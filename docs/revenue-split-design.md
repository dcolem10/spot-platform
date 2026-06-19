# Design Doc: Revenue-Split / Creator Payout Engine

**Status:** ✅ Decided + foundation implemented (see §8). Production POS
reconciliation, frontend, and legal review remain (see §9).
**Author:** drafted via Claude Code
**Context:** The AI improvement plan proposed a "60/25/15 revenue split engine."
This doc specifies the viable model and records the decisions taken.

## Decisions (locked)

- **Money flow:** Restaurants pay a fee on POS-*attributed* sales; Spot pays
  the creator a **performance share** of that fee via **Stripe Connect**.
  Rationale: Spot's mission is to "turn restaurant collaborations into
  recurring revenue" for creators — a Spot-only fee wouldn't deliver that. A
  payout strictly on *proven attributed results* (never upfront) is fully
  consistent with "nobody gets exploited."
- **Fee structure:** flat **12%** of attributed sales, with a configurable
  **per-restaurant monthly cap** (default **$500**) to protect scarce early
  partners from a shock bill on a viral month. Raise/remove the cap as the
  partner base grows.
- **Split:** **60% creator / 40% platform** of the fee.
- All three numbers are configurable (env vars + per-restaurant override).

---

## 1. The ask vs. the current model

The plan describes splitting each attributed transaction **60% creator / 25%
venue / 15% platform**, with the engine recording `creator_payout`,
`venue_share`, and `platform_share` per visit.

Today the platform does something fundamentally different:

| | Today | Revenue-split engine |
|---|---|---|
| Money direction | **Inbound only** — creators pay Spot | **Outbound** — Spot pays creators/venues |
| Payment system | Stripe **Subscriptions** ($49/$99/$149) | Stripe **Connect** (marketplace payouts) |
| Restaurant pays | Nothing (join free) | A share of attributed sales |
| Code that exists | `lambda-stripe`: checkout + subscription webhooks | None — no disbursement capability anywhere |
| Compliance surface | Minimal (SaaS billing) | KYC, 1099-K, money movement |

`lambda-stripe/index.mjs` only knows how to *collect* subscriptions. There is
no transfer, payout, connected-account, or balance logic in the codebase.

## 2. The economic problem with 60/25/15 as written

The plan's example splits an **$85 dinner bill**: $51 to the creator, $21.25 to
the venue, $12.75 to the platform. That implies the **restaurant gives away 85%
of a sale** — non-viable, and it directly contradicts two documented anchors:

- **CLAUDE.md / business-context:** restaurants **join free** and only invest
  in partnerships that deliver measurable results; the SaaS model targets ~95%
  gross margin.
- **"Nobody gets exploited":** _"No feature should force upfront payment for
  unproven value."_ Splitting gross sales inverts the model the business is
  built on.

So before any build, the **unit of money to be split must be redefined.** It is
not the customer's bill.

## 3. Recommended model: commission on *attributed* sales

A version that fits the business and still rewards creators:

1. A customer redeems a creator's offer code; `lambda-sync` reconciles it
   against the POS to confirm a **real, attributed sale** (this closed loop
   already exists — it is Spot's moat).
2. The **restaurant pays a performance fee** — a percentage of *attributed*
   revenue only (e.g. 10–15%), billed monthly. They never pay for unproven
   visits, preserving "nobody gets exploited."
3. Spot **shares part of that fee with the creator** who drove the visit, and
   keeps the rest as platform revenue.

Worked example at a 12% fee on $85 attributed, split 60/40 creator/platform:
restaurant pays **$10.20**; creator earns **$6.12**; Spot keeps **$4.08**. The
restaurant keeps ~88% of the sale — sustainable, and the creator earns from
*proven* results.

The exact percentages are a business decision. The point: **split the fee, not
the bill.**

## 4. What a payout engine requires (Stripe Connect)

Paying creators is regulated money movement. Minimum scope:

- **Connected accounts** — onboard every creator (and venue, if venues ever
  receive payouts) as a Stripe **Express** connected account: identity/KYC,
  bank details, and **tax forms (1099-K)** handled by Stripe.
- **Fund flow** — collect the restaurant fee, then `transfer` the creator's
  share to their connected account; track platform balance.
- **Lifecycle** — payout schedules, refunds, reversals, disputes/chargebacks,
  failed payouts, account deactivation.
- **Ledger** — an auditable record of every fee charged and payout made
  (new DynamoDB item types, e.g. `PK: CREATOR#{id}  SK: PAYOUT#{id}` and
  `PK: RESTAURANT#{id}  SK: FEE#{period}`).
- **Compliance** — money-transmission posture, tax reporting, and clear terms;
  worth a brief legal review before launch.

### Likely code/infra changes (when approved)

- Extend `lambda-stripe`: Connect onboarding endpoints
  (`/api/stripe/connect/onboard`, account-status webhook handlers:
  `account.updated`, `payout.*`, `transfer.*`).
- New attribution→fee→payout pipeline triggered off confirmed redemptions in
  `lambda-sync` (not a new Python/RDS service — extend the existing Node path).
- New DynamoDB access patterns for fees, payouts, and a running ledger.
- Frontend: creator payout onboarding + earnings dashboard; restaurant
  attributed-billing view.
- Secrets: Connect uses the existing Stripe key; add Connect webhook secret.

## 5. Cost impact

- Stripe Connect: no extra platform subscription; Stripe takes standard
  processing + a small Express payout fee per active connected account/payout.
- AWS: negligible new infra — reuses DynamoDB (pay-per-request) and existing
  Lambdas. **No RDS required.** Stays within the $50/mo budget.

## 6. Recommendation — adopted

The recommended model (performance fee on attributed sales + creator cash share)
was adopted. Percentages locked (see Decisions, top). Stripe Connect chosen as
the payout rail.

## 7. Open questions — resolved

- [x] **Pay creators cash, or attribution-only?** → **Pay cash** (performance
      share on proven attribution). Fulfills the mission; not exploitative
      because it's never upfront.
- [x] **Fee % / creator share?** → **12% fee, 60% creator / 40% platform**,
      monthly cap default **$500**. All configurable.
- [x] **Do venues receive payouts?** → **No.** Restaurants are *billed* only;
      only creators have Connect accounts. (Revisit if a venue-payout product
      ever emerges.)
- [x] **DC-launch or post-PMF?** → Build the **foundation now** (it's a
      roadmapped revenue stream — see value-proposition.md), but the monthly
      cap and dev-mode wiring keep it safe for the small DC cohort; flip on
      production POS reconciliation + frontend when ready.

## 8. Implementation (this PR)

Backend foundation, wired end-to-end through the existing attribution loop:

- **`backend/lambda-api/commission.mjs`** — pure, unit-tested split engine
  (integer cents): `computeCommission` (fee + cap + 60/40 split),
  `resolveCommissionConfig` (env + per-restaurant override), `billingPeriod`,
  `dollarsToCents`/`centsToDollars`. 15 tests in `commission.test.mjs`.
- **Attribution event** — `redeemOffer` now writes a per-restaurant
  `REDEEM#{ts}#{offerId}` event carrying `creatorId`, so POS sync can attribute
  confirmed revenue back to the creator who drove it.
- **Accrual** — `accrueCommissions()` runs inside `POST /api/pos/sync`: it
  splits the day's attributed revenue across creators by redemption share,
  applies fee % + monthly cap, and writes ledger entries. Idempotent per
  (restaurant, day).
- **Read endpoints** — `GET /api/earnings` (creator: earnings by month + payout
  readiness) and `GET /api/restaurants/:id/commissions` (owner: the bill).
- **Stripe Connect** (`lambda-stripe`) — `POST /api/stripe/connect/onboard`,
  `GET /api/stripe/connect/status`, `POST /api/stripe/payouts/run` (idempotent
  transfer), plus `account.updated` / `transfer.*` webhook handlers.
- **Config** — `SPOT_COMMISSION_FEE_PCT`, `SPOT_CREATOR_SHARE_PCT`,
  `SPOT_MONTHLY_CAP_CENTS` as SAM parameters/env vars.

### New DynamoDB access patterns

```
RESTAURANT#{id}  COMMISSION#{YYYY-MM}        restaurant's monthly bill + cap state
RESTAURANT#{id}  COMMISSION_ACCRUAL#{date}   idempotency marker (one accrual/day)
RESTAURANT#{id}  COMMISSION_CONFIG           optional per-restaurant override
RESTAURANT#{id}  REDEEM#{ts}#{offerId}       attribution event (creator link)
CREATOR#{id}     EARNING#{YYYY-MM}           creator's running earnings (pending/paid)
CREATOR#{id}     ACCRUAL#{date}#{restId}     per-day audit line
CREATOR#{id}     CONNECT_ACCOUNT             Stripe Express account + payout status
CREATOR#{id}     PAYOUT#{transferId}         payout record
GSI1: COMMISSIONS#{YYYY-MM} / EARNINGS#{YYYY-MM}   for future batch billing/payout runs
```

## 9. Remaining work (follow-ups, not in this PR)

- **Production POS reconciliation** — `syncRedemptions()` is still dev-mode
  synthetic; real Square/Clover order matching (currently a 501 stub) must feed
  real dollar amounts before charging anyone.
- **Frontend** — creator earnings + Connect onboarding page (`/app/earnings`)
  and a restaurant billing view. Backend endpoints are ready.
- **Restaurant collection** — restaurants are *billed* in the ledger but not yet
  *charged*; a monthly invoice/charge step (Stripe Invoicing on the platform
  account) closes that side.
- **Legal** — KYC/1099/money-transmission review before enabling live payouts.
- **Connect webhook** — enable `account.*` and `transfer.*` events on the Stripe
  webhook endpoint (same signing secret).
