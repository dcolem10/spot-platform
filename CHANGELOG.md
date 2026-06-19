# Changelog

Notable changes to the Spot platform. Format loosely follows
[Keep a Changelog](https://keepachangelog.com/). Dates are UTC.

---

## 2026-06-19

### Direction

This release begins **closing the loop from attribution to creator income.**
Until now Spot earned only from creator subscriptions ($49/$99/$149); creators
got attribution *data* but no money *from the platform*. This release adds a
**performance-based commission stream**:

> Restaurants pay a small fee (**12%**, monthly-capped) on sales we attribute to
> a creator's content through their POS. The creator who drove the visit earns
> **60%** of that fee, paid via Stripe Connect; Spot keeps 40%.

Why this shape (full rationale in `docs/revenue-split-design.md`):
- It fulfils the mission — "turn restaurant collaborations into recurring
  revenue" — which a Spot-only fee would not.
- It does **not** violate "nobody gets exploited": payment is only ever on
  *proven, POS-attributed* results, never upfront-to-post (the Mustard model).
- The original plan's "60/25/15 split of the customer's bill" was rejected — it
  would have restaurants give away 85% of a sale, contradicting "restaurants
  join free."

Subscriptions remain the primary, ~95%-margin revenue line; commission is an
additive, near-pass-through stream tracked separately.

### Added — Revenue-split engine (backend, PR #4)
- `backend/lambda-api/commission.mjs` — pure, unit-tested split engine (integer
  cents): fee %, monthly cap, 60/40 split, per-restaurant config override. 15 tests.
- Attribution event: `redeemOffer` now writes a per-restaurant
  `REDEEM#{ts}#{offerId}` record carrying `creatorId`.
- `accrueCommissions()` runs inside `POST /api/pos/sync`: splits attributed
  revenue across creators, applies fee + cap, writes ledger entries. Idempotent
  per (restaurant, day).
- Endpoints: `GET /api/earnings` (creator), `GET /api/restaurants/:id/commissions`
  (owner-only bill).
- New ledger access patterns: `COMMISSION#{period}`, `COMMISSION_ACCRUAL#{date}`,
  `COMMISSION_CONFIG`, `EARNING#{period}`, `ACCRUAL#{date}#{restId}`,
  `CONNECT_ACCOUNT`, `PAYOUT#{transferId}` (+ GSI1 batch keys).

### Added — Stripe Connect creator payouts (backend, PR #4)
- `POST /api/stripe/connect/onboard`, `GET /api/stripe/connect/status`,
  `POST /api/stripe/payouts/run` (idempotent transfer), and `account.updated` /
  `transfer.*` webhook handlers.
- Fixed a latent bug: `ORIGIN` was referenced but never defined in lambda-stripe
  (checkout/portal redirect URLs would have thrown).

### Added — Creator earnings UI (frontend, PR #5)
- `/app/earnings` page (sidebar: 💰 Earnings): payout-status hero that drives
  Connect onboarding, stat cards (earned / available / paid), a monthly earnings
  chart, and a per-period table with a cash-out button gated on payout
  readiness. Handles the `?connect=done|refresh` return from Stripe; demo-mode
  populated; full loading/error/empty states.
- Types `CreatorEarnings` / `EarningPeriod` / `ConnectStatus` / `PayoutResult`.
- Wired up `pauseOfferMutation` in the Partner Portal (a "Pause" button on active
  offers) — previously implemented but never connected to the UI.

### Added — AI cost & safety guardrails (backend, PR #4)
- `backend/lambda-ai/guardrails.mjs` — iteration cap, empty-result handler, LLM
  token-usage logging, Anthropic usage extraction.
- `[TOKEN_USAGE]` / `[TOKEN_WARNING]` logging wired into all three Anthropic
  call sites.
- Billing alarms as IaC in `template.yaml`: SNS topic + email subscription and
  `EstimatedCharges` alarms at $20 / $50.
- `backend/AGENT_SAFETY_AUDIT.md` — audit of all 7 Lambdas.

### Fixed — CI (PR #5)
- Synced the drifted `package-lock.json` and declared the previously-undeclared
  `aws-amplify` umbrella dependency (the app imports `aws-amplify/auth`) — fixes
  the `Test` job's `npm ci`.
- Added `--region us-east-1` to `sam validate` in `ci.yml` and
  `backend-deploy.yml` — fixes the `validate` job.

### Docs & skills
- `docs/revenue-split-design.md` — full design + decisions + remaining work.
- `.claude/skills/revenue-payouts` — subsystem skill (money model, ledger, API,
  invariants).
- Updated `business-context`, `value-proposition`, root + backend `CLAUDE.md` to
  reflect the commission/payout stream.

### Not built yet (intentional — see `docs/revenue-split-design.md` §9)
- **Production POS reconciliation** — `syncRedemptions()` is still dev-mode
  synthetic; real Square/Clover order matching (a 501 stub) must feed real
  dollar amounts before anyone is charged.
- **Restaurant collection** — the bill is accrued but not yet *charged*
  (a Stripe Invoicing step closes that side).
- **Legal review** of KYC / 1099 / money-transmission before enabling live
  payouts.
- **Live UI verification** of `/app/earnings` against the deployed app (see
  `.claude/skills/site-verification`).
