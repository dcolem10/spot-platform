# Spot Launch Checklist — Remaining Items

**Last Updated:** March 30, 2026
**Overall Readiness:** ~95%

## Priority 1: Blocks Real User Launch

| Item | Status | Notes |
|------|--------|-------|
| Real social OAuth credentials (Instagram, TikTok, YouTube) | Not started | Dev/mock mode works; need Meta/TikTok/Google app approvals |
| Toast POS partner approval | Pending | Square + Clover live; Toast requires partner agreement |
| Legal review of Privacy Policy / Terms of Service | Not started | Frontend pages exist; need attorney review |
| Cookie consent banner | Not started | Required for GDPR/ePrivacy compliance |
| GDPR/CCPA data export + deletion endpoints | Not started | Required before storing real user PII |
| Real Stripe price IDs | Not started | Current IDs are development placeholders |

## Priority 2: Should Have at Launch

| Item | Status | Notes |
|------|--------|-------|
| Audit logging for data mutations | Not started | No trail for campaign/offer/partnership changes |
| Dead Letter Queues on async Lambdas | Not started | Async failures silently lost |
| Rate limit fail-closed pattern | Not started | Currently fails open if DynamoDB check errors |
| Test coverage 50%+ | Partial | ~200 tests, concentrated in backend helpers/Stripe/email |
| Campaign report PDF polish | Partial | Browser-side generation exists, needs refinement |

## Priority 3: Post-Launch Growth

| Item | Status | Notes |
|------|--------|-------|
| Enable multi-creator collaboration | Built, flagged OFF | Flip VITE_ENABLE_MULTI_CREATOR |
| Insider (Concept 2) UX pass | Functional | Deprioritized per strategy; grows organically |
| CloudWatch dashboards | Not started | Key business metric monitoring |
| AWS SDK version update | Not started | ~500 versions behind (^3.500 vs 3.1002) |

## What's Already Done (Not Blocking)

- DynamoDB user isolation (CREATOR#{userId} pattern)
- Stripe integration with webhook idempotency
- POS integrations (Square + Clover live)
- Security hardening (input sanitization, rate limiting, encryption, security headers)
- All secrets in Secrets Manager
- Multi-origin CORS across all 3 Lambdas
- Landing page with competitive positioning
- Creator + Partner onboarding flows
- 200 passing backend tests
- Amplify auto-deploy CI/CD
- Ambassador referral program
