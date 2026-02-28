import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;
const GOOGLE_KEY = process.env.GOOGLE_PLACES_API_KEY;
const YELP_KEY = process.env.YELP_FUSION_API_KEY;

// ─── Google Places Refresh ────────────────────────────────────────────────────

async function refreshFromGoogle(restaurant) {
  if (!GOOGLE_KEY || !restaurant.googlePlaceId) return null;

  try {
    const fields = 'displayName,formattedAddress,regularOpeningHours,rating,priceLevel,photos';
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${restaurant.googlePlaceId}?fields=${fields}`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_KEY,
          'X-Goog-FieldMask': fields,
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();

    return {
      hours: data.regularOpeningHours || null,
      googleRating: data.rating || null,
      googlePriceLevel: data.priceLevel || null,
    };
  } catch (err) {
    console.error(`Google refresh failed for ${restaurant.restaurantId}:`, err.message);
    return null;
  }
}

// ─── Yelp Refresh ─────────────────────────────────────────────────────────────

async function refreshFromYelp(restaurant) {
  if (!YELP_KEY || !restaurant.yelpId) return null;

  try {
    const res = await fetch(
      `https://api.yelp.com/v3/businesses/${restaurant.yelpId}`,
      { headers: { Authorization: `Bearer ${YELP_KEY}` } }
    );

    if (!res.ok) return null;
    const data = await res.json();

    return {
      yelpRating: data.rating || null,
      yelpReviewCount: data.review_count || null,
      yelpPrice: data.price || null,
      yelpCategories: data.categories?.map((c) => c.title) || [],
      yelpPhone: data.display_phone || null,
    };
  } catch (err) {
    console.error(`Yelp refresh failed for ${restaurant.restaurantId}:`, err.message);
    return null;
  }
}

// ─── Merge and Update ─────────────────────────────────────────────────────────

async function refreshRestaurant(restaurant) {
  const [google, yelp] = await Promise.all([
    refreshFromGoogle(restaurant),
    refreshFromYelp(restaurant),
  ]);

  if (!google && !yelp) return;

  // H6: Use UpdateCommand with SET expressions for only the synced fields,
  // instead of PutCommand which could overwrite concurrent changes.
  const syncedFields = {
    ...(google || {}),
    ...(yelp || {}),
    lastSynced: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const names = {};
  const values = {};
  const parts = [];

  Object.entries(syncedFields).forEach(([field, value]) => {
    if (value !== undefined) {
      names[`#${field}`] = field;
      values[`:${field}`] = value;
      parts.push(`#${field} = :${field}`);
    }
  });

  if (parts.length === 0) return;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: restaurant.PK, SK: restaurant.SK },
      UpdateExpression: `SET ${parts.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    })
  );
  console.log(`Refreshed: ${restaurant.name} (${restaurant.restaurantId})`);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export const handler = async () => {
  console.log('Starting daily restaurant data sync...');

  // H5: Paginate through all restaurants to handle large datasets
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

  console.log(`Found ${restaurants.length} restaurants to refresh`);

  // Process in batches of 5 to respect API rate limits
  const BATCH_SIZE = 5;
  let refreshed = 0;
  let failed = 0;

  for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
    const batch = restaurants.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((r) => refreshRestaurant(r))
    );

    results.forEach((r) => {
      if (r.status === 'fulfilled') refreshed++;
      else failed++;
    });

    // Small delay between batches
    if (i + BATCH_SIZE < restaurants.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  const summary = {
    total: restaurants.length,
    refreshed,
    failed,
    timestamp: new Date().toISOString(),
  };

  console.log('Sync complete:', summary);
  return summary;
};
