# Spot Platform — Claude Context Guide

## What Is Spot?

Spot is a two-sided marketplace connecting food creators (influencers) with restaurants for paid content partnerships. Creators discover restaurants, propose campaigns, create content, track redemptions via QR/promo codes, and measure ROI. Restaurants get authentic social media exposure and track attribution back to real sales.

## Business Roles

- **Creator** — food influencer who runs campaigns, creates content, manages offers
- **Partner** (Restaurant) — business that receives proposals, approves content, tracks attribution
- **Audience** (Insider) — consumer who discovers restaurants and redeems deals

## Architecture Overview

```
Frontend (React 18 + Vite + TypeScript)
  → AWS Amplify Hosting (https://main.dc04hhpr1ng78.amplifyapp.com)
  → Cognito Auth (JWT tokens)

Backend (AWS SAM + Node.js 20 Lambda)
  → API Gateway (https://a2b7grybv4.execute-api.us-east-1.amazonaws.com/dev/)
  → DynamoDB (single-table: spot-data-dev)
  → Secrets Manager, KMS, SES, S3

Payments: Stripe (3 tiers: $49, $99, $149/mo)
POS: Square (live), Clover (live), Toast (pending partner approval)
AI: Anthropic Claude API for insights/recommendations
```

## Key URLs

- **Production app:** https://main.dc04hhpr1ng78.amplifyapp.com
- **API base:** https://a2b7grybv4.execute-api.us-east-1.amazonaws.com/dev/
- **Cognito User Pool:** us-east-1_foUcNKd5K
- **Test account:** networth589+darrenspot@gmail.com (Creator role)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 6, React Router 6 |
| State | Zustand 5 (auth), TanStack React Query 5 (server state) |
| Auth | AWS Amplify + Cognito |
| Backend | AWS Lambda (Node.js 20, ES modules) |
| Database | DynamoDB (single-table design, 3 GSIs) |
| IaC | AWS SAM (template.yaml) |
| Payments | Stripe |
| Email | AWS SES |
| Hosting | AWS Amplify |

## Development Workflow

### Local Development
```bash
npm run dev          # Start Vite dev server on localhost:5173
```

### Backend Deployment
⚠️ `sam deploy` is currently blocked by a CloudFormation `EarlyValidation::ResourceExistenceCheck` hook. Use direct Lambda updates instead:
```bash
# Build
cd backend && sam build

# Deploy individual Lambda code
cd .aws-sam/build/ApiFunction && zip -r /tmp/api.zip .
aws lambda update-function-code --function-name spot-api-dev --zip-file fileb:///tmp/api.zip --region us-east-1

# Update env vars (REPLACES entire env block — include ALL vars)
aws lambda update-function-configuration --function-name spot-api-dev --environment 'Variables={...all vars...}' --region us-east-1
```

### Frontend Deployment
Push to `main` branch → Amplify auto-deploys.

## Critical Rules

1. **Never expose secrets.** API keys, Stripe keys, POS credentials go in Secrets Manager or Lambda env vars — never in code or git.
2. **CORS origins.** Production origin is `https://main.dc04hhpr1ng78.amplifyapp.com`. Lambda code dynamically matches request Origin against `ALLOWED_ORIGINS` env var. If you add a new origin, update all 3 Lambdas (api, ai, stripe).
3. **DynamoDB keys.** Always strip PK, SK, GSI keys, creatorId, and sensitive fields before returning data to clients. Use the `stripDdbKeys()` helper.
4. **Auth enforcement.** Every mutation must verify `getUserId(event)` matches the resource owner. Public endpoints must be explicitly marked in template.yaml with `Auth: Authorizer: NONE`.
5. **Lambda env vars.** When updating via `update-function-configuration`, you must pass ALL existing env vars — it replaces the entire block.
6. **Commit after every change.** Use conventional commit messages. Push to trigger Amplify deploy.
7. **Test on production URL.** After any backend change, verify at https://main.dc04hhpr1ng78.amplifyapp.com — not just localhost.

## Project Structure

```
spot-platform/
├── src/                          # React frontend
│   ├── features/                 # Feature modules
│   │   ├── concept1-platform/    # Creator-Restaurant partnerships
│   │   ├── concept2-insider/     # Consumer discovery
│   │   ├── concept3-spotops/     # Creator tools (dashboard, calendar, etc.)
│   │   ├── landing/              # Public landing page
│   │   ├── auth/                 # Login/signup
│   │   ├── onboarding/           # Role-based onboarding
│   │   └── raffles/              # Raffle system
│   ├── components/               # Shared UI components
│   ├── services/ApiService.ts    # HTTP client with Cognito auth
│   ├── store/authStore.ts        # Zustand auth state
│   ├── hooks/                    # useAuth, useAuthInit
│   ├── lib/                      # Amplify config, feature flags, query client
│   └── types/index.ts            # All TypeScript interfaces
├── backend/
│   ├── template.yaml             # SAM infrastructure definition
│   ├── samconfig.toml            # Deployment parameters
│   ├── lambda-api/               # Main API (5600+ lines, all business logic)
│   ├── lambda-ai/                # AI insights (Anthropic integration)
│   ├── lambda-stripe/            # Payment processing
│   ├── lambda-email/             # SES email delivery
│   ├── lambda-sync/              # POS data synchronization
│   ├── lambda-lifecycle/         # Scheduled cleanup tasks
│   └── lambda-ses-handler/       # Bounce/complaint handling
└── .claude/                      # Claude Code skills and worktrees
```

## Feature Flags

Control via environment variables in `.env`:
- `VITE_ENABLE_RESTAURANT_PORTAL` — partner portal (default: true)
- `VITE_ENABLE_MEMBERSHIP` — insider membership (default: true)
- `VITE_ENABLE_MULTI_CREATOR` — multi-creator campaigns (default: false)
- `VITE_DEMO_MODE` — bypass auth for dev (default: true)

## Cost Awareness

AWS budget alarm is set at $50/month. Before adding new resources:
- Lambda: each invocation costs ~$0.0000002. AI Lambda (Anthropic calls) is the biggest cost driver.
- DynamoDB: PAY_PER_REQUEST billing. No capacity concerns at current scale.
- API Gateway: throttled at 20 req/sec burst 50.
- Always check if a feature will increase API call volume significantly.
