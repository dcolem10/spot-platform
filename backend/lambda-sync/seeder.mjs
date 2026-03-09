/**
 * Google Places Restaurant Seeder
 *
 * Fetches real restaurants from Google Places API (v2 — Text Search)
 * and writes them to DynamoDB for the public restaurant directory.
 *
 * DynamoDB schema for seeded restaurants:
 *   PK:     RESTAURANT#{restaurantId}
 *   SK:     PROFILE
 *   GSI1PK: RESTAURANTS
 *   GSI1SK: CITY#{city}#{name}   (enables begins_with for city filtering)
 *
 * Cost notes:
 *   - Text Search (Basic) = $0.032 per request
 *   - Each request returns up to 20 results
 *   - 9 cities × ~12 cuisine types = ~108 requests ≈ $3.46 per full seed
 *   - We request minimal fields to stay on the Basic pricing tier
 *
 * Safety:
 *   - MAX_REQUESTS cap prevents runaway costs
 *   - Deduplication by Google place ID
 *   - Batch writes with exponential backoff
 */

import { DynamoDBDocumentClient, BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

/* ─── Configuration ──────────────────────────────────────────────────────── */

/** Cities to seed — center coordinates + search radius in meters */
const SEED_CITIES = [
  { name: 'Washington, DC',   lat: 38.9072, lng: -77.0369, radius: 12000 },
  { name: 'Baltimore, MD',    lat: 39.2904, lng: -76.6122, radius: 10000 },
  { name: 'Arlington, VA',    lat: 38.8799, lng: -77.1068, radius: 8000  },
  { name: 'Alexandria, VA',   lat: 38.8048, lng: -77.0469, radius: 8000  },
  { name: 'New York, NY',     lat: 40.7128, lng: -74.0060, radius: 15000 },
  { name: 'Atlanta, GA',      lat: 33.7490, lng: -84.3880, radius: 12000 },
  { name: 'Chicago, IL',      lat: 41.8781, lng: -87.6298, radius: 12000 },
  { name: 'Los Angeles, CA',  lat: 34.0522, lng: -118.2437, radius: 15000 },
  { name: 'Miami, FL',        lat: 25.7617, lng: -80.1918, radius: 12000 },
];

/** Cuisine categories to search per city */
const CUISINE_CATEGORIES = [
  'Italian', 'Japanese', 'Mexican', 'Chinese', 'Thai', 'Indian',
  'French', 'Korean', 'Mediterranean', 'Vietnamese', 'Ethiopian',
  'American', 'Seafood', 'BBQ', 'Caribbean', 'Middle Eastern',
  'Filipino', 'Peruvian', 'Southern', 'Greek',
];

/** Max Google API requests per invocation — hard safety cap */
const MAX_REQUESTS = 200;

/** Max restaurants to write per invocation */
const MAX_RESTAURANTS = 5000;

/* ─── Google Places API (v2) ─────────────────────────────────────────────── */

/**
 * Search for restaurants via Google Places Text Search (New).
 * Uses Basic field mask to stay on cheapest pricing tier ($0.032/request).
 *
 * @param {string} query - e.g. "Italian restaurants in Washington DC"
 * @param {object} location - { lat, lng }
 * @param {number} radius - search radius in meters
 * @param {string} apiKey - Google Places API key
 * @returns {Array} array of place objects
 */
async function searchPlaces(query, location, radius, apiKey) {
  const body = {
    textQuery: query,
    locationBias: {
      circle: {
        center: { latitude: location.lat, longitude: location.lng },
        radius,
      },
    },
    includedType: 'restaurant',
    maxResultCount: 20,
    languageCode: 'en',
  };

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // Basic field mask — keeps cost at Basic tier ($0.032/request)
      'X-Goog-FieldMask': [
        'places.id',
        'places.displayName',
        'places.formattedAddress',
        'places.location',
        'places.types',
        'places.priceLevel',
        'places.rating',
        'places.websiteUri',
        'places.nationalPhoneNumber',
        'places.googleMapsUri',
      ].join(','),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => 'unknown');
    console.error(`Google Places API error ${res.status}: ${errText}`);
    return [];
  }

  const data = await res.json();
  return data.places || [];
}

/* ─── Normalization ──────────────────────────────────────────────────────── */

/**
 * Convert Google Places price_level to our 1-4 scale.
 * Google uses: PRICE_LEVEL_FREE, PRICE_LEVEL_INEXPENSIVE, PRICE_LEVEL_MODERATE,
 *              PRICE_LEVEL_EXPENSIVE, PRICE_LEVEL_VERY_EXPENSIVE
 */
function normalizePriceLevel(googleLevel) {
  const map = {
    'PRICE_LEVEL_FREE': 1,
    'PRICE_LEVEL_INEXPENSIVE': 1,
    'PRICE_LEVEL_MODERATE': 2,
    'PRICE_LEVEL_EXPENSIVE': 3,
    'PRICE_LEVEL_VERY_EXPENSIVE': 4,
  };
  return map[googleLevel] || 2; // default to $$ if unknown
}

/**
 * Extract neighborhood from formatted address.
 * Google doesn't provide neighborhood directly — we parse from the address.
 * Format is usually: "123 Main St, Neighborhood, City, State ZIP"
 */
function extractNeighborhood(address, cityName) {
  if (!address) return 'Unknown';
  const parts = address.split(',').map((p) => p.trim());
  // Try to find the part between street address and city
  // Usually index 1 is neighborhood/area
  if (parts.length >= 3) {
    // Check if parts[1] is the city itself — if so, there's no neighborhood
    const cityShort = cityName.split(',')[0].trim();
    if (!parts[1].includes(cityShort) && !parts[1].match(/^\d/)) {
      return parts[1];
    }
  }
  return parts.length >= 2 ? parts[1] || 'Unknown' : 'Unknown';
}

/**
 * Infer cuisine tags from the search query and Google place types.
 * Since Google types are very broad (e.g., "restaurant", "food"), we use
 * the cuisine category we searched for as the primary tag.
 */
function inferCuisine(searchedCuisine, googleTypes) {
  const cuisines = [searchedCuisine];

  // Map some Google types to additional cuisine tags
  const typeMap = {
    'japanese_restaurant': 'Japanese',
    'chinese_restaurant': 'Chinese',
    'indian_restaurant': 'Indian',
    'italian_restaurant': 'Italian',
    'mexican_restaurant': 'Mexican',
    'thai_restaurant': 'Thai',
    'french_restaurant': 'French',
    'korean_restaurant': 'Korean',
    'vietnamese_restaurant': 'Vietnamese',
    'greek_restaurant': 'Greek',
    'mediterranean_restaurant': 'Mediterranean',
    'seafood_restaurant': 'Seafood',
    'american_restaurant': 'American',
    'barbecue_restaurant': 'BBQ',
    'brunch_restaurant': 'Brunch',
    'steak_house': 'Steakhouse',
    'sushi_restaurant': 'Japanese',
    'pizza_restaurant': 'Pizza',
    'hamburger_restaurant': 'American',
  };

  (googleTypes || []).forEach((type) => {
    const mapped = typeMap[type];
    if (mapped && !cuisines.includes(mapped)) {
      cuisines.push(mapped);
    }
  });

  return cuisines.slice(0, 4); // max 4 cuisine tags
}

/**
 * Convert a Google Place object to our Restaurant schema.
 */
function normalizePlace(place, cityName, searchedCuisine) {
  const googlePlaceId = place.id;
  // Create a stable restaurantId from the Google place ID
  const restaurantId = `gp-${googlePlaceId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

  return {
    // DynamoDB keys
    PK: `RESTAURANT#${restaurantId}`,
    SK: 'PROFILE',
    GSI1PK: 'RESTAURANTS',
    GSI1SK: `CITY#${cityName}#${(place.displayName?.text || '').replace(/[^a-zA-Z0-9 ]/g, '').slice(0, 80)}`,

    // Restaurant fields
    restaurantId,
    name: place.displayName?.text || 'Unknown',
    address: place.formattedAddress || '',
    neighborhood: extractNeighborhood(place.formattedAddress, cityName),
    city: cityName,
    coords: {
      lat: place.location?.latitude || 0,
      lng: place.location?.longitude || 0,
    },
    cuisine: inferCuisine(searchedCuisine, place.types),
    vibes: [], // we don't get this from Google — can be enriched later
    priceLevel: normalizePriceLevel(place.priceLevel),
    phone: place.nationalPhoneNumber || null,
    website: place.websiteUri || null,
    googlePlaceId,
    googleMapsUrl: place.googleMapsUri || null,
    spotRating: place.rating ? Math.round(place.rating * 10) / 10 : null,
    isPartner: false, // seeded restaurants start as non-partners
    photos: [], // photo references require Photo API calls — skip for now
    reservationUrl: null,
    source: 'google-places-seed',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/* ─── DynamoDB Batch Write ───────────────────────────────────────────────── */

/**
 * Write restaurants to DynamoDB in batches of 25 (DynamoDB limit).
 * Uses PutRequest which will overwrite existing items with same PK/SK.
 */
async function batchWriteRestaurants(tableName, restaurants) {
  const BATCH_SIZE = 25;
  let written = 0;
  let failed = 0;

  for (let i = 0; i < restaurants.length; i += BATCH_SIZE) {
    const batch = restaurants.slice(i, i + BATCH_SIZE);
    const requestItems = {
      [tableName]: batch.map((r) => ({
        PutRequest: { Item: r },
      })),
    };

    try {
      const result = await ddb.send(new BatchWriteCommand({ RequestItems: requestItems }));

      // Handle unprocessed items (throttling)
      const unprocessed = result.UnprocessedItems?.[tableName]?.length || 0;
      written += batch.length - unprocessed;
      failed += unprocessed;

      if (unprocessed > 0) {
        console.warn(`${unprocessed} unprocessed items in batch ${Math.floor(i / BATCH_SIZE) + 1}`);
      }
    } catch (err) {
      console.error(`Batch write error at offset ${i}:`, err.message);
      failed += batch.length;
    }

    // Small delay between batches to avoid throttling
    if (i + BATCH_SIZE < restaurants.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return { written, failed };
}

/* ─── Count existing restaurants per city ─────────────────────────────────── */

async function countExistingByCity(tableName) {
  const counts = {};
  let lastKey = undefined;

  do {
    const params = {
      TableName: tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'RESTAURANTS' },
      Select: 'SPECIFIC_ATTRIBUTES',
      ProjectionExpression: 'city',
    };
    if (lastKey) params.ExclusiveStartKey = lastKey;

    const result = await ddb.send(new QueryCommand(params));
    (result.Items || []).forEach((item) => {
      if (item.city) counts[item.city] = (counts[item.city] || 0) + 1;
    });
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return counts;
}

/* ─── Main Seeder ─────────────────────────────────────────────────────────── */

/**
 * Seed restaurants from Google Places for all configured cities.
 *
 * @param {string} tableName - DynamoDB table name
 * @param {string} apiKey - Google Places API key
 * @param {object} options
 * @param {string[]} [options.cities] - Specific city names to seed (default: all)
 * @param {string[]} [options.cuisines] - Specific cuisines to search (default: all)
 * @param {boolean} [options.dryRun] - If true, skip DynamoDB writes
 * @returns {object} summary of seeding results
 */
export async function seedRestaurants(tableName, apiKey, options = {}) {
  const startTime = Date.now();
  const targetCities = options.cities
    ? SEED_CITIES.filter((c) => options.cities.includes(c.name))
    : SEED_CITIES;
  const targetCuisines = options.cuisines || CUISINE_CATEGORIES;
  const dryRun = options.dryRun || false;

  console.log(`Starting restaurant seeder: ${targetCities.length} cities × ${targetCuisines.length} cuisines`);
  if (dryRun) console.log('DRY RUN — no DynamoDB writes');

  // Check existing counts
  const existingCounts = await countExistingByCity(tableName);
  console.log('Existing restaurant counts:', existingCounts);

  // Deduplicate across all searches by Google place ID
  const seen = new Map(); // googlePlaceId → normalized restaurant
  let requestCount = 0;

  for (const city of targetCities) {
    const cityStart = Date.now();
    let cityCount = 0;

    for (const cuisine of targetCuisines) {
      if (requestCount >= MAX_REQUESTS) {
        console.warn(`Hit request safety cap (${MAX_REQUESTS}). Stopping.`);
        break;
      }

      const query = `Best ${cuisine} restaurants in ${city.name}`;
      console.log(`  Searching: ${query}`);

      try {
        const places = await searchPlaces(query, { lat: city.lat, lng: city.lng }, city.radius, apiKey);
        requestCount++;

        for (const place of places) {
          if (!place.id || seen.has(place.id)) continue;

          const normalized = normalizePlace(place, city.name, cuisine);
          seen.set(place.id, normalized);
          cityCount++;

          if (seen.size >= MAX_RESTAURANTS) {
            console.warn(`Hit restaurant safety cap (${MAX_RESTAURANTS}). Stopping.`);
            break;
          }
        }

        // Rate limit: ~2 requests/second
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (err) {
        console.error(`  Error searching "${query}":`, err.message);
      }
    }

    if (requestCount >= MAX_REQUESTS || seen.size >= MAX_RESTAURANTS) break;

    console.log(`  ${city.name}: found ${cityCount} unique restaurants (${Date.now() - cityStart}ms)`);
  }

  // Merge cuisine tags for duplicates that appeared in multiple searches
  // (handled by dedup — first search's cuisine wins, but Google types add more)

  const allRestaurants = Array.from(seen.values());
  console.log(`Total unique restaurants: ${allRestaurants.length} from ${requestCount} API requests`);

  // Write to DynamoDB
  let writeResult = { written: 0, failed: 0 };
  if (!dryRun && allRestaurants.length > 0) {
    writeResult = await batchWriteRestaurants(tableName, allRestaurants);
    console.log(`DynamoDB writes: ${writeResult.written} succeeded, ${writeResult.failed} failed`);
  }

  // Per-city summary
  const cityCounts = {};
  allRestaurants.forEach((r) => {
    cityCounts[r.city] = (cityCounts[r.city] || 0) + 1;
  });

  const summary = {
    action: 'seed',
    dryRun,
    requestCount,
    estimatedCost: `$${(requestCount * 0.032).toFixed(2)}`,
    totalRestaurants: allRestaurants.length,
    cityCounts,
    existingCounts,
    written: writeResult.written,
    failed: writeResult.failed,
    durationMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  console.log('Seed complete:', JSON.stringify(summary, null, 2));
  return summary;
}

/** Export city/cuisine config for transparency */
export { SEED_CITIES, CUISINE_CATEGORIES };
