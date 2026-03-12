import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const TABLE_NAME = process.env.TABLE_NAME;
if (!TABLE_NAME) {
  throw new Error('TABLE_NAME env var is required — Lambda misconfigured');
}

const dynamoDb = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: 'us-east-1' })
);

const MAX_RECIPIENTS = 50; // Safety limit per invocation

/**
 * Handler for SES bounce and complaint notifications via SNS
 * Writes suppression records for bounced/complained emails to DynamoDB
 */
export const handler = async (event) => {
  console.log(JSON.stringify({ event: 'SES handler invoked', recordCount: event.Records?.length || 0 }));

  if (!event.Records || event.Records.length === 0) {
    console.log(JSON.stringify({ action: 'no records', status: 'skip' }));
    return { statusCode: 200, message: 'No records to process' };
  }

  const results = [];

  for (const record of event.Records) {
    try {
      const sns = record.Sns;
      if (!sns) {
        console.log(JSON.stringify({ action: 'skip record', reason: 'no SNS message' }));
        continue;
      }

      const message = JSON.parse(sns.Message);
      const messageType = message.eventType; // 'Bounce' or 'Complaint'

      console.log(JSON.stringify({
        action: 'processing',
        messageType,
        sourceMessageId: message.mail?.messageId,
      }));

      if (messageType === 'Bounce') {
        await handleBounce(message, results);
      } else if (messageType === 'Complaint') {
        await handleComplaint(message, results);
      } else {
        console.log(JSON.stringify({ action: 'skip', reason: `unknown event type: ${messageType}` }));
      }
    } catch (err) {
      console.error(JSON.stringify({
        action: 'record error',
        error: err.message,
        // H24: Stack traces removed — may expose internal paths and dependencies
      }));
      results.push({ status: 'error', message: err.message });
    }
  }

  console.log(JSON.stringify({
    action: 'handler complete',
    processedRecords: results.length,
    results,
  }));

  return {
    statusCode: 200,
    message: 'Bounce/complaint processing complete',
    processed: results.length,
  };
};

/**
 * Handle SES bounce notifications
 * Only suppress permanent bounces; log and skip transient bounces
 */
async function handleBounce(message, results) {
  const bounce = message.bounce;
  if (!bounce || !bounce.bouncedRecipients) {
    console.log(JSON.stringify({ action: 'skip bounce', reason: 'no bounced recipients' }));
    return;
  }

  const sourceMessageId = message.mail?.messageId || 'unknown';
  const bounceType = bounce.bounceType; // 'Transient' or 'Permanent'

  for (const recipient of bounce.bouncedRecipients) {
    const email = recipient.emailAddress?.toLowerCase();
    if (!email) continue;

    if (bounceType === 'Transient') {
      console.log(JSON.stringify({
        action: 'skip transient bounce',
        email,
        status: 'transient bounces not suppressed',
      }));
      results.push({ email, status: 'skipped', reason: 'transient bounce' });
      continue;
    }

    if (bounceType !== 'Permanent') {
      console.log(JSON.stringify({
        action: 'skip unknown bounce type',
        email,
        bounceType,
      }));
      results.push({ email, status: 'skipped', reason: `unknown bounce type: ${bounceType}` });
      continue;
    }

    // Safety check: max 50 recipients per invocation
    if (results.length >= MAX_RECIPIENTS) {
      console.warn(JSON.stringify({
        action: 'max recipients exceeded',
        limit: MAX_RECIPIENTS,
        email,
        status: 'skipped',
      }));
      results.push({ email, status: 'skipped', reason: 'max recipients limit exceeded' });
      continue;
    }

    try {
      const now = new Date().toISOString();
      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `SUPPRESSED#${email}`,
            SK: 'SUPPRESSION',
            email,
            reason: 'bounce',
            bounceType,
            suppressedAt: now,
            sourceMessageId,
          },
        })
      );

      console.log(JSON.stringify({
        action: 'suppression written',
        email,
        reason: 'bounce',
        bounceType,
      }));
      results.push({ email, status: 'suppressed', reason: 'permanent bounce' });
    } catch (err) {
      console.error(JSON.stringify({
        action: 'suppression write failed',
        email,
        error: err.message,
      }));
      results.push({ email, status: 'error', reason: err.message });
    }
  }
}

/**
 * Handle SES complaint notifications
 * Suppress all complained emails
 */
async function handleComplaint(message, results) {
  const complaint = message.complaint;
  if (!complaint || !complaint.complainedRecipients) {
    console.log(JSON.stringify({ action: 'skip complaint', reason: 'no complained recipients' }));
    return;
  }

  const sourceMessageId = message.mail?.messageId || 'unknown';

  for (const recipient of complaint.complainedRecipients) {
    const email = recipient.emailAddress?.toLowerCase();
    if (!email) continue;

    // Safety check: max 50 recipients per invocation
    if (results.length >= MAX_RECIPIENTS) {
      console.warn(JSON.stringify({
        action: 'max recipients exceeded',
        limit: MAX_RECIPIENTS,
        email,
        status: 'skipped',
      }));
      results.push({ email, status: 'skipped', reason: 'max recipients limit exceeded' });
      continue;
    }

    try {
      const now = new Date().toISOString();
      await dynamoDb.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `SUPPRESSED#${email}`,
            SK: 'SUPPRESSION',
            email,
            reason: 'complaint',
            suppressedAt: now,
            sourceMessageId,
          },
        })
      );

      console.log(JSON.stringify({
        action: 'suppression written',
        email,
        reason: 'complaint',
      }));
      results.push({ email, status: 'suppressed', reason: 'complaint' });
    } catch (err) {
      console.error(JSON.stringify({
        action: 'suppression write failed',
        email,
        error: err.message,
      }));
      results.push({ email, status: 'error', reason: err.message });
    }
  }
}
