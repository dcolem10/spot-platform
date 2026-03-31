# AWS Spend Breakdown for Spot Platform (March 2026)

To get your current AWS spending this month broken down by service, I'll walk you through the CLI commands to run and what to expect from each one.

## AWS CLI Commands to Run

### 1. Get This Month's Total Spend by Service

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-09 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region us-east-1
```

**Purpose:** Shows cumulative spend from March 1st to today broken down by AWS service (Lambda, DynamoDB, API Gateway, SES, etc.).

**Expected output format:**
```json
{
  "ResultsByTime": [
    {
      "TimePeriod": {
        "Start": "2026-03-01",
        "End": "2026-03-09"
      },
      "Total": {
        "BlendedCost": {
          "Amount": "X.XX",
          "Unit": "USD"
        }
      },
      "Groups": [
        {
          "Keys": ["AWS Lambda"],
          "Metrics": {
            "BlendedCost": {
              "Amount": "Y.YY",
              "Unit": "USD"
            }
          }
        },
        {
          "Keys": ["Amazon DynamoDB"],
          "Metrics": { ... }
        },
        {
          "Keys": ["Amazon API Gateway"],
          "Metrics": { ... }
        },
        ...
      ]
    }
  ]
}
```

This will show you the breakdown by major service. Look for these key services in your results:
- **AWS Lambda** (spot-api, spot-ai, spot-sync, spot-stripe, spot-lifecycle, spot-email functions)
- **Amazon DynamoDB** (spot-data table with on-demand billing)
- **Amazon API Gateway** (REST API — note: REST API v1 costs $3.50/M requests, not the cheaper HttpApi v2)
- **AWS Secrets Manager** (API key storage)
- **Amazon SES** (email sending)
- **Amazon Cognito** (user authentication)
- **AWS CloudWatch** (logs and alarms)

### 2. Get Daily Breakdown for Better Granularity

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-09 \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region us-east-1
```

**Purpose:** Shows daily spend trends so you can identify which days had higher usage.

**Expected output:** Similar JSON structure but with multiple daily time periods instead of one monthly.

### 3. Lambda Invocation Details (by Function)

```bash
# API Function
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=spot-api-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum \
  --region us-east-1

# AI Function (HIGH COST PRIORITY)
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=spot-ai-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum \
  --region us-east-1

# Sync Function
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=spot-sync-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum \
  --region us-east-1
```

**Purpose:** Shows how many times each Lambda function was invoked. Critical for the AI function since each invocation can cost $0.01-$0.10+ (Anthropic API tokens).

**Expected output:**
```json
{
  "Label": "Invocations",
  "Datapoints": [
    {
      "Timestamp": "2026-03-01T00:00:00Z",
      "Sum": 150.0,
      "Unit": "Count"
    },
    {
      "Timestamp": "2026-03-02T00:00:00Z",
      "Sum": 120.0,
      "Unit": "Count"
    },
    ...
  ]
}
```

### 4. Lambda Duration (GB-seconds) — Compute Cost Driver

```bash
# API Function
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=spot-api-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum,Average \
  --region us-east-1

# AI Function
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=spot-ai-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum,Average \
  --region us-east-1
```

**Purpose:** Duration is in milliseconds. Combined with memory size (512MB for API, 512MB for AI), this calculates GB-seconds for Lambda billing: `(duration_ms / 1000) × (memory_mb / 1024) = GB-seconds`. Lambda costs $0.0000166667 per GB-second.

### 5. DynamoDB Consumed Capacity (Read/Write)

```bash
# Read Capacity
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=spot-data-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum \
  --region us-east-1

# Write Capacity (includes GSI1 writes at 2x cost)
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedWriteCapacityUnits \
  --dimensions Name=TableName,Value=spot-data-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum \
  --region us-east-1

# Storage (table + PITR backup)
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name UserErrors \
  --dimensions Name=TableName,Value=spot-data-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum \
  --region us-east-1
```

**Purpose:** DynamoDB is on-demand (PAY_PER_REQUEST). Costs: $1.25/M write units, $0.25/M read units, $0.25/GB/month storage. Remember: GSI1 writes cost double (appear as 2x in metrics).

### 6. API Gateway Request Count

```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=spot-api-dev \
  --start-time 2026-03-01T00:00:00Z \
  --end-time 2026-03-09T23:59:59Z \
  --period 86400 \
  --statistics Sum \
  --region us-east-1
```

**Purpose:** API Gateway v1 (REST API) costs $3.50 per 1 million requests. This command shows total requests.

### 7. Check Budget Status

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
aws budgets describe-budget \
  --account-id $ACCOUNT_ID \
  --budget-name spot-monthly-dev \
  --region us-east-1
```

**Purpose:** Shows your current monthly budget ($50) and spend-to-date vs. projected spend.

---

## Expected Spend Breakdown (Estimates Based on Infrastructure)

Based on your Spot Platform architecture, here's what to watch for in your bill:

### Lambda ($0.20/1M requests + compute)
- **spot-api-dev**: Likely $0.01–$0.05/month (standard CRUD, 512MB, 15s timeout)
- **spot-ai-dev**: **HIGHEST RISK** — if averaging 100 calls/day at $0.01–$0.10 per call, could be $30–$300+/month
- **spot-sync-dev**: Low (runs once daily, 1024MB, 300s timeout) = ~$0.10/month
- **spot-stripe-dev**: <$0.01/month
- **spot-email-dev**: <$0.01/month
- **spot-lifecycle-dev**: Low (~$0.01/month)

### DynamoDB (On-Demand)
- Typical early-stage usage: **$1–$5/month** for reads + writes
- Storage (spot-data table + PITR): **$0.50–$2/month** for low usage
- **If you're doing heavy batch operations or have high-frequency writes, this could spike to $10+**

### API Gateway (REST v1)
- Low request volume (<100K/month): **<$0.50/month**
- High request volume (1M+/month): **$3.50/month**

### Third-Party APIs
- **Anthropic (Claude API)**: Varies wildly. If AI function is called 100 times/day with Haiku model: ~$60/month
- **Google Places**: One-time seeder cost ~$5.76; ongoing validation minimal
- Secrets Manager: **$0.40/month** (flat) + ~$0.01/month (API calls)

### Email & Auth
- **SES**: $0.10 per 1,000 emails. If sending 1,000 emails/month = $0.10
- **Cognito**: Free (under 50K MAU)
- **CloudWatch**: Free tier covers logs; if exceeding 5GB/month = $0.30/GB

### Typical Monthly Total (Low Usage)
- **Expected range: $2–$10/month** if AI calls are minimal
- **Could jump to $30–$50/month** if AI calls are heavy

---

## How to Interpret Your Bill

When you run the CLI commands above, follow this priority checklist:

1. **Check AI Lambda invocations first** — This is your biggest cost driver. If spot-ai-dev is being called >1,000 times per month, you'll exceed your $50 budget.

2. **Look at DynamoDB writes** — On-demand means you pay per request. Heavy writes (especially to GSI1) add up fast.

3. **Monitor API Gateway requests** — At $3.50/M, you're safe until very high traffic. But consider migrating to HttpApi v2 ($1.00/M) for 71% savings.

4. **Check third-party API usage** — Log into Anthropic and Google Cloud dashboards to see actual token/request counts.

5. **Compare to budget alert** — Your CloudFormation template has a $50/month budget alert. If projected spend > $50, something needs optimizing.

---

## Cost Reduction Quick Wins

If you're approaching or exceeding budget:

1. **Anthropic model**: Default to Haiku (10x cheaper than Sonnet) for non-critical AI tasks
2. **API Gateway**: Migrate REST API to HttpApi v2 (saves 71%)
3. **Lambda right-sizing**: Check if 512MB functions can run on 256MB
4. **DynamoDB caching**: Add a short TTL in-memory cache for frequently queried data
5. **CloudWatch retention**: Set log retention to 30 days instead of indefinite

---

## Next Steps

1. Run the CLI commands above and paste the JSON output
2. I'll calculate exact costs per service
3. We'll identify the top 3 cost drivers
4. I'll recommend optimization if you're over budget
