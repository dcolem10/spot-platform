# Agent Instructions — Spot Platform

## For All Claude Agents (Claude Code, Claude Cowork, or any other session)

Read this file first. Then read the relevant CLAUDE.md files before doing anything.

## Context Files (Read These First)

| File | When to Read | What It Contains |
|------|-------------|-----------------|
| `/CLAUDE.md` | Always | Business context, architecture, deployment rules, critical safety rules |
| `/src/CLAUDE.md` | Any frontend work | React patterns, styling (CSS vars, NOT Tailwind), component conventions, routing |
| `/backend/CLAUDE.md` | Any backend work | DynamoDB schema, API routes, Lambda patterns, POS integration, env vars |

## Slash Commands

These are in `.claude/commands/` and should be used when relevant to the user's request:

| Command | When to Use |
|---------|------------|
| `/fix-page` | User reports a broken page, error, or data not loading |
| `/deploy-backend` | Backend code was changed and needs to go live |
| `/new-feature` | User wants to add something new to the app |
| `/review` | Security audit, code quality check, or cost review |
| `/polish-page` | UI/UX improvements to an existing page |
| `/diagnose` | Investigate an issue without making changes |

## How to Handle Any User Request

1. **Read context first.** Before writing any code, read `/CLAUDE.md` and the relevant subdirectory CLAUDE.md. This is non-negotiable — the codebase has specific patterns that must be followed.

2. **Identify the request type.** Is it a bug fix, new feature, UI polish, backend change, deployment, or investigation? Use the matching slash command workflow.

3. **Follow established patterns.** This codebase has strict conventions:
   - Frontend: CSS custom properties (no Tailwind), ApiService for all API calls, React Query for server state, Zustand only for auth
   - Backend: Single-table DynamoDB, stripDdbKeys on all responses, getUserId for auth, CORS via setRequestOrigin
   - Deployment: `sam deploy` is BLOCKED — use direct Lambda updates via AWS CLI (see `/deploy-backend` command)

4. **Never expose secrets.** No API keys, POS credentials, Stripe keys, or Cognito secrets in code or git. They go in Lambda env vars or Secrets Manager.

5. **Always commit and push.** Frontend auto-deploys via Amplify on push to `main`. Use conventional commit messages:
   - `fix:` for bug fixes
   - `feat:` for new features
   - `style:` for UI/UX polish
   - `refactor:` for code cleanup
   - `chore:` for config/tooling changes

6. **Test on production URL.** After any change, verify at https://main.dc04hhpr1ng78.amplifyapp.com — not just localhost.

## Key Architecture Decisions

- **Single Lambda for API:** `lambda-api/index.mjs` handles ALL business logic routes (~5600 lines). Don't split it.
- **Single DynamoDB table:** `spot-data-dev` with 3 GSIs. All entities share one table. Follow existing PK/SK patterns.
- **CORS is dynamic:** Lambdas check request Origin against ALLOWED_ORIGINS env var. Both localhost and production work simultaneously.
- **Demo mode exists:** `VITE_DEMO_MODE=true` bypasses auth for local development.
- **Cost ceiling:** AWS budget alarm at $50/month. AI Lambda (Anthropic calls) is the biggest cost driver.

## Current Known Issues

- `sam deploy` blocked by CloudFormation `EarlyValidation::ResourceExistenceCheck` hook — use direct Lambda updates instead
- Toast POS integration requires partner approval (not self-service)
- Production sync (`POST /api/pos/sync`) returns 501 — only dev mode synthetic data works currently

## Owner

Darren (networth589@gmail.com) — early-career engineer, self-taught. Prefers Claude to handle as much code and infrastructure as possible. Explain decisions when asked, but default to just doing the work.
