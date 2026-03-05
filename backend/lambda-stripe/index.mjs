import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import Stripe from 'stripe';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const smClient = new SecretsManagerClient({});
const TABLE = process.env.TABLE_NAME;
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ─── Secrets (cached with TTL for key rotation support) ──────────────────────
let _secrets = null;
let _secretsLoadedAt = 0;
const SECRETS_CACHE_TTL = 3600 * 1000; // 1 hour

async function getSecrets() {
  const now = Date.now();
  if (_secrets && (now - _secretsLoadedAt < SECRETS_CACHE_TTL)) return _secrets;
  const arn = process.env.SECRETS_ARN;
  if (!arn) { console.warn('SECRETS_ARN not configured'); return {}; }
  try {
    const { SecretString } = await smClient.send(
      new GetSecretValueCommand({ SecretId: arn })
    );
    _secrets = JSON.parse(SecretString);
    _secretsLoadedAt = now;
    return _secrets;
  } catch (err) {
    const code = err.name || err.code || 'Unknown';
    console.error(`Secrets Manager error [${code}]: ${err.message}`);
    if (code === 'AccessDeniedException') console.error('IAM policy missing secretsmanager:GetSecretValue');
    if (code === 'ResourceNotFoundException') console.error('Secret ARN does not exist');
    // Return stale cache if available (critical for financial operations)
    if (_secrets) { console.warn('Using stale cached secrets'); return _secrets; }
    return {};
  }
}

let _stripe = null;
async function getStripe() {
  if (_stripe) return _stripe;
  const secrets = await getSecrets();
  _stripe = new Stripe(secrets.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
    timeout: 10000,
  });
  return _stripe;
}

async function getWebhookSecret() {
  const secrets = await getSecrets();
  return secrets.STRIPE_WEBHOOK_SECRET;
}

// Allowed price IDs — hardcoded to prevent abuse (max 3)
const ALLOWED_PRICES = new Set([
  'price_1QqhR2HHGM8mRhx2j9Q8kL2m', // Example: starter plan
  'price_1QqhR2HHGM8mRhx2n5R9mN3o', // Example: pro plan
  'price_1QqhR2HHGM8mRhx2p7T1oP5q', // Example: enterprise plan
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

function getUserId(event) {
  return event.requestContext?.authorizer?.claims?.sub || null;
}

const isValidId = (id) =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);

// ─── API Handlers ─────────────────────────────────────────────────────────────

/**
 * POST /api/stripe/create-checkout-session
 * Creates a Stripe Checkout session for restaurant subscription.
 * Authenticated endpoint.
 * Body: { priceId, restaurantId }
 * Returns: { sessionId, url }
 */
async function createCheckoutSession(event) {
  const userId = getUserId(event);
  if (!userId) {
    return respond(401, { error: 'Unauthorized' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const { priceId, restaurantId } = body;

  if (!priceId || typeof priceId !== 'string') {
    return respond(400, { error: 'Missing or invalid priceId' });
  }

  if (!restaurantId || !isValidId(restaurantId)) {
    return respond(400, { error: 'Missing or invalid restaurantId' });
  }

  // Validate priceId is in allowed list
  if (!ALLOWED_PRICES.has(priceId)) {
    return respond(400, { error: 'Invalid price ID' });
  }

  try {
    // Verify restaurant exists and user owns it
    const restaurantRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'METADATA' },
      })
    );

    if (!restaurantRes.Item || restaurantRes.Item.creatorId !== userId) {
      return respond(403, { error: 'Forbidden' });
    }

    // Create Stripe checkout session
    const stripeClient = await getStripe();
    const session = await stripeClient.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${ORIGIN}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${ORIGIN}/billing`,
      metadata: {
        restaurantId,
        userId,
      },
    });

    return respond(200, {
      sessionId: session.id,
      url: session.url,
    });
  } catch (err) {
    console.error('Stripe checkout error:', err.message);
    return respond(500, { error: 'Failed to create checkout session' });
  }
}

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhooks (public, no auth).
 * Verifies webhook signature and processes events.
 */
async function handleWebhook(event) {
  // Stripe requires raw body for signature verification
  const rawBody = event.body;
  const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];

  if (!rawBody || !sig) {
    return respond(400, { error: 'Missing signature or body' });
  }

  let stripeEvent;
  try {
    const stripeClient = await getStripe();
    const webhookSecret = await getWebhookSecret();
    stripeEvent = stripeClient.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return respond(400, { error: 'Invalid signature' });
  }

  // ─── Idempotency Check ───────────────────────────────────────────────────
  // Prevent duplicate processing of the same Stripe event.
  // Uses DynamoDB conditional write + 30-day TTL for automatic cleanup.
  const eventId = stripeEvent.id;
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `WEBHOOK#${eventId}`,
          SK: 'EVENT',
          eventType: stripeEvent.type,
          processedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60, // 30-day TTL
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.log(`Duplicate webhook skipped: ${eventId}`);
      return respond(200, { received: true, duplicate: true });
    }
    // Fail CLOSED: if idempotency check fails, reject the webhook.
    // Stripe will retry, and we avoid processing duplicates.
    console.error(`Idempotency check failed (fail-closed): ${err.name} ${err.message}`);
    return respond(500, { error: 'Webhook processing temporarily unavailable' });
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(stripeEvent.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(stripeEvent.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(stripeEvent.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(stripeEvent.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return respond(200, { received: true });
  } catch (err) {
    console.error('Webhook processing error:', err.message);
    return respond(500, { error: 'Webhook processing failed' });
  }
}

/**
 * Webhook handler: checkout.session.completed
 * Creates subscription record in DynamoDB.
 */
async function handleCheckoutSessionCompleted(session) {
  const restaurantId = session.metadata?.restaurantId;
  if (!restaurantId) {
    console.warn('Checkout session missing restaurantId metadata');
    return;
  }

  try {
    // Get subscription details
    const stripeClient = await getStripe();
    const subscription = await stripeClient.subscriptions.retrieve(session.subscription);

    const now = new Date().toISOString();

    // Write subscription to DynamoDB with conditional write to prevent duplicates
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `RESTAURANT#${restaurantId}`,
          SK: 'SUBSCRIPTION',
          GSI1PK: 'SUBSCRIPTIONS',
          GSI1SK: `SUBSCRIPTION#${subscription.id}`,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: subscription.id,
          priceId: subscription.items.data[0].price.id,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000).toISOString(),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000).toISOString(),
          createdAt: now,
          updatedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );

    console.log(`Subscription created for restaurant ${restaurantId}`);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.log(`Subscription already exists for restaurant ${restaurantId}`);
    } else {
      console.error('Error handling checkout completion:', err.message);
      throw err;
    }
  }
}

/**
 * Webhook handler: customer.subscription.updated
 * Updates subscription record in DynamoDB.
 */
async function handleSubscriptionUpdated(subscription) {
  try {
    // Query for subscription by GSI
    const queryRes = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'SUBSCRIPTIONS',
          ':sk': `SUBSCRIPTION#${subscription.id}`,
        },
        Limit: 1,
      })
    );

    if (!queryRes.Items || queryRes.Items.length === 0) {
      console.warn(`Subscription ${subscription.id} not found in DynamoDB`);
      return;
    }

    const item = queryRes.Items[0];

    // Update subscription status
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression:
          'SET #status = :status, currentPeriodStart = :start, currentPeriodEnd = :end, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': subscription.status,
          ':start': new Date(subscription.current_period_start * 1000).toISOString(),
          ':end': new Date(subscription.current_period_end * 1000).toISOString(),
          ':now': new Date().toISOString(),
        },
      })
    );

    console.log(`Subscription ${subscription.id} updated`);
  } catch (err) {
    console.error('Error handling subscription update:', err.message);
    throw err;
  }
}

/**
 * Webhook handler: customer.subscription.deleted
 * Marks subscription as canceled in DynamoDB.
 */
async function handleSubscriptionDeleted(subscription) {
  try {
    // Query for subscription by GSI
    const queryRes = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
        ExpressionAttributeValues: {
          ':pk': 'SUBSCRIPTIONS',
          ':sk': `SUBSCRIPTION#${subscription.id}`,
        },
        Limit: 1,
      })
    );

    if (!queryRes.Items || queryRes.Items.length === 0) {
      console.warn(`Subscription ${subscription.id} not found in DynamoDB`);
      return;
    }

    const item = queryRes.Items[0];

    // Mark subscription as canceled
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: 'SET #status = :status, canceledAt = :now, updatedAt = :now',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': 'canceled',
          ':now': new Date().toISOString(),
        },
      })
    );

    console.log(`Subscription ${subscription.id} canceled`);
  } catch (err) {
    console.error('Error handling subscription deletion:', err.message);
    throw err;
  }
}

/**
 * Webhook handler: invoice.payment_failed
 * Logs payment failure for monitoring.
 */
async function handleInvoicePaymentFailed(invoice) {
  console.warn(
    `Payment failed for invoice ${invoice.id}, subscription ${invoice.subscription}`
  );
  // Implement notification/alerting logic here if needed
}

/**
 * GET /api/stripe/subscription
 * Returns subscription status for a restaurant (authenticated).
 * Query params: restaurantId
 */
async function getSubscription(event) {
  const userId = getUserId(event);
  if (!userId) {
    return respond(401, { error: 'Unauthorized' });
  }

  const params = event.queryStringParameters || {};
  const restaurantId = params.restaurantId;

  if (!restaurantId || !isValidId(restaurantId)) {
    return respond(400, { error: 'Missing or invalid restaurantId' });
  }

  try {
    // Verify user owns the restaurant
    const restaurantRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'METADATA' },
      })
    );

    if (!restaurantRes.Item || restaurantRes.Item.creatorId !== userId) {
      return respond(403, { error: 'Forbidden' });
    }

    // Get subscription
    const subRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'SUBSCRIPTION' },
      })
    );

    if (!subRes.Item) {
      return respond(404, { error: 'No active subscription' });
    }

    // Strip sensitive fields
    const subscription = { ...subRes.Item };
    delete subscription.stripeCustomerId;
    delete subscription.stripeSubscriptionId;

    return respond(200, subscription);
  } catch (err) {
    console.error('Error fetching subscription:', err.message);
    return respond(500, { error: 'Failed to fetch subscription' });
  }
}

/**
 * POST /api/stripe/create-portal-session
 * Creates a Stripe Customer Portal session (authenticated).
 * Body: { restaurantId }
 * Returns: { url }
 */
async function createPortalSession(event) {
  const userId = getUserId(event);
  if (!userId) {
    return respond(401, { error: 'Unauthorized' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return respond(400, { error: 'Invalid JSON body' });
  }

  const { restaurantId } = body;

  if (!restaurantId || !isValidId(restaurantId)) {
    return respond(400, { error: 'Missing or invalid restaurantId' });
  }

  try {
    // Verify user owns the restaurant
    const restaurantRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'METADATA' },
      })
    );

    if (!restaurantRes.Item || restaurantRes.Item.creatorId !== userId) {
      return respond(403, { error: 'Forbidden' });
    }

    // Get subscription to get Stripe customer ID
    const subRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'SUBSCRIPTION' },
      })
    );

    if (!subRes.Item || !subRes.Item.stripeCustomerId) {
      return respond(404, { error: 'No active subscription' });
    }

    // Create portal session
    const stripeClient = await getStripe();
    const portalSession = await stripeClient.billingPortal.sessions.create({
      customer: subRes.Item.stripeCustomerId,
      return_url: `${ORIGIN}/dashboard`,
    });

    return respond(200, {
      url: portalSession.url,
    });
  } catch (err) {
    console.error('Stripe portal error:', err.message);
    return respond(500, { error: 'Failed to create portal session' });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const path = event.path || event.rawPath || '';
  const method = event.httpMethod || event.requestContext?.http?.method || 'GET';

  // CORS preflight
  if (method === 'OPTIONS') {
    return respond(200, {});
  }

  // Route requests
  if (path === '/api/stripe/create-checkout-session' && method === 'POST') {
    return createCheckoutSession(event);
  }

  if (path === '/api/stripe/webhook' && method === 'POST') {
    return handleWebhook(event);
  }

  if (path === '/api/stripe/subscription' && method === 'GET') {
    return getSubscription(event);
  }

  if (path === '/api/stripe/create-portal-session' && method === 'POST') {
    return createPortalSession(event);
  }

  return respond(404, { error: 'Not found' });
};
