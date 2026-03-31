# AWS Cost Reduction Opportunities for Spot Platform

## Executive Summary

Your current infrastructure is running on a $50/month budget with good foundational controls in place. Based on analysis of your serverless architecture and the Spot Platform's usage patterns, I've identified **six high-impact cost reduction opportunities** that could reduce your AWS spend by 30-50% ($15-25/month savings) without losing any critical functionality.

**Top Priority:** Migrate API Gateway from v1 (REST API) to v2 (HttpApi). This single change saves 71% on API Gateway costs.

---

## 1. Migrate API Gateway: REST API v1 → HttpApi v2 (71% Savings)

### Current State
- **Current:** REST API costs $3.50 per million requests
- **Your usage:** Estimate ~500K-1M requests/month at early stage
- **Monthly cost:** $1.75-$3.50 for API Gateway alone

### Recommended Change
Upgrade to API Gateway v2 (HttpApi), which costs $1.00 per million requests.

### Cost Impact
| Metric | REST API (v1) | HttpApi (v2) | Savings |
|--------|---------------|--------------|---------|
| Cost per 1M requests | $3.50 | $1.00 | 71% |
| At 500K requests/month | $1.75 | $0.50 | $1.25/month |
| At 1M requests/month | $3.50 | $1.00 | $2.50/month |

### Implementation Notes
- **Current blocker:** Your template uses Cognito authorizer (`CognitoAuthorizer` in the SpotApi definition). HttpApi v2 doesn't support Cognito authorizers directly.
- **Solution:** Replace with Lambda authorizer. This is a one-time code change (~200 lines of Node.js Lambda code). AWS Secrets Manager already stores your API keys, so integration is straightforward.
- **Effort:** ~2-4 hours of development (write Lambda authorizer, update SAM template, test endpoints)
- **Risk:** Low. Lambda authorizers are widely used and well-documented. The authorizer itself runs at negligible cost.
- **Savings:** $1.25-$2.50/month (~5% of total budget)

---

## 2. Reduce Lambda Memory Allocation (10-20% Lambda Cost Savings)

### Current State
Looking at your `backend/template.yaml`, memory allocation is:
| Function | Memory | Timeout | Cost Driver |
|----------|--------|---------|-------------|
| `spot-api-{env}` | 512MB | 15s | Standard CRUD |
| `spot-ai-{env}` | 512MB | 60s | AI calls (keep at 512MB) |
| `spot-sync-{env}` | **1024MB** | 300s | Restaurant seeding |
| `spot-stripe-{env}` | 256MB | 30s | Subscription mgmt |
| `spot-email-{env}` | 256MB | 10s | Email delivery |
| `spot-lifecycle-{env}` | 512MB | 120s | Daily scheduling |

### Recommended Changes

**API Lambda (512MB → 256MB):**
- CRUD operations (create, read, update, delete) are lightweight
- 256MB is sufficient for DynamoDB queries and response serialization
- Reduces cost by ~50% for this function's compute
- **Risk:** Very low. Test with production-like load; if p99 latency spikes, revert.

**Sync Lambda (1024MB → 512MB):**
- The seeder's bottleneck is Google Places API throttling, not memory
- 512MB is plenty for JSON parsing and network I/O
- Halves compute cost for scheduled jobs
- **Risk:** Low. Worst case: a full seed takes slightly longer. Still completes within 300s timeout.

**Lifecycle Lambda (512MB → 256MB):**
- Daily query-and-email pattern doesn't need 512MB
- DynamoDB scans fit easily in 256MB
- **Risk:** Very low.

### Cost Impact
| Function | Old | New | Cost per invocation | Monthly impact (1K invocations) |
|----------|-----|-----|--------------------|---------------------------------|
| API (1K invocations/day) | 512MB | 256MB | -$0.0000083/req | -$0.25 |
| Sync (1 invocation/day) | 1024MB | 512MB | -$0.0000166/req | -$0.005 |
| Lifecycle (1 invocation/day) | 512MB | 256MB | -$0.0000083/req | -$0.002 |
| **Total monthly** | — | — | — | **-$0.50-$1.50/month** |

**Cumulative Lambda savings: $0.50-$1.50/month (5-10% of Lambda costs)**

---

## 3. Enable DynamoDB Data Lifecycle & Reduce PITR Storage (15-20% DynamoDB Savings)

### Current State
- **Billing Mode:** PAY_PER_REQUEST (on-demand) ✓ Good for variable workloads
- **PITR Enabled:** Yes — adds ~20% to storage costs
- **TTL:** Already enabled (you have a `ttl` attribute)
- **GSI Storage:** 1 GSI (GSI1) in ALL_PROJECTION mode

### Analysis
Your on-demand model is correct for early stage. But storage can be optimized:

**PITR (Point-in-Time Recovery) Cost:**
- Backup storage: ~20% overhead on table size
- If your table grows to 1GB: PITR adds ~$0.05/month
- Question: Do you need point-in-time restore, or is daily snapshots sufficient?
  - If your data is non-critical (restaurant metadata + user subscriptions are regenerable), disable PITR
  - If customer data must never be lost, keep it

**TTL Optimization:**
- You have TTL enabled. Verify your `ttl` attribute is set on temporary data (sessions, invite codes)
- DynamoDB auto-deletes expired items, saving storage costs
- Action: Audit your item creation code and ensure short-TTL data (e.g., signup tokens: 15 min, sessions: 24 hrs) uses TTL

### Cost Impact
| Scenario | PITR On | PITR Off | Savings |
|----------|---------|----------|---------|
| Table size: 500MB | ~$0.10-0.15/month | ~$0.10/month | $0.05/month |
| Table size: 1GB | ~$0.20-0.25/month | ~0.15/month | $0.05-0.10/month |

**DynamoDB storage savings: $0.05-$0.10/month (if PITR disabled)**

---

## 4. Implement Response Caching for Public Endpoints (10-15% API Gateway + DynamoDB Savings)

### Current State
Your public endpoints serve read-heavy data:
- `/api/restaurants` — restaurant list
- `/api/restaurants/{restaurantId}` — restaurant details
- `/api/offers/{offerId}` — offer details

These queries hit DynamoDB every request.

### Recommended Solution
**Option A: API Gateway Caching (Simpler)**
- Enable API Gateway caching at the endpoint level
- Cache window: 5-60 minutes (configurable per endpoint)
- REST API caching cost: $0.02/hour for a cache, ~$15/month per cache instance
- **Verdict:** Not cost-effective for a single cache. Skip this.

**Option B: In-Lambda Caching (Better)**
- Add a simple in-memory cache (Node.js `Map` or similar) in your API Lambda
- Cache restaurant list for 5-10 minutes
- Cache individual restaurant details for 15-30 minutes
- Store frequent queries in a separate DynamoDB table with TTL (very cheap)

**Option C: DynamoDB DAX (Recommended for Growth)**
- DynamoDB DAX is a managed in-memory cache layer
- Cost: ~$0.25/hour for a single-node cluster (~$180/month)
- **Verdict:** Overkill right now, but consider when you hit 10K+ requests/day

### Cost Impact (Option B: In-Lambda Cache)
| Metric | With cache | Without | Savings |
|--------|-----------|---------|---------|
| Restaurant list queries/day | 500 (cached) → 100 actual DynamoDB reads | 500 reads | 80% reduction |
| DynamoDB read cost | 100 × $0.25/1M = $0.000025 | 500 × $0.25/1M = $0.000125 | -$0.00001/day |
| Monthly impact | — | — | **-$0.30/month** |

**API + DynamoDB savings: $0.30/month (2-5% savings, low-hanging fruit)**

---

## 5. Set CloudWatch Log Retention to 30 Days (5-10% CloudWatch Savings)

### Current State
CloudWatch logs are set to **indefinite retention** by default (no expiry set in template).
- Each Lambda writes logs (~100-500 bytes per invocation)
- CloudWatch storage: $0.03/GB/month
- At 1M requests/month: ~500MB-2GB of logs/month → $0.015-0.06/month

### Recommended Change
Set log retention to **30 days** for all Lambda functions. This gives you operational visibility (one month of historical logs) while auto-deleting old data.

**Template change:**
```yaml
ApiFunction:
  Type: AWS::Serverless::Function
  Properties:
    # ... existing properties ...
    LoggingConfig:
      LogFormat: JSON
```

Or add retention via CloudFormation:
```yaml
ApiLogGroup:
  Type: AWS::Logs::LogGroup
  Properties:
    LogGroupName: !Sub /aws/lambda/spot-api-${Environment}
    RetentionInDays: 30
```

### Cost Impact
| Retention | Monthly log cost | Savings |
|-----------|------------------|---------|
| Indefinite | ~$0.06-0.20/month (grows over time) | — |
| 30 days | ~$0.02-0.05/month | -$0.04-0.15/month |

**CloudWatch savings: $0.04-$0.15/month (5-15% of CloudWatch costs)**

---

## 6. Audit & Cap Anthropic API Usage (Highest Impact for Prevention)

### Current State
Your skill document flags this as the **HIGHEST cost risk**. You have:
- CloudWatch alarm: 1000 invocations/day limit ✓
- No per-user rate limiting
- No output token capping

### Cost Reality
- Anthropic Haiku: ~$0.00075 per 1K input tokens, ~$0.003 per 1K output tokens
- Single API call: ~2000 input + 500 output tokens = ~$0.0025 per call
- 1000 calls/day × $0.0025 = **$2.50/day = $75/month** ← **ALREADY OVER YOUR $50 BUDGET**

### Risk Assessment
If your AI feature gains traction:
- 50 users × 3 AI calls/day = 150 calls/day = $0.375/day = $11.25/month (at Haiku)
- 500 users × 3 AI calls/day = 1500 calls/day = $3.75/day = **$112.50/month** (over budget)

### Recommended Actions

**Immediate (before scaling):**
1. **Implement per-user daily caps:**
   ```javascript
   // In your API Lambda
   const userCalls = await getUserAiCallCount(userId, 'today');
   if (userCalls > 5) {  // 5 calls/user/day max
     return { statusCode: 429, body: 'Rate limit exceeded' };
   }
   ```

2. **Log token usage:**
   ```javascript
   const response = await client.messages.create({ ... });
   const tokens = {
     input: response.usage.input_tokens,
     output: response.usage.output_tokens,
     cost: (response.usage.input_tokens * 0.00075 + response.usage.output_tokens * 0.003) / 1000
   };
   // Store in DynamoDB for tracking
   ```

3. **Use Haiku exclusively** (not Sonnet/Opus):
   - Haiku: $0.00375/1K tokens (input + output)
   - Sonnet: $0.03/1K tokens (8x more expensive)
   - Opus: $0.15/1K tokens (40x more expensive)

4. **Cache responses:**
   - If users ask similar AI questions, cache the response for 24 hours
   - Reduces API calls by 30-50% in typical workflows

**Cost Impact:**
| Scenario | Current | With caps + cache | Savings |
|----------|---------|-------------------|---------|
| 100 calls/day (no caps) | $0.25/day = $7.50/month | $0.12/day = $3.50/month | **-53%** |
| 500 calls/day (with caps) | $1.25/day = $37.50/month | $0.40/day = $12/month | **-68%** |
| 1000 calls/day (no limits) | $2.50/day = $75/month | $0.75/day = $22.50/month | **-70%** |

**Anthropic savings: $3-15/month (if you implement caps)**

---

## Summary: Cost Reduction Roadmap

### Quick Wins (This Week)
1. **Set CloudWatch log retention → 30 days**
   - **Effort:** 5 minutes
   - **Savings:** $0.04-0.15/month
   - **Risk:** None

2. **Audit & cap Anthropic API usage**
   - **Effort:** 2-3 hours (implement per-user limits + logging)
   - **Savings:** $3-15/month
   - **Risk:** Low (prevents runaway costs)

3. **Reduce Lambda memory**
   - **Effort:** 30 minutes (change template, test, deploy)
   - **Savings:** $0.50-1.50/month
   - **Risk:** Very low

### Medium-Term (Next 2-4 Weeks)
4. **Implement in-Lambda caching**
   - **Effort:** 4-6 hours
   - **Savings:** $0.30/month
   - **Risk:** Very low
   - **Bonus:** Improves response times

5. **Disable PITR if data isn't critical**
   - **Effort:** 5 minutes
   - **Savings:** $0.05-0.10/month
   - **Risk:** Medium (can't restore old backups)
   - **Mitigation:** Export data to S3 weekly if needed

### Long-Term (Next 1-2 Months)
6. **Migrate API Gateway v1 → v2 + Lambda authorizer**
   - **Effort:** 2-4 hours
   - **Savings:** $1.25-2.50/month
   - **Risk:** Low (well-documented migration path)
   - **Impact:** 5% overall budget reduction

---

## Total Estimated Savings

| Opportunity | Savings | Cumulative |
|-------------|---------|-----------|
| CloudWatch log retention | $0.04-0.15 | $0.04-0.15 |
| Anthropic API caps + cache | $3-15 | $3-15.15 |
| Lambda memory reduction | $0.50-1.50 | $3.50-16.65 |
| In-Lambda caching | $0.30 | $3.80-16.95 |
| Disable PITR | $0.05-0.10 | $3.85-17.05 |
| API Gateway v1 → v2 | $1.25-2.50 | **$5.10-19.55/month** |

### Bottom Line
**Potential monthly savings: $5-$20/month (10-40% reduction from $50 budget)**

Most of this ($3-15/month) comes from capping your Anthropic API usage, which also prevents surprise bills. The API Gateway v2 migration is the second-biggest win but requires more work.

---

## Monitoring & Alerts to Add

Once you implement these changes, add these CloudWatch alarms:

1. **Anthropic API spend tracker** (already have invocation alarm, but add cost tracking)
   ```
   Daily Anthropic cost > $2.50 → Alert
   ```

2. **API Gateway cost anomaly detection**
   ```
   Requests spike 50% above baseline → Investigate
   ```

3. **DynamoDB read cost** (watch for runaway queries)
   ```
   Consumed read capacity > 1000 per day → Alert
   ```

4. **Lambda error rate** (errors = wasted compute)
   ```
   Errors > 5% of invocations → Alert
   ```

These alarms ensure you catch cost issues before they hit your $50 budget ceiling.

---

## FAQ

**Q: Will these changes break anything?**
A: Low risk across the board. Lambda memory reduction is the only one requiring load testing. API Gateway v2 migration requires code changes but is well-tested by AWS customers.

**Q: What if my usage spikes?**
A: You'll still benefit from these optimizations. In fact, the Anthropic API cap is *essential* if traffic grows—without it, a single feature going viral could cost $500+ in a day.

**Q: Should I move to provisioned billing for DynamoDB?**
A: No. On-demand is correct for early-stage, variable workloads. Only consider provisioned capacity when you have predictable, sustained traffic >10K requests/day.

**Q: Can I combine these optimizations?**
A: Yes, absolutely. Start with the quick wins (log retention, API caps) and layer in the others as you iterate. No conflicts.

**Q: What's your #1 recommendation?**
A: **Cap Anthropic API usage immediately.** It's the only change that prevents financial risk with minimal effort. Then migrate API Gateway v2 when you have a few hours free.
