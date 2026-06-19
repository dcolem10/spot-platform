# Agent Safety Audit — Backend Lambdas

_Phase 2a of the AI engineering improvement plan, adapted to the real stack
(Node.js 20 / DynamoDB / Anthropic — not the Python/RDS/OpenAI stack the
original plan assumed)._

## What was checked

For every Lambda, four guardrail questions:

1. **Iteration cap** — is every loop bounded so it cannot run away?
2. **Empty-result handling** — are empty/null API or DB responses handled
   explicitly (so an empty result can't drive an infinite retry)?
3. **Timeout** — is a Lambda timeout configured (default is 3s if unset; this
   stack sets a global 15s default in `template.yaml` Globals)?
4. **Token logging** — if it calls an LLM, does it log token usage?

## Findings

| Lambda | Loops bounded | Empty-result handling | Timeout | LLM token logging |
|--------|:-------------:|:---------------------:|:-------:|:-----------------:|
| lambda-ai | ✅ no loops | ⚠️ partial | ✅ 60s | ❌ → ✅ **fixed** |
| lambda-api | ✅ capped (1000) | ✅ | ✅ 15s | n/a (no LLM) |
| lambda-sync | ✅ capped (1000/2000) | ✅ | ✅ 300s | n/a (logs $ est.) |
| lambda-stripe | ✅ no loops | ✅ | ✅ 30s | n/a |
| lambda-lifecycle | ✅ capped (500/1000) | ✅ | ✅ 120s | n/a |
| lambda-email | ✅ no loops | ✅ | ✅ 10s | n/a |
| lambda-ses-handler | ✅ bounded (50) | ✅ | ✅ 10s | n/a |

### Notes per Lambda

- **lambda-ai** — 3 Anthropic call sites (`/ai/recommendations`,
  `/ai/content-ideas`, `/ai/campaign-insights`). No unbounded loops. Already
  has good cost controls: 10 req/hr/user rate limit, 1hr/30min response
  caching, 5KB input caps, `max_tokens` caps (1500–2000), and 50s fetch
  timeouts. **Gap: no token-usage logging** — fixed in this change set (see
  below).
- **lambda-api** — pagination `do-while` loops at the restaurant seeder and
  calendar fetch are both capped (`MAX_RESTAURANTS = 1000`, explicit `lastKey`
  termination). Calls many external APIs (POS OAuth, Google Places, social
  graph) but each checks `res.ok` before parsing.
- **lambda-sync** — two pagination loops, both capped (1000 / 2000) with
  `Limit: 100` per page; Google Places calls batched 5-at-a-time with 1s
  delays, a 200-request cap, and an estimated-cost log line on completion.
- **lambda-stripe** — no loops; webhook idempotency via conditional write
  (fail-closed), signature verification fails closed when the secret is
  missing.
- **lambda-lifecycle** — scan loop capped (`SCAN_CAP = 1000`), plus
  `MAX_CREATORS_PER_RUN = 500`, `MAX_EMAILS_PER_RUN = 50`, and a remaining-time
  guard that stops work with <10s left.
- **lambda-email / lambda-ses-handler** — no loops or bounded iteration over
  SNS recipients (`MAX_RECIPIENTS = 50`); suppression checks before send.

## Assessment

The "runaway loop burns the budget overnight" scenario the plan was written to
prevent is **already largely mitigated**: every loop in the codebase has a hard
cap, and the only LLM Lambda has per-user rate limits plus response caching.
The two real gaps were **(a)** no visibility into Anthropic token spend and
**(b)** no AWS-level billing alarm.

## What this change set added

1. **`backend/lambda-ai/guardrails.mjs`** — a reusable Node module:
   `checkIterationLimit`, `handleEmptyResult`, `logTokenUsage`,
   `extractAnthropicUsage`, and the `AgentBudgetExceeded` /
   `EmptyResultMaxRetriesExceeded` errors. Constants mirror the plan
   (`MAX_ITERATIONS = 25`, `MAX_TOKENS_PER_RUN = 50000`,
   `EMPTY_RESULT_MAX_RETRIES = 3`).
2. **Token logging wired into lambda-ai** — all three Anthropic calls now emit
   a structured `[TOKEN_USAGE]` line (CloudWatch Insights-aggregatable) and a
   `[TOKEN_WARNING]` past the 50k threshold.
3. **Billing alarms as IaC in `template.yaml`** — an SNS topic
   (`spot-cost-alerts-${Environment}`) with email subscription, plus
   `EstimatedCharges` alarms at **$20** (early warning) and **$50** (budget
   cap). Codified as CloudFormation rather than imperative CLI so they are
   versioned and repeatable.

## Notes / follow-ups (not done here)

- **Deploy of the alarms** requires an environment with AWS access (this
  remote sandbox has no AWS CLI/credentials). Billing metrics only exist in
  `us-east-1`, where this stack already deploys. The email subscription must be
  confirmed via the link AWS sends.
- `guardrails.mjs` currently lives only in `lambda-ai` (each Lambda is zipped
  independently, like `logger.mjs`). Copy it into another Lambda's directory if
  that Lambda later grows an agentic loop or LLM call.
- Consider a per-user **daily** Anthropic spend cap (today's limit is per-hour
  request count, not token cost) once real usage data exists.
