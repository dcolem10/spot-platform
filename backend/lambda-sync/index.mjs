import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { seedRestaurants } from './seeder.mjs';
import { initLogger, log } from './logger.mjs';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const smClient = new SecretsManagerClient({});
const TABLE = process.env.TABLE_NAME;
if (!TABLE) throw new Error('TABLE_NAME env var is required — Lambda misconfigured');

// ─── Secrets (fetched once per cold start, cached in memory) ─────────────────
let _syncSecrets = null;
let _syncSecretsLoadedAt = 0;
const SECRETS_CACHE_TTL = 300 * 1000; // 5 minutes — shorter window for secret rotation

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
      Limit: 100, // Page size cap — prevents single query from exhausting Lambda memory
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

// ─── Contact Hydration ──────────────────────────────────────────────────────
// Fetches phone & website from Google Places for restaurants missing contact data.
// Uses Place Details (Basic) — $0.017 per request.

async function hydrateContacts(options = {}) {
  const googleKey = await getGoogleKey();
  if (!googleKey) return { error: 'Google Places API key not found' };

  const dryRun = options.dryRun || false;
  const maxRequests = options.maxRequests || 200; // safety cap
  const targetCities = options.cities || null; // null = all cities

  console.log(`Starting contact hydration (dryRun=${dryRun}, cap=${maxRequests})`);

  // Fetch all restaurants
  const restaurants = [];
  let exclusiveStartKey = undefined;

  do {
    const params = {
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'RESTAURANTS' },
      Limit: 100, // Page size cap — prevents single query from exhausting Lambda memory
    };
    if (exclusiveStartKey) params.ExclusiveStartKey = exclusiveStartKey;

    const result = await ddb.send(new QueryCommand(params));
    restaurants.push(...(result.Items || []));
    exclusiveStartKey = result.LastEvaluatedKey;

    if (restaurants.length >= 2000) break; // hard safety cap
  } while (exclusiveStartKey);

  // Filter to restaurants missing contact info + have googlePlaceId
  let needsHydration = restaurants.filter(
    (r) => r.googlePlaceId && (!r.phone || !r.website)
  );

  // Deduplicate by googlePlaceId — multiple restaurants can share the same Place ID
  // (e.g. franchise locations). Only hydrate each unique Place ID once to avoid wasted API calls.
  const seenPlaceIds = new Set();
  needsHydration = needsHydration.filter((r) => {
    if (seenPlaceIds.has(r.googlePlaceId)) return false;
    seenPlaceIds.add(r.googlePlaceId);
    return true;
  });

  // Optionally filter by city
  if (targetCities) {
    needsHydration = needsHydration.filter((r) => targetCities.includes(r.city));
  }

  console.log(`${needsHydration.length} restaurants need contact hydration (of ${restaurants.length} total)`);

  if (needsHydration.length === 0) {
    return { action: 'hydrate', total: restaurants.length, hydrated: 0, skipped: 0, failed: 0 };
  }

  // Cap requests
  const toProcess = needsHydration.slice(0, maxRequests);
  let hydrated = 0;
  let skipped = 0;
  let failed = 0;

  // Process in batches of 5 (rate limiting)
  const BATCH_SIZE = 5;

  for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
    const batch = toProcess.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (r) => {
        try {
          const res = await fetch(
            `https://places.googleapis.com/v1/places/${r.googlePlaceId}`,
            {
              signal: AbortSignal.timeout(8000),
              headers: {
                'X-Goog-Api-Key': googleKey,
                'X-Goog-FieldMask': 'nationalPhoneNumber,websiteUri',
              },
            }
          );

          if (!res.ok) {
            console.warn(`Google API ${res.status} for ${r.name} (${r.googlePlaceId})`);
            return 'failed';
          }

          const data = await res.json();
          const phone = data.nationalPhoneNumber || null;
          const website = data.websiteUri || null;

          if (!phone && !website) {
            console.log(`No contact data available from Google for: ${r.name}`);
            return 'skipped';
          }

          if (dryRun) {
            console.log(`[DRY RUN] Would update ${r.name}: phone=${phone}, website=${website}`);
            return 'hydrated';
          }

          // Build update expression dynamically
          const updates = [];
          const names = {};
          const values = { ':updatedAt': new Date().toISOString() };

          updates.push('#updatedAt = :updatedAt');
          names['#updatedAt'] = 'updatedAt';

          if (phone) {
            updates.push('#phone = :phone');
            names['#phone'] = 'phone';
            values[':phone'] = phone;
          }
          if (website) {
            updates.push('#website = :website');
            names['#website'] = 'website';
            values[':website'] = website;
          }

          await ddb.send(
            new UpdateCommand({
              TableName: TABLE,
              Key: { PK: r.PK, SK: r.SK },
              UpdateExpression: `SET ${updates.join(', ')}`,
              ExpressionAttributeNames: names,
              ExpressionAttributeValues: values,
            })
          );

          console.log(`Hydrated: ${r.name} — phone=${phone}, website=${website}`);
          return 'hydrated';
        } catch (err) {
          console.error(`Error hydrating ${r.name}: ${err.message}`);
          return 'failed';
        }
      })
    );

    results.forEach((r) => {
      const val = r.status === 'fulfilled' ? r.value : 'failed';
      if (val === 'hydrated') hydrated++;
      else if (val === 'skipped') skipped++;
      else failed++;
    });

    // Rate limit delay between batches
    if (i + BATCH_SIZE < toProcess.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const summary = {
    action: 'hydrate',
    dryRun,
    total: restaurants.length,
    needsHydration: needsHydration.length,
    processed: toProcess.length,
    hydrated,
    skipped,
    failed,
    estimatedCost: `$${(toProcess.length * 0.017).toFixed(2)}`,
    timestamp: new Date().toISOString(),
  };

  console.log('Hydration complete:', JSON.stringify(summary, null, 2));
  return summary;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
//
// Event-driven routing:
//   - No event / scheduled event → daily validation (existing behavior)
//   - { action: "seed" }         → seed restaurants from Google Places
//   - { action: "seed", cities: ["Washington, DC"], dryRun: true } → targeted dry run
//   - { action: "hydrate" }      → backfill phone/website from Google Places
//   - { action: "hydrate", dryRun: true } → preview what would be hydrated
//
// To trigger hydration from CLI:
//   aws lambda invoke --function-name spot-sync-dev \
//     --payload '{"action":"hydrate"}' /dev/stdout
//
// Dry run first:
//   aws lambda invoke --function-name spot-sync-dev \
//     --payload '{"action":"hydrate","dryRun":true}' /dev/stdout

export const handler = async (event = {}) => {
  const action = event.action || 'validate';
  initLogger(event.requestContext?.requestId || 'scheduled', `sync:${action}`);
  log.info('handler_invoked', { action });

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

  if (action === 'hydrate') {
    console.log('Contact hydration triggered');
    return await hydrateContacts({
      dryRun: event.dryRun || false,
      maxRequests: event.maxRequests || 200,
      cities: event.cities || null,
    });
  }

  // Default: daily validation
  const summary = await runValidation();
  console.log('Sync complete:', summary);
  return summary;
};
