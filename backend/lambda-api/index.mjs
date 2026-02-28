import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { randomUUID } from 'crypto';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const respond = (statusCode, body) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

const sanitize = (s, max = 500) =>
  typeof s === 'string' ? s.trim().slice(0, max) : '';

const isValidId = (id) =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);

function getUserId(event) {
  return (
    event.requestContext?.authorizer?.claims?.sub ||
    event.headers?.['x-user-id'] ||
    'anonymous'
  );
}

// ─── Restaurant CRUD ──────────────────────────────────────────────────────────

async function listRestaurants(event) {
  const params = event.queryStringParameters || {};
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'RESTAURANTS' },
    })
  );

  let items = result.Items || [];

  if (params.cuisine) {
    const cuisines = params.cuisine.split(',');
    items = items.filter((r) =>
      r.cuisine?.some((c) => cuisines.includes(c))
    );
  }
  if (params.neighborhood) {
    items = items.filter(
      (r) => r.neighborhood === params.neighborhood
    );
  }
  if (params.partner === 'true') {
    items = items.filter((r) => r.isPartner);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    items = items.filter(
      (r) =>
        r.name?.toLowerCase().includes(q) ||
        r.cuisine?.some((c) => c.toLowerCase().includes(q)) ||
        r.neighborhood?.toLowerCase().includes(q)
    );
  }

  return respond(200, { restaurants: items });
}

async function getRestaurant(restaurantId) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid ID' });
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' },
    })
  );
  if (!result.Item) return respond(404, { error: 'Not found' });
  return respond(200, result.Item);
}

async function createRestaurant(event) {
  const body = JSON.parse(event.body || '{}');
  const id = randomUUID().slice(0, 8);
  const item = {
    PK: `RESTAURANT#${id}`,
    SK: 'PROFILE',
    GSI1PK: 'RESTAURANTS',
    GSI1SK: `RESTAURANT#${id}`,
    restaurantId: id,
    name: sanitize(body.name, 200),
    address: sanitize(body.address, 500),
    neighborhood: sanitize(body.neighborhood, 100),
    coords: body.coords || { lat: 0, lng: 0 },
    cuisine: Array.isArray(body.cuisine) ? body.cuisine.map((c) => sanitize(c, 50)) : [],
    vibes: Array.isArray(body.vibes) ? body.vibes.map((v) => sanitize(v, 50)) : [],
    priceLevel: Math.min(4, Math.max(1, Number(body.priceLevel) || 2)),
    phone: sanitize(body.phone, 20),
    website: sanitize(body.website, 300),
    hours: body.hours || null,
    googlePlaceId: sanitize(body.googlePlaceId, 100),
    yelpId: sanitize(body.yelpId, 100),
    spotRating: body.spotRating ? Math.min(5, Math.max(0, Number(body.spotRating))) : null,
    spotVideoUrl: sanitize(body.spotVideoUrl, 500),
    spotReview: sanitize(body.spotReview, 2000),
    lastVisited: body.lastVisited || null,
    isPartner: Boolean(body.isPartner),
    photos: Array.isArray(body.photos) ? body.photos.slice(0, 10).map((p) => sanitize(p, 500)) : [],
    reservationUrl: sanitize(body.reservationUrl, 500),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return respond(201, item);
}

async function updateRestaurant(restaurantId, event) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid ID' });
  const body = JSON.parse(event.body || '{}');
  const updates = {};
  const names = {};
  const values = {};
  let expr = '';

  const fields = [
    'name', 'address', 'neighborhood', 'cuisine', 'vibes', 'priceLevel',
    'phone', 'website', 'hours', 'spotRating', 'spotVideoUrl', 'spotReview',
    'lastVisited', 'isPartner', 'photos', 'reservationUrl',
  ];

  fields.forEach((f) => {
    if (body[f] !== undefined) {
      const key = `#${f}`;
      const val = `:${f}`;
      names[key] = f;
      values[val] = body[f];
      expr += `${expr ? ', ' : ''}${key} = ${val}`;
    }
  });

  if (!expr) return respond(400, { error: 'No fields to update' });

  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  expr += ', #updatedAt = :updatedAt';

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' },
      UpdateExpression: `SET ${expr}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    })
  );

  return respond(200, { message: 'Updated' });
}

// ─── Campaign CRUD ────────────────────────────────────────────────────────────

async function listCampaigns(event) {
  const userId = getUserId(event);
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'CAMPAIGNS' },
    })
  );
  return respond(200, { campaigns: result.Items || [] });
}

async function createCampaign(event) {
  const body = JSON.parse(event.body || '{}');
  const id = randomUUID().slice(0, 8);
  const restaurantId = sanitize(body.restaurantId, 64);

  const item = {
    PK: `RESTAURANT#${restaurantId}`,
    SK: `CAMPAIGN#${id}`,
    GSI1PK: 'CAMPAIGNS',
    GSI1SK: `CAMPAIGN#${id}`,
    campaignId: id,
    restaurantId,
    restaurantName: sanitize(body.restaurantName, 200),
    status: 'inquiry',
    package: sanitize(body.package, 200),
    budget: Number(body.budget) || 0,
    startDate: body.startDate || null,
    endDate: body.endDate || null,
    deliverables: Array.isArray(body.deliverables)
      ? body.deliverables.map((d) => ({
          id: randomUUID().slice(0, 6),
          type: sanitize(d.type, 20),
          description: sanitize(d.description, 500),
          completed: false,
        }))
      : [],
    notes: sanitize(body.notes, 2000),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return respond(201, item);
}

async function updateCampaign(campaignId, event) {
  if (!isValidId(campaignId)) return respond(400, { error: 'Invalid ID' });
  const body = JSON.parse(event.body || '{}');

  // Find the campaign first via GSI
  const find = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': 'CAMPAIGNS',
        ':sk': `CAMPAIGN#${campaignId}`,
      },
    })
  );

  if (!find.Items?.length) return respond(404, { error: 'Campaign not found' });
  const existing = find.Items[0];

  const updates = { ...existing, ...body, updatedAt: new Date().toISOString() };

  await ddb.send(
    new PutCommand({ TableName: TABLE, Item: updates })
  );

  return respond(200, updates);
}

// ─── Offer CRUD ───────────────────────────────────────────────────────────────

async function createOffer(restaurantId, event) {
  const body = JSON.parse(event.body || '{}');
  const id = randomUUID().slice(0, 8);
  const code = `SPOT-${id.toUpperCase()}`;

  const item = {
    PK: `RESTAURANT#${restaurantId}`,
    SK: `OFFER#${id}`,
    GSI1PK: 'OFFERS',
    GSI1SK: `OFFER#${id}`,
    offerId: id,
    restaurantId,
    code,
    type: body.type || 'qr',
    description: sanitize(body.description, 500),
    landingPageUrl: `/r/${sanitize(body.slug || restaurantId, 100)}`,
    scans: 0,
    redemptions: 0,
    expiresAt: body.expiresAt || null,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return respond(201, item);
}

async function trackScan(code) {
  // Find offer by code
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'OFFERS' },
    })
  );

  const offer = result.Items?.find((o) => o.code === code);
  if (!offer) return respond(404, { error: 'Offer not found' });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: offer.PK, SK: offer.SK },
      UpdateExpression: 'SET scans = scans + :inc',
      ExpressionAttributeValues: { ':inc': 1 },
    })
  );

  return respond(200, {
    restaurantId: offer.restaurantId,
    landingPageUrl: offer.landingPageUrl,
    description: offer.description,
  });
}

async function redeemOffer(code) {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'OFFERS' },
    })
  );

  const offer = result.Items?.find((o) => o.code === code);
  if (!offer) return respond(404, { error: 'Offer not found' });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: offer.PK, SK: offer.SK },
      UpdateExpression: 'SET redemptions = redemptions + :inc',
      ExpressionAttributeValues: { ':inc': 1 },
    })
  );

  return respond(200, { message: 'Redeemed', offerId: offer.offerId });
}

// ─── Saves (Audience) ─────────────────────────────────────────────────────────

async function saveRestaurant(event, restaurantId) {
  const userId = getUserId(event);
  const body = JSON.parse(event.body || '{}');

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `AUDIENCE#${userId}`,
        SK: `SAVE#${restaurantId}`,
        restaurantId,
        savedAt: new Date().toISOString(),
        notes: sanitize(body.notes, 500),
        occasion: sanitize(body.occasion, 100),
      },
    })
  );

  return respond(201, { message: 'Saved' });
}

async function listSaves(event) {
  const userId = getUserId(event);
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `AUDIENCE#${userId}`,
        ':sk': 'SAVE#',
      },
    })
  );
  return respond(200, { saves: result.Items || [] });
}

// ─── Email Subscribe ──────────────────────────────────────────────────────────

async function subscribe(event) {
  const body = JSON.parse(event.body || '{}');
  const email = sanitize(body.email, 200);
  if (!email || !email.includes('@')) return respond(400, { error: 'Invalid email' });

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: 'SUBSCRIBERS',
        SK: `EMAIL#${email}`,
        email,
        subscribedAt: new Date().toISOString(),
      },
    })
  );

  return respond(201, { message: 'Subscribed' });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path || '';
  const pathParts = path.split('/').filter(Boolean);

  try {
    // Health check
    if (path.endsWith('/health')) return respond(200, { status: 'ok' });

    // Restaurants
    if (path.match(/\/api\/restaurants$/) && method === 'GET')
      return listRestaurants(event);
    if (path.match(/\/api\/restaurants$/) && method === 'POST')
      return createRestaurant(event);
    if (path.match(/\/api\/restaurants\/[^/]+$/) && method === 'GET')
      return getRestaurant(pathParts[pathParts.length - 1]);
    if (path.match(/\/api\/restaurants\/[^/]+$/) && method === 'PUT')
      return updateRestaurant(pathParts[pathParts.length - 1], event);

    // Restaurant offers
    if (path.match(/\/api\/restaurants\/[^/]+\/offers$/) && method === 'POST') {
      const restId = pathParts[pathParts.length - 2];
      return createOffer(restId, event);
    }

    // Campaigns
    if (path.match(/\/api\/campaigns$/) && method === 'GET')
      return listCampaigns(event);
    if (path.match(/\/api\/campaigns$/) && method === 'POST')
      return createCampaign(event);
    if (path.match(/\/api\/campaigns\/[^/]+$/) && method === 'PUT')
      return updateCampaign(pathParts[pathParts.length - 1], event);

    // Offer tracking (public)
    if (path.match(/\/api\/offers\/[^/]+\/scan$/) && method === 'GET')
      return trackScan(pathParts[pathParts.length - 2]);
    if (path.match(/\/api\/offers\/[^/]+\/redeem$/) && method === 'POST')
      return redeemOffer(pathParts[pathParts.length - 2]);

    // Saves
    if (path.match(/\/api\/saves\/[^/]+$/) && method === 'POST')
      return saveRestaurant(event, pathParts[pathParts.length - 1]);
    if (path.match(/\/api\/saves$/) && method === 'GET')
      return listSaves(event);

    // Subscribe
    if (path.match(/\/api\/subscribe$/) && method === 'POST')
      return subscribe(event);

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error('Handler error:', err);
    return respond(500, { error: 'Internal server error' });
  }
};
