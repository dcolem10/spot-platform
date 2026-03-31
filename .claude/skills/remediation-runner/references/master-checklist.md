# Spot Platform — Master Remediation Checklist

> Generated: March 30, 2026
> Source: Document-by-document analysis of 7 private business documents vs actual codebase
> Rule: Work items 1–35 in order. One at a time. Mark [x] when done. Commit after each.

---

## CRITICAL (Items 1–9)

- [ ] **1. Subscription tier enforcement**
  - Source: Business Plan, Value Proposition
  - Problem: Stripe checkout creates sessions but nothing connects subscription tier (Starter/Pro/Scale) to feature access. All users get all features regardless of plan.
  - Scope: Backend (add tier lookup from Stripe subscription status) + Frontend (gate features by tier)
  - Key files: `backend/lambda-stripe/index.mjs`, `src/services/ApiService.ts`, `src/lib/featureFlags.ts`
  - Acceptance: Starter users limited to 2 active campaigns. Pro gets unlimited + calendar + AI. Scale gets ambassador + API access.

- [ ] **2. Restaurant pricing model — resolve contradiction**
  - Source: Value Proposition vs Business Plan
  - Problem: Value Proposition claims restaurants pay $299-$499/month ($240K ARR target). Business Plan and landing page say "Restaurants join free." Code has no restaurant pricing. These documents contradict each other.
  - Scope: Decision required from founder (Darren). Then update whichever document is wrong.
  - Acceptance: All documents agree on one restaurant revenue model. Code matches.

- [ ] **3. POS production sync — remove 501 stub**
  - Source: Business Plan, Value Proposition, Interconnectivity Plan
  - Problem: `syncRedemptionData()` returns 501 in production. The attribution loop breaks at the most critical step: connecting QR scans to actual POS transactions.
  - Scope: Backend (`backend/lambda-sync/`), POS credential setup, Square/Clover SDK integration
  - Key files: `backend/lambda-sync/index.mjs`, `backend/lambda-api/index.mjs` (lines ~2211-2311)
  - Acceptance: At least Square sync works in production with real credentials. Redemption data flows from POS to DynamoDB.

- [ ] **4. Real QR code generation**
  - Source: Value Proposition
  - Problem: `QRCodePlaceholder` renders a fake SVG pattern. No actual QR library. Creators can't print/share scannable codes.
  - Scope: Frontend — integrate `qrcode.react` or similar library into OfferManager
  - Key files: `src/features/concept1-platform/OfferManager.tsx` (lines 82-136)
  - Acceptance: QR codes encode the offer scan URL (`/api/offers/{code}/scan`), are downloadable as PNG, and scan correctly with phone cameras.

- [ ] **5. Creator-to-restaurant attribution reporting**
  - Source: Value Proposition
  - Problem: No dashboard shows restaurants "Creator X drove 47 redemptions worth $2,350." Partner analytics aggregates everything — no per-creator breakdown.
  - Scope: Backend (new endpoint or modify `/api/partner/analytics`) + Frontend (PartnerPortal dashboard)
  - Key files: `backend/lambda-api/index.mjs` (partner analytics ~line 1298), `src/features/concept1-platform/PartnerPortal.tsx`
  - Acceptance: Restaurant sees a table/chart of each creator's scans, redemptions, and estimated revenue.

- [ ] **6. Campaign limit enforcement for Starter tier**
  - Source: Business Plan
  - Problem: Starter ($49) should be limited to 2 active campaigns. No enforcement exists.
  - Scope: Backend — check subscription tier on campaign creation. Depends on item #1.
  - Key files: `backend/lambda-api/index.mjs` (campaign creation endpoint)
  - Acceptance: Starter users get error when creating 3rd active campaign. Pro/Scale unlimited.
  - Dependency: Item #1 must be completed first.

- [ ] **7. Privacy Policy & Terms of Service — attorney review**
  - Source: Compliance/IP Review
  - Problem: Frontend pages exist at `/privacy` and `/terms` but content needs legal review before collecting real user data.
  - Scope: Review current content, identify gaps (data retention, third-party sharing, CCPA rights), get attorney sign-off or use Termly/Iubenda generator.
  - Key files: Landing page legal sections
  - Acceptance: Privacy Policy covers data collected, purpose, retention, third-party sharing, user rights. ToS covers acceptable use, liability, termination.

- [ ] **8. Cookie consent banner**
  - Source: Compliance/IP Review
  - Problem: No cookie consent mechanism. Required for GDPR/ePrivacy.
  - Scope: Frontend — add lightweight banner component. Classify cookies (strictly necessary vs analytics).
  - Acceptance: Banner appears on first visit, respects user choice, persists preference.

- [ ] **9. GDPR/CCPA data endpoints**
  - Source: Compliance/IP Review
  - Problem: No `DELETE /api/profile` or `GET /api/profile/export` endpoints. Required before storing real PII.
  - Scope: Backend — two new endpoints. Frontend — "Account Settings" page with Download/Delete buttons.
  - Key files: `backend/lambda-api/index.mjs`
  - Acceptance: Users can download all their data as JSON. Users can request account deletion (30-day soft delete, then hard delete via TTL).

---

## HIGH (Items 10–18)

- [ ] **10. Insider subscription payment endpoint**
  - Source: Value Proposition
  - Problem: MembershipGate calls `/api/insider/subscribe` which doesn't exist in the backend. "Subscribe" button has no backend.
  - Scope: Backend — new endpoint wiring to Stripe with Insider price ID. Or defer Insider payments entirely (mark as "coming soon").
  - Key files: `src/features/concept2-insider/MembershipGate.tsx`, `backend/lambda-stripe/index.mjs`
  - Acceptance: Either subscription works end-to-end, or UI clearly shows "coming soon" without broken buttons.

- [ ] **11. Separate Cognito pool for restaurants**
  - Source: Interconnectivity Plan
  - Problem: Creators and restaurants share one Cognito pool. Plan calls for separate pools (security isolation, POS OAuth readiness).
  - Scope: Infrastructure — new Cognito pool in template.yaml, update auth flows, mapping table.
  - Key files: `backend/template.yaml`, `src/lib/amplifyConfig.ts`, `src/store/authStore.ts`
  - Acceptance: Restaurant users authenticate to separate pool. Creator pool unaffected. Hybrid user mapping works.

- [ ] **12. Blog infrastructure**
  - Source: Competitive Analysis
  - Problem: No blog routes, CMS, or content pipeline. dcspot.com has blog with SEO infrastructure.
  - Scope: Decision — build minimal blog in React, or use external blog (Ghost, WordPress) linked from Spot.
  - Acceptance: At minimum, a `/blog` route exists with restaurant-focused content capability.

- [ ] **13. Scheduling/booking integration**
  - Source: Competitive Analysis
  - Problem: dcspot.com has Calendly for prospect booking. Spot has no equivalent.
  - Scope: Frontend — embed Calendly widget or add booking link to landing page/partner portal.
  - Acceptance: Restaurant prospects can schedule a consultation call from the Spot Platform.

- [ ] **14. Brand logo carousel on landing page**
  - Source: Competitive Analysis
  - Problem: 3 text testimonials exist but no visual brand logos from partner restaurants.
  - Scope: Frontend — add logo carousel/grid to landing page testimonials section.
  - Key files: `src/features/landing/LandingPage.tsx` (testimonials section ~line 716)
  - Acceptance: At least 5-6 partner restaurant logos displayed with testimonials.

- [ ] **15. Connect AI insights to real Claude API**
  - Source: Value Proposition, Strategic Review
  - Problem: AIInsights component shows hardcoded demo data. lambda-ai backend exists but isn't connected to SpotOps AI tabs.
  - Scope: Backend (lambda-ai endpoints for campaign-insights, recommendations, content-ideas) + Frontend (wire API calls)
  - Key files: `src/features/concept3-spotops/AIInsights.tsx`, `backend/lambda-ai/index.mjs`
  - Acceptance: AI insights derive from actual campaign data via Claude API calls, not hardcoded arrays.

- [ ] **16. ROI report sharing — make functional**
  - Source: Value Proposition
  - Problem: "Generate & Share" button plays animation but doesn't generate a shareable URL or send anything.
  - Scope: Backend (generate shareable report URL or PDF) + Frontend (actual share mechanism)
  - Key files: `src/features/concept3-spotops/ROIReporter.tsx`
  - Acceptance: Creator can generate a link or PDF that a restaurant partner can view without logging in.

- [ ] **17. Social OAuth credentials — production setup**
  - Source: Launch Checklist
  - Problem: Instagram, TikTok, YouTube OAuth all use dev/mock mode. Need real app approvals.
  - Scope: External — apply for Meta Developer, TikTok Developer, Google API credentials. Update Lambda env vars.
  - Acceptance: At least Instagram OAuth works in production (most critical for food creators).

- [ ] **18. Stripe production price IDs**
  - Source: Launch Checklist
  - Problem: Current Stripe price IDs are development/test mode. Need production price IDs.
  - Scope: Stripe Dashboard — create production prices. Update `ALLOWED_PRICES` in lambda-stripe.
  - Key files: `backend/lambda-stripe/index.mjs` (lines 78-82)
  - Acceptance: Real payments can be processed on production Stripe account.

---

## MEDIUM (Items 19–30)

- [ ] **19. PartnershipCRM — Kanban view option**
  - Source: Strategic Review
  - Problem: Described as "Kanban-style pipeline" but implemented as sortable table.
  - Scope: Frontend — add toggle between table view and Kanban board view.
  - Key files: `src/features/concept3-spotops/PartnershipCRM.tsx`

- [ ] **20. Landing page 3D scene or enhanced hero visual**
  - Source: Strategic Review
  - Problem: "3D Spline scene" is a static PNG placeholder.
  - Scope: Frontend — integrate Spline 3D viewer or replace with polished animation/illustration.
  - Key files: `src/features/landing/LandingPage.tsx`

- [ ] **21. Server-side restaurant filtering (COST-03)**
  - Source: Production Readiness Review
  - Problem: Cuisine/neighborhood/search filter client-side after DynamoDB fetch. Wasteful at scale.
  - Scope: Backend — move filtering to FilterExpression or create cuisine/neighborhood GSI.
  - Key files: `backend/lambda-api/index.mjs` (lines 148-218)

- [ ] **22. Pagination on listDeals() and listSaves() (COST-04, COST-05)**
  - Source: Production Readiness Review
  - Problem: No Limit on public deals or saved restaurants queries. Could exceed payload limits.
  - Scope: Backend — add Limit: 100 and pagination cursor to both endpoints.
  - Key files: `backend/lambda-api/index.mjs`

- [ ] **23. Ambassador program — define tier benefits**
  - Source: Value Proposition
  - Problem: Bronze/Silver/Gold tiers exist but benefits are undefined. Commission rates not visible.
  - Scope: Product decision + Frontend UI update.
  - Key files: `src/features/concept3-spotops/AmbassadorDashboard.tsx`

- [ ] **24. Day-5 proposal expiration email**
  - Source: Interconnectivity Plan
  - Problem: Proposals auto-expire at 7 days with in-app notification but no SES email at day 5.
  - Scope: Backend — add SES email trigger in proposal expiration check.
  - Key files: `backend/lambda-lifecycle/index.mjs`, `backend/lambda-email/index.mjs`

- [x] **25. Restaurant offer approval UI polish**
  - Source: Interconnectivity Plan
  - Problem: Backend approve/reject/pause flow complete but Partner Portal may not expose clear approval buttons.
  - Scope: Frontend — verify and improve restaurant-side approval actions in PartnerPortal.
  - Key files: `src/features/concept1-platform/PartnerPortal.tsx`

- [x] **26. Fix CollaborationPanel feature flag default**
  - Source: Strategic Review
  - Problem: `VITE_ENABLE_MULTI_CREATOR` defaults to `true` but Strategic Review says it should be OFF.
  - Scope: Frontend — change default to `false` in featureFlags.ts.
  - Key files: `src/lib/featureFlags.ts`

- [x] **27. Frontend test coverage**
  - Source: Strategic Review
  - Problem: ~192 tests concentrated in backend. No frontend tests. No integration tests.
  - Scope: Add React Testing Library tests for critical user flows (auth, campaign creation, offer management).

- [ ] **28. Per-Lambda IAM roles (SEC-04)**
  - Source: Production Readiness Review
  - Problem: All Lambdas share DynamoDBCrudPolicy. Over-permissioned.
  - Scope: Infrastructure — separate IAM policies per Lambda in template.yaml.
  - Key files: `backend/template.yaml`

- [ ] **29. Structured JSON logging (OBS-05)**
  - Source: Production Readiness Review
  - Problem: Free-text console.log throughout. CloudWatch Insights queries impossible.
  - Scope: All Lambdas — implement JSON structured logging with requestId, timestamp, level, operation.

- [ ] **30. Health check dependency verification (OBS-07)**
  - Source: Production Readiness Review
  - Problem: `GET /health` returns 200 without checking DynamoDB or Secrets Manager.
  - Scope: Backend — add dependency checks, return 503 if degraded.
  - Key files: `backend/lambda-api/index.mjs`

---

## LOW (Items 31–35) — Not blocking, address opportunistically

- [ ] **31. NDA template for early access users** — Source: Compliance/IP Review
- [ ] **32. Provisional patent application** — Source: Compliance/IP Review
- [ ] **33. Trademark filing for "Spot"** — Source: Compliance/IP Review
- [ ] **34. Patch fast-xml-parser CVE (DEP-01)** — Source: Production Readiness Review
- [ ] **35. Remove unused Amplify analytics deps (DEP-02)** — Source: Production Readiness Review

---

## Change Log

| Date | Item | Status | Notes |
|------|------|--------|-------|
| 2026-03-30 | Checklist created | — | Initial analysis of 7 documents complete |
| 2026-03-31 | #25 | Restaurant offer approval UI polish | Done |
| 2026-03-31 | #26 | Fix CollaborationPanel feature flag default | Done |
| 2026-03-31 | #27 | Frontend test coverage | Done |
