---
name: spot-dev-review
description: "Audit the Spot Platform codebase against the Strategic Review document to identify completed features, gaps, and next priorities. Use this skill whenever Darren asks about project status, what to work on next, sprint planning, progress review, roadmap alignment, or anything related to checking how the codebase lines up with the strategic plan. Also trigger when the user says 'review', 'what's next', 'sprint', 'progress', 'roadmap', 'status update', or 'strategic review'."
---

# Spot Platform Development Review

You are auditing the Spot Platform codebase against its Strategic Review document to determine current progress, identify gaps, and recommend next priorities.

## Context

Spot Platform is a creator-first restaurant attribution platform for DC food creators. The strategic review lives at `Spot-Platform-Strategic-Review.docx` in the project root. The codebase uses React 18 + TypeScript on the frontend and AWS SAM (Lambda, DynamoDB, Cognito, API Gateway) on the backend.

## How to Perform the Review

### Step 1: Read the Strategic Review

Convert and read the strategic review document:
```bash
pandoc Spot-Platform-Strategic-Review.docx -t markdown --wrap=none
```
If pandoc isn't available, use the docx skill to extract the text.

### Step 2: Inventory the Codebase

Check these key areas to understand what exists:

**Backend Lambdas:**
```bash
ls backend/
# Check each Lambda's index.mjs for implemented endpoints
```

Key files to inspect:
- `backend/template.yaml` — SAM template showing all deployed resources
- `backend/lambda-api/index.mjs` — Core API routes and handlers
- `backend/lambda-ai/index.mjs` — AI-powered features (recommendations, content ideas, campaign insights)
- `backend/lambda-stripe/index.mjs` — Payment integration
- `backend/lambda-email/index.mjs` — Email templates and sending
- `backend/lambda-lifecycle/index.mjs` — Lifecycle automation (day 1/14/28 emails)
- `backend/lambda-sync/index.mjs` — External data sync
- `backend/lambda-api/helpers.mjs` — Shared utilities
- `.github/workflows/ci.yml` — CI/CD pipeline

**Frontend Features:**
```bash
ls src/features/
# Check each feature directory for implemented components
```

Key directories:
- `src/features/concept1-platform/` — Restaurant platform (Concept 1)
- `src/features/concept2-insider/` — Audience insider (Concept 2)
- `src/features/concept3-spotops/` — Creator tools (Concept 3)
- `src/features/onboarding/` — Onboarding flows
- `src/features/auth/` — Authentication
- `src/features/shared/` — Shared components

### Step 3: Map Features to Strategic Review

Use the strategic review's priority matrix (Section 6) as your checklist. For each feature, determine its status:

**Tier 1: Do Now (Blocks Launch)**
- User isolation in DynamoDB queries
- Soft-delete + archive for campaigns
- Fix campaign update GSI inefficiency
- Email notifications (day 1, 14, 28)
- Creator onboarding flow
- Stripe integration (subscriptions)

**Tier 2: Schedule (Unlocks Revenue)**
- Campaign ROI calculator
- AI content ideas enhancement
- Editorial calendar UI improvement
- Benchmarking data endpoint
- CI/CD pipeline

**Tier 3: Backlog (Post-Launch)**
- Collaborative campaigns (multi-creator)
- Creator ambassador program
- Campaign report PDF export
- Test coverage (50%)
- Concept 2 audience rollout

Also check the "Critical Issues" from Section 5:
1. User isolation in DynamoDB queries
2. AI costs unbounded (per-user rate limiting)
3. Zero test coverage
4. No CI/CD pipeline
5. Secrets in CloudFormation parameters

### Step 4: Security & Operational Health Check

Review these aspects:
- Input sanitization patterns (parseBody, field validators)
- Rate limiting on public endpoints
- PII handling in logs
- Dependency versions (check package.json files for outdated packages)
- Error handling patterns (try/catch around JSON.parse, DynamoDB calls)

### Step 5: Generate the Report

Produce a structured report with these sections:

```
## Spot Platform Development Status Report
Date: [current date]

### Completed Features
[List each completed feature with evidence from the codebase]

### In Progress / Partially Complete
[Features that exist but need more work]

### Not Started
[Features from the roadmap that have no code yet]

### Security & Operational Status
[Summary of security posture, dependency health, operational concerns]

### Recommended Next Sprint
[Top 3-5 items to work on next, ordered by strategic priority]
Based on the strategic review's priority matrix, considering:
- What tier the feature is in
- Dependencies between features
- Current momentum (what's partially done)

### Strategic Review Updates
[Suggest any updates to the strategic review document based on:
- Features that shipped ahead of schedule
- New risks or blockers discovered
- Market changes that affect prioritization
- Technical debt that needs addressing]
```

## Important Notes

- The strategic review is a living document. If you find items that are complete or priorities that should shift, recommend specific updates.
- Always check the actual code, not just file existence. A file might exist but contain placeholder code.
- Look at git log for recent changes to understand development velocity and direction.
- When recommending next steps, consider Darren's preference for Claude handling as much code and infrastructure as possible — recommend items that can be built autonomously.
