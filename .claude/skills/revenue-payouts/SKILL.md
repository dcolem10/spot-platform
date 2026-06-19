---
name: revenue-payouts
description: "The commission / revenue-split / creator-payout subsystem for the Spot Platform. Consult this whenever work touches creator earnings, commission accrual, the platform fee on POS-attributed sales, Stripe Connect onboarding, payouts/transfers, the earnings ledger, or the /app/earnings page. Trigger on terms like payout, commission, earnings, revenue split, Stripe Connect, transfer, fee, attributed sales, or cash out. It encodes the money model, the DynamoDB ledger schema, the API surface, invariants, and what is intentionally NOT built yet, so the ledger model never has to be re-derived."
---

# Revenue-Split & Creator Payouts Skill

**Purpose:** One place that captures how money flows from an attributed restaurant sale to a creator's bank account. Full design + rationale: `docs/revenue-split-design.md`. Business framing: the `business-context` skill (Revenue Model).

## The money model (decided, locked)

- Restaurants pay a **12%** fee on **POS-attributed** sales only — never upfront. Honors "nobody gets exploited."
- A per-restaurant **monthly cap** (default **$500**) limits the fee so a viral month can't shock a partner.
- Of the fee, the creator who drove the visit earns **60%**; the platform keeps **40%**.
- Creators are paid via **Stripe Connect (Express)** — Stripe handles KYC, bank details, 1099-K.
- All three numbers are configurable: env vars `SPOT_COMMISSION_FEE_PCT`, `SPOT_CREATOR_SHARE_PCT`, `SPOT_MONTHLY_CAP_CENTS` (SAM params), or a per-restaurant `COMMISSION_CONFIG` override item.

> Distinction from Mustard: Spot pays creators **only on proven attribution**, never upfront-to-post. A results-based payout is the mission ("turn collaborations into recurring revenue"), not a violation of the anti-exploitation rule.

## Core engine — `backend/lambda-api/commission.mjs`

Pure, unit-tested (`commission.test.mjs`), **integer cents** throughout to avoid float drift.
- `computeCommission({ grossSaleCents, feePct, creatorSharePct, monthlyCapCents, priorFeeThisPeriodCents })` → `{ feeCents, creatorCutCents, platformCutCents, capReached, ... }`. Platform absorbs the rounding remainder so cuts sum exactly to the fee.
- `resolveCommissionConfig(override, env)` — merges per-restaurant override over env over code defaults.
- `billingPeriod(date)` → `YYYY-MM`. `dollarsToCents` / `centsToDollars`.

**If you change the engine, update `commission.test.mjs` and keep money in cents.**

## DynamoDB ledger (single-table)

```
RESTAURANT#{id}  REDEEM#{ts}#{offerId}      attribution event (carries creatorId) — written in redeemOffer
RESTAURANT#{id}  COMMISSION#{YYYY-MM}        restaurant's running monthly bill + cap state
RESTAURANT#{id}  COMMISSION_ACCRUAL#{date}   idempotency marker — one accrual per restaurant/day
RESTAURANT#{id}  COMMISSION_CONFIG           optional per-restaurant fee/share/cap override
CREATOR#{id}     EARNING#{YYYY-MM}           creator's running earnings: earnedCents/pendingCents/paidCents/status
CREATOR#{id}     ACCRUAL#{date}#{restId}     immutable per-day audit line
CREATOR#{id}     CONNECT_ACCOUNT             Stripe Express account id + payout readiness
CREATOR#{id}     PAYOUT#{transferId}         payout record
GSI1: COMMISSIONS#{YYYY-MM} / EARNINGS#{YYYY-MM}   for future batch billing/payout runs
```

Accrual happens in `accrueCommissions()` inside `POST /api/pos/sync` (lambda-api): it splits the day's attributed revenue across creators by redemption share, applies fee + cap, and writes the ledgers. **Idempotent per (restaurant, day)** via the `COMMISSION_ACCRUAL#{date}` marker — re-running sync never double-charges or double-pays.

## API surface

| Endpoint | Lambda | Notes |
|----------|--------|-------|
| `GET /api/earnings` | api | creator's earnings by month + payout readiness |
| `GET /api/restaurants/:id/commissions` | api | restaurant's bill (owner-only) |
| `POST /api/stripe/connect/onboard` | stripe | create/resume Express account → returns hosted onboarding `url` |
| `GET /api/stripe/connect/status` | stripe | payout readiness, refreshed from Stripe |
| `POST /api/stripe/payouts/run` | stripe | body `{ period }`; idempotent transfer (Stripe idempotency key + conditional ledger write) |
| webhooks | stripe | `account.updated`, `transfer.created/reversed` keep local state in sync |

## Frontend — `src/features/concept3-spotops/Earnings.tsx` (route `/app/earnings`)

React Query + Chart.js. Hero card drives Connect onboarding; stat cards (earned / pending / paid); monthly bar chart; per-period table with a "Cash out" button (enabled only when `payoutsEnabled && pending > 0`). Handles the `?connect=done|refresh` return from Stripe. Demo-mode data keeps it populated when `VITE_DEMO_MODE` bypasses the API. Types in `src/types/index.ts` (`CreatorEarnings`, `EarningPeriod`, `ConnectStatus`, `PayoutResult`) **mirror the backend responses exactly** — keep them in sync.

## Invariants & gotchas

- Money is **cents** end-to-end in the backend; the API returns **dollars** to the client (`centsToDollars`). Don't mix.
- Never charge/pay without a real attributed dollar amount. Today `syncRedemptions` is **dev-mode synthetic**; production POS reconciliation is a 501 stub.
- Payouts require a `payoutsEnabled` Connect account; the UI must gate the cash-out button on it.
- Stripe transfers must always pass `idempotencyKey: payout_${userId}_${period}`.

## Intentionally NOT built yet (see design doc §9)

Production POS reconciliation (real Square/Clover order matching), restaurant invoice/charge step (the bill is accrued but not yet collected), and a legal review of KYC/1099/money-transmission before enabling **live** payouts. Don't assume these exist.
