# Cost Analysis: Personalized Restaurant Descriptions via Anthropic API

## Feature Overview
You want to add a Lambda function that generates personalized descriptions for every restaurant in your database by calling the Anthropic Claude API. The database currently contains approximately 5,000 restaurants across 9 cities.

---

## Step 1: Identify Billable Actions

This feature touches three AWS services and one external API:

1. **Lambda** (new function or extended AI function)
   - Invocations: $0.20 per 1M requests
   - Compute: $0.0000166667 per GB-second

2. **Anthropic API** (token-based)
   - Input tokens: $0.08 per 1M tokens (Claude 3.5 Haiku)
   - Output tokens: $0.24 per 1M tokens (Claude 3.5 Haiku)
   - Pricing reference: Use Haiku for cost-conscious generation; Sonnet is 5-10x more expensive

3. **DynamoDB** (update writes)
   - Write costs: $1.25 per 1M write request units
   - GSI writes cost double (2 WRU per write for GSI updates)

4. **API Gateway**
   - REST API: $3.50 per 1M requests
   - Only if exposed as endpoint; background generation avoids this

---

## Step 2: Determine Invocation Patterns

**Key Question**: How often will descriptions be generated?

### Scenario A: One-Time Batch Generation
Generate descriptions once for all 5,000 restaurants (seeded from Google Places).

- **Volume**: 5,000 invocations
- **Execution model**: Batch job or daily sync (add to existing `spot-sync` Lambda or create new function)

### Scenario B: On-Demand Per Restaurant
Generate description when user views or adds a restaurant.

- **Volume**: Depends on user traffic (highly variable)
- **Risk**: Could trigger uncontrolled Anthropic API spend if not rate-limited

### Scenario C: Hybrid (Recommended)
- Generate descriptions once at seeding time (5,000 batch)
- Regenerate monthly for trending/updated restaurants (100-500 monthly)
- Optionally expose on-demand endpoint with per-user rate limits

**This analysis assumes Scenario C (hybrid approach)** — safest for a bootstrapped startup.

---

## Step 3: Calculate Anthropic API Costs

### Input Estimation
Each description generation requires context about one restaurant:
- Restaurant name, cuisine, location, ratings, reviews
- JSON/plain text input: **~400 tokens per restaurant**

### Output Estimation
A personalized, SEO-optimized description:
- ~150-200 words per description
- **~150 tokens per description**

### Cost Per Call (Haiku)
```
Input:  400 tokens × ($0.08 / 1,000,000) = $0.000032
Output: 150 tokens × ($0.24 / 1,000,000) = $0.000036
Total:  $0.000068 per restaurant ≈ $0.00007 (7 cents per 100 restaurants)
```

### Monthly Cost Breakdown

**Initial Batch (Month 1):**
```
5,000 restaurants × $0.000068 = $0.34
```

**Ongoing Monthly (Scenario C: Refresh 10% of restaurants):**
```
500 restaurants × $0.000068 = $0.034 ≈ $0.04
```

**Worst Case (Full refresh monthly):**
```
5,000 restaurants × $0.000068 = $0.34/month
```

**Note on Model Choice:**
- Using **Claude 3.5 Haiku**: $0.000068 per restaurant
- Switching to **Claude 3.5 Sonnet**: $0.0005 per restaurant (~7.4x more expensive)
- Switching to **Claude 3 Opus**: $0.0015 per restaurant (~22x more expensive)

**Recommendation**: Use Haiku for bulk description generation. Descriptions are low-risk content (not conversational) and don't require advanced reasoning. Reserve Sonnet/Opus for user-facing AI features.

---

## Step 4: Calculate Lambda Execution Costs

### Approach 1: Extend Existing Sync Function
Add description generation to the daily `spot-sync` Lambda (currently 300s timeout, 1024MB memory).

**Per Invocation Cost (Scenario C):**
- 500 restaurants per invocation
- Anthropic API calls: 500 requests × 5s network time per call = 2500s (running in parallel with Promise.all, assume 50s max)
- Processing overhead: 10s (JSON parsing, DynamoDB updates)
- **Total duration: ~60s per run**

Cost breakdown:
```
Lambda duration: 60s × 1024MB = 61,440 GB-milliseconds = 61.44 GB-seconds
GB-second cost: 61.44 × $0.0000166667 = $0.001024 per run

Invocation count: 1 invocation/day = 30/month
Lambda cost: (30 × $0.001024) + (30 × $0.20 / 1,000,000)
           = $0.030720 + $0.000006
           = $0.0307/month ≈ $0.03
```

### Approach 2: Create Separate Lightweight Lambda
Dedicated function with smaller memory footprint (256MB).

**Estimated cost:**
```
Duration: 120s (sequential Anthropic calls) × 256MB = 30,720 GB-ms = 30.72 GB-seconds
Cost: 30.72 × $0.0000166667 = $0.000512 per run
Monthly: $0.000512 × 30 = $0.0154/month ≈ $0.02
```

**Recommendation**: Extend `spot-sync` function. Adding a new function increases complexity and adds EventInvokeConfig/DLQ overhead. The sync function already has infrastructure for long-running tasks (300s timeout, 1024MB memory).

---

## Step 5: Calculate DynamoDB Write Costs

Each description is stored as an attribute update on the restaurant item.

**Per Update:**
- 1 write request unit (WRU) per restaurant
- GSI1 exists → write affects both base table + GSI1 → **2 WRU total per write**

**Monthly Writes:**
```
Scenario C: 500 + 5,000 (initial batch month 1) = 5,500 writes total in month 1
            500 writes/month in steady state

Month 1 WRU: 5,500 × 2 = 11,000 WRU
Steady state: 500 × 2 = 1,000 WRU/month

Cost calculation:
Month 1: 11,000 WRU × ($1.25 / 1,000,000) = $0.01375 ≈ $0.01
Ongoing: 1,000 WRU × ($1.25 / 1,000,000) = $0.00125 ≈ $0.001
```

---

## Step 6: Calculate API Gateway Costs (If Exposed)

**If descriptions are generated on-demand (endpoint: POST /api/restaurants/{id}/description):**

```
REST API request cost: $3.50 per 1M requests

Assuming:
- 100 monthly API calls (users requesting descriptions)
- 100 × ($3.50 / 1,000,000) = $0.00035 ≈ $0
```

**Recommendation**: For bulk generation, keep this as a background process (no API Gateway exposure). If you later add on-demand access, the API Gateway cost is negligible.

---

## Step 7: Total Monthly Cost Summary

### Month 1 (Initial Batch + First Refresh)
```
Anthropic API (5,000 restaurants):  $0.34
Lambda execution:                   $0.03
DynamoDB writes:                    $0.01
API Gateway (if exposed):           $0.00
─────────────────────────────────────────
TOTAL MONTH 1:                      $0.38
```

### Steady State (Monthly Refresh)
```
Anthropic API (500 restaurants):    $0.04
Lambda execution:                   $0.03
DynamoDB writes:                    $0.001
─────────────────────────────────────────
TOTAL MONTH N+1:                    $0.07/month
```

### Annual Cost (After Year 1)
```
Year 1: $0.38 + ($0.07 × 11) = $1.15
Annual steady state: $0.07 × 12 = $0.84/year
```

---

## Step 8: Budget Impact Analysis

**Current Budget**: $50/month (enforced by `BudgetAlert` in template.yaml)

### Verdict: ✅ WELL WITHIN BUDGET

Even in the worst-case scenario (full monthly refresh of all 5,000 restaurants):
```
5,000 restaurants × $0.000068 = $0.34
Lambda + DynamoDB overhead: $0.04
─────────────────────────────────────
Maximum monthly: $0.38
```

This is **0.76% of your $50 monthly budget**.

---

## Step 9: Cost Control Recommendations

### Before Deployment

1. **Add per-restaurant description caching**
   - Store generated descriptions with TTL (Time To Live)
   - Only regenerate if description is >30 days old
   - Reduces monthly refresh from 100% to 5-10%

2. **Set Anthropic API daily spend alarm**
   - Current template has `AiCostAlarm` (1000 daily AI Lambda invocations)
   - Add CloudWatch custom metric: log token counts from Anthropic API responses
   - Set daily threshold: $5 (safe buffer)

   ```yaml
   AnthropicDailySpendAlarm:
     Type: AWS::CloudWatch::Alarm
     Properties:
       MetricName: AnthropicTokensUsed
       Threshold: 70000  # Approximate daily token budget to stay under $5
       ComparisonOperator: GreaterThanThreshold
   ```

3. **Implement rate limiting on on-demand endpoint (if added later)**
   - Max 10 requests/user/day
   - Max 100 total requests/day globally
   - Prevents accidental hammering of Anthropic API

4. **Monitor Anthropic API costs weekly**
   - Log token usage from every API call in DynamoDB
   - Weekly cost report: `sum(input_tokens + output_tokens) × model_rate`

### CloudWatch Checks to Run

To verify costs before and after deployment:

```bash
# Check current Lambda invocation patterns (verify batch runs successfully)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=spot-sync-dev \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT00:00:00) \
  --end-time $(date -u +%Y-%m-%dT00:00:00) \
  --period 86400 \
  --statistics Sum

# Monitor DynamoDB write capacity after first batch
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=spot-data-dev \
  --start-time $(date -u -d '7 days ago' +%Y-%m-%dT00:00:00) \
  --end-time $(date -u +%Y-%m-%dT00:00:00) \
  --period 86400 \
  --statistics Sum
```

---

## Step 10: Comparison to Other Approaches

### Option 1: Batch Generation with Haiku (Recommended)
```
Cost: $0.34-0.38/month
Speed: ~2-5 minutes for 5,000 restaurants
Quality: Good for descriptions, SEO-friendly
Effort: 1-2 hours implementation
```

### Option 2: On-Demand Generation with Rate Limiting
```
Cost: Depends on usage (0.01-0.10/request)
Speed: Real-time per user request
Quality: Higher per-request (could use Sonnet)
Effort: 3-4 hours (caching, rate limiting, auth)
Risk: Unbounded if rate limits fail
```

### Option 3: Hybrid (Batch + Cached On-Demand)
```
Cost: $0.04-0.38/month + $0.01-0.05 per on-demand call
Speed: Instant for pre-generated, 5s for on-demand
Quality: Highest (Haiku for batch, Sonnet for on-demand premium)
Effort: 4-5 hours
```

### Option 4: Pre-Generate with GPT-3.5 (Cheaper but Lower Quality)
```
Cost: ~$0.0002/restaurant (~$1/month for full batch)
Speed: Same as Haiku
Quality: Noticeably lower for nuanced descriptions
Effort: Requires switching providers (not recommended)
```

---

## Final Recommendations

### Go/No-Go: ✅ GO

This feature is **extremely cost-effective** and safe to implement.

### Implementation Checklist

- [ ] **Use Claude 3.5 Haiku** — sufficient quality for descriptions, lowest cost
- [ ] **Extend spot-sync Lambda** — don't create a new function
- [ ] **Batch generate on-demand, not per-request** — keep Anthropic calls predictable
- [ ] **Add per-restaurant TTL caching** — reduce regeneration frequency
- [ ] **Log Anthropic token usage to DynamoDB** — track costs weekly
- [ ] **Set CloudWatch alarm for Anthropic spend** — trigger alert if >$5/day
- [ ] **Test batch job with 100 restaurants first** — verify token counts and latency
- [ ] **Monitor daily for first week post-deployment** — catch unexpected patterns early

### Infrastructure Changes Needed

1. Add Anthropic API call logic to `spot-sync` Lambda (already has API key access)
2. Add `description` and `description_generated_at` attributes to restaurant items
3. Add CloudWatch custom metric for token usage
4. Add optional on-demand endpoint `GET /api/restaurants/{id}/description` if needed

### Cost Monitoring Setup

After deployment, run these AWS CLI commands weekly:

```bash
# Weekly Anthropic spend (estimate from token logs in DynamoDB)
aws dynamodb query \
  --table-name spot-data-dev \
  --index-name GSI1 \
  --key-condition-expression "GSI1PK = :pk AND GSI1SK > :sk" \
  --expression-attribute-values "{\":pk\": {\"S\": \"ANTHROPIC_USAGE\"}, \":sk\": {\"S\": \"2026-03-02\"}}" \
  --projection-expression "tokens,created_at"
```

---

## Bottom Line

**This feature will cost you approximately $0.07-0.38/month after the initial batch.**

Your current $50/month budget comfortably covers this, even if you scale to daily regeneration of all restaurants ($10/month worst case). The Anthropic API is your only significant cost driver, and at ~$0.00007 per restaurant, it's negligible at your current scale.

**Proceed with confidence.**
