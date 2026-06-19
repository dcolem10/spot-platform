---
name: site-verification
description: "Playbook for observing and smoke-testing the DEPLOYED Spot app (https://main.dc04hhpr1ng78.amplifyapp.com) in a real browser — confirming a feature shipped, that pages render, and that flows work end to end. Use when asked to verify the live site, check production functionality, confirm a deploy, screenshot the app, or QA a feature against the real URL (not just local tests). Encodes the environment constraints (egress/auth) and a Playwright recipe, plus per-feature verification checklists. Includes a ready-to-paste prompt in references/ for a browser/computer-use Claude or a human."
---

# Site Verification Skill

**Goal:** verify the *deployed* app behaves correctly — not just that code compiles.

## Read this first: can you even reach the site?

Two hard constraints decide your approach:

1. **Network egress.** The Claude-Code-on-the-web sandbox is frequently **blocked
   from the Amplify edge** — `curl`/WebFetch return **403 even with a browser
   user-agent** (it's the egress IP/WAF, not the UA). A headless browser launched
   in the same sandbox hits the same 403. **Probe first:**
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" -A "Mozilla/5.0 (X11; Linux x86_64) \
     AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36" \
     https://main.dc04hhpr1ng78.amplifyapp.com
   ```
   `200/302` → you can proceed in-sandbox. `403` → you cannot; hand off (see below).

2. **Auth.** Everything under `/app/*` is behind **Cognito login**. Public,
   no-auth pages: `/` (landing), `/auth`, `/privacy`, `/raffle/:id`,
   `/shared-report/:token`. The test creator account is
   `networth589+darrenspot@gmail.com` (CLAUDE.md) — **password is not committed**;
   it must be supplied. `VITE_DEMO_MODE` bypasses auth locally but is typically
   **off in production**, so don't count on it on the deployed URL.

If egress is 403 or you lack credentials, **do not sink time into installing a
browser.** Hand off: paste `references/earnings-verification-prompt.md` (or write
an analogous prompt) for a browser/computer-use Claude or the user to run.

## Browser recipe (when egress works)

No system browser ships in the sandbox; install Playwright on demand:
```bash
npm i -D playwright >/dev/null 2>&1 && npx playwright install chromium
```
Minimal screenshot + console-error capture:
```js
// verify.mjs — node verify.mjs <url> <outfile.png>
import { chromium } from 'playwright';
const [url, out] = process.argv.slice(2);
const b = await chromium.launch();
const p = await b.newPage();
const errors = [];
p.on('console', m => m.type() === 'error' && errors.push(m.text()));
p.on('pageerror', e => errors.push(String(e)));
const resp = await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
await p.screenshot({ path: out, fullPage: true });
console.log('status', resp?.status(), '\nconsole errors:', errors);
await b.close();
```
Send screenshots to the user with `SendUserFile`. For auth flows, script the
Cognito login on `/auth` with supplied creds, then navigate to the target route.

## Generic checklist (any page)

- HTTP 200 and the SPA mounts (not a blank `#root`).
- No uncaught console/page errors; no failed API calls (check Network).
- Loading → loaded → (empty?) states all render; no infinite spinner.
- Responsive at 375 / 768 / 1280 px. Dark-theme tokens intact.
- Primary CTA works and routes correctly.

## Feature checklist — Creator Earnings (`/app/earnings`)

See `references/earnings-verification-prompt.md` for the full hand-off prompt.
Quick version:
- Sidebar shows **💰 Earnings**; route loads.
- **Not connected:** payout hero shows "Set up payouts"; clicking starts Stripe
  Connect onboarding (redirects to a `connect.stripe.com` URL).
- **Returning** with `?connect=done` shows the success banner; `?connect=refresh`
  shows the resume banner.
- Stat cards (earned / available / paid) render real numbers; monthly chart and
  per-period table populate.
- **Cash out** button is disabled until payouts are enabled and `pending > 0`.
- Confirm `GET /api/earnings` and `GET /api/stripe/connect/status` succeed (200).
- Cross-reference behavior with the `revenue-payouts` skill.

## Reporting

Report concisely: what you saw (with screenshots), what worked, what didn't
(with the exact error + repro), and whether the deploy reflects the latest code.
Don't claim a flow works unless you actually exercised it.
