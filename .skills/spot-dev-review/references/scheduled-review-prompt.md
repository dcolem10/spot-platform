# Weekly Spot Platform Strategic Review — Scheduled Task Prompt

**Task Name:** `weekly-spot-strategic-review`
**Schedule:** `0 9 * * 1` (Every Monday at 9:00 AM local time)

## Prompt (self-contained for autonomous execution)

Perform a comprehensive development review of the Spot Platform codebase. This is a creator-first restaurant attribution platform built on React 18 + TypeScript with an AWS SAM backend (Lambda, DynamoDB, Cognito, API Gateway).

### Steps

1. Read the strategic review document at `Spot-Platform-Strategic-Review.docx` in the project root. Convert it with `pandoc Spot-Platform-Strategic-Review.docx -t markdown --wrap=none` to extract the text.

2. Inventory the codebase by inspecting:
   - `backend/template.yaml` (SAM template — all deployed resources)
   - Each Lambda directory under `backend/` (lambda-api, lambda-ai, lambda-email, lambda-lifecycle, lambda-stripe, lambda-sync)
   - Frontend feature directories under `src/features/`
   - `.github/workflows/` (CI/CD pipeline)
   - `backend/lambda-api/helpers.mjs` and `backend/lambda-api/helpers.test.mjs`

3. Check git log (`git log --oneline -20`) to see recent development activity and velocity.

4. Map implemented features against the strategic review's Priority Matrix (Section 6), categorizing each as Completed, In Progress, or Not Started. The three tiers are:
   - **Tier 1 (Blocks Launch):** User isolation, soft-delete, campaign update fix, email notifications, creator onboarding, Stripe integration
   - **Tier 2 (Unlocks Revenue):** Campaign ROI calculator, AI content ideas, editorial calendar UI, benchmarking endpoint, CI/CD pipeline
   - **Tier 3 (Backlog):** Collaborative campaigns, creator ambassador program, campaign report PDF, test coverage, Concept 2 rollout

5. Run a security and operational health check:
   - Verify input sanitization patterns (parseBody, decodePaginationKey, field validators)
   - Check rate limiting on public endpoints
   - Verify PII handling in CloudWatch logs
   - Check dependency versions in package.json files for outdated or vulnerable packages
   - Review error handling patterns (try/catch around JSON.parse, DynamoDB calls)

6. Generate a markdown status report saved to the project root as `dev-status-report.md` with these sections:
   - **Completed Features** (with evidence from the codebase)
   - **In Progress / Partially Complete**
   - **Not Started**
   - **Security & Operational Status**
   - **Recommended Next Sprint** (top 3-5 items, ordered by strategic priority)
   - **Strategic Review Updates** (suggested changes to the living document)

7. If any strategic review updates are warranted (features completed ahead of schedule, new risks discovered, priority shifts needed), note them clearly in the report so the developer can decide whether to update the .docx.

### Success Criteria

A clear, actionable `dev-status-report.md` that tells the developer exactly what to work on next, ordered by strategic priority, with evidence from the actual codebase.
