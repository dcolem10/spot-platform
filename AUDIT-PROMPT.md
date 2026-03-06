# Spot Platform — Security & Architecture Audit Prompt

Paste the following prompt into another LLM (Claude, GPT, etc.) to get a comprehensive audit of the Spot Platform. You can attach specific source files for deeper analysis.

---

## PROMPT START

You are a senior security engineer and software architect performing a comprehensive audit of **Spot Platform** — a creator-first restaurant attribution SaaS built for food influencers in Washington, DC. The platform lets creators manage restaurant partnerships, track ROI on sponsored content, generate QR-code offers for their audience, and get paid based on measurable attribution.

Your job is to identify **faults, shortcomings, security vulnerabilities, performance issues, and architectural risks** across the full stack. Be specific — cite the exact layer, endpoint, or pattern where each issue exists, rate severity (Critical / High / Medium / Low / Info), and provide a concrete fix.

---

## ARCHITECTURE OVERVIEW

### Tech Stack
- **Frontend**: React 18 + TypeScript + Vite 6, TanStack Query, Zustand, Chart.js
- **Auth**: AWS Cognito User Pool (email/password, custom attributes for role/orgId)
- **API Layer**: API Gateway (REST) with Cognito authorizer → AWS Lambda (Node.js 20, ES modules)
- **Database**: DynamoDB single-table design (PAY_PER_REQUEST, PITR enabled, TTL enabled)
- **Payments**: Stripe Checkout + Customer Portal + Webhooks (signature-verified, idempotent)
- **AI**: Anthropic Claude API for creator insights (separate Lambda, 60s timeout)
- **Email**: Amazon SES (currently in sandbox — only verified recipients)
- **Secrets**: AWS Secrets Manager (Stripe keys, Anthropic key, Google Places key)
- **Hosting**: AWS Amplify (frontend) with custom security headers
- **Monitoring**: CloudWatch alarms on API errors, AI errors, Stripe errors, DynamoDB throttle, budget ($50/mo alert)

### Data Flow
```
Browser → Amplify CDN → React SPA
React → fetchAuthSession() → Cognito ID Token
React → API Gateway (Authorization: Bearer <idToken>) → Cognito Authorizer
API Gateway → Lambda (event.requestContext.authorizer.claims.sub = userId)
Lambda → DynamoDB (single-table, composite keys: PK + SK, GSI1)
Lambda → Secrets Manager (cached 1hr API / 5min Stripe)
Lambda → Stripe API / Google Places API / Anthropic API
```

---

## AUTHENTICATION & AUTHORIZATION

### Cognito Setup
- User Pool with email/password auth
- Custom attributes: `custom:role` (creator | partner | audience), `custom:orgId`
- ID token claims extracted in Lambda: `sub`, `email`, `name`, `custom:role`, `cognito:groups`, `custom:orgId`

### Backend Auth Pattern
```javascript
function getUserId(event) {
  return event.requestContext?.authorizer?.claims?.sub || null;
}
// Every protected endpoint:
const userId = getUserId(event);
if (!userId) return respond(401, { error: 'Unauthorized' });
```
- No header-based auth fallback — only Cognito claims trusted
- No API keys, no service accounts

### Frontend Auth
- Zustand store holds auth state (userId, email, name, role, groups, orgId, isDemoMode)
- `useAuthInit` hook: tries real Cognito session first, falls back to demo mode if `VITE_DEMO_MODE=true`
- Demo mode is **frontend-only** — sets fake userId `demo-user`, no backend equivalent
- API client attaches ID token via `fetchAuthSession()` on every non-public request

### Demo Mode
- Three entry points set demo state: LandingPage "Try Demo", AuthPage "Try Demo Mode", auto-init if `VITE_DEMO_MODE=true`
- Demo user: `{ userId: 'demo-user', email: 'demo@spot.app', role: 'creator', groups: ['creator'] }`
- All feature components check `isDemoMode()` and return hardcoded demo data without calling the API
- Route guard: `RequireAuth` allows access if `isAuthenticated || isDemoMode`

---

## API ENDPOINTS (31 routes)

### Public (no auth required):
| Method | Path | Rate Limited | Notes |
|--------|------|:---:|-------|
| GET | `/api/health` | No | Health check |
| GET | `/api/restaurants` | No | Paginated list |
| GET | `/api/restaurants/{id}` | No | Detail |
| GET | `/api/restaurants/{id}/google-details` | No | Proxies Google Places API |
| GET | `/api/offers/{id}/scan` | Yes (30/5min/IP) | Tracks QR scan |
| POST | `/api/offers/{id}/redeem` | Yes | Redeems offer |
| GET | `/api/insider/deals` | No | Static deal list |
| POST | `/api/insider/deals/{id}/redeem` | No | Tracks deal redemption |
| POST | `/api/subscribe` | No | Email list signup |
| POST | `/api/unsubscribe` | No | Email list removal |
| POST | `/api/stripe/webhook` | No | Stripe signature verified |

### Protected (Cognito auth required):
- Restaurants: `POST /api/restaurants`, `GET /api/my/restaurants`, `PUT /api/restaurants/{id}`
- Campaigns: `GET/POST /api/campaigns`, `PUT /api/campaigns/{id}`, archive/restore
- Offers: `POST /api/restaurants/{id}/offers`, `GET /api/partner/offers`
- SpotOps: `GET /api/spotops/pipeline`, `GET /api/spotops/campaigns`
- Saves: `POST/GET/DELETE/PUT` save operations
- Profile: `GET/POST /api/profile`
- Reports: `POST /api/reports/roi-calculate`, `GET /api/reports/benchmarks`
- Ambassador: generate-link, track-referral, status, referrals
- Collaborations: invite, list, respond, remove collaborators
- Stripe: create-checkout-session, subscription status, create-portal-session

---

## INPUT VALIDATION

```javascript
// String sanitization — trims + truncates
function sanitize(s, max = 500) { return typeof s === 'string' ? s.trim().slice(0, max) : ''; }

// ID format — alphanumeric + dash + underscore, 1-64 chars
function isValidId(id) { return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id); }

// Request body — safe JSON parse, returns null on failure
function parseBody(event) { try { return JSON.parse(event.body); } catch { return null; } }

// Global body size limit: 100 KB
if (event.body && event.body.length > 102400) return respond(413, { error: 'Request body too large' });

// Pagination key validation: base64 decode, max 4 DynamoDB attributes
function decodePaginationKey(encoded) { ... }
```

### Rate Limiting (public endpoints only):
- 30 requests per 5-minute window per IP
- Tracked via DynamoDB: `PK: RATE#IP#{ip}`, with TTL
- **Fail-closed**: if DynamoDB check fails, request is rejected

---

## SECURITY HEADERS

### Amplify (CDN):
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.amazonaws.com https://*.amazoncognito.com
```

### Lambda Response Headers:
```
Content-Type: application/json
Access-Control-Allow-Origin: <single configured origin>
Access-Control-Allow-Headers: Content-Type,Authorization
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## STRIPE INTEGRATION

- Price ID whitelist: 3 hardcoded price IDs validated before checkout
- Webhook: signature verified via `stripe.webhooks.constructEvent()`
- Idempotency: DynamoDB conditional write with 30-day TTL prevents duplicate processing
- Restaurant ownership: verified (`creatorId === userId`) before creating checkout sessions
- Sensitive fields stripped from subscription responses
- API version pinned: `2024-12-18.acacia`

---

## DYNAMODB DATA MODEL

Single-table design with composite keys:
- **PK**: `RESTAURANT#{id}`, `CAMPAIGN#{id}`, `OFFER#{id}`, `USER#{userId}`, `RATE#IP#{ip}`, `WEBHOOK#{eventId}`
- **SK**: `METADATA`, `PROFILE`, `SUBSCRIPTION`, `OFFER#{id}`, etc.
- **GSI1**: `GSI1PK` + `GSI1SK` for cross-entity queries (creator's restaurants, all subscriptions, restaurant offers)
- Response helper `stripDdbKeys()` removes PK, SK, GSI keys before returning to client

---

## INFRASTRUCTURE

### Lambda Functions (6):
| Function | Timeout | Memory | Purpose |
|----------|---------|--------|---------|
| spot-api | 15s | 512MB | Main API handler (31 routes) |
| spot-ai | 60s | 512MB | AI insights (Anthropic API) |
| spot-sync | 300s | 1024MB | Daily data sync |
| spot-stripe | 30s | 256MB | Payment processing |
| spot-lifecycle | 120s | 512MB | Email scheduling (daily) |
| spot-email | 10s | 256MB | SES email sender |

### API Gateway:
- Throttling: 50 burst / 20 sustained req/sec
- Single Cognito authorizer
- CORS: single-origin

### Monitoring:
- API error alarm: >5 errors
- AI error alarm: >3 errors
- Stripe error alarm: >2 errors
- DynamoDB throttle alarm: >0 events
- AI invocation limit: 1000/day
- Budget alarm: $50/month

---

## KNOWN GAPS (from internal SRE review)

1. **Single IAM role** shared across all 6 Lambdas (should be separate per-function roles with least privilege)
2. **SES still in sandbox** — can only send to verified email addresses
3. **No pagination limits** enforced on `listDeals`, `listSaves`, `getCreatorActivity`
4. **Dashboard trend calculations** use placeholder values when data is non-zero
5. **`fast-xml-parser` CVE** flagged in dependency audit (used transitively)
6. **No WAF** in front of API Gateway
7. **CORS origin** is a single value — no support for multiple legitimate origins (e.g., preview deployments)

---

## AUDIT SCOPE

Please analyze the following areas and provide findings organized by severity:

### 1. Authentication & Authorization
- Can any protected endpoint be accessed without valid Cognito claims?
- Are there cross-tenant data leaks (User A accessing User B's data)?
- Is the demo mode safely isolated from production data?
- Can the `custom:role` claim be spoofed or escalated?

### 2. Input Validation & Injection
- Are there any paths where unsanitized input reaches DynamoDB queries?
- Can the pagination key decoder be exploited?
- Is the 100KB body limit sufficient and consistently enforced?
- Can the `sanitize()` function be bypassed?

### 3. API Security
- Are all public endpoints appropriately rate-limited?
- Can the IP-based rate limiter be bypassed (X-Forwarded-For spoofing)?
- Are error messages leaking internal details?
- Is the Google Places API proxy properly secured against abuse?

### 4. Payment Security
- Can the Stripe price ID whitelist be circumvented?
- Are there race conditions in the checkout or webhook flow?
- Is the restaurant ownership check sufficient?
- Can webhook events be replayed?

### 5. Data Security
- Are DynamoDB keys ever leaked in responses?
- Is sensitive data (emails, Stripe customer IDs) properly protected?
- Are secrets cached securely in Lambda memory?
- Is there data at rest encryption?

### 6. Infrastructure & Configuration
- Is the CSP header sufficient? Any bypass vectors?
- Are Lambda permissions overly broad?
- Are there DoS vectors (expensive queries, unbounded scans)?
- Is the monitoring sufficient to detect attacks?

### 7. Frontend Security
- Can the Zustand auth store be manipulated via browser devtools to access unauthorized features?
- Is the demo mode data completely isolated from real API calls?
- Are there any XSS vectors in the React components?
- Is the API client properly handling token refresh?

### 8. Business Logic
- Can a creator claim another creator's restaurant?
- Can collaborator invitations be spoofed?
- Can offer redemption counts be inflated?
- Are ambassador referral codes exploitable?

---

## OUTPUT FORMAT

For each finding, provide:

```
### [SEVERITY] Finding Title
**Location**: File/endpoint/layer affected
**Description**: What the issue is
**Impact**: What an attacker could do
**Fix**: Specific code/config change to resolve
```

End with an overall risk assessment and a prioritized remediation roadmap.

## PROMPT END
