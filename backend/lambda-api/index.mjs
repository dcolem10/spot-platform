import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { randomUUID } from 'crypto';
import { sanitize, isValidId, stripDdbKeys, calculateTier, DDB_KEYS } from './helpers.mjs';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const smClient = new SecretsManagerClient({});
const TABLE = process.env.TABLE_NAME;
const ORIGIN = process.env.ALLOWED_ORIGIN || '';
if (!ORIGIN) console.warn('ALLOWED_ORIGIN not set — CORS will block all cross-origin requests');

// ─── Secrets (fetched once per cold start, cached in memory) ─────────────────
let _apiSecrets = null;
let _apiSecretsLoadedAt = 0;
const SECRETS_CACHE_TTL = 3600 * 1000; // 1 hour

async function getApiSecrets() {
  const now = Date.now();
  if (_apiSecrets && (now - _apiSecretsLoadedAt < SECRETS_CACHE_TTL)) return _apiSecrets;
  const arn = process.env.SECRETS_ARN;
  if (!arn) { console.warn('SECRETS_ARN not configured'); return {}; }
  try {
    const { SecretString } = await smClient.send(
      new GetSecretValueCommand({ SecretId: arn })
    );
    _apiSecrets = JSON.parse(SecretString);
    _apiSecretsLoadedAt = now;
    return _apiSecrets;
  } catch (err) {
    const code = err.name || err.code || 'Unknown';
    console.error(`Secrets Manager error [${code}]: ${err.message}`);
    if (code === 'AccessDeniedException') console.error('IAM policy missing secretsmanager:GetSecretValue');
    if (code === 'ResourceNotFoundException') console.error('Secret ARN does not exist');
    // Return cached secrets if available (stale is better than nothing), otherwise empty
    if (_apiSecrets) { console.warn('Using stale cached secrets'); return _apiSecrets; }
    return {};
  }
}

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

// Imported from helpers.mjs: sanitize, isValidId, stripDdbKeys, calculateTier, DDB_KEYS

const stripAll = (items) => items.map(stripDdbKeys);

/** Safe JSON body parser — returns null on malformed input */
function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

/** Validate and decode a pagination lastKey — only allows expected DDB key shapes */
function decodePaginationKey(encoded) {
  if (!encoded || typeof encoded !== 'string' || encoded.length > 500) return null;
  try {
    const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString());
    // Must be a plain object with only string values (DDB key attributes)
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) return null;
    const keys = Object.keys(decoded);
    if (keys.length === 0 || keys.length > 4) return null; // DDB keys: PK, SK, GSI1PK, GSI1SK
    for (const k of keys) {
      if (typeof decoded[k] !== 'string' || decoded[k].length > 500) return null;
      // Only allow expected key attribute names
      if (!['PK', 'SK', 'GSI1PK', 'GSI1SK'].includes(k)) return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

function getUserId(event) {
  // C1: Only trust Cognito authorizer claims — no header fallback, no anonymous.
  // Callers must handle null (return 401).
  return event.requestContext?.authorizer?.claims?.sub || null;
}

// ─── Restaurant CRUD ──────────────────────────────────────────────────────────

async function listRestaurants(event) {
  const params = event.queryStringParameters || {};

  // H3: Pagination support
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 200);
  const queryParams = {
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'RESTAURANTS' },
    Limit: limit,
  };

  if (params.lastKey) {
    const decoded = decodePaginationKey(params.lastKey);
    if (decoded) queryParams.ExclusiveStartKey = decoded;
  }

  const result = await ddb.send(new QueryCommand(queryParams));

  let items = result.Items || [];

  // City filter (server-side)
  if (params.city) {
    const city = sanitize(params.city, 100);
    items = items.filter((r) => r.city === city);
  }
  if (params.cuisine) {
    const cuisines = sanitize(params.cuisine, 500).split(',').map((c) => c.trim()).filter(Boolean).slice(0, 10);
    items = items.filter((r) =>
      r.cuisine?.some((c) => cuisines.includes(c))
    );
  }
  if (params.neighborhood) {
    const hood = sanitize(params.neighborhood, 100);
    items = items.filter(
      (r) => r.neighborhood === hood
    );
  }
  if (params.partner === 'true') {
    items = items.filter((r) => r.isPartner);
  }
  if (params.search) {
    const q = sanitize(params.search, 100).toLowerCase();
    if (q) {
      items = items.filter(
        (r) =>
          r.name?.toLowerCase().includes(q) ||
          r.cuisine?.some((c) => c.toLowerCase().includes(q)) ||
          r.neighborhood?.toLowerCase().includes(q)
      );
    }
  }

  return respond(200, stripAll(items));
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
  return respond(200, stripDdbKeys(result.Item));
}

async function createRestaurant(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const id = randomUUID();
  const item = {
    PK: `RESTAURANT#${id}`,
    SK: 'PROFILE',
    GSI1PK: `CREATOR#${userId}#RESTAURANTS`,
    GSI1SK: `RESTAURANT#${id}`,
    restaurantId: id,
    creatorId: userId,
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

async function listMyRestaurants(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#RESTAURANTS` },
      Limit: 200,
    })
  );

  return respond(200, stripAll(result.Items || []));
}

async function updateRestaurant(restaurantId, event) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid ID' });
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const names = {};
  const values = {};
  let expr = '';

  // Sanitize every field before storing — mirrors createRestaurant() logic
  const sanitizers = {
    name:           (v) => sanitize(v, 200),
    address:        (v) => sanitize(v, 300),
    neighborhood:   (v) => sanitize(v, 100),
    cuisine:        (v) => Array.isArray(v) ? v.slice(0, 10).map((c) => sanitize(c, 50)) : undefined,
    vibes:          (v) => Array.isArray(v) ? v.slice(0, 10).map((c) => sanitize(c, 50)) : undefined,
    priceLevel:     (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(4, Math.max(1, Math.round(n))) : undefined; },
    phone:          (v) => sanitize(v, 30),
    website:        (v) => sanitize(v, 500),
    hours:          (v) => sanitize(v, 500),
    spotRating:     (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(10, Math.max(0, n)) : undefined; },
    spotVideoUrl:   (v) => sanitize(v, 500),
    spotReview:     (v) => sanitize(v, 2000),
    lastVisited:    (v) => sanitize(v, 20),
    isPartner:      (v) => v === true,
    photos:         (v) => Array.isArray(v) ? v.slice(0, 20).map((p) => sanitize(p, 500)) : undefined,
    reservationUrl: (v) => sanitize(v, 500),
  };

  for (const [f, fn] of Object.entries(sanitizers)) {
    if (body[f] !== undefined) {
      const safe = fn(body[f]);
      if (safe === undefined) continue;
      const key = `#${f}`;
      const val = `:${f}`;
      names[key] = f;
      values[val] = safe;
      expr += `${expr ? ', ' : ''}${key} = ${val}`;
    }
  }

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
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const queryParams = {
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#CAMPAIGNS` },
  };

  // H3: Pagination support
  const limit = Math.min(Math.max(Number(params.limit) || 25, 1), 100);
  queryParams.Limit = limit;
  if (params.lastKey) {
    const decoded = decodePaginationKey(params.lastKey);
    if (decoded) queryParams.ExclusiveStartKey = decoded;
  }

  const result = await ddb.send(new QueryCommand(queryParams));

  // Filter out soft-deleted campaigns by default
  const includeArchived = params.includeArchived === 'true';
  let items = result.Items || [];
  if (!includeArchived) {
    items = items.filter((c) => !c.deletedAt);
  }

  return respond(200, stripAll(items));
}

async function archiveCampaign(campaignId, event) {
  if (!isValidId(campaignId)) return respond(400, { error: 'Invalid ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Find campaign via GSI (user-isolated)
  const find = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#CAMPAIGNS`,
        ':sk': `CAMPAIGN#${campaignId}`,
      },
    })
  );

  if (!find.Items?.length) return respond(404, { error: 'Campaign not found' });
  const existing = find.Items[0];

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: 'SET #deletedAt = :deletedAt, #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: {
        ':deletedAt': new Date().toISOString(),
        ':updatedAt': new Date().toISOString(),
      },
    })
  );

  return respond(200, { message: 'Campaign archived', campaignId });
}

async function restoreCampaign(campaignId, event) {
  if (!isValidId(campaignId)) return respond(400, { error: 'Invalid ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const find = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#CAMPAIGNS`,
        ':sk': `CAMPAIGN#${campaignId}`,
      },
    })
  );

  if (!find.Items?.length) return respond(404, { error: 'Campaign not found' });
  const existing = find.Items[0];

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: 'REMOVE #deletedAt SET #updatedAt = :updatedAt',
      ExpressionAttributeNames: { '#deletedAt': 'deletedAt', '#updatedAt': 'updatedAt' },
      ExpressionAttributeValues: {
        ':updatedAt': new Date().toISOString(),
      },
    })
  );

  return respond(200, { message: 'Campaign restored', campaignId });
}

async function createCampaign(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const id = randomUUID();
  const restaurantId = sanitize(body.restaurantId, 64);
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid restaurant ID' });

  const budget = Number(body.budget) || 0;

  const item = {
    PK: `RESTAURANT#${restaurantId}`,
    SK: `CAMPAIGN#${id}`,
    GSI1PK: `CREATOR#${userId}#CAMPAIGNS`,
    GSI1SK: `CAMPAIGN#${id}`,
    campaignId: id,
    creatorId: userId,
    restaurantId,
    restaurantName: sanitize(body.restaurantName, 200),
    status: 'inquiry',
    package: sanitize(body.package, 200),
    budget: Math.min(1000000, Math.max(0, budget)),
    startDate: sanitize(body.startDate || '', 20) || null,
    endDate: sanitize(body.endDate || '', 20) || null,
    deliverables: Array.isArray(body.deliverables)
      ? body.deliverables.slice(0, 20).map((d) => ({
          id: randomUUID(),
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
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  // Find the campaign first via GSI
  const find = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#CAMPAIGNS`,
        ':sk': `CAMPAIGN#${campaignId}`,
      },
    })
  );

  if (!find.Items?.length) return respond(404, { error: 'Campaign not found' });
  const existing = find.Items[0];

  // C3: Allowlisted fields only — prevent mass assignment of PK/SK/GSI keys
  const ALLOWED_STATUSES = ['inquiry', 'negotiation', 'active', 'completed', 'cancelled'];
  const campaignSanitizers = {
    status: (v) => ALLOWED_STATUSES.includes(v) ? v : undefined,
    package: (v) => sanitize(v, 200),
    budget: (v) => { const n = Number(v); return Number.isFinite(n) ? Math.min(1000000, Math.max(0, n)) : undefined; },
    startDate: (v) => sanitize(v, 20),
    endDate: (v) => sanitize(v, 20),
    deliverables: (v) => Array.isArray(v) ? v.slice(0, 20).map((d) => ({
      id: sanitize(d.id, 64) || randomUUID(),
      type: sanitize(d.type, 20),
      description: sanitize(d.description, 500),
      completed: d.completed === true,
    })) : undefined,
    notes: (v) => sanitize(v, 2000),
  };
  const names = {};
  const values = {};
  let expr = '';

  for (const [f, fn] of Object.entries(campaignSanitizers)) {
    if (body[f] !== undefined) {
      const safe = fn(body[f]);
      if (safe === undefined) continue;
      const key = `#${f}`;
      const val = `:${f}`;
      names[key] = f;
      values[val] = safe;
      expr += `${expr ? ', ' : ''}${key} = ${val}`;
    }
  }

  if (!expr) return respond(400, { error: 'No valid fields to update' });

  names['#updatedAt'] = 'updatedAt';
  values[':updatedAt'] = new Date().toISOString();
  expr += ', #updatedAt = :updatedAt';

  const result = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: `SET ${expr}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    })
  );

  return respond(200, result.Attributes);
}

// ─── Offer CRUD ───────────────────────────────────────────────────────────────

async function createOffer(restaurantId, event) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid restaurant ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const id = randomUUID();
  const code = `SPOT-${id.slice(0, 8).toUpperCase()}`;

  // Validate offer type
  const ALLOWED_OFFER_TYPES = ['qr', 'link', 'code', 'promo'];
  const offerType = ALLOWED_OFFER_TYPES.includes(body.type) ? body.type : 'qr';

  // Validate expiresAt is a proper ISO date string if provided
  let expiresAt = null;
  if (body.expiresAt) {
    const parsed = new Date(sanitize(body.expiresAt, 30));
    if (!isNaN(parsed.getTime())) expiresAt = parsed.toISOString();
  }

  const item = {
    PK: `RESTAURANT#${restaurantId}`,
    SK: `OFFER#${id}`,
    GSI1PK: `CREATOR#${userId}#OFFERS`,
    GSI1SK: `OFFER#${id}`,
    offerId: id,
    creatorId: userId,
    restaurantId,
    code,
    type: offerType,
    description: sanitize(body.description, 500),
    landingPageUrl: `/r/${sanitize(body.slug || restaurantId, 100)}`,
    scans: 0,
    redemptions: 0,
    expiresAt,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

  // H2: Write a lookup record so trackScan/redeemOffer can do direct GetItem by code
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `OFFER_CODE#${code}`,
        SK: 'LOOKUP',
        restaurantPK: `RESTAURANT#${restaurantId}`,
        offerSK: `OFFER#${id}`,
        offerId: id,
        restaurantId,
        code,
        description: item.description,
        landingPageUrl: item.landingPageUrl,
        isActive: item.isActive,
        expiresAt: item.expiresAt,
        createdAt: item.createdAt,
      },
    })
  );

  return respond(201, item);
}

/**
 * Lightweight rate limiter for public (unauthenticated) endpoints.
 * Limits by source IP to prevent scan/redeem abuse.
 * Max 30 requests per 5-minute window per IP.
 */
const PUBLIC_RATE_LIMIT = 30;
const PUBLIC_RATE_WINDOW = 300; // 5 minutes

async function checkPublicRateLimit(event) {
  const ip = event.requestContext?.identity?.sourceIp || 'unknown';
  const windowKey = Math.floor(Date.now() / 1000 / PUBLIC_RATE_WINDOW);
  try {
    const result = await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `RATE#IP#${ip}`, SK: `WIN#${windowKey}` },
      UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, #ttl = :ttl',
      ExpressionAttributeNames: { '#c': 'cnt', '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':zero': 0,
        ':inc': 1,
        ':ttl': Math.floor(Date.now() / 1000) + PUBLIC_RATE_WINDOW + 60,
      },
      ReturnValues: 'ALL_NEW',
    }));
    return (result.Attributes?.cnt || 0) <= PUBLIC_RATE_LIMIT;
  } catch (err) {
    console.error('Rate limit check failed (fail-closed):', err.message);
    return false; // fail closed — reject if we can't verify rate limit
  }
}

function validateOffer(offer) {
  // Check if offer is active
  if (offer.isActive === false) {
    return { valid: false, error: 'This offer is no longer active' };
  }
  // Check expiration
  if (offer.expiresAt) {
    const expiry = new Date(offer.expiresAt);
    if (!isNaN(expiry.getTime()) && expiry < new Date()) {
      return { valid: false, error: 'This offer has expired' };
    }
  }
  return { valid: true };
}

async function trackScan(code, event) {
  if (!code || !/^[A-Z0-9-]{5,20}$/.test(code)) {
    return respond(400, { error: 'Invalid offer code format' });
  }

  // Rate limit public endpoint
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  try {
    const lookup = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `OFFER_CODE#${code}`, SK: 'LOOKUP' },
      })
    );

    if (!lookup.Item) return respond(404, { error: 'Offer not found' });
    const offer = lookup.Item;

    // Validate offer is active and not expired
    const check = validateOffer(offer);
    if (!check.valid) return respond(410, { error: check.error });

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: offer.restaurantPK, SK: offer.offerSK },
        UpdateExpression: 'SET scans = scans + :inc',
        ExpressionAttributeValues: { ':inc': 1 },
      })
    );

    console.log(`Offer scanned: code=${code}, restaurant=${offer.restaurantId}`);
    return respond(200, {
      restaurantId: offer.restaurantId,
      landingPageUrl: offer.landingPageUrl,
      description: offer.description,
    });
  } catch (err) {
    console.error(`trackScan error: code=${code}, error=${err.message}`);
    return respond(500, { error: 'Internal server error' });
  }
}

async function redeemOffer(code, event) {
  if (!code || !/^[A-Z0-9-]{5,20}$/.test(code)) {
    return respond(400, { error: 'Invalid offer code format' });
  }

  // Rate limit public endpoint
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  try {
    const lookup = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `OFFER_CODE#${code}`, SK: 'LOOKUP' },
      })
    );

    if (!lookup.Item) return respond(404, { error: 'Offer not found' });
    const offer = lookup.Item;

    // Validate offer is active and not expired
    const check = validateOffer(offer);
    if (!check.valid) return respond(410, { error: check.error });

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: offer.restaurantPK, SK: offer.offerSK },
        UpdateExpression: 'SET redemptions = redemptions + :inc',
        ExpressionAttributeValues: { ':inc': 1 },
      })
    );

    console.log(`Offer redeemed: code=${code}, restaurant=${offer.restaurantId}`);
    return respond(200, { message: 'Redeemed', offerId: offer.offerId });
  } catch (err) {
    console.error(`redeemOffer error: code=${code}, error=${err.message}`);
    return respond(500, { error: 'Internal server error' });
  }
}

// ─── Saves (Audience) ─────────────────────────────────────────────────────────

async function saveRestaurant(event, restaurantId) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid restaurant ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

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
  if (!userId) return respond(401, { error: 'Unauthorized' });
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
  return respond(200, stripAll(result.Items || []));
}

// ─── SpotOps Pipeline ─────────────────────────────────────────────────────────

async function getSpotOpsPipeline(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#CAMPAIGNS` },
    })
  );

  const campaigns = result.Items || [];
  const byStatus = { inquiry: 0, negotiation: 0, active: 0, completed: 0, cancelled: 0 };
  let totalRevenue = 0;

  campaigns.forEach((c) => {
    if (byStatus[c.status] !== undefined) byStatus[c.status]++;
    totalRevenue += c.budget || 0;
  });

  return respond(200, {
    total: campaigns.length,
    byStatus,
    totalRevenue,
    avgDealSize: campaigns.length > 0 ? Math.round(totalRevenue / campaigns.length) : 0,
  });
}

// ─── Offers (List) ───────────────────────────────────────────────────────────

async function listOffers(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#OFFERS` },
      Limit: 200,
    })
  );

  return respond(200, stripAll(result.Items || []));
}

// ─── Reports ─────────────────────────────────────────────────────────────────

async function listReports(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#REPORTS` },
      Limit: 200,
    })
  );

  return respond(200, stripAll(result.Items || []));
}

// ─── Insider Deals ───────────────────────────────────────────────────────────

async function listDeals() {
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'DEALS' },
    })
  );

  return respond(200, stripAll(result.Items || []));
}

async function redeemDeal(dealId, event) {
  if (!isValidId(dealId)) return respond(400, { error: 'Invalid deal ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `AUDIENCE#${userId}`,
        SK: `REDEMPTION#${dealId}`,
        dealId,
        redeemedAt: new Date().toISOString(),
      },
    })
  );

  return respond(200, { message: 'Redeemed', dealId });
}

// ─── Insider Membership ──────────────────────────────────────────────────────

async function getMembership(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `AUDIENCE#${userId}`, SK: 'MEMBERSHIP' },
    })
  );

  return respond(200, { tier: result.Item?.tier || 'free' });
}

// ─── Save Management ─────────────────────────────────────────────────────────

async function removeSave(restaurantId, event) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `AUDIENCE#${userId}`, SK: `SAVE#${restaurantId}` },
    })
  );

  return respond(200, { message: 'Removed' });
}

async function updateSaveNotes(restaurantId, event) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `AUDIENCE#${userId}`, SK: `SAVE#${restaurantId}` },
      UpdateExpression: 'SET #notes = :notes, #occasion = :occasion',
      ExpressionAttributeNames: { '#notes': 'notes', '#occasion': 'occasion' },
      ExpressionAttributeValues: {
        ':notes': sanitize(body.notes, 500),
        ':occasion': sanitize(body.occasion, 100),
      },
    })
  );

  return respond(200, { message: 'Updated' });
}

// ─── Google Places JIT ───────────────────────────────────────────────────────

async function getGoogleDetails(restaurantId) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid ID' });

  // Get restaurant to find googlePlaceId
  const restaurant = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' },
    })
  );

  if (!restaurant.Item) return respond(404, { error: 'Restaurant not found' });
  const placeId = restaurant.Item.googlePlaceId;
  if (!placeId) return respond(404, { error: 'No Google Place ID' });

  // Check DynamoDB cache (24hr TTL)
  const cacheKey = { PK: `GOOGLE_CACHE#${placeId}`, SK: 'DETAILS' };
  const cached = await ddb.send(new GetCommand({ TableName: TABLE, Key: cacheKey }));

  if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
    return respond(200, cached.Item.data);
  }

  // Fetch fresh from Google Places API
  const secrets = await getApiSecrets();
  const googleKey = secrets.GOOGLE_PLACES_API_KEY;
  if (!googleKey) return respond(503, { error: 'Google Places not configured' });

  const fields = 'displayName,formattedAddress,regularOpeningHours,rating,priceLevel,photos,websiteUri,nationalPhoneNumber';
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${placeId}?fields=${fields}`,
    {
      signal: AbortSignal.timeout(5000),
      headers: {
        'X-Goog-Api-Key': googleKey,
        'X-Goog-FieldMask': fields,
      },
    }
  );

  if (!res.ok) return respond(502, { error: 'Google Places API error' });
  const data = await res.json();

  // Cache for 24 hours
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        ...cacheKey,
        data,
        ttl: Math.floor(Date.now() / 1000) + 86400,
        cachedAt: new Date().toISOString(),
      },
    })
  );

  return respond(200, data);
}

// ─── Email Subscribe ──────────────────────────────────────────────────────────

async function subscribe(event) {
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const email = sanitize(body.email, 200).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(400, { error: 'Invalid email' });

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

async function unsubscribe(event) {
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const email = sanitize(body.email, 200).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(400, { error: 'Invalid email' });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: 'SUBSCRIBERS', SK: `EMAIL#${email}` },
      UpdateExpression: 'SET unsubscribedAt = :now, #s = :status',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
        ':status': 'unsubscribed',
      },
    })
  );

  return respond(200, { message: 'Unsubscribed successfully' });
}

// ─── Creator Profile ────────────────────────────────────────────────────────

async function getProfile(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: 'PROFILE' },
    })
  );

  if (!result.Item) return respond(404, { error: 'Profile not found' });
  return respond(200, stripDdbKeys(result.Item));
}

async function upsertProfile(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const item = {
    PK: `CREATOR#${userId}`,
    SK: 'PROFILE',
    GSI1PK: 'CREATORS',
    GSI1SK: `CREATOR#${userId}`,
    creatorId: userId,
    displayName: sanitize(body.displayName, 100),
    bio: sanitize(body.bio, 500),
    city: sanitize(body.city, 100),
    neighborhoods: Array.isArray(body.neighborhoods)
      ? body.neighborhoods.slice(0, 10).map(n => sanitize(n, 100))
      : [],
    cuisinePreferences: Array.isArray(body.cuisinePreferences)
      ? body.cuisinePreferences.slice(0, 15).map(c => sanitize(c, 50))
      : [],
    socialLinks: {
      instagram: sanitize(body.socialLinks?.instagram || '', 200),
      tiktok: sanitize(body.socialLinks?.tiktok || '', 200),
      youtube: sanitize(body.socialLinks?.youtube || '', 200),
      website: sanitize(body.socialLinks?.website || '', 300),
    },
    followerCount: Math.max(0, Math.min(100000000, Number(body.followerCount) || 0)),
    creatorType: ['food', 'lifestyle', 'travel', 'other'].includes(body.creatorType)
      ? body.creatorType
      : 'food',
    onboardingCompleted: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return respond(200, stripDdbKeys(item));
}

// ─── ROI Calculator ───────────────────────────────────────────────────────────

async function calculateROI(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const campaignId = sanitize(body.campaignId, 64);
  if (!campaignId) return respond(400, { error: 'campaignId required' });

  // Fetch campaign data
  const campaignResult = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `CREATOR#${userId}#CAMPAIGNS`,
      ':sk': `CAMPAIGN#${campaignId}`,
    },
    Limit: 1,
  }));

  if (!campaignResult.Items?.length) return respond(404, { error: 'Campaign not found' });
  const campaign = campaignResult.Items[0];

  // Fetch offers for this restaurant to get scan/redemption data
  const offersResult = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#OFFERS` },
    Limit: 200,
  }));

  const restaurantOffers = (offersResult.Items || []).filter(
    o => o.restaurantId === campaign.restaurantId
  );

  const totalScans = restaurantOffers.reduce((sum, o) => sum + (o.scans || 0), 0);
  const totalRedemptions = restaurantOffers.reduce((sum, o) => sum + (o.redemptions || 0), 0);

  // ROI Calculations
  const budget = campaign.budget || 0;
  const avgCheckSize = Math.max(0, Math.min(500, Number(body.avgCheckSize) || 35)); // restaurant avg check
  const estimatedVisits = Math.round(totalRedemptions * 1.8); // multiplier: not all visitors use offers
  const estimatedRevenue = estimatedVisits * avgCheckSize;
  const roi = budget > 0 ? ((estimatedRevenue - budget) / budget) * 100 : 0;
  const costPerVisit = estimatedVisits > 0 ? budget / estimatedVisits : 0;
  const costPerRedemption = totalRedemptions > 0 ? budget / totalRedemptions : 0;
  const scanToRedemptionRate = totalScans > 0 ? totalRedemptions / totalScans : 0;

  // Save ROI report to DynamoDB
  const reportId = `roi-${campaignId}-${Date.now()}`;
  const roiReport = {
    PK: `CREATOR#${userId}`,
    SK: `ROI_REPORT#${reportId}`,
    GSI1PK: `CREATOR#${userId}#REPORTS`,
    GSI1SK: `REPORT#${reportId}`,
    reportId,
    campaignId,
    restaurantId: campaign.restaurantId,
    restaurantName: campaign.restaurantName || '',
    creatorId: userId,
    budget,
    avgCheckSize,
    totalScans,
    totalRedemptions,
    estimatedVisits,
    estimatedRevenue: Math.round(estimatedRevenue),
    roi: Math.round(roi * 100) / 100,
    costPerVisit: Math.round(costPerVisit * 100) / 100,
    costPerRedemption: Math.round(costPerRedemption * 100) / 100,
    scanToRedemptionRate: Math.round(scanToRedemptionRate * 10000) / 10000,
    generatedAt: new Date().toISOString(),
    ttl: Math.floor(Date.now() / 1000) + (90 * 86400), // 90 day TTL
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: roiReport }));

  return respond(200, stripDdbKeys(roiReport));
}

// ─── Creator Benchmarking ─────────────────────────────────────────────────────

async function getBenchmarks(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Get this creator's campaigns
  const campaignsResult = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#CAMPAIGNS` },
    Limit: 200,
  }));

  const campaigns = campaignsResult.Items || [];

  // Get this creator's offers
  const offersResult = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#OFFERS` },
    Limit: 200,
  }));

  const offers = offersResult.Items || [];

  // Calculate creator's metrics
  const totalCampaigns = campaigns.length;
  const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
  const completedCampaigns = campaigns.filter(c => c.status === 'completed').length;
  const totalRevenue = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0);
  const avgDealSize = totalCampaigns > 0 ? Math.round(totalRevenue / totalCampaigns) : 0;
  const totalScans = offers.reduce((sum, o) => sum + (o.scans || 0), 0);
  const totalRedemptions = offers.reduce((sum, o) => sum + (o.redemptions || 0), 0);
  const avgRedemptionRate = totalScans > 0 ? totalRedemptions / totalScans : 0;

  // Platform averages (hardcoded benchmarks for MVP — replace with real aggregation later)
  // These represent typical DC food creator metrics
  const platformAvg = {
    avgDealSize: 2500,
    avgCampaignsPerMonth: 2.5,
    avgRedemptionRate: 0.12,
    avgScansPerOffer: 45,
    avgCompletionRate: 0.78,
  };

  const completionRate = totalCampaigns > 0 ? completedCampaigns / totalCampaigns : 0;
  const scansPerOffer = offers.length > 0 ? totalScans / offers.length : 0;

  return respond(200, {
    creator: {
      totalCampaigns,
      activeCampaigns,
      completedCampaigns,
      totalRevenue,
      avgDealSize,
      totalScans,
      totalRedemptions,
      avgRedemptionRate: Math.round(avgRedemptionRate * 10000) / 10000,
      completionRate: Math.round(completionRate * 100) / 100,
      scansPerOffer: Math.round(scansPerOffer * 10) / 10,
    },
    platformAvg,
    deltas: {
      dealSize: avgDealSize > 0 ? Math.round(((avgDealSize - platformAvg.avgDealSize) / platformAvg.avgDealSize) * 100) : 0,
      redemptionRate: avgRedemptionRate > 0 ? Math.round(((avgRedemptionRate - platformAvg.avgRedemptionRate) / platformAvg.avgRedemptionRate) * 100) : 0,
      scansPerOffer: scansPerOffer > 0 ? Math.round(((scansPerOffer - platformAvg.avgScansPerOffer) / platformAvg.avgScansPerOffer) * 100) : 0,
      completionRate: completionRate > 0 ? Math.round(((completionRate - platformAvg.avgCompletionRate) / platformAvg.avgCompletionRate) * 100) : 0,
    },
  });
}

// ─── Ambassador & Referral System ──────────────────────────────────────────

async function generateReferralCode(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Check if code already exists
  const existingCode = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND begins_with(GSI1SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#AMBASSADOR`,
        ':sk': 'CODE#',
      },
      Limit: 1,
    })
  );

  if (existingCode.Items?.length) {
    const existing = existingCode.Items[0];
    return respond(200, {
      referralCode: existing.code,
      createdAt: existing.createdAt,
      referralCount: existing.referralCount || 0,
      tier: calculateTier(existing.referralCount || 0),
    });
  }

  // Generate unique code: REF-${shortId}
  const shortId = randomUUID().slice(0, 8).toUpperCase();
  const code = `REF-${shortId}`;

  const item = {
    PK: `CREATOR#${userId}`,
    SK: `REFERRAL_CODE`,
    GSI1PK: `CREATOR#${userId}#AMBASSADOR`,
    GSI1SK: `CODE#${code}`,
    code,
    referralCount: 0,
    commissionEarned: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));

  return respond(201, {
    referralCode: code,
    createdAt: item.createdAt,
    referralCount: 0,
    tier: 'bronze',
  });
}

// calculateTier imported from helpers.mjs

async function trackReferral(event) {
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const code = sanitize(body.referralCode, 50);
  const newUserId = sanitize(body.newUserId, 64);

  if (!code || !newUserId) return respond(400, { error: 'Missing code or newUserId' });
  // Validate format: referral codes should be alphanumeric with hyphens only
  if (!/^[a-zA-Z0-9_-]{3,50}$/.test(code)) return respond(400, { error: 'Invalid referral code format' });
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(newUserId)) return respond(400, { error: 'Invalid user ID format' });

  // Look up referral code via GSI
  const lookup = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `REFERRAL#${code}` },
      Limit: 1,
    })
  );

  if (!lookup.Items?.length) return respond(404, { error: 'Referral code not found' });

  // Extract referrer ID from first match
  const referrerMatch = lookup.Items[0].GSI1SK?.match(/CREATOR#(.+)$/);
  if (!referrerMatch) return respond(400, { error: 'Invalid referral code' });
  const referrerId = referrerMatch[1];

  // Create referral record
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `CREATOR#${referrerId}`,
        SK: `REFERRAL#${newUserId}`,
        GSI1PK: `CREATOR#${referrerId}#REFERRALS`,
        GSI1SK: `REFERRAL#${newUserId}`,
        referredUserId: newUserId,
        referrerId,
        referralCode: code,
        createdAt: new Date().toISOString(),
      },
    })
  );

  // Increment referral count on ambassador record
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${referrerId}`, SK: `REFERRAL_CODE` },
      UpdateExpression: 'SET referralCount = referralCount + :inc, #updated = :updatedAt',
      ExpressionAttributeNames: { '#updated': 'updatedAt' },
      ExpressionAttributeValues: {
        ':inc': 1,
        ':updatedAt': new Date().toISOString(),
      },
    })
  );

  return respond(200, { message: 'Referral tracked', referrerId });
}

async function getAmbassadorStatus(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Try to get ambassador record
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `REFERRAL_CODE` },
    })
  );

  if (!result.Item) {
    // Create default ambassador record
    const item = {
      PK: `CREATOR#${userId}`,
      SK: `REFERRAL_CODE`,
      GSI1PK: `CREATOR#${userId}#AMBASSADOR`,
      GSI1SK: `CODE#NONE`,
      referralCount: 0,
      commissionEarned: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return respond(200, {
      tier: 'bronze',
      referralCount: 0,
      commissionEarned: 0,
      referralCode: null,
    });
  }

  const ambassador = result.Item;
  const tier = calculateTier(ambassador.referralCount || 0);

  return respond(200, {
    tier,
    referralCount: ambassador.referralCount || 0,
    commissionEarned: ambassador.commissionEarned || 0,
    referralCode: ambassador.code || null,
  });
}

async function listReferrals(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}`,
        ':sk': 'REFERRAL#',
      },
      Limit: 100,
    })
  );

  return respond(200, stripAll(result.Items || []));
}

// ─── Multi-Creator Collaborations ─────────────────────────────────────────────

async function inviteCollaborator(campaignId, event) {
  if (!isValidId(campaignId)) return respond(400, { error: 'Invalid campaign ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const inviteeId = sanitize(body.creatorId, 64);
  const sharePercent = Math.max(1, Math.min(99, Number(body.sharePercent) || 50));
  const role = body.role === 'co-creator' ? 'co-creator' : 'viewer';

  if (!inviteeId) return respond(400, { error: 'creatorId required' });
  if (inviteeId === userId) return respond(400, { error: 'Cannot invite yourself' });

  // Verify caller owns the campaign
  const campaignFind = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#CAMPAIGNS`,
        ':sk': `CAMPAIGN#${campaignId}`,
      },
      Limit: 1,
    })
  );

  if (!campaignFind.Items?.length) return respond(404, { error: 'Campaign not found' });
  const campaign = campaignFind.Items[0];

  // Check max collaborators limit
  const collabCount = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CAMPAIGN#${campaignId}`,
        ':sk': 'COLLAB#',
      },
      Limit: 10,
    })
  );

  if (collabCount.Items?.length >= 5) {
    return respond(400, { error: 'Max 5 collaborators per campaign' });
  }

  const createdAt = new Date().toISOString();

  // Create collaboration record linked to campaign
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `CAMPAIGN#${campaignId}`,
        SK: `COLLAB#${inviteeId}`,
        GSI1PK: `CAMPAIGN#${campaignId}#COLLABS`,
        GSI1SK: `CREATOR#${inviteeId}`,
        collaboratorId: inviteeId,
        campaignId,
        ownerCreatorId: userId,
        status: 'pending',
        role,
        sharePercent,
        createdAt,
        updatedAt: createdAt,
      },
    })
  );

  // Create reverse lookup for invitee
  await ddb.send(
    new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `CREATOR#${inviteeId}`,
        SK: `COLLAB_INVITE#${campaignId}`,
        GSI1PK: `CREATOR#${inviteeId}#COLLABS`,
        GSI1SK: `CAMPAIGN#${campaignId}`,
        campaignId,
        campaignName: campaign.restaurantName || 'Unknown',
        invitedBy: userId,
        status: 'pending',
        role,
        sharePercent,
        createdAt,
        updatedAt: createdAt,
      },
    })
  );

  return respond(201, { message: 'Invite sent', campaignId, collaboratorId: inviteeId });
}

async function respondToInvite(campaignId, event) {
  if (!isValidId(campaignId)) return respond(400, { error: 'Invalid campaign ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const accept = body.accept === true;
  const newStatus = accept ? 'accepted' : 'declined';

  // Get the invite record
  const inviteFind = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `COLLAB_INVITE#${campaignId}` },
    })
  );

  if (!inviteFind.Item) return respond(404, { error: 'Invite not found' });
  const invite = inviteFind.Item;

  const updatedAt = new Date().toISOString();

  // Update campaign collab record
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `CAMPAIGN#${campaignId}`, SK: `COLLAB#${userId}` },
      UpdateExpression: 'SET #status = :status, #updated = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status', '#updated': 'updatedAt' },
      ExpressionAttributeValues: {
        ':status': newStatus,
        ':updatedAt': updatedAt,
      },
    })
  );

  // Update invitee's invite record
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `COLLAB_INVITE#${campaignId}` },
      UpdateExpression: 'SET #status = :status, #updated = :updatedAt',
      ExpressionAttributeNames: { '#status': 'status', '#updated': 'updatedAt' },
      ExpressionAttributeValues: {
        ':status': newStatus,
        ':updatedAt': updatedAt,
      },
    })
  );

  return respond(200, { message: `Invite ${newStatus}`, campaignId });
}

async function listCollaborators(campaignId, event) {
  if (!isValidId(campaignId)) return respond(400, { error: 'Invalid campaign ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Verify caller owns the campaign
  const campaignFind = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#CAMPAIGNS`,
        ':sk': `CAMPAIGN#${campaignId}`,
      },
      Limit: 1,
    })
  );

  if (!campaignFind.Items?.length) return respond(404, { error: 'Campaign not found' });

  // Get all collaborators for this campaign
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `CAMPAIGN#${campaignId}`,
        ':sk': 'COLLAB#',
      },
      Limit: 10,
    })
  );

  return respond(200, stripAll(result.Items || []));
}

async function listMyCollabCampaigns(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Query GSI for campaigns where user is a collaborator
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#COLLABS` },
      Limit: 100,
    })
  );

  const items = result.Items || [];
  // Filter to only campaigns where user has accepted invites
  const acceptedCampaigns = items.filter((item) => item.status === 'accepted');

  return respond(200, stripAll(acceptedCampaigns));
}

async function removeCollaborator(campaignId, creatorId, event) {
  if (!isValidId(campaignId) || !isValidId(creatorId)) {
    return respond(400, { error: 'Invalid IDs' });
  }
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Verify caller owns the campaign
  const campaignFind = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#CAMPAIGNS`,
        ':sk': `CAMPAIGN#${campaignId}`,
      },
      Limit: 1,
    })
  );

  if (!campaignFind.Items?.length) return respond(404, { error: 'Campaign not found' });

  // Delete from campaign collabs
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `CAMPAIGN#${campaignId}`, SK: `COLLAB#${creatorId}` },
    })
  );

  // Delete from creator's invites
  await ddb.send(
    new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${creatorId}`, SK: `COLLAB_INVITE#${campaignId}` },
    })
  );

  return respond(200, { message: 'Collaborator removed' });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path || '';
  const pathParts = path.split('/').filter(Boolean);

  try {
    // CORS preflight — return immediately with proper headers
    if (method === 'OPTIONS') {
      return {
        statusCode: 200,
        headers: {
          ...headers,
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        },
        body: '',
      };
    }

    // Global guard: reject oversized request bodies (100 KB max)
    if (event.body && event.body.length > 102400) {
      return respond(413, { error: 'Request body too large' });
    }
    // Health check
    if (path.endsWith('/health')) return respond(200, { status: 'ok' });

    // Restaurants
    if (path.match(/\/api\/restaurants$/) && method === 'GET')
      return listRestaurants(event);
    if (path.match(/\/api\/restaurants$/) && method === 'POST')
      return createRestaurant(event);
    if (path.match(/\/api\/my\/restaurants$/) && method === 'GET')
      return listMyRestaurants(event);
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
    if (path.match(/\/api\/campaigns\/[^/]+\/archive$/) && method === 'POST')
      return archiveCampaign(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/campaigns\/[^/]+\/restore$/) && method === 'POST')
      return restoreCampaign(pathParts[pathParts.length - 2], event);

    // Offer tracking (public — rate limited by IP)
    if (path.match(/\/api\/offers\/[^/]+\/scan$/) && method === 'GET')
      return trackScan(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/offers\/[^/]+\/redeem$/) && method === 'POST')
      return redeemOffer(pathParts[pathParts.length - 2], event);

    // SpotOps
    if (path.match(/\/api\/spotops\/pipeline$/) && method === 'GET')
      return getSpotOpsPipeline(event);
    if (path.match(/\/api\/spotops\/campaigns$/) && method === 'GET')
      return listCampaigns(event);

    // Partner portal
    if (path.match(/\/api\/partner\/campaigns$/) && method === 'GET')
      return listCampaigns(event);
    if (path.match(/\/api\/partner\/offers$/) && method === 'GET')
      return listOffers(event);
    if (path.match(/\/api\/partner\/reports$/) && method === 'GET')
      return listReports(event);

    // Insider deals (public)
    if (path.match(/\/api\/insider\/deals$/) && method === 'GET')
      return listDeals();
    if (path.match(/\/api\/insider\/deals\/[^/]+\/redeem$/) && method === 'POST')
      return redeemDeal(pathParts[pathParts.length - 2], event);

    // Insider membership
    if (path.match(/\/api\/insider\/membership$/) && method === 'GET')
      return getMembership(event);

    // Saves
    if (path.match(/\/api\/saves\/[^/]+$/) && method === 'POST')
      return saveRestaurant(event, pathParts[pathParts.length - 1]);
    if (path.match(/\/api\/saves$/) && method === 'GET')
      return listSaves(event);
    if (path.match(/\/api\/insider\/saved$/) && method === 'GET')
      return listSaves(event);
    if (path.match(/\/api\/insider\/saved\/[^/]+$/) && method === 'DELETE')
      return removeSave(pathParts[pathParts.length - 1], event);
    if (path.match(/\/api\/insider\/saved\/[^/]+$/) && method === 'PUT')
      return updateSaveNotes(pathParts[pathParts.length - 1], event);

    // Google Places JIT
    if (path.match(/\/api\/restaurants\/[^/]+\/google-details$/) && method === 'GET')
      return getGoogleDetails(pathParts[pathParts.length - 2]);

    // Subscribe / Unsubscribe
    if (path.match(/\/api\/subscribe$/) && method === 'POST')
      return subscribe(event);
    if (path.match(/\/api\/unsubscribe$/) && method === 'POST')
      return unsubscribe(event);

    // Profile
    if (path.match(/\/api\/profile$/) && method === 'GET') return getProfile(event);
    if (path.match(/\/api\/profile$/) && method === 'POST') return upsertProfile(event);

    // ROI & Benchmarks
    if (path.match(/\/api\/reports\/roi-calculate$/) && method === 'POST') return calculateROI(event);
    if (path.match(/\/api\/reports\/benchmarks$/) && method === 'GET') return getBenchmarks(event);

    // Ambassador & Referral
    if (path.match(/\/api\/ambassador\/generate-link$/) && method === 'POST')
      return generateReferralCode(event);
    if (path.match(/\/api\/ambassador\/track-referral$/) && method === 'POST')
      return trackReferral(event);
    if (path.match(/\/api\/ambassador\/status$/) && method === 'GET')
      return getAmbassadorStatus(event);
    if (path.match(/\/api\/ambassador\/referrals$/) && method === 'GET')
      return listReferrals(event);

    // Multi-Creator Collaborations
    if (path.match(/\/api\/campaigns\/[^/]+\/collaborators$/) && method === 'POST') {
      const campaignId = pathParts[pathParts.length - 2];
      return inviteCollaborator(campaignId, event);
    }
    if (path.match(/\/api\/campaigns\/[^/]+\/collaborators\/respond$/) && method === 'PUT') {
      const campaignId = pathParts[pathParts.length - 3];
      return respondToInvite(campaignId, event);
    }
    if (path.match(/\/api\/campaigns\/[^/]+\/collaborators$/) && method === 'GET') {
      const campaignId = pathParts[pathParts.length - 2];
      return listCollaborators(campaignId, event);
    }
    if (path.match(/\/api\/campaigns\/collaborations$/) && method === 'GET')
      return listMyCollabCampaigns(event);
    if (path.match(/\/api\/campaigns\/[^/]+\/collaborators\/[^/]+$/) && method === 'DELETE') {
      const campaignId = pathParts[pathParts.length - 3];
      const creatorId = pathParts[pathParts.length - 1];
      return removeCollaborator(campaignId, creatorId, event);
    }

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error('Handler error:', err);
    return respond(500, { error: 'Internal server error' });
  }
};
