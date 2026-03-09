import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { seedRestaurants } from './seeder.mjs';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const smClient = new SecretsManagerClient({});
const TABLE = process.env.TABLE_NAME;

// ─── Secrets (fetched once per cold start, cached in memory) ─────────────────
let _syncSecrets = null;
let _syncSecretsLoadedAt = 0;
const SECRETS_CACHE_TTL = 3600 * 1000; // 1 hour

async function getGoogleKey() {
  const now = Date.now();
  if (_syncSecrets && (now - _syncSecretsLoadedAt < SECRETS_CACHE_TTL)) {
    return _syncSecrets.GOOGLE_PLACES_API_KEY;
  }
  const arn = process.env.SECRETS_ARN;
  if (!arn) return null;
  try {
    const { SecretString } = await smClient.send(
      new GetSecretValueCommand({ SecretId: arn })
    );
    _syncSecrets = JSON.parse(SecretString);
    _syncSecretsLoadedAt = now;
    return _syncSecrets.GOOGLE_PLACES_API_KEY;
  } catch (err) {
    const code = err.name || err.code || 'Unknown';
    console.error(`Secrets Manager error [${code}]: ${err.message}`);
    // Return cached key if available
    if (_syncSecrets) { console.warn('Using stale cached secrets'); return _syncSecrets.GOOGLE_PLACES_API_KEY; }
    return null;
  }
}

// ─── Google Places Validation ────────────────────────────────────────────────
// Only validates that the place_id is still valid. Does NOT store Google content
// (hours, rating, photos, etc.) — that data is fetched JIT via the API Lambda
// with a 24hr DynamoDB cache to comply with Google Places ToS.

async function validateGooglePlaceId(restaurant) {
  const googleKey = await getGoogleKey();
  if (!googleKey || !restaurant.googlePlaceId) return false;

  try {
    // Request only 'id' (IDs Only SKU = free tier) since we only need existence check
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${restaurant.googlePlaceId}`,
      {
        signal: AbortSignal.timeout(10000),
        headers: {
          'X-Goog-Api-Key': googleKey,
          'X-Goog-FieldMask': 'id',
        },
      }
    );

    return res.ok;
  } catch (err) {
    console.error(`Google validation failed for ${restaurant.restaurantId}:`, err.message);
    return false;
  }
}

// ─── Refresh (validate + update timestamp) ───────────────────────────────────

async function refreshRestaurant(restaurant) {
  const isValid = await validateGooglePlaceId(restaurant);

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: restaurant.PK, SK: restaurant.SK },
      UpdateExpression: 'SET #lastSynced = :lastSynced, #googleValid = :googleValid, #updatedAt = :updatedAt',
      ExpressionAttributeNames: {
        '#lastSynced': 'lastSynced',
        '#googleValid': 'googleValid',
        '#updatedAt': 'updatedAt',
      },
      ExpressionAttributeValues: {
        ':lastSynced': new Date().toISOString(),
        ':googleValid': isValid,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );

  console.log(`Validated: ${restaurant.name} (${restaurant.restaurantId}) — Google valid: ${isValid}`);
}

// ─── Daily Validation ────────────────────────────────────────────────────────

/** Safety cap: max restaurants to process per invocation to prevent runaway API costs */
const MAX_RESTAURANTS = 1000;

async function runValidation() {
  console.log('Starting daily restaurant validation sync...');

  // Paginate through all restaurants (with safety cap)
  const restaurants = [];
  let exclusiveStartKey = undefined;

  do {
    const queryParams = {
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'RESTAURANTS' },
    };
    if (exclusiveStartKey) {
      queryParams.ExclusiveStartKey = exclusiveStartKey;
    }

    const result = await ddb.send(new QueryCommand(queryParams));
    restaurants.push(...(result.Items || []));
    exclusiveStartKey = result.LastEvaluatedKey;

    if (restaurants.length >= MAX_RESTAURANTS) {
      console.warn(`Hit restaurant safety cap (${MAX_RESTAURANTS}). Stopping pagination.`);
      break;
    }
  } while (exclusiveStartKey);

  // Trim to cap in case last page pushed over
  if (restaurants.length > MAX_RESTAURANTS) {
    restaurants.length = MAX_RESTAURANTS;
  }

  console.log(`Found ${restaurants.length} restaurants to validate (cap: ${MAX_RESTAURANTS})`);

  // Process in batches of 5 to respect API rate limits
  const BATCH_SIZE = 5;
  let validated = 0;
  let failed = 0;

  for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
    const batch = restaurants.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((r) => refreshRestaurant(r))
    );

    results.forEach((r) => {
      if (r.status === 'fulfilled') validated++;
      else failed++;
    });

    // Small delay between batches
    if (i + BATCH_SIZE < restaurants.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return {
    action: 'validate',
    total: restaurants.length,
    validated,
    failed,
    timestamp: new Date().toISOString(),
  };
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
//
// Event-driven routing:
//   - No event / scheduled event → daily validation (existing behavior)
//   - { action: "seed" }         → seed restaurants from Google Places
//   - { action: "seed", cities: ["Washington, DC"], dryRun: true } → targeted dry run
//
// To trigger a seed manually from CLI:
//   aws lambda invoke --function-name spot-sync-dev \
//     --payload '{"action":"seed"}' /dev/stdout
//
// To do a dry run for one city:
//   aws lambda invoke --function-name spot-sync-dev \
//     --payload '{"action":"seed","cities":["Washington, DC"],"dryRun":true}' /dev/stdout

export const handler = async (event = {}) => {
  const action = event.action || 'validate';

  if (action === 'seed') {
    console.log('Seed mode triggered');
    const googleKey = await getGoogleKey();

    if (!googleKey) {
      const err = 'Google Places API key not found in Secrets Manager. Cannot seed.';
      console.error(err);
      return { error: err };
    }

    return await seedRestaurants(TABLE, googleKey, {
      cities: event.cities || undefined,      // array of city names, or all
      cuisines: event.cuisines || undefined,   // array of cuisine names, or all
      dryRun: event.dryRun || false,
    });
  }

  // Default: daily validation
  const summary = await runValidation();
  console.log('Sync complete:', summary);
  return summary;
};
