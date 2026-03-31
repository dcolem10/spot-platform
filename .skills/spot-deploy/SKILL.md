---
name: spot-deploy
description: "Deploy the Spot Platform backend using AWS SAM. Use this skill whenever Darren asks to deploy, push to AWS, ship changes, update Lambda functions, or anything related to getting code changes live on AWS. Also trigger on 'sam deploy', 'deploy backend', 'push to prod', 'ship it', or 'go live'."
---

# Spot Platform Deployment

You are deploying the Spot Platform backend to AWS using SAM (Serverless Application Model).

## Pre-Deploy Checklist

Before deploying, run through these checks:

### 1. Verify No Syntax Errors
```bash
cd backend
# Check each Lambda for basic syntax validity
for dir in lambda-api lambda-ai lambda-email lambda-lifecycle lambda-stripe lambda-sync; do
  echo "Checking $dir..."
  node --check "$dir/index.mjs" 2>&1 || echo "SYNTAX ERROR in $dir"
done
```

### 2. Run Tests (if available)
```bash
cd backend
npm test 2>&1 || echo "No tests configured or tests failed"
```

### 3. Check for Sensitive Data
Scan for accidentally committed secrets:
```bash
# Look for hardcoded keys, tokens, passwords
grep -rn "AKIA\|sk_live\|sk_test\|password\s*=" backend/ --include="*.mjs" --include="*.js" --include="*.yaml" | grep -v node_modules | grep -v ".git"
```

### 4. Verify Template
```bash
cd backend
sam validate --lint 2>&1
```

## Deploy

### Standard Deploy (guided, uses saved config)
```bash
cd backend
sam build && sam deploy
```

The `samconfig.toml` file stores deployment configuration. SAM will use it automatically.

### First-Time or Config Reset
```bash
cd backend
sam build && sam deploy --guided
```

### Deploy a Single Function (faster iteration)
If you only changed one Lambda and want a quicker deploy:
```bash
cd backend
sam build <FunctionLogicalId> && sam deploy
```
Where `<FunctionLogicalId>` is from template.yaml (e.g., `ApiFunction`, `EmailFunction`, `LifecycleFunction`).

## Post-Deploy Verification

### 1. Check CloudFormation Status
```bash
aws cloudformation describe-stacks --stack-name spot-platform --query 'Stacks[0].StackStatus' --output text
```

### 2. Test API Endpoint
```bash
# Get API URL from stack outputs
API_URL=$(aws cloudformation describe-stacks --stack-name spot-platform --query 'Stacks[0].Outputs[?OutputKey==`ApiUrl`].OutputValue' --output text)
echo "API URL: $API_URL"
curl -s "$API_URL/api/health" 2>/dev/null || echo "No health endpoint (this is OK if not implemented)"
```

### 3. Check Recent Lambda Errors
```bash
# Check for errors in the last 15 minutes
for fn in spot-platform-ApiFunction spot-platform-EmailFunction spot-platform-LifecycleFunction; do
  echo "=== $fn ==="
  aws logs filter-log-events \
    --log-group-name "/aws/lambda/$fn" \
    --start-time $(date -d '15 minutes ago' +%s000 2>/dev/null || date -v-15M +%s000) \
    --filter-pattern "ERROR" \
    --query 'events[].message' \
    --output text 2>/dev/null | head -5
done
```

## Rollback

If something goes wrong:
```bash
# Rollback to previous deployment
aws cloudformation rollback-stack --stack-name spot-platform
```

Or deploy the previous version from git:
```bash
git stash  # save current changes
sam build && sam deploy
git stash pop  # restore changes
```

## Common Issues

**"No changes to deploy"** — SAM detected no difference. Force with `sam deploy --force-upload`.

**Template validation errors** — Run `sam validate --lint` and fix any YAML issues.

**Timeout during deploy** — Lambda functions with large dependencies can take time. Check CloudFormation console for status.

**Permission errors** — Ensure AWS CLI is configured with correct credentials: `aws sts get-caller-identity`

## Security Reminders

- Never deploy with hardcoded API keys or secrets. Use Secrets Manager or SSM Parameter Store.
- Always invoke the `sre` skill before deploying significant changes to review for security risks.
- Check that ALLOWED_ORIGIN in template.yaml is set correctly for production (not `*`).
- Verify rate limiting is enabled on public endpoints before deploying.
