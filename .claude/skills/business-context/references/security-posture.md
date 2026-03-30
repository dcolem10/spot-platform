# Spot Security Posture — Deep Reference

**Last Updated:** March 30, 2026

## Implemented Security Controls

### Authentication & Authorization
- AWS Cognito with JWT tokens and role-based groups (Creator, Partner, Insider)
- Every mutation verifies `getUserId(event)` matches resource owner
- DynamoDB user isolation via `CREATOR#{userId}` GSI1PK pattern
- Public endpoints explicitly marked in template.yaml with `Auth: Authorizer: NONE`

### Input Validation & Sanitization
- `sanitize()` strips dangerous characters from all user input
- `parseBody()` validates request bodies with size limit (100KB)
- ID validation regex: `[a-zA-Z0-9_-]{1,64}`
- `decodePaginationKey()` validates cursor tokens
- AI prompt injection defense: 11 regex patterns block prompt manipulation

### Rate Limiting (3 layers)
- API Gateway: 20 req/s sustained, 50 burst
- Per-user AI: 10 requests/hour via DynamoDB atomic counters
- IP-based public endpoints: 30 requests per 5 minutes

### Secrets Management
- All API keys in AWS Secrets Manager (Stripe, Anthropic, POS credentials)
- TTL-based caching (5-minute refresh) for key rotation support
- POS tokens encrypted with KMS
- No secrets in code, git, or CloudFormation parameters

### Financial Operations
- Stripe webhook idempotency via DynamoDB conditional writes (fail-closed)
- `ALLOWED_PRICES` whitelist prevents arbitrary price manipulation
- Customer portal for self-service subscription management
- All financial operations fail-closed (errors block transactions, not allow them)

### Security Headers
- `Content-Security-Policy` with restrictive directives
- `Strict-Transport-Security` (HSTS, 1 year, includeSubDomains)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Cross-Origin-Opener-Policy: same-origin`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Data Protection
- PII redacted from CloudWatch logs
- DynamoDB keys (PK, SK, GSI) stripped before client responses via `stripDdbKeys()`
- CORS dynamically matches request origin against `ALLOWED_ORIGINS` whitelist

## Known Gaps (Prioritized)

### Must Fix Before Real Users
1. **Privacy Policy / ToS** — Legal pages exist in frontend but need attorney review
2. **Cookie consent banner** — Not implemented; required for compliance
3. **GDPR/CCPA endpoints** — No data export or deletion API endpoints
4. **Rate limit fail-open** — If DynamoDB check fails, request proceeds (should fail-closed)

### Should Fix Soon After Launch
5. **Audit logging** — No mutation audit trail for campaigns, offers, partnerships
6. **Dead Letter Queues** — Async Lambda failures are silently lost
7. **AWS SDK versions** — ~500 versions behind latest (^3.500 vs 3.1002)

### Production Readiness Review Findings (March 5, 2026)
The SRE audit identified 20 findings across cost, security, observability, and dependencies. Most critical items have been addressed:
- DynamoDB lifecycle scan: SCAN_CAP added
- SES bounce/complaint handling: lambda-ses-handler deployed
- Cognito credentials: rotated, removed from git history
- Google Places API key: migrated to Secrets Manager

## Cost Controls
- AWS budget alarm set at $50/month
- Lambda pay-per-invocation (~$0.0000002 each)
- DynamoDB PAY_PER_REQUEST (no reserved capacity)
- Anthropic Claude API rate-limited + cached (1hr TTL) — biggest cost driver
- Google Places: $10 budget alert, free-tier field mask applied
