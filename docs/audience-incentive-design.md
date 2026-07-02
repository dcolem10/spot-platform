# Audience Incentive Design — Why a Viewer Redeems a Promo Code

**Status:** Phase 1 implemented (2026-07)
**Related:** `docs/revenue-split-design.md` (the money model this feeds)

## 1. The problem

Demo feedback surfaced a structural gap: **there was no reason for a viewer to
use a promo code.** Every dollar in Spot's revenue model — the 12% fee on
POS-attributed sales, the creator's 60% share — fires on exactly one event: a
viewer redeems a code at a restaurant. Yet:

- Deal value existed only as free text (`description`). The Partner portal
  collected a structured discount when publishing a deal, but `createOffer`
  silently dropped it.
- The audience surface (Insider DealsHub) was disconnected from the attributed
  offer system: its deals had no codes, no POS linkage, and redeeming one wrote
  a throwaway record.
- Tapping "Redeem" gave the viewer nothing — no code, no visible benefit.

We built supply-side plumbing (creators, restaurants, adoption marketplace,
billing) on top of a demand-side void.

## 2. The decision

**The promo code IS the discount.** The viewer's incentive is a concrete,
restaurant-funded benefit (percent off, dollars off, or a free item) attached
to every tracked code and displayed prominently wherever the code appears.

This is the purest fit with "nobody gets exploited":

- The **restaurant** funds the incentive out of gross margin and only "pays"
  (discount + 12% fee) when a real, POS-confirmed visit happens. No upfront
  spend for unproven value.
- The **creator**'s code becomes genuinely worth sharing — their followers get
  real value, which drives the redemptions that generate the creator's 60%
  performance share.
- The **viewer** gets a frictionless, real discount — no account required to
  claim a code.
- **Spot** earns only when the loop closes.

## 3. What Phase 1 shipped

### Data model
- `terms` (`OfferTerms`: `discountType` percent|fixed|freeItem, `discountValue`,
  `freeItemDescription`, `minSpend`, …) is now **persisted on the offer row**
  at creation (`createOffer`), inherited on adoption (`adoptOffer`), and
  finalized at approval (`approveOffer` writes the restaurant-approved terms to
  the unified `terms` field). Sanitized via `sanitizeOfferTerms()`.
- `OFFER_CODE#` lookups carry `restaurantName` + `terms` for resilience.

### The audience bridge (Deals feed ⇄ attributed offers)
- `projectOfferToDealsFeed()` writes a `DEAL#{offerId}` projection row
  (`GSI1PK='DEALS'`) whenever a code goes publicly live:
  - on **adoption** of a restaurant-published deal (live immediately), and
  - on **restaurant approval** of a creator-submitted offer.
- The projection carries the tracked `code`, `terms`, and expiry, so the
  existing `GET /api/insider/deals` feed now surfaces real, attributed,
  restaurant-blessed deals with zero new endpoints.
- Pausing an offer removes its card; resuming restores it. Expired projections
  age out via TTL. The redeem path always re-validates the **live** offer, so a
  stale card can never mint a redemption on a dead offer.

### Redemption experience (the payoff moment)
- `POST /api/offers/:code/redeem` (public) now returns the **benefit** —
  `code`, `terms`, `description`, `restaurantName` — including on the
  idempotent "already redeemed" path.
- DealsHub: deal cards lead with the value ("15% OFF") rendered large; "Get
  Code" claims through the public attributed path (no login required) and opens
  a **code-reveal modal** with the code, the benefit, a copy button, and
  redemption instructions. Attribution to the sharing creator happens on claim;
  revenue confirmation happens at POS sync.
- Legacy code-less insider deals still work (auth-required confirmation flow).

### Creator & restaurant surfaces
- OfferManager: "What diners get" (type + value) is a first-class input on deal
  creation; value badges on every offer row; "Request Approval" submits the
  offer's real terms instead of a hardcoded 15%.
- PartnerPortal: published-deal terms are actually persisted now; value chips
  on published deal cards.
- RestaurantDetail: creators see the deal value before adopting.
- Demo data for both perspectives (creator offers + audience deals) carries
  structured terms and codes, so the full loop is demoable end to end.

## 4. The loop, end to end

```
Restaurant publishes deal w/ funded discount (terms persisted)
  → Creator adopts → gets own tracked code carrying the same terms
  → Code auto-appears in audience Deals feed (projection)
  → Creator also promotes code on socials
  → Viewer sees "20% OFF" → taps Get Code (no account needed)
  → Attributed redemption event written (creatorId carried)
  → Viewer shows code at restaurant, gets the discount
  → POS sync matches the sale → 12% fee accrues → creator earns 60%
```

## 5. Forward plan (in priority order)

1. **Close the real POS loop (master checklist #3).** Production Square/Clover
   reconciliation is still a dev-mode stub — without it no real dollars flow.
   This remains the single highest-leverage item on the platform.
2. **Redemption-linked raffles.** Raffle entry is currently decoupled from
   redemption (email/watch-based). Add "redeem to enter" as an entry method so
   the existing raffle system amplifies the redemption incentive instead of
   bypassing it.
3. **Insider membership value ladder.** With real deal value now structured,
   `insiderOnly` deals can carry visibly better terms (e.g. 10% public / 20%
   insider), giving the membership something concrete to sell when Stripe
   price IDs land (checklist #18).
4. **Code-reveal → directions/reservation CTA.** After claiming, offer "Get
   directions" / restaurant page links to shorten the claim→visit gap.
5. **Redemption nudges.** Reminder email/notification for claimed-but-unused
   codes nearing expiry (SES infrastructure already exists).

## 6. Intentionally not built

- **Spot-funded discounts.** Spot never subsidizes deals — the restaurant funds
  the incentive; Spot's economics stay fee-based.
- **Points/wallet system.** A loyalty currency adds liability and complexity
  before product-market fit; structured per-deal value is enough for the DC
  launch phase.
- **Coupon marketplaces / aggregator syndication.** Deals stay creator-anchored;
  broadcasting codes without a creator context would break attribution and the
  creator-first positioning.
