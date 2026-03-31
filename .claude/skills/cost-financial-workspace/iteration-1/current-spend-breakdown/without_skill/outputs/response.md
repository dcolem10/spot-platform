# Spot Platform AWS Cost Breakdown Guide

## How to Check Your Monthly AWS Spending

To retrieve your current AWS spending broken down by service, you would use the AWS Cost Explorer API or CLI. Here are the primary CLI commands you would run:

### 1. Get Total Cost By Service (Current Month)

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --profile default \
  --region us-east-1
```

**What this returns:**
- A JSON response with each AWS service and its total cost for March 2026
- UnblendedCost represents the actual cost you're charged
- Example output structure:
  ```json
  {
    "ResultsByTime": [
      {
        "TimePeriod": {
          "Start": "2026-03-01",
          "End": "2026-03-31"
        },
        "Groups": [
          {
            "Keys": ["Amazon Elastic Compute Cloud - Compute"],
            "Metrics": {"UnblendedCost": {"Amount": "25.50", "Unit": "USD"}}
          }
        ]
      }
    ]
  }
  ```

### 2. Get Granular Daily Breakdown (To See Trends)

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-09 \
  --granularity DAILY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --profile default \
  --region us-east-1
```

**What this shows:**
- Daily cost breakdown by service (useful to identify cost spikes)
- Helps you see if costs are trending up or down
- Identifies which days were most expensive

### 3. Get Costs With Multiple Dimensions (Service + Region)

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE Type=DIMENSION,Key=REGION \
  --profile default \
  --region us-east-1
```

**What this shows:**
- Cost breakdown by both service and AWS region
- Useful if you're running resources in multiple regions
- Helps identify if one region is unexpectedly expensive

### 4. Filter By Specific Services (Optional)

```bash
aws ce get-cost-and-usage \
  --time-period Start=2026-03-01,End=2026-03-31 \
  --granularity MONTHLY \
  --metrics "UnblendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --filter file://cost-filter.json \
  --profile default \
  --region us-east-1
```

With `cost-filter.json`:
```json
{
  "Dimensions": {
    "Key": "SERVICE",
    "Values": ["AWS Lambda", "Amazon DynamoDB", "Amazon API Gateway", "Amazon Simple Email Service"]
  }
}
```

---

## Expected Cost Breakdown for Spot Platform

Based on the CloudFormation template analysis, here are the services that will incur costs:

### Primary Cost Drivers

#### 1. **AWS Lambda** (~$10-20/month)
- **Functions deployed:**
  - `spot-api-prod` (512 MB, 15s timeout) - Main API handler
  - `spot-ai-prod` (512 MB, 60s timeout) - AI processing endpoint
  - `spot-sync-prod` (1024 MB, 300s timeout) - Daily batch sync
  - `spot-stripe-prod` (256 MB, 30s timeout) - Stripe webhook handler
  - `spot-lifecycle-prod` (512 MB, 120s timeout) - Daily lifecycle emails
  - `spot-email-prod` (256 MB, 10s timeout) - Email sender

- **Cost factors:**
  - Invocations: First 1 million/month are free, then $0.20 per million
  - Compute duration: $0.0000166667 per GB-second
  - Estimated: 50,000 invocations/month = ~$1-2
  - Compute time: Varies by AI endpoint usage, could add $5-15/month
  - **Estimate: $6-17/month**

**Cost optimization tip:** Monitor the `AiCostAlarm` which triggers at >1000 AI invocations/day ($0.000166667 per invocation at 512MB)

#### 2. **Amazon DynamoDB** (~$5-15/month)
- **Configuration:**
  - Billing Mode: `PAY_PER_REQUEST` (on-demand pricing)
  - Table: `spot-data-prod` with 2 GSI (Global Secondary Indexes)
  - Point-in-time recovery: **Enabled** (adds ~5% to base cost)
  - TTL: **Enabled** (no additional cost)

- **Cost factors:**
  - Read Capacity: $1.25 per million read units
  - Write Capacity: $6.25 per million write units
  - Estimated traffic: ~10,000 reads/day, ~5,000 writes/day
  - **Estimate: $5-12/month**

**Cost tracking:** CloudWatch dashboard shows ConsumedReadCapacityUnits and ConsumedWriteCapacityUnits
**DLQ backup cost:** Dead letter queues won't incur DynamoDB costs, but SQS queues will (see below)

#### 3. **Amazon API Gateway** (~$2-5/month)
- **Configuration:**
  - REST API with Cognito authorization
  - Throttling: 20 requests/second, 50 burst
  - CORS enabled

- **Cost factors:**
  - HTTP requests: $3.50 per million requests
  - Data transfer: $0.09 per GB out
  - Estimated: ~200,000 requests/month
  - **Estimate: $0.70 + data transfer costs**

#### 4. **Amazon SES (Simple Email Service)** (~$2-10/month)
- **Configuration:**
  - Verified sender: `networth589@gmail.com`
  - Used by lifecycle and email Lambda functions

- **Cost factors:**
  - First 62,000 emails/month are free (within AWS free tier)
  - Above that: $0.10 per 1,000 emails
  - Bounce/Complaint SNS topics for monitoring (minimal cost)
  - **Estimate: $0-5/month** (depending on email volume)

#### 5. **Amazon Secrets Manager** (~$0.40/month)
- **Configuration:**
  - Stores: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ANTHROPIC_API_KEY, GOOGLE_PLACES_API_KEY

- **Cost factors:**
  - $0.40 per secret per month
  - Estimated 1 secret (all keys in one secret): $0.40/month
  - API calls: First 10,000 free, then $0.05 per 10,000

#### 6. **Amazon CloudWatch** (~$1-3/month)
- **Alarms deployed:**
  - API function errors
  - AI function errors
  - Stripe, Email, Lifecycle, Sync errors
  - API latency (p99)
  - DynamoDB throttle detection
  - API Gateway 5XX errors
  - DLQ message monitoring (3 DLQs)

- **Cost factors:**
  - First 10 alarms/month are free
  - Each additional alarm: $0.10/month
  - Logs ingestion: $0.50 per GB
  - **Estimate: $1-3/month**

#### 7. **Amazon SQS (Simple Queue Service)** (~$0.50/month)
- **Configuration:**
  - 3 Dead Letter Queues:
    - `spot-lifecycle-dlq-prod`
    - `spot-email-dlq-prod`
    - `spot-sync-dlq-prod`

- **Cost factors:**
  - First 1 million requests free per month
  - Beyond that: $0.40 per million
  - Assuming minimal DLQ traffic
  - **Estimate: $0.10-0.50/month**

#### 8. **AWS Cognito** (~$0-5/month)
- Used for user authentication (template references CognitoUserPoolId)
- **Cost factors:**
  - First 50,000 MAU (Monthly Active Users) per pool: **Free**
  - Beyond that: $0.50-0.60 per MAU
  - Estimated MAU for early-stage: 50-100 users
  - **Estimate: $0/month** (likely within free tier)

---

## Total Estimated Monthly Cost for Spot Platform

| Service | Low Estimate | High Estimate | Notes |
|---------|-------------|---------------|-------|
| Lambda | $6 | $17 | Varies by AI endpoint usage |
| DynamoDB | $5 | $12 | On-demand pricing with PITR |
| API Gateway | $0.70 | $5 | ~200k requests/month baseline |
| SES | $0 | $5 | Free tier covers first 62k emails |
| Secrets Manager | $0.40 | $0.40 | 1 secret, minimal API calls |
| CloudWatch | $1 | $3 | 13 alarms deployed |
| SQS | $0.10 | $0.50 | Minimal DLQ traffic expected |
| Cognito | $0 | $5 | Likely free tier for early users |
| Data Transfer | $0 | $10 | Regional transfer costs |
| **TOTAL** | **~$13.20** | **~$57.80** | **$50 Budget Alert set** |

---

## Budget Monitoring

The CloudFormation template includes a Budget Alert configured to:
- **Budget Name:** `spot-monthly-prod`
- **Monthly Limit:** $50 USD
- **Type:** COST budget

This alert will notify you if spending exceeds $50/month.

---

## How to Interpret the CLI Results

When you run the `get-cost-and-usage` command, you'll get output like:

```json
{
  "ResultsByTime": [
    {
      "TimePeriod": {
        "Start": "2026-03-01",
        "End": "2026-03-31"
      },
      "Total": {
        "UnblendedCost": {
          "Amount": "35.42",
          "Unit": "USD"
        }
      },
      "Groups": [
        {
          "Keys": ["AWS Lambda"],
          "Metrics": {"UnblendedCost": {"Amount": "12.50", "Unit": "USD"}}
        },
        {
          "Keys": ["Amazon DynamoDB"],
          "Metrics": {"UnblendedCost": {"Amount": "8.75", "Unit": "USD"}}
        },
        {
          "Keys": ["Amazon API Gateway"],
          "Metrics": {"UnblendedCost": {"Amount": "2.15", "Unit": "USD"}}
        },
        {
          "Keys": ["Amazon Simple Email Service"],
          "Metrics": {"UnblendedCost": {"Amount": "0.00", "Unit": "USD"}}
        },
        {
          "Keys": ["Amazon Simple Queue Service"],
          "Metrics": {"UnblendedCost": {"Amount": "0.25", "Unit": "USD"}}
        },
        {
          "Keys": ["AWS Secrets Manager"],
          "Metrics": {"UnblendedCost": {"Amount": "0.40", "Unit": "USD"}}
        },
        {
          "Keys": ["Amazon CloudWatch"],
          "Metrics": {"UnblendedCost": {"Amount": "1.50", "Unit": "USD"}}
        },
        {
          "Keys": ["AWS Cognito"],
          "Metrics": {"UnblendedCost": {"Amount": "0.00", "Unit": "USD"}}
        }
      ],
      "Estimated": false
    }
  ]
}
```

**Key fields to understand:**
- `Amount`: The cost in USD
- `Unit`: Always "USD" for currency
- `Estimated`: `true` if the current month's data isn't finalized yet (usually true until month-end)
- `Groups`: Each service listed with its individual cost
- `Total.UnblendedCost`: Sum of all services shown

---

## Cost Optimization Recommendations

1. **Monitor AI Endpoint Usage**
   - The `AiCostAlarm` triggers at >1000 invocations/day
   - Consider batch processing or caching for repeated AI requests
   - Lambda cost is: `(memory_in_GB × duration_in_seconds × $0.0000166667) × invocations`

2. **Optimize DynamoDB Queries**
   - Use GSI1 efficiently to minimize read units consumed
   - Batch operations where possible (`BatchGetItem`, `BatchWriteItem`)
   - Enable DynamoDB auto-scaling if transitioning from on-demand

3. **Set More Granular Cost Alerts**
   ```bash
   aws budgets create-budget \
     --account-id YOUR_ACCOUNT_ID \
     --budget file://budget-config.json
   ```

4. **Review CloudWatch Logs Retention**
   - Set retention policies to reduce storage costs
   - Default is unlimited; consider 30-day retention

5. **Leverage AWS Free Tier**
   - DynamoDB: 25 GB free storage
   - Lambda: 1 million free invocations/month
   - SES: 62,000 free emails/month
   - CloudWatch: 10 alarms free
   - API Gateway: Currently not in free tier, so optimize request volume

---

## Additional Resources

- [AWS Cost Explorer Documentation](https://docs.aws.amazon.com/aws-cost-management/latest/userguide/ce-what-is.html)
- [Cost and Usage Report Documentation](https://docs.aws.amazon.com/cur/latest/userguide/what-is-cur.html)
- [AWS Pricing Calculator](https://calculator.aws/) - Pre-calculate costs before deployment
- [Cost Optimization Best Practices](https://aws.amazon.com/architecture/cost-optimization/)
