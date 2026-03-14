# Backend — Claude Context Guide

## Lambda Architecture

All Lambdas use Node.js 20 with ES modules (.mjs). Single-handler pattern — each Lambda has one `export const handler` that routes internally by path and method.

### Lambda Functions

| Function | Name | Purpose | Timeout |
|----------|------|---------|---------|
| lambda-api | spot-api-dev | All business logic (5600+ lines) | 15s |
| lambda-ai | spot-ai-dev | AI insights via Anthropic | 60s |
| lambda-stripe | spot-stripe-dev | Payments & subscriptions | 30s |
| lambda-email | spot-email-dev | SES email delivery | 10s |
| lambda-sync | spot-sync-dev | POS redemption sync | 300s |
| lambda-lifecycle | spot-lifecycle-dev | Scheduled cleanup | 120s |
| lambda-ses-handler | spot-ses-handler-dev | Bounce/complaint handling | 10s |

### Response Pattern

Every Lambda response must include CORS and security headers:

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': dynamicOrigin, // Set by setRequestOrigin(event)
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
};
```

### CORS — Dynamic Multi-Origin

Each Lambda parses `ALLOWED_ORIGINS` env var (comma-separated), checks the request's `Origin` header, and returns the matching origin. Set at the top of every handler via `setRequestOrigin(event)`.

```javascript
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
);

function setRequestOrigin(event) {
  const reqOrigin = event?.headers?.origin || event?.headers?.Origin || '';
  headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS.has(reqOrigin)
    ? reqOrigin : ([...ALLOWED_ORIGINS][0] || '');
}
```

### Auth Pattern

```javascript
function getUserId(event) {
  return event.requestContext?.authorizer?.claims?.sub || null;
}

// In every mutation handler:
const userId = getUserId(event);
if (!userId) return respond(401, { error: 'Unauthorized' });
```

### Secrets Manager (Cached)

```javascript
let _secrets = null;
let _secretsLoadedAt = 0;
const SECRETS_CACHE_TTL = 300 * 1000; // 5 minutes

async function getSecrets() {
  const now = Date.now();
  if (_secrets && (now - _secretsLoadedAt < SECRETS_CACHE_TTL)) return _secrets;
  // ... fetch from Secrets Manager, cache result
}
```

## DynamoDB Single-Table Design

Table: `spot-data-dev` | Billing: PAY_PER_REQUEST | Point-in-time recovery: enabled

### Primary Key Patterns

```
PK: RESTAURANT#{restaurantId}     SK: PROFILE
PK: RESTAURANT#{restaurantId}     SK: CAMPAIGN#{campaignId}
PK: RESTAURANT#{restaurantId}     SK: OFFER#{offerId}
PK: RESTAURANT#{restaurantId}     SK: POS_CONNECTION#{provider}
PK: CREATOR#{userId}              SK: CAMPAIGN#{campaignId}
PK: CREATOR#{userId}              SK: OFFER#{offerId}
PK: CREATOR#{userId}              SK: PROPOSAL#{proposalId}
PK: CREATOR#{userId}              SK: RAFFLE#{raffleId}
PK: CREATOR#{userId}              SK: CONTENT_REVIEW#{reviewId}
PK: CREATOR#{userId}              SK: NOTIFICATION#{notificationId}
PK: OFFER_CODE#{code}             SK: LOOKUP
PK: RATE#{ip}#{window}            SK: WIN#{key}
```

### GSI Patterns

```
GSI1PK: RESTAURANTS                       GSI1SK: CITY#{city}#{name}
GSI1PK: CREATOR#{userId}#RESTAURANTS      GSI1SK: RESTAURANT#{id}
GSI1PK: CREATOR#{userId}#CAMPAIGNS        GSI1SK: CAMPAIGN#{id}
GSI1PK: CREATOR#{userId}#OFFERS           GSI1SK: OFFER#{id}
GSI1PK: RESTAURANT#{id}#CONTENT_REVIEWS   GSI1SK: submitted#{createdAt}

GSI2PK: RAFFLE                            GSI2SK: ACTIVE | DRAWN | CLOSED
```

### Data Security

Always strip internal keys before returning to client:

```javascript
function stripDdbKeys(item) {
  const { PK, SK, GSI1PK, GSI1SK, GSI2PK, GSI2SK, GSI3PK, GSI3SK,
          creatorId, posOAuthTokens, apiKeys, ...safe } = item;
  return safe;
}
```

## API Routes Reference

### Restaurants
- `GET /api/restaurants` — public, paginated, filterable
- `POST /api/restaurants` — auth required, creates restaurant + links to creator
- `GET /api/restaurants/:id` — public
- `PUT /api/restaurants/:id` — auth required, ownership check
- `GET /api/my/restaurants` — auth required, creator's own

### Campaigns
- `GET /api/campaigns` — creator's campaigns
- `POST /api/campaigns` — create campaign (must own restaurant)
- `PUT /api/campaigns/:id` — update
- `POST /api/campaigns/:id/archive` — soft delete
- `POST /api/campaigns/:id/restore` — unarchive

### Offers (QR/Promo/Link Codes)
- `POST /api/restaurants/:id/offers` — create offer
- `GET /api/offers/:code/scan` — public, tracks scan (rate-limited)
- `POST /api/offers/:code/redeem` — public, redeems offer

### Proposals (Handshake Model)
- `POST /api/proposals` — create (either side can initiate)
- `GET /api/proposals/inbox` — received proposals
- `GET /api/proposals/sent` — sent proposals
- `PUT /api/proposals/:id/accept|counter|decline`
- `POST /api/proposals/:id/message` — threaded messages

### Content Reviews
- `POST /api/content-reviews` — creator initiates
- `PUT /api/content-reviews/:id/submit` — submit draft
- `PUT /api/content-reviews/:id/approve|reject|request-revision` — restaurant actions

### POS Integration
- `POST /api/pos/connect/square|clover` — initiate OAuth
- `GET /api/pos/callback/square|clover` — OAuth callback
- `GET /api/pos/status` — connection status
- `POST /api/pos/sync` — sync redemption data (dev mode only currently)

### SpotOps (Creator Tools)
- `GET /api/spotops/pipeline` — partnership pipeline
- `GET|POST|PUT|DELETE /api/spotops/calendar` — editorial calendar

## POS Integration

### Credentials (Lambda env vars)
- Square: `SQUARE_APP_ID`, `SQUARE_APP_SECRET`, `SQUARE_ENVIRONMENT=sandbox`
- Clover: `CLOVER_APP_ID`, `CLOVER_APP_SECRET`, `CLOVER_ENVIRONMENT=sandbox`
- Toast: pending partner approval

### Token Storage
OAuth tokens encrypted with KMS before storing in DynamoDB:
```
PK: RESTAURANT#{id}  SK: POS_CONNECTION#{provider}
```

## Deployment

### Current workaround (CloudFormation hook blocking sam deploy):
```bash
cd backend && sam build
cd .aws-sam/build/ApiFunction && zip -r /tmp/api.zip .
aws lambda update-function-code --function-name spot-api-dev --zip-file fileb:///tmp/api.zip --region us-east-1
```

### Env var update (replaces entire block):
```bash
aws lambda update-function-configuration --function-name spot-api-dev \
  --environment 'Variables={TABLE_NAME=spot-data-dev,...ALL OTHER VARS...}' \
  --region us-east-1
```

### Current API Lambda env vars:
- TABLE_NAME=spot-data-dev
- POS_KMS_KEY_ID=arn:aws:kms:us-east-1:827235146020:key/48905979-...
- SECRETS_ARN=arn:aws:secretsmanager:us-east-1:827235146020:secret:spot/api-keys-dev-abc123
- SES_FROM_EMAIL=networth589@gmail.com
- ALLOWED_ORIGIN=https://main.dc04hhpr1ng78.amplifyapp.com
- ALLOWED_ORIGINS=https://main.dc04hhpr1ng78.amplifyapp.com,http://localhost:5173,https://spot-platform.com
- LOG_LEVEL=info
- SQUARE_APP_ID, SQUARE_APP_SECRET, SQUARE_ENVIRONMENT=sandbox
- CLOVER_APP_ID, CLOVER_APP_SECRET, CLOVER_ENVIRONMENT=sandbox
