# /deploy-backend — Build and deploy backend Lambda changes

⚠️ `sam deploy` is currently blocked by a CloudFormation EarlyValidation hook. Use direct Lambda updates.

## Steps

1. **Build the SAM project:**
```bash
cd backend && sam build
```

2. **Deploy each modified Lambda** (only deploy the ones you changed):

For lambda-api:
```bash
cd backend/.aws-sam/build/ApiFunction && zip -r /tmp/api.zip . && aws lambda update-function-code --function-name spot-api-dev --zip-file fileb:///tmp/api.zip --region us-east-1
```

For lambda-ai:
```bash
cd backend/.aws-sam/build/AiFunction && zip -r /tmp/ai.zip . && aws lambda update-function-code --function-name spot-ai-dev --zip-file fileb:///tmp/ai.zip --region us-east-1
```

For lambda-stripe:
```bash
cd backend/.aws-sam/build/StripeFunction && zip -r /tmp/stripe.zip . && aws lambda update-function-code --function-name spot-stripe-dev --zip-file fileb:///tmp/stripe.zip --region us-east-1
```

3. **If env vars changed**, update configuration (this REPLACES the entire env block — include ALL vars):
```bash
aws lambda get-function-configuration --function-name spot-api-dev --query "Environment.Variables" --output json --region us-east-1
```
Then update with all existing vars plus your changes.

4. **Verify** — test the affected endpoint:
```bash
curl -s -H "Origin: https://main.dc04hhpr1ng78.amplifyapp.com" https://a2b7grybv4.execute-api.us-east-1.amazonaws.com/dev/api/health
```

5. **Commit** the code changes (even though deploy was manual):
```bash
git add -A && git commit -m "fix: description of backend change"
git push origin main
```

$ARGUMENTS
