import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;

// ─── Google Places Validation ────────────────────────────────────────────────
// Only validates that the place_id is still valid. Does NOT store Google content
// (hours, rating, photos, etc.) — that data is fetched JIT via the API Lambda
// with a 24hr DynamoDB cache to comply with Google Places ToS.

async function validateGooglePlaceId(restaurant) {
  if (!GOOGLE_KEY || !restaurant.googlePlaceId) return false;

  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${restaurant.googlePlaceId}?fields=displayName`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': 'displayName',
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

// ─── Main Handler ─────────────────────────────────────────────────────────────

export const handler = async () => {
  console.log('Starting daily restaurant validation sync...');

  // Paginate through all restaurants
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
  } while (exclusiveStartKey);

  console.log(`Found ${restaurants.length} restaurants to validate`);

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

  const summary = {
    total: restaurants.length,
    validated,
    failed,
    timestamp: new Date().toISOString(),
  };

  console.log('Sync complete:', summary);
  return summary;
};
