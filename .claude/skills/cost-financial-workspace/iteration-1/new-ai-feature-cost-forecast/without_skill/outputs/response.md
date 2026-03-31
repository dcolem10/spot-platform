# Cost Analysis: Restaurant Description Generation Lambda Function

## Executive Summary

Adding a Lambda function that generates personalized restaurant descriptions via the Anthropic API for ~5,000 restaurants will cost approximately **$50-150/month** depending on execution frequency and description length. The primary cost driver is the Anthropic API, not AWS infrastructure.

---

## 1. System Context

**Project Details:**
- Platform: Spot Platform (serverless SaaS on AWS)
- Total restaurants: ~5,000 across 9 cities
- Existing infrastructure: DynamoDB, Lambda, API Gateway
- Current budget alert: $50/month (line 418 in template.yaml)

**Key Assumptions:**
- Descriptions are generated once per restaurant (not per request)
- ~500-1,000 tokens per generated description (varies by detail level)
- Anthropic API model: Claude 3.5 Haiku (most cost-effective for bulk generation)
- Execution via scheduled Lambda or batch job

---

## 2. Anthropic API Cost Calculation

### Current Anthropic Pricing (as of Feb 2025)

**Claude 3.5 Haiku:**
- Input: $0.80 / 1M tokens
- Output: $4.00 / 1M tokens

### Cost Per Description

**Assumptions:**
- System prompt (constant): ~150 tokens
- Restaurant context prompt: ~300 tokens
- Total input per restaurant: ~450 tokens
- Generated description (output): ~600 tokens

**Cost per restaurant:**
```
Input cost:  450 tokens × ($0.80 / 1,000,000) = $0.00036
Output cost: 600 tokens × ($4.00 / 1,000,000) = $0.00240
Total per restaurant: $0.00276 (~0.3 cents)
```

### Total Cost for 5,000 Restaurants

**One-time bulk generation:**
```
5,000 restaurants × $0.00276 = $13.80
```

**Monthly cost (if regenerating all descriptions monthly):**
```
$13.80 / month
```

**Quarterly refresh (once every 3 months):**
```
$13.80 / 3 = $4.60 / month
```

---

## 3. AWS Lambda Cost Calculation

### Function Specifications

Based on template.yaml patterns, estimated configuration:
- Memory: 512 MB (standard for AI operations in this project)
- Timeout: 60 seconds (sufficient for API call + processing)
- Duration: ~3-5 seconds per invocation (including API call)

### AWS Pricing (US East 1, as of Feb 2025)

**Lambda:**
- Compute: $0.0000166667 per GB-second
- Free tier: 1,000,000 invocations/month + 400,000 GB-seconds/month

**One-time batch generation (5,000 restaurants):**
```
Invocations: 5,000
Compute time per invocation: 5 seconds
Memory: 512 MB = 0.5 GB

Total GB-seconds: 5,000 invocations × 0.5 GB × 5 seconds = 12,500 GB-seconds

Cost: 12,500 GB-seconds × $0.0000166667 = $0.21
(Within free tier for month, so effectively $0.00)
```

**Monthly cost (if running 5,000 per month):**
```
12,500 GB-seconds × $0.0000166667 = $0.21 / month
(Within free tier, so effectively $0.00)
```

**Key point:** AWS Lambda costs are negligible; free tier easily accommodates this workload.

---

## 4. Additional AWS Service Costs

### DynamoDB (Read/Write)

The function will read restaurant metadata and write generated descriptions:

**Assumptions:**
- Read 1 item per restaurant: 5,000 reads
- Write 1 item per restaurant: 5,000 writes
- DynamoDB is on PAY_PER_REQUEST billing (line 42 in template.yaml)

**DynamoDB Pricing (on-demand):**
- Reads: $1.25 per 1M requests
- Writes: $6.25 per 1M requests

**One-time cost:**
```
Reads:  5,000 × ($1.25 / 1,000,000) = $0.0063
Writes: 5,000 × ($6.25 / 1,000,000) = $0.0313
Total DynamoDB: $0.0376 (~0.04 cents, negligible)
```

### Secrets Manager (API Key Retrieval)

Assuming ANTHROPIC_API_KEY is already stored (line 30 in template.yaml):

**Secrets Manager Pricing:**
- First secret: $0.40/month
- API call: $0.05 per 10,000 API calls

**If called once per Lambda invocation:**
```
5,000 invocations × ($0.05 / 10,000) = $0.025 / month
(Total with secret storage: ~$0.40/month, already in budget)
```

### CloudWatch Logs

**CloudWatch Logs Pricing:**
- Ingestion: $0.50 per GB
- Storage: $0.03 per GB-month

**Estimated log volume per invocation:** ~2 KB

**One-time batch:**
```
5,000 invocations × 2 KB = 10 MB = 0.01 GB
Cost: 0.01 GB × $0.50 = $0.005 (ingestion)
Storage (30 days): negligible
```

**Monthly (if recurring):**
```
5,000 invocations × 2 KB × $0.50 per GB = $0.05 / month
```

---

## 5. Total Cost Summary

### One-Time Initial Generation (5,000 restaurants)

| Component | Cost |
|-----------|------|
| Anthropic API | $13.80 |
| AWS Lambda | $0.00 (free tier) |
| DynamoDB | $0.04 |
| CloudWatch Logs | $0.01 |
| Secrets Manager | $0.00 (amortized) |
| **TOTAL** | **$13.85** |

### Monthly Costs (Different Scenarios)

**Scenario A: One-time generation only**
```
$13.85 / 12 months = $1.16 / month (amortized)
```

**Scenario B: Monthly regeneration of all 5,000 descriptions**
```
Anthropic API: $13.80
AWS services: ~$0.10
Total: $13.90 / month
```

**Scenario C: Quarterly refresh (most realistic)**
```
Anthropic API: $13.80 / 3 = $4.60 / month
AWS services: ~$0.03 / month
Total: $4.63 / month
```

**Scenario D: Weekly refresh (heavy usage)**
```
Anthropic API: $13.80 × 4.33 = $59.75 / month
AWS services: ~$0.40 / month
Total: $60.15 / month
```

---

## 6. Budget Impact Analysis

**Current monthly budget:** $50 (line 418 in template.yaml)

**Budget headroom with new feature:**

| Scenario | Monthly Cost | Budget Remaining |
|----------|--------------|------------------|
| One-time (amortized) | $1.16 | $48.84 ✓ |
| Quarterly refresh | $4.63 | $45.37 ✓ |
| Monthly refresh | $13.90 | $36.10 ✓ |
| Weekly refresh | $60.15 | -$10.15 ✗ |

**Recommendation:** Quarterly or less frequent refresh fits within budget. Monthly refresh approaches budget limit.

---

## 7. Cost Optimization Strategies

### 1. Use Claude 3.5 Haiku Instead of Opus/Sonnet
- **Already recommended:** Haiku is 90% cheaper than Claude 3 Sonnet
- Sufficient quality for restaurant descriptions
- Savings: ~$0.002 per description

### 2. Batch Processing with SQS
- Reduce Lambda cold starts by batching 10-50 descriptions per invocation
- Would reduce Lambda invocation count by 90%
- AWS Lambda cost reduction: Already negligible
- Implementation complexity: Moderate

### 3. Implement Incremental Updates
- Only regenerate descriptions for new/modified restaurants
- Estimated 10-20% monthly change rate
- Reduction: From $13.80 to $2.76 per month

### 4. Add Caching Layer
- Cache descriptions in ElastiCache or CloudFront
- Serves cached descriptions instead of regenerating
- Reduction: From $13.80 to near $0 for read operations

### 5. Use Cheaper Models for Variations
- Use Haiku for initial generation ($0.00276/description)
- Use cheaper API for regeneration requests
- Estimate: 20-40% cost reduction

---

## 8. Implementation Pattern

Based on the template.yaml structure, recommended approach:

### Lambda Configuration

```yaml
RestaurantDescriptionFunction:
  Type: AWS::Serverless::Function
  Properties:
    FunctionName: !Sub spot-description-${Environment}
    CodeUri: lambda-descriptions/
    Handler: index.handler
    Timeout: 120
    MemorySize: 512
    Environment:
      Variables:
        TABLE_NAME: !Ref DataTable
        SECRETS_ARN: !Ref SecretsArN
    Policies:
      - DynamoDBCrudPolicy:
          TableName: !Ref DataTable
      - Statement:
          - Effect: Allow
            Action: secretsmanager:GetSecretValue
            Resource: !Ref SecretsArn
    Events:
      GenerateDescriptions:
        Type: Schedule
        Properties:
          Schedule: rate(3 months)  # Quarterly
          Description: Generate restaurant descriptions
          Enabled: true
```

### Key Points:
- Reuse existing Secrets Manager (ANTHROPIC_API_KEY already configured)
- Follow DynamoDB patterns from existing Lambdas
- Schedule as quarterly task to minimize cost
- Implement error handling with DLQ (SQS pattern already in template)

---

## 9. Risks and Considerations

### Cost Risks
1. **Token overage:** If descriptions exceed 600 tokens, cost increases proportionally
2. **Frequency creep:** Pressure to regenerate more frequently increases costs
3. **API rate limits:** Large batch jobs may hit Anthropic rate limits

### Quality Risks
1. **Description relevance:** Haiku may produce less nuanced descriptions than Sonnet
   - Mitigation: Test with sample restaurants before full rollout
2. **Data freshness:** Quarterly refresh means stale data
   - Mitigation: Prioritize new/modified restaurants for immediate refresh

### Integration Risks
1. **Current $50 budget limit is restrictive** for AI features
   - Monthly costs of $13.90 consume 28% of budget
   - Recommend increasing budget to $75-100/month for headroom

---

## 10. Conclusion

**Bottom line:** Adding a restaurant description Lambda function is **cost-effective and feasible** within current budgets.

**Recommended approach:**
- **Monthly cost:** $4-15 depending on refresh frequency
- **Best practice:** Quarterly regeneration = $4.63/month
- **Model choice:** Claude 3.5 Haiku (optimal price/quality)
- **AWS cost:** Negligible (under free tier)
- **Budget impact:** Moderate (9-28% of $50 budget)

**Next steps:**
1. Confirm refresh frequency with product team
2. Run 100-restaurant pilot to validate token estimates
3. Monitor Anthropic API costs in first month
4. Consider budget increase if frequent updates needed
