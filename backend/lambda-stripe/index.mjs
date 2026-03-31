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
// ─── Dynamic CORS — supports multiple origins (dev + prod simultaneously) ────
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
);
if (!ALLOWED_ORIGINS.size) console.warn('No allowed origins configured — CORS will block all cross-origin requests');

function setRequestOrigin(event) {
  const reqOrigin = event?.headers?.origin || event?.headers?.Origin || '';
  headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS.has(reqOrigin)
    ? reqOrigin
    : ([...ALLOWED_ORIGINS][0] || '');
}

// ─── Secrets (cached with TTL for key rotation support) ──────────────────────
let _secrets = null;
let _secretsLoadedAt = 0;
const SECRETS_CACHE_TTL = 300 * 1000; // 5 minutes (shorter for financial operations)

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
  // H25: Fail fast if Stripe secret key is missing — prevents silent initialization with undefined key
  if (!secrets.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured — cannot initialize Stripe client');
  }
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

// Allowed price IDs — read from env vars so production IDs can be configured
// without code changes. Set STRIPE_PRICE_STARTER, STRIPE_PRICE_PRO, STRIPE_PRICE_SCALE
// in Lambda env vars for each environment (test vs live Stripe account).
const ALLOWED_PRICES = new Set([
  process.env.STRIPE_PRICE_STARTER || 'price_1T7lCIJob49CLLyGuvtIIKgP', // Spot Starter — $49/mo
  process.env.STRIPE_PRICE_PRO     || 'price_1T7lCiJob49CLLyG7vfdi7kq', // Spot Pro — $99/mo
  process.env.STRIPE_PRICE_SCALE   || 'price_1T7lKHJob49CLLyGajlRXAsr', // Spot Scale — $149/mo
].filter(Boolean));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': [...ALLOWED_ORIGINS][0] || '',
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
 * Creates a Stripe Checkout session for a creator subscription (Starter/Pro/Scale).
 * Restaurants join free — this endpoint is creator-only.
 * Authenticated endpoint.
 * Body: { priceId }
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

  const { priceId } = body;

  if (!priceId || typeof priceId !== 'string') {
    return respond(400, { error: 'Missing or invalid priceId' });
  }

  // Validate priceId is in allowed list
  if (!ALLOWED_PRICES.has(priceId)) {
    return respond(400, { error: 'Invalid price ID' });
  }

  try {
    // Create Stripe checkout session for the authenticated creator
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
    // H26: Fail if webhook secret is missing — prevents signature bypass when Secrets Manager is unavailable
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not available — rejecting webhook to prevent unsigned event processing');
      return respond(503, { error: 'Webhook processing temporarily unavailable' });
    }
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
 * Creates creator subscription record in DynamoDB.
 * Restaurants join free — subscriptions belong to creators only.
 */
async function handleCheckoutSessionCompleted(session) {
  const userId = session.metadata?.userId;
  if (!userId) {
    console.warn('Checkout session missing userId metadata');
    return;
  }

  try {
    // Get subscription details
    const stripeClient = await getStripe();
    const subscription = await stripeClient.subscriptions.retrieve(session.subscription);

    const now = new Date().toISOString();

    // Write subscription to DynamoDB under the creator's record
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `CREATOR#${userId}`,
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

    console.log(`Subscription created for creator ${userId}`);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      console.log(`Subscription already exists for creator ${userId}`);
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
 * Returns the authenticated creator's subscription status.
 * Restaurants join free and have no subscription.
 */
async function getSubscription(event) {
  const userId = getUserId(event);
  if (!userId) {
    return respond(401, { error: 'Unauthorized' });
  }

  try {
    // Get the creator's subscription directly by userId
    const subRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `CREATOR#${userId}`, SK: 'SUBSCRIPTION' },
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
 * Creates a Stripe Customer Portal session for the authenticated creator.
 * Restaurants join free and have no billing portal.
 * Returns: { url }
 */
async function createPortalSession(event) {
  const userId = getUserId(event);
  if (!userId) {
    return respond(401, { error: 'Unauthorized' });
  }

  try {
    // Get the creator's subscription to retrieve Stripe customer ID
    const subRes = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `CREATOR#${userId}`, SK: 'SUBSCRIPTION' },
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
  setRequestOrigin(event); // Dynamic CORS — match request origin against allowed list
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
