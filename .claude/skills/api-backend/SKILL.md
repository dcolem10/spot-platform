---
name: api-backend
description: "REST API design, Lambda handlers, DynamoDB schema design, and backend architecture for serverless Node.js applications. Use this skill when the user asks about creating API endpoints, writing Lambda functions, designing database schemas, handling authentication, webhooks, data validation, error handling, or backend business logic. Also trigger when working with template.yaml, Lambda code, DynamoDB access patterns, Stripe integration, or any server-side code. Trigger for questions about API design, request/response formats, middleware patterns, or backend security."
---

# API & Backend Development Skill

> **Business context:** Before adding endpoints or changing business logic, consult `.claude/skills/business-context/SKILL.md` for Spot's mission, revenue model, and the "nobody gets exploited" philosophy. See also `references/security-posture.md` for current security controls.

You are a backend architect specializing in serverless Node.js APIs on AWS. The user is early-career, so write production-quality code with clear comments and explain architectural trade-offs.

## Stack

- **Runtime**: Node.js 20.x (ES modules)
- **Framework**: Raw Lambda handlers (no Express/Fastify — keep it lean)
- **Database**: DynamoDB (single-table design)
- **Auth**: Cognito JWT validation via API Gateway authorizer
- **Payments**: Stripe (Checkout Sessions, Webhooks, Customer Portal)
- **Secrets**: AWS Secrets Manager (Stripe keys, webhook secrets)
- **IaC**: AWS SAM (`template.yaml`)

## Project Structure

```
backend/
  lambda-api/
    index.mjs          # Main API handler (event router)
    package.json
  template.yaml         # SAM template defining all resources
```

## Lambda Handler Pattern

Every API handler follows this structure:

```javascript
// Clean handler pattern — thin routing, business logic separated
export const handler = async (event) => {
  const { httpMethod, path, body, requestContext } = event;
  const userId = requestContext?.authorizer?.claims?.sub;

  try {
    // Route to handler
    if (httpMethod === 'GET' && path === '/api/campaigns') {
      return await getCampaigns(userId);
    }
    if (httpMethod === 'POST' && path === '/api/campaigns') {
      return await createCampaign(userId, JSON.parse(body));
    }

    return response(404, { error: 'Not found' });
  } catch (err) {
    console.error('Handler error:', err);
    return response(500, { error: 'Internal server error' }); // Never leak stack traces
  }
};

// Standard response helper
function response(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    },
    body: JSON.stringify(body),
  };
}
```

## DynamoDB Single-Table Design

Use composite keys to store multiple entity types in one table:

```
PK                    SK                      Entity
USER#<userId>         PROFILE                 User profile
USER#<userId>         CAMPAIGN#<campaignId>   Campaign
USER#<userId>         OFFER#<offerId>         Offer
RESTAURANT#<id>       META                    Restaurant metadata
RESTAURANT#<id>       CAMPAIGN#<campaignId>   Restaurant's campaign view
```

**Access pattern rules**:
- Design keys around your query patterns, not your data model
- Use `begins_with(SK, ...)` for range queries within a partition
- Add GSIs only when you need to query by a different key
- Use conditional writes (`ConditionExpression`) for idempotency
- Set TTL on ephemeral records (sessions, rate limits, temporary tokens)

**DynamoDB SDK patterns**:
```javascript
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';

const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = process.env.TABLE_NAME;

// Query all campaigns for a user
async function getCampaigns(userId) {
  const result = await client.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':sk': 'CAMPAIGN#',
    },
  }));
  return response(200, { campaigns: result.Items });
}

// Idempotent create
async function createCampaign(userId, data) {
  const id = crypto.randomUUID();
  await client.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `USER#${userId}`,
      SK: `CAMPAIGN#${id}`,
      campaignId: id,
      ...data,
      createdAt: new Date().toISOString(),
      status: 'inquiry',
    },
    ConditionExpression: 'attribute_not_exists(PK)', // Prevent overwrites
  }));
  return response(201, { campaignId: id, status: 'success' });
}
```

## Input Validation

Validate all input at the API boundary. Never trust client data:

```javascript
function validateCampaign(data) {
  const errors = [];
  if (!data.restaurantName?.trim()) errors.push('restaurantName is required');
  if (!data.budget || data.budget < 0) errors.push('budget must be positive');
  if (data.packageType && !['spotlight','feature','series','takeover','custom'].includes(data.packageType)) {
    errors.push('invalid packageType');
  }
  return errors;
}

// In handler:
const errors = validateCampaign(data);
if (errors.length) return response(400, { error: 'Validation failed', details: errors });
```

## Stripe Integration

**Checkout Sessions** (creating subscriptions):
```javascript
const session = await stripe.checkout.sessions.create({
  customer_email: userEmail,
  mode: 'subscription',
  line_items: [{ price: priceId, quantity: 1 }],
  success_url: `${frontendUrl}/app/dashboard?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${frontendUrl}/pricing`,
  metadata: { userId },
});
```

**Webhook handling** (always verify signatures):
```javascript
const sig = event.headers['stripe-signature'];
const endpointSecret = await getSecret('stripe-webhook-secret');
const stripeEvent = stripe.webhooks.constructEvent(body, sig, endpointSecret);

switch (stripeEvent.type) {
  case 'checkout.session.completed':
    await activateSubscription(stripeEvent.data.object);
    break;
  case 'customer.subscription.deleted':
    await deactivateSubscription(stripeEvent.data.object);
    break;
}
```

## Error Handling Rules

1. **Never return raw errors to clients** — log the full error, return a sanitized message
2. **Use HTTP status codes correctly**: 400 (bad input), 401 (not authenticated), 403 (not authorized), 404 (not found), 409 (conflict/duplicate), 429 (rate limited), 500 (server error)
3. **Consistent error format**: `{ "error": "message", "details": [...] }`
4. **Idempotency**: POST endpoints should use conditional writes to prevent duplicate creates
5. **Timeouts**: Set Lambda timeout to 10s for API handlers, return 504 if downstream services are slow

## Security Rules

- Secrets from Secrets Manager only — never environment variables for sensitive values
- Validate Cognito JWT `sub` claim matches the requested resource's owner
- Rate limit sensitive endpoints (login, signup, password reset)
- Sanitize all user input before storing in DynamoDB
- Use HTTPS-only for all external API calls
- Never log sensitive data (tokens, passwords, PII beyond userId)
