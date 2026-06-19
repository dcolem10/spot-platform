# Hand-off prompt — verify the Spot creator Earnings & payouts feature

Paste the block below to a Claude with **browser / computer-use** capability
(or use it yourself as a checklist). It assumes access to the deployed app and
a creator login. Fill in `<CREATOR_EMAIL>` / `<CREATOR_PASSWORD>` before sending.

---

You are QA-verifying a newly shipped feature on a deployed web app. Be skeptical:
only report a flow as working if you actually performed it. Capture screenshots.

**App:** https://main.dc04hhpr1ng78.amplifyapp.com
**Login (Cognito):** go to `/auth`, sign in as `<CREATOR_EMAIL>` / `<CREATOR_PASSWORD>` (a Creator account).

**Context:** Spot is a creator↔restaurant attribution marketplace. A new
**Earnings** feature lets creators see their commission (a 60% share of a 12%
fee restaurants pay on POS-attributed sales) and cash out via **Stripe Connect**.

**Steps & checks:**

1. **Deploy freshness / nav.** After login, confirm the left sidebar (under
   "Campaigns") shows a **💰 Earnings** item. Click it → URL becomes
   `/app/earnings`. (If the item is missing, the latest deploy may not be live —
   report that.)

2. **Page renders.** Confirm: a page title "Earnings", a payout-status hero, three
   stat cards (**Total earned**, **Available to cash out**, **Paid out**), and —
   if the account has earnings — a monthly bar chart and a "Monthly breakdown"
   table. Note any blank areas, infinite spinners, or console errors (open
   DevTools → Console + Network).

3. **Empty vs populated.** If no earnings, confirm a friendly empty state with a
   "Manage Deals & QR" CTA (not a blank page). If there are earnings, confirm the
   numbers in the cards, chart, and table are internally consistent (earned −
   pending ≈ paid out).

4. **Stripe Connect onboarding.** In the hero:
   - If **not connected**, a "Set up payouts" button. Click it → it should call
     the backend and **redirect to a Stripe-hosted onboarding URL**
     (`connect.stripe.com/...`). You don't need to finish KYC — just confirm the
     redirect happens. Then return to `/app/earnings?connect=done` and confirm a
     success banner appears (and `?connect=refresh` shows a "resume" banner).
   - If **already connected/active**, the hero shows "Payouts active".

5. **Cash out.** In the breakdown table, the **Cash out** button must be
   **disabled** unless payouts are enabled AND that month has a pending balance.
   If you can safely trigger a payout in a test/sandbox Stripe environment,
   confirm it returns success and the row moves pending → paid. Do **not** trigger
   a real-money payout.

6. **Network sanity.** Confirm `GET /api/earnings` and
   `GET /api/stripe/connect/status` return **200** (Network tab). Flag any 4xx/5xx.

7. **Responsive.** Check the page at mobile width (~375px): the hero stacks, the
   table scrolls horizontally rather than squashing.

**Report:** a short summary + screenshots of (a) the Earnings page, (b) the
payout hero state, (c) any errors. State clearly whether the feature is live and
functional, and list anything broken with exact errors and repro steps.
