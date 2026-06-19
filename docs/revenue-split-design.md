# Design Doc: Revenue-Split / Creator Payout Engine

**Status:** Proposal — for decision, not yet approved for build
**Author:** drafted via Claude Code
**Context:** The AI improvement plan proposed a "60/25/15 revenue split engine."
This doc specifies what that actually requires so the founder can decide
*before* any code is written. **No payout code has been built.**

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

## 6. Recommendation

1. **Decide the money model first** (Section 3): performance fee on attributed
   sales + creator share — not a split of the customer's bill.
2. **Lock the percentages** (fee %, creator share %).
3. Only then scope the Stripe Connect build as its own milestone, with a legal
   check on KYC/1099/money-transmission.

Until 1–3 are settled, building a payout engine is premature.

## 7. Open questions for the founder

- [ ] Is the goal genuinely to **pay creators cash**, or to give them
      **attribution data + portfolio proof** they can monetize via their own
      brand deals (the current positioning)?
- [ ] If cash: what fee % do restaurants pay on attributed sales, and what
      share goes to the creator?
- [ ] Do **venues** receive payouts, or only get billed? (Affects whether
      venues also need connected accounts.)
- [ ] Is this a DC-launch feature, or post-PMF? (Stripe Connect + compliance is
      heavy for the current phase.)
