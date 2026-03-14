# /diagnose — Investigate and diagnose an issue without making changes

Do NOT make any code changes. Only investigate and report findings.

## Steps

1. **Read the relevant CLAUDE.md files** for context.

2. **Understand the reported issue:**
   - What page/feature is affected?
   - What's the expected behavior vs actual behavior?
   - Is it a frontend issue, backend issue, or both?

3. **Trace the issue:**

### If it's a frontend issue:
- Find the component in `src/features/`
- Trace the API calls — what endpoint is being called?
- Check the response handling — does it expect a different data shape?
- Check for missing null/undefined checks
- Check if a feature flag is blocking it

### If it's a backend issue:
- Find the route handler in `backend/lambda-api/index.mjs`
- Check if the endpoint exists and handles the right HTTP method
- Check auth — does it require auth? Is auth configured in template.yaml?
- Check DynamoDB queries — are the PK/SK patterns correct?
- Check if env vars are needed but missing

### If it's a deployment/infra issue:
- Check CORS: `curl -s -I -H "Origin: https://main.dc04hhpr1ng78.amplifyapp.com" https://a2b7grybv4.execute-api.us-east-1.amazonaws.com/dev/api/health`
- Check Lambda logs: `aws logs tail /aws/lambda/spot-api-dev --since 5m --region us-east-1`
- Check if the latest code is actually deployed (code might be committed but not deployed to Lambda)

4. **Report findings:**
   - Root cause (or top 2-3 hypotheses)
   - Which files are involved
   - Recommended fix (but don't implement it)
   - Risk level (low/medium/high)

Issue to investigate: $ARGUMENTS
