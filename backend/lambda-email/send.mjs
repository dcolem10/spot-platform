/**
 * Helper for other Lambdas to invoke the email Lambda
 *
 * Usage in other Lambdas:
 *   import { sendEmail } from './send.mjs';
 *   await sendEmail('welcome', 'user@example.com', { name: 'John' });
 *
 * Supported types:
 *   - welcome
 *   - offer_alert
 *   - subscription_confirmed
 *   - weekly_digest
 */

import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

const lambda = new LambdaClient({});
const EMAIL_FUNCTION = process.env.EMAIL_FUNCTION_NAME || 'spot-email-dev';

/**
 * Invoke the email Lambda asynchronously (fire-and-forget)
 * Does not throw — failures are logged but don't break the caller
 *
 * @param {string} type - Email template type
 * @param {string} to - Recipient email address
 * @param {object} data - Template data (name, restaurantName, etc.)
 */
export async function sendEmail(type, to, data) {
  try {
    await lambda.send(new InvokeCommand({
      FunctionName: EMAIL_FUNCTION,
      InvocationType: 'Event', // async, fire-and-forget
      Payload: JSON.stringify({ type, to, data }),
    }));
    console.log(`Email queued: type=${type}, to=${to}`);
  } catch (err) {
    // Log but don't throw — email failure shouldn't break the caller
    console.error(`Failed to invoke email Lambda: ${err.message}`);
  }
}
