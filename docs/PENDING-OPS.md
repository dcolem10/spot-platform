# Pending Manual Ops

Actions that can't be completed from a Claude Code web session — they need AWS
credentials, third-party service credentials, or another out-of-band step. This
file is committed to the repo on purpose: web sessions run in ephemeral
containers, so a tracked file is the only thing that survives between sessions.

**How this works**
- Every change that defers a credentialed/manual step adds an entry here with the
  exact command and why it's blocked.
- Root `CLAUDE.md` instructs every session to check this file, so a future Claude
  session will surface these and offer to run them once you provide credentials.
- When an item is done, check it off (or delete it). Keep this file honest — it's
  the source of truth for "what still needs deploying."

---

## Open

### [ ] Deploy `lambda-api` — restaurant `city` / `state` fields
- **Added:** 2026-06-20
- **Why deferred:** Needs AWS credentials; `sam deploy` is blocked (see CLAUDE.md),
  so use the direct Lambda code-update flow.
- **What changed:** `backend/lambda-api/index.mjs` — `createRestaurant()` now stores
  `city` + `state`, and `updateRestaurant()` accepts them. Until this is deployed,
  real (non-demo) restaurant onboarding will not persist city/state. The frontend
  cascade and demo flow work without it.
- **Command:**
  ```bash
  cd backend && sam build
  cd .aws-sam/build/ApiFunction && zip -r /tmp/api.zip .
  aws lambda update-function-code --function-name spot-api-dev \
    --zip-file fileb:///tmp/api.zip --region us-east-1
  ```
- **Verify:** Onboard a restaurant (non-demo) in Arlington, VA, then
  `GET /api/restaurants/:id` and confirm `city` + `state` are present.

### [ ] (Optional) Seed real Arlington VA + Alexandria VA restaurants
- **Added:** 2026-06-20
- **Why deferred:** Needs AWS credentials + `GOOGLE_PLACES_API_KEY` in Secrets
  Manager (`spot/api-keys-dev`). Costs ~$0.77 per run. Demo data already covers
  both cities, so this is only needed for real production data.
- **What changed:** Nothing new in code — the seeder
  (`backend/lambda-sync/seeder.mjs`) already lists both cities in `SEED_CITIES`.
- **Command:** invoke the `lambda-sync` function, e.g.
  ```bash
  aws lambda invoke --function-name spot-sync-dev \
    --payload '{"action":"seed","cities":["Arlington, VA","Alexandria, VA"]}' \
    --cli-binary-format raw-in-base64-out --region us-east-1 /tmp/seed-out.json
  cat /tmp/seed-out.json
  ```
  (Confirm the exact function name + payload contract in `backend/template.yaml` /
  `lambda-sync/index.mjs` before running.)
- **Verify:** `GET /api/restaurants?city=Arlington, VA` returns seeded rows.

---

## Done

_(move completed items here with the date, or delete them)_
