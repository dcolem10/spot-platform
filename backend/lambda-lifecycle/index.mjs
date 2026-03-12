/**
 * Lifecycle Email Scheduler
 *
 * Runs daily via CloudWatch Schedule. Queries creators by signup date
 * and sends lifecycle emails at day 1, 14, and 28 milestones.
 *
 * Uses a "lastLifecycleEmail" attribute on creator profiles to avoid
 * duplicate sends. Invokes the Email Lambda asynchronously for each send.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const ddbClient = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(ddbClient);
const lambda = new LambdaClient({});

const TABLE = process.env.TABLE_NAME;
if (!TABLE) throw new Error('TABLE_NAME env var is required — Lambda misconfigured');
const EMAIL_FUNCTION = process.env.EMAIL_FUNCTION_NAME;
if (!EMAIL_FUNCTION) throw new Error('EMAIL_FUNCTION_NAME env var is required — Lambda misconfigured');

/** Day milestones to check (in days since signup) */
const MILESTONES = [1, 14, 28];

/** Safety cap: max creators processed per invocation to prevent runaway costs */
const MAX_CREATORS_PER_RUN = 500;

/** Safety cap: max emails sent per invocation */
const MAX_EMAILS_PER_RUN = 50;

/** Map milestone day → email template type */
const MILESTONE_TEMPLATES = {
  1: 'lifecycle_day1',
  14: 'lifecycle_day14',
  28: 'lifecycle_day28',
};

/** Minimum remaining time (ms) before we stop processing to avoid timeout */
const TIMEOUT_BUFFER_MS = 10_000;

export const handler = async (_event, context) => {
  console.log('Lifecycle scheduler starting...');
  const now = new Date();
  let processed = 0;
  let sent = 0;
  let errors = 0;
  let timedOut = false;

  // Helper: check if we're running low on Lambda execution time
  const isRunningLow = () => {
    if (!context?.getRemainingTimeInMillis) return false;
    return context.getRemainingTimeInMillis() < TIMEOUT_BUFFER_MS;
  };

  try {
    // Scan all creator profiles
    // For scale: replace with GSI query on createdAt ranges
    const creators = await getAllCreators();
    console.log(`Found ${creators.length} creators to evaluate (cap: ${MAX_CREATORS_PER_RUN})`);

    for (const creator of creators) {
      if (processed >= MAX_CREATORS_PER_RUN) {
        console.warn(`Hit creator cap (${MAX_CREATORS_PER_RUN}). Stopping.`);
        break;
      }
      if (sent >= MAX_EMAILS_PER_RUN) {
        console.warn(`Hit email cap (${MAX_EMAILS_PER_RUN}). Stopping.`);
        break;
      }
      if (isRunningLow()) {
        timedOut = true;
        console.warn(`Approaching Lambda timeout — stopping early. Processed: ${processed}, Sent: ${sent}`);
        break;
      }
      processed++;
      try {
        const result = await processCreator(creator, now);
        if (result.sent) sent++;
      } catch (err) {
        errors++;
        console.error(`Error processing creator ${creator.PK}: ${err.message}`);
      }
    }

    console.log(`Lifecycle complete: processed=${processed}, sent=${sent}, errors=${errors}, timedOut=${timedOut}`);
    return { statusCode: 200, processed, sent, errors, timedOut };
  } catch (err) {
    console.error(`Lifecycle scheduler failed: ${err.message}`);
    return { statusCode: 500, error: err.message };
  }
};

/**
 * Get all creator profiles from DynamoDB
 * Scans for items where PK starts with USER# and SK = PROFILE.
 * Safety cap prevents runaway scan costs if table grows unexpectedly.
 */
async function getAllCreators() {
  const items = [];
  let lastKey;
  let scannedCount = 0;
  const SCAN_CAP = MAX_CREATORS_PER_RUN * 2; // Safety margin for filtered scans

  do {
    // TODO: Replace Scan with GSI query when USERS_BY_CREATED GSI is added.
    // For now, Limit per page bounds memory usage per iteration.
    const result = await ddb.send(new ScanCommand({
      TableName: TABLE,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :sk',
      ExpressionAttributeValues: {
        ':prefix': 'USER#',
        ':sk': 'PROFILE',
      },
      ExclusiveStartKey: lastKey,
      Limit: 200, // Page size cap — prevents single scan page from exhausting Lambda memory
    }));

    if (result.Items) items.push(...result.Items);
    scannedCount += result.ScannedCount || 0;
    lastKey = result.LastEvaluatedKey;

    if (items.length >= SCAN_CAP) {
      console.warn(`Hit scan safety cap (${SCAN_CAP}). Stopping pagination. Scanned: ${scannedCount}`);
      break;
    }
  } while (lastKey);

  const efficiency = scannedCount > 0 ? ((items.length / scannedCount) * 100).toFixed(1) : '100';
  console.log(`Lifecycle scan: ${items.length} creators from ${scannedCount} items (${efficiency}% efficiency)`);
  return items;
}

/**
 * Process a single creator — check if they're due for a lifecycle email
 */
async function processCreator(creator, now) {
  const { PK, SK, email, name, createdAt, lastLifecycleEmail } = creator;

  // Must have email and createdAt
  if (!email || !createdAt) return { sent: false };

  const signupDate = new Date(createdAt);
  if (isNaN(signupDate.getTime())) return { sent: false };

  const daysSinceSignup = Math.floor((now - signupDate) / (1000 * 60 * 60 * 24));
  const lastSent = lastLifecycleEmail || '';

  // Find the highest milestone the creator has reached but hasn't received yet.
  // Uses >= instead of === to handle edge cases where the Lambda misses a day
  // (e.g., CloudWatch delay, Lambda timeout). Milestones are sorted ascending
  // so we iterate forward and send only the first unsent one.
  for (const milestone of MILESTONES) {
    if (daysSinceSignup < milestone) continue;

    const templateType = MILESTONE_TEMPLATES[milestone];

    // Skip if already sent this milestone
    if (lastSent === templateType) {
      console.log(`Skipping ${PK}: already sent ${templateType}`);
      continue;
    }

    // Gather activity data for day 14 and 28 templates
    const templateData = { name: name || 'Friend' };

    if (milestone >= 14) {
      const userId = PK.replace('USER#', '');
      const activity = await getCreatorActivity(userId);
      Object.assign(templateData, activity);
    }

    // Send the email
    await invokeEmailLambda(templateType, email, templateData);

    // Mark as sent
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK, SK },
      UpdateExpression: 'SET lastLifecycleEmail = :template, lastLifecycleAt = :now',
      ExpressionAttributeValues: {
        ':template': templateType,
        ':now': now.toISOString(),
      },
    }));

    console.log(`Sent ${templateType} to ${PK} (day ${daysSinceSignup})`);
    return { sent: true };
  }

  return { sent: false };
}

/**
 * Query creator's campaign and offer activity for email personalization
 */
async function getCreatorActivity(userId) {
  const activity = { campaignCount: 0, scanCount: 0, redemptionCount: 0, tier: 'bronze' };

  try {
    // Count campaigns
    const campaigns = await ddb.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#CAMPAIGNS` },
      Select: 'COUNT',
    }));
    activity.campaignCount = campaigns.Count || 0;

    // Count scans and redemptions across all offers (cap at 200 to bound memory)
    const offers = await ddb.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#OFFERS` },
      Limit: 200,
    }));

    if (offers.Items) {
      for (const offer of offers.Items) {
        activity.scanCount += offer.scanCount || 0;
        activity.redemptionCount += offer.redemptionCount || 0;
      }
    }

    // Calculate tier
    const referralCount = activity.campaignCount; // simplified — use actual referral count if tracked
    if (referralCount >= 15) activity.tier = 'gold';
    else if (referralCount >= 5) activity.tier = 'silver';

  } catch (err) {
    console.error(`Failed to get activity for ${userId}: ${err.message}`);
  }

  return activity;
}

/**
 * Invoke the email Lambda asynchronously
 */
async function invokeEmailLambda(type, to, data) {
  await lambda.send(new InvokeCommand({
    FunctionName: EMAIL_FUNCTION,
    InvocationType: 'Event',
    Payload: JSON.stringify({ type, to, data }),
  }));
}
