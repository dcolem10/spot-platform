import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
  GetCommand,
  DeleteCommand,
  UpdateCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { randomUUID, randomInt, createHash, randomBytes } from 'crypto';
import { sanitize, isValidId, stripDdbKeys, calculateTier, DDB_KEYS, normalizeEmail, hashIp, escapeHtml } from './helpers.mjs';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const smClient = new SecretsManagerClient({});
const sesClient = new SESClient({});
const kmsClient = new KMSClient({});
const TABLE = process.env.TABLE_NAME;
const KMS_KEY_ID = process.env.POS_KMS_KEY_ID;

// ─── KMS Helpers for POS Token Encryption ────────────────────────────────────

async function encryptPosToken(plaintext) {
  if (!KMS_KEY_ID || !plaintext) return plaintext; // Graceful fallback if key not configured
  const result = await kmsClient.send(new EncryptCommand({
    KeyId: KMS_KEY_ID,
    Plaintext: Buffer.from(plaintext, 'utf-8'),
  }));
  return `kms:${Buffer.from(result.CiphertextBlob).toString('base64')}`;
}

async function decryptPosToken(ciphertext) {
  if (!ciphertext || !ciphertext.startsWith('kms:')) return ciphertext; // Plaintext fallback for migration
  const result = await kmsClient.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(ciphertext.slice(4), 'base64'),
  }));
  return Buffer.from(result.Plaintext).toString('utf-8');
}
if (!TABLE) throw new Error('TABLE_NAME env var is required — Lambda misconfigured');
const SES_FROM_EMAIL = process.env.SES_FROM_EMAIL || 'noreply@tryspot.app';
// ─── Dynamic CORS — supports multiple origins (dev + prod simultaneously) ────
const ALLOWED_ORIGINS = new Set(
  (process.env.ALLOWED_ORIGINS || process.env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean)
);
if (!ALLOWED_ORIGINS.size) console.warn('No allowed origins configured — CORS will block all cross-origin requests');

/** Set per-request CORS origin by matching the request's Origin header */
function setRequestOrigin(event) {
  const reqOrigin = event?.headers?.origin || event?.headers?.Origin || '';
  headers['Access-Control-Allow-Origin'] = ALLOWED_ORIGINS.has(reqOrigin)
    ? reqOrigin
    : ([...ALLOWED_ORIGINS][0] || '');
}

// ─── Secrets (fetched once per cold start, cached in memory) ─────────────────
let _apiSecrets = null;
let _apiSecretsLoadedAt = 0;
const SECRETS_CACHE_TTL = 300 * 1000; // 5 minutes — shorter window for secret rotation

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
  'Access-Control-Allow-Origin': [...ALLOWED_ORIGINS][0] || '',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
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
      if (!['PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK'].includes(k)) return null;
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
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }
  const params = event.queryStringParameters || {};

  // H3: Pagination support
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 50);
  const queryParams = {
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': 'RESTAURANTS' },
    Limit: limit,
  };

  // Efficient city filter using GSI1SK begins_with
  // Seeded restaurants use GSI1SK = "CITY#{cityName}#{restaurantName}"
  // This avoids scanning the entire table when filtering by city
  if (params.city) {
    const city = sanitize(params.city, 100);
    queryParams.KeyConditionExpression += ' AND begins_with(GSI1SK, :cityPrefix)';
    queryParams.ExpressionAttributeValues[':cityPrefix'] = `CITY#${city}`;
  }

  if (params.lastKey) {
    const decoded = decodePaginationKey(params.lastKey);
    if (decoded) queryParams.ExclusiveStartKey = decoded;
  }

  const result = await ddb.send(new QueryCommand(queryParams));

  let items = result.Items || [];

  // Fallback city filter for legacy items that don't use the new GSI1SK format
  if (params.city) {
    const city = sanitize(params.city, 100);
    items = items.filter((r) => r.city === city || (r.GSI1SK && r.GSI1SK.startsWith(`CITY#${city}`)));
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

  const nextPage = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;
  return respond(200, { items: stripAll(items), nextPage });
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
  if (!(await checkUserMutationRate(userId, 'CREATE_REST', 20))) {
    return respond(429, { error: 'Too many restaurant creations. Please try again later.' });
  }

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
    coords: body.coords && typeof body.coords === 'object' ? {
      lat: Math.max(-90, Math.min(90, Number(body.coords.lat) || 0)),
      lng: Math.max(-180, Math.min(180, Number(body.coords.lng) || 0)),
    } : { lat: 0, lng: 0 },
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
  return respond(201, stripDdbKeys(item));
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
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Ownership check — only the creator who added this restaurant can update it
  const existing = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' },
    })
  );
  if (!existing.Item) return respond(404, { error: 'Restaurant not found' });
  if (existing.Item.creatorId !== userId) return respond(403, { error: 'Forbidden' });

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

  const nextPage = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;
  return respond(200, { items: stripAll(items), nextPage });
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

  // Prevent double-archive
  if (existing.deletedAt) return respond(400, { error: 'Campaign is already archived' });

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: 'SET #deletedAt = :deletedAt, #updatedAt = :updatedAt',
      ConditionExpression: 'attribute_not_exists(#deletedAt)', // Atomic guard against concurrent archive
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
  if (!(await checkUserMutationRate(userId, 'CREATE_CAMP', 30))) {
    return respond(429, { error: 'Too many campaign creations. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const id = randomUUID();
  const restaurantId = sanitize(body.restaurantId, 64);
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid restaurant ID' });

  // H17: Verify caller owns this restaurant before allowing campaign creation
  const restOwnerCheck = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  if (!restOwnerCheck.Item) return respond(404, { error: 'Restaurant not found' });
  if (restOwnerCheck.Item.creatorId !== userId) {
    return respond(403, { error: 'You do not own this restaurant' });
  }

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
  return respond(201, stripDdbKeys(item));
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

  // Prevent updates to soft-deleted (archived) campaigns
  if (existing.deletedAt) return respond(410, { error: 'This campaign has been archived' });

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
    goal: (v) => sanitize(v, 1000),
    dealType: (v) => sanitize(v, 100),
    dealDescription: (v) => sanitize(v, 1000),
    linkedOfferId: (v) => sanitize(v, 64),
    linkedOfferCode: (v) => sanitize(v, 64),
    trackingMethods: (v) => Array.isArray(v) ? v.slice(0, 10).map((m) => sanitize(m, 50)).filter(Boolean) : undefined,
    contentDeliverables: (v) => Array.isArray(v) ? v.slice(0, 20).map((d) => sanitize(d, 100)).filter(Boolean) : undefined,
    activity: (v) => Array.isArray(v) ? v.slice(0, 200).map((a) => ({
      id: sanitize(a.id, 64) || randomUUID(),
      type: ['status_change', 'outreach', 'note', 'offer_linked', 'deal_updated'].includes(a.type) ? a.type : 'note',
      message: sanitize(a.message, 500),
      timestamp: sanitize(a.timestamp, 30) || new Date().toISOString(),
    })) : undefined,
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
  if (!(await checkUserMutationRate(userId, 'CREATE_OFFER', 30))) {
    return respond(429, { error: 'Too many offer creations. Please try again later.' });
  }

  // Verify the restaurant exists before creating an offer (creators partner with restaurants they don't own)
  const restExistsCheck = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' },
      ProjectionExpression: 'restaurantId',
    })
  );
  if (!restExistsCheck.Item) {
    return respond(404, { error: 'Restaurant not found' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const id = randomUUID();
  const code = `SPOT-${id.slice(0, 8).toUpperCase()}`;

  // Validate offer type
  const ALLOWED_OFFER_TYPES = ['qr', 'link', 'code', 'promo'];
  const offerType = ALLOWED_OFFER_TYPES.includes(body.type) ? body.type : 'qr';

  // Validate linkedCampaignId belongs to this user (prevent cross-user campaign linking)
  let validatedCampaignId = '';
  if (body.linkedCampaignId) {
    const campaignId = sanitize(body.linkedCampaignId, 64);
    if (isValidId(campaignId)) {
      try {
        const campaignResult = await ddb.send(
          new GetCommand({
            TableName: TABLE,
            Key: { PK: `CREATOR#${userId}`, SK: `CAMPAIGN#${campaignId}` },
            ProjectionExpression: 'campaignId, restaurantId',
          })
        );
        if (campaignResult.Item) {
          // Prevent cross-restaurant linking: campaign must belong to same restaurant
          if (campaignResult.Item.restaurantId && campaignResult.Item.restaurantId !== restaurantId) {
            console.warn(`Campaign ${campaignId} is for restaurant ${campaignResult.Item.restaurantId}, not ${restaurantId}`);
            // Don't link — silently drop the invalid link rather than failing the offer creation
          } else {
            validatedCampaignId = campaignId;
          }
        } else {
          console.warn(`linkedCampaignId ${campaignId} not found for user ${userId}`);
        }
      } catch (err) {
        console.warn(`Campaign ownership check failed: ${err.message}`);
        // Fail open for campaign linking — still create the offer, just don't link
      }
    }
  }

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
    restaurantName: sanitize(body.restaurantName || '', 200),
    linkedCampaignId: validatedCampaignId,
    code,
    type: offerType,
    description: sanitize(body.description, 500),
    landingPageUrl: `/r/${sanitize(body.slug || restaurantId, 100)}`,
    scans: 0,
    redemptions: 0,
    scansBySource: {},
    expiresAt,
    isActive: true,
    approvalStatus: 'creator_only',
    mutuallyApproved: false,
    createdAt: new Date().toISOString(),
  };

  // Atomic write: offer + lookup record together — prevents orphaned records on partial failure
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: TABLE, Item: item } },
        {
          Put: {
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
            ConditionExpression: 'attribute_not_exists(PK)', // Enforce offer code uniqueness at DB level
          },
        },
      ],
    })
  );

  return respond(201, stripDdbKeys(item));
}

async function updateOffer(offerId, event) {
  if (!isValidId(offerId)) return respond(400, { error: 'Invalid offer ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  // Look up the offer via GSI1 to verify ownership
  const ownerResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#OFFERS`,
        ':sk': `OFFER#${offerId}`,
      },
      Limit: 1,
    })
  );

  if (!ownerResult.Items?.length) return respond(404, { error: 'Offer not found' });
  const existing = ownerResult.Items[0];

  // Build update expression for allowed fields only
  const updates = [];
  const names = {};
  const values = {};
  let idx = 0;

  if (typeof body.isActive === 'boolean') {
    updates.push(`#f${idx} = :v${idx}`);
    names[`#f${idx}`] = 'isActive';
    values[`:v${idx}`] = body.isActive;
    idx++;
  }
  if (typeof body.description === 'string') {
    updates.push(`#f${idx} = :v${idx}`);
    names[`#f${idx}`] = 'description';
    values[`:v${idx}`] = sanitize(body.description, 500);
    idx++;
  }
  if (typeof body.expiresAt === 'string') {
    const parsed = new Date(sanitize(body.expiresAt, 30));
    if (!isNaN(parsed.getTime())) {
      updates.push(`#f${idx} = :v${idx}`);
      names[`#f${idx}`] = 'expiresAt';
      values[`:v${idx}`] = parsed.toISOString();
      idx++;
    }
  }

  if (updates.length === 0) return respond(400, { error: 'No valid fields to update' });

  // Always set updatedAt
  updates.push(`#upd = :upd`);
  names['#upd'] = 'updatedAt';
  values[':upd'] = new Date().toISOString();

  const result = await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
      ReturnValues: 'ALL_NEW',
    })
  );

  // Keep lookup record in sync — update isActive and expiresAt if changed
  // Note: scan/redeem now fetch the live offer for validation, so this is best-effort consistency
  if (existing.code) {
    const lookupUpdates = [];
    const lookupValues = {};
    if (typeof body.isActive === 'boolean') {
      lookupUpdates.push('isActive = :isActive');
      lookupValues[':isActive'] = body.isActive;
    }
    if (typeof body.expiresAt === 'string') {
      const parsed = new Date(sanitize(body.expiresAt, 30));
      if (!isNaN(parsed.getTime())) {
        lookupUpdates.push('expiresAt = :expiresAt');
        lookupValues[':expiresAt'] = parsed.toISOString();
      }
    }
    if (lookupUpdates.length > 0) {
      try {
        await ddb.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { PK: `OFFER_CODE#${existing.code}`, SK: 'LOOKUP' },
            UpdateExpression: `SET ${lookupUpdates.join(', ')}`,
            ExpressionAttributeValues: lookupValues,
          })
        );
      } catch (err) {
        console.warn(`Failed to update lookup record for ${existing.code}: ${err.message}`);
      }
    }
  }

  return respond(200, stripDdbKeys(result.Attributes));
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

/**
 * Per-user mutation rate limiter. Prevents a single authenticated user from
 * spamming create operations. Default: 30 mutations per hour (fail-closed).
 */
async function checkUserMutationRate(userId, label = 'MUTATION', limit = 30) {
  const hour = Math.floor(Date.now() / 3600000);
  try {
    const result = await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `RATE#${label}#${userId}`, SK: `HR#${hour}` },
      UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, #ttl = :ttl',
      ExpressionAttributeNames: { '#c': 'cnt', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':ttl': Math.floor(Date.now() / 1000) + 7200 },
      ReturnValues: 'ALL_NEW',
    }));
    return (result.Attributes?.cnt || 0) <= limit;
  } catch (err) {
    console.error(`User mutation rate check failed (${label}):`, err.message);
    return false; // fail closed — deny mutation if rate check fails
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
    const lookupRec = lookup.Item;

    // Fetch the LIVE offer record for current isActive/expiresAt — lookup may be stale
    const liveOffer = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: lookupRec.restaurantPK, SK: lookupRec.offerSK },
        ProjectionExpression: 'isActive, expiresAt, offerId, restaurantId',
      })
    );
    const offer = liveOffer.Item || lookupRec; // fallback to lookup if offer record missing

    // Validate offer is active and not expired
    const check = validateOffer(offer);
    if (!check.valid) return respond(410, { error: check.error });

    // Extract source from query params (e.g., ?src=instagram, ?src=tiktok)
    const qs = event.queryStringParameters || {};
    const ALLOWED_SOURCES = ['instagram', 'tiktok', 'youtube', 'twitter', 'web', 'in_person', 'email', 'direct'];
    const source = ALLOWED_SOURCES.includes(qs.src) ? qs.src : 'direct';

    // Dedup scans per IP per code per day (prevent scan count inflation)
    const scanIp = (event.requestContext?.identity?.sourceIp) || 'unknown';
    const scanIpHash = hashIp(scanIp, code);
    const scanDay = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: `RATE#SCAN_IP#${scanIpHash}`,
            SK: `CODE#${code}#DAY#${scanDay}`,
            ttl: Math.floor(Date.now() / 1000) + 172800, // 2 days
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (condErr) {
      if (condErr.name === 'ConditionalCheckFailedException') {
        // Already counted this IP+code today — return success but don't increment
        return respond(200, {
          restaurantId: offer.restaurantId,
          landingPageUrl: offer.landingPageUrl,
          description: offer.description,
          source,
          deduplicated: true,
        });
      }
      throw condErr;
    }

    // Increment total scans + per-source counter (only for unique scans)
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: offer.restaurantPK, SK: offer.offerSK },
        UpdateExpression: 'SET scans = if_not_exists(scans, :zero) + :inc, scansBySource.#src = if_not_exists(scansBySource.#src, :zero) + :inc',
        ExpressionAttributeNames: { '#src': source },
        ExpressionAttributeValues: { ':inc': 1, ':zero': 0 },
      })
    );

    console.log(`Offer scanned: code=${code}, restaurant=${offer.restaurantId}, source=${source}`);
    return respond(200, {
      restaurantId: offer.restaurantId,
      landingPageUrl: offer.landingPageUrl,
      description: offer.description,
      source,
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
    const lookupRec = lookup.Item;

    // Fetch the LIVE offer record for current isActive/expiresAt — lookup may be stale
    const liveOffer = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: lookupRec.restaurantPK, SK: lookupRec.offerSK },
        ProjectionExpression: 'isActive, expiresAt, offerId, restaurantId',
      })
    );
    const offer = liveOffer.Item || lookupRec; // fallback to lookup if offer record missing

    // Validate offer is active and not expired
    const check = validateOffer(offer);
    if (!check.valid) return respond(410, { error: check.error });

    // Extract source from body or query params
    const body = parseBody(event) || {};
    const qs = event.queryStringParameters || {};
    const ALLOWED_SOURCES = ['instagram', 'tiktok', 'youtube', 'twitter', 'web', 'in_person', 'email', 'direct'];
    const source = ALLOWED_SOURCES.includes(body.source || qs.src) ? (body.source || qs.src) : 'direct';

    // Idempotent redemption — deduplicate by IP + day to prevent attribution fraud
    const ip = event.requestContext?.identity?.sourceIp || 'unknown';
    const day = new Date().toISOString().slice(0, 10);
    const redeemKey = `REDEEM#${offer.offerId}#${ip}#${day}`;
    try {
      await ddb.send(
        new PutCommand({
          TableName: TABLE,
          Item: {
            PK: redeemKey,
            SK: 'IDEMPOTENCY',
            offerId: offer.offerId,
            ip,
            source,
            redeemedAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + 86400 * 30, // 30-day TTL
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        // Already redeemed today from this IP — still return success but don't double-count
        console.log(`Duplicate redemption skipped: code=${code}, ip=${ip}`);
        return respond(200, { message: 'Already redeemed', offerId: offer.offerId });
      }
      throw err;
    }

    // H21: Conditional update — only increment if offer is still active and not expired
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: offer.restaurantPK, SK: offer.offerSK },
          UpdateExpression: 'SET redemptions = if_not_exists(redemptions, :zero) + :inc, uniqueRedemptions = if_not_exists(uniqueRedemptions, :zero) + :inc, scansBySource.#src = if_not_exists(scansBySource.#src, :zero) + :inc',
          ConditionExpression: 'isActive <> :false AND (attribute_not_exists(expiresAt) OR expiresAt > :now)',
          ExpressionAttributeNames: { '#src': `redeem_${source}` },
          ExpressionAttributeValues: { ':inc': 1, ':zero': 0, ':false': false, ':now': new Date().toISOString() },
        })
      );
    } catch (condErr) {
      if (condErr.name === 'ConditionalCheckFailedException') {
        return respond(410, { error: 'This offer is no longer active' });
      }
      throw condErr;
    }

    console.log(`Offer redeemed: code=${code}, restaurant=${offer.restaurantId}, source=${source}`);
    return respond(200, { message: 'Redeemed', offerId: offer.offerId, source });
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
  if (!(await checkUserMutationRate(userId, 'SAVE_REST', 60))) {
    return respond(429, { error: 'Too many save operations. Please try again later.' });
  }
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  try {
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
  } catch (err) {
    console.error('saveRestaurant error:', err.message);
    return respond(500, { error: 'Failed to save restaurant' });
  }
}

async function listSaves(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `AUDIENCE#${userId}`,
          ':sk': 'SAVE#',
        },
        Limit: 100, // Cap to prevent unbounded reads
      })
    );
    return respond(200, stripAll(result.Items || []));
  } catch (err) {
    console.error('listSaves error:', err.message);
    return respond(500, { error: 'Failed to load saves' });
  }
}

// ─── SpotOps Pipeline ─────────────────────────────────────────────────────────

async function getSpotOpsPipeline(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#CAMPAIGNS` },
        Limit: 200,
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
  } catch (err) {
    console.error('getSpotOpsPipeline error:', err.message);
    return respond(500, { error: 'Failed to load pipeline' });
  }
}

// ─── Offers (List) ───────────────────────────────────────────────────────────

async function listOffers(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  try {
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
  } catch (err) {
    console.error('listOffers error:', err.message);
    return respond(500, { error: 'Failed to load offers' });
  }
}

// ─── Restaurant Offers (public — for campaign linking) ───────────────────────

async function listRestaurantOffers(restaurantId, event) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid restaurant ID' });
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        ExpressionAttributeValues: {
          ':pk': `RESTAURANT#${restaurantId}`,
          ':sk': 'OFFER#',
        },
        Limit: 50,
      })
    );

    // Public endpoint: only return active + approved offers (hide draft/paused/unapproved from public)
    const activeOffers = (result.Items || [])
      .filter((o) => o.isActive !== false)
      .filter((o) => !o.approvalStatus || o.approvalStatus === 'approved')
      .filter((o) => !o.expiresAt || new Date(o.expiresAt) > new Date()) // hide expired
      .map((o) => stripDdbKeys(o));

    return respond(200, activeOffers);
  } catch (err) {
    console.error('listRestaurantOffers error:', err.message);
    return respond(500, { error: 'Failed to load offers' });
  }
}

// ─── Reports ─────────────────────────────────────────────────────────────────

async function listReports(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  try {
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
  } catch (err) {
    console.error('listReports error:', err.message);
    return respond(500, { error: 'Failed to load reports' });
  }
}

// ─── Partner Analytics ────────────────────────────────────────────────────────

/**
 * GET /api/partner/analytics — Aggregated margin-first metrics for restaurant dashboard.
 * Computes ROI, cost-per-acquisition, estimated revenue from existing data.
 */
async function getPartnerAnalytics(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // H15: Determine which restaurant this user owns for analytics
  // Query the user's restaurants to scope analytics to THEIR data only
  const userRestaurants = await ddb.send(new QueryCommand({
    TableName: TABLE,
    IndexName: 'GSI1',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#RESTAURANTS` },
    ProjectionExpression: 'restaurantId',
    Limit: 20,
  }));
  const ownedRestaurantIds = (userRestaurants.Items || []).map(r => r.restaurantId).filter(Boolean);

  // Check for POS connection to use real metrics
  let AVG_CHECK_VALUE = 45;
  let REPEAT_VISIT_RATE = 0.35;
  let metricsSource = 'industry_average';

  // Check all POS providers for connected metrics
  // H27: Use first owned restaurantId, not userId — findConnectedPos expects RESTAURANT#{id}
  try {
    const posFound = ownedRestaurantIds.length > 0 ? await findConnectedPos(ownedRestaurantIds[0]) : null;
    if (posFound?.conn?.lastMetrics) {
      AVG_CHECK_VALUE = posFound.conn.lastMetrics.avgCheckValue || 45;
      REPEAT_VISIT_RATE = posFound.conn.lastMetrics.repeatCustomerRate || 0.35;
      metricsSource = `${posFound.provider}_pos`;
    }

    // Also check for REDEMPTION_SYNC data (more accurate than POS lastMetrics)
    // H15: Scope to user's first owned restaurant, not userId as restaurantId
    const analyticsRestaurantId = ownedRestaurantIds[0] || userId;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
    const syncResult = await ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND SK >= :start',
      ExpressionAttributeValues: {
        ':pk': `RESTAURANT#${analyticsRestaurantId}`,
        ':start': `REDEMPTION_SYNC#${thirtyDaysAgo}`,
      },
      Limit: 30,
    }));
    const syncs = syncResult.Items || [];
    if (syncs.length > 0) {
      const avgCheck = syncs.reduce((s, r) => s + (r.avgTransactionValue || 0), 0) / syncs.length;
      const totalMatched = syncs.reduce((s, r) => s + (r.matchedRedemptions || 0), 0);
      const totalRepeat = syncs.reduce((s, r) => s + (r.repeatCustomerCount || 0), 0);
      const avgRepeat = totalMatched > 0 ? totalRepeat / totalMatched : 0.35;
      if (avgCheck > 0) AVG_CHECK_VALUE = Math.round(avgCheck * 100) / 100;
      if (avgRepeat > 0 && avgRepeat < 1) REPEAT_VISIT_RATE = Math.round(avgRepeat * 100) / 100;
      metricsSource = 'redemption_sync';
    }
  } catch (e) { console.warn('POS/sync lookup failed, using industry defaults:', e.message); }

  // Fetch campaigns, offers, and reports in parallel
  const [campaignResult, offerResult, reportResult, proposalResult] = await Promise.all([
    ddb.send(new QueryCommand({
      TableName: TABLE, IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#CAMPAIGNS` },
      Limit: 50,
    })),
    ddb.send(new QueryCommand({
      TableName: TABLE, IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#OFFERS` },
      Limit: 50,
    })),
    ddb.send(new QueryCommand({
      TableName: TABLE, IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CREATOR#${userId}#REPORTS` },
      Limit: 50,
    })),
    ddb.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: '#s = :pending',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}`,
        ':prefix': 'PROPOSAL#',
        ':pending': 'pending',
      },
      Limit: 20,
    })),
  ]);

  const campaigns = campaignResult.Items || [];
  const offers = offerResult.Items || [];
  const reports = reportResult.Items || [];
  const pendingProposals = proposalResult.Items || [];

  // Aggregate metrics
  const activeCampaigns = campaigns.filter(c => c.status === 'active' || c.status === 'negotiation');
  const totalBudgetSpent = campaigns
    .filter(c => c.status === 'active' || c.status === 'completed')
    .reduce((sum, c) => sum + (c.budget || 0), 0);

  const totalScans = offers.reduce((sum, o) => sum + (o.scans || 0), 0);
  const totalRedemptions = offers.reduce((sum, o) => sum + (o.redemptions || 0), 0);
  const totalReach = reports.reduce((sum, r) => sum + (r.metrics?.totalReach || 0), 0);
  const totalImpressions = reports.reduce((sum, r) => sum + (r.metrics?.totalImpressions || 0), 0);
  const estimatedVisits = reports.reduce((sum, r) => sum + (r.metrics?.estimatedVisits || 0), 0);

  // Margin-first calculations
  const estimatedRevenue = Math.round(totalRedemptions * AVG_CHECK_VALUE * (1 + REPEAT_VISIT_RATE));
  const costPerAcquisition = totalRedemptions > 0 ? Math.round(totalBudgetSpent / totalRedemptions) : 0;
  const roi = totalBudgetSpent > 0 ? parseFloat(((estimatedRevenue - totalBudgetSpent) / totalBudgetSpent * 100).toFixed(1)) : 0;
  const revenuePerDollarSpent = totalBudgetSpent > 0 ? parseFloat((estimatedRevenue / totalBudgetSpent).toFixed(2)) : 0;
  const scanToRedemptionRate = totalScans > 0 ? parseFloat(((totalRedemptions / totalScans) * 100).toFixed(1)) : 0;

  // Top performing campaign (by redemptions)
  const campaignRedemptions = campaigns
    .filter(c => c.status === 'active' || c.status === 'completed')
    .map(c => {
      const linkedOffers = offers.filter(o => o.linkedCampaignId === c.campaignId);
      const redemptions = linkedOffers.reduce((s, o) => s + (o.redemptions || 0), 0);
      return { campaignId: c.campaignId, restaurantName: c.restaurantName, package: c.package, budget: c.budget, redemptions };
    })
    .sort((a, b) => b.redemptions - a.redemptions);

  // Pending actions count
  const expiringOffers = offers.filter(o => {
    if (!o.expiresAt || !o.isActive) return false;
    const daysLeft = (new Date(o.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return daysLeft > 0 && daysLeft <= 7;
  });

  // Pending proposals expiring soon (within 2 days of 7-day expiry)
  const expiringProposals = pendingProposals.filter(p => {
    if (!p.createdAt) return false;
    const age = Date.now() - new Date(p.createdAt).getTime();
    const daysOld = age / (1000 * 60 * 60 * 24);
    return daysOld >= 5 && daysOld < 7;
  });

  return respond(200, {
    // Hero metrics (margin-first)
    estimatedRevenue,
    totalBudgetSpent,
    roi,
    revenuePerDollarSpent,
    costPerAcquisition,
    // Volume metrics
    activeCampaignCount: activeCampaigns.length,
    totalScans,
    totalRedemptions,
    scanToRedemptionRate,
    totalReach,
    totalImpressions,
    estimatedVisits,
    // Pending actions
    pendingProposalCount: pendingProposals.length,
    expiringOfferCount: expiringOffers.length,
    expiringProposalCount: expiringProposals.length,
    // Top performers
    topCampaigns: campaignRedemptions.slice(0, 5).map(c => ({
      campaignId: c.campaignId, restaurantName: c.restaurantName,
      package: c.package, budget: c.budget, redemptions: c.redemptions,
    })),
    // Recent redemptions (today + this week from offers)
    recentRedemptions: {
      today: totalRedemptions, // Phase 4: real daily tracking from POS
      thisWeek: totalRedemptions,
    },
    // Assumptions (transparent to restaurant)
    assumptions: {
      avgCheckValue: AVG_CHECK_VALUE,
      repeatVisitRate: REPEAT_VISIT_RATE,
      source: metricsSource,
      note: metricsSource === 'square_pos'
        ? 'Revenue estimates based on Square POS data.'
        : 'Revenue estimates based on industry averages. Connect POS for real numbers.',
    },
  });
}

// ─── Content Reviews ──────────────────────────────────────────────────────────

const VALID_PLATFORMS = ['instagram', 'tiktok', 'youtube'];
const VALID_CONTENT_TYPES = ['reel', 'story', 'post', 'tiktok', 'shorts'];
const VALID_REVIEW_STATUSES = ['draft', 'submitted', 'revision_requested', 'revised', 'approved', 'rejected', 'published'];

/**
 * POST /api/content-reviews — Creator creates a draft content review request
 * Body: { restaurantId, restaurantName, campaignId?, platform, contentType, contentUrl, caption, hashtagsProposed?, callToAction? }
 */
async function createContentReview(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'CONTENT_REVIEW', 20))) {
    return respond(429, { error: 'Too many content reviews. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const restaurantId = sanitize(body.restaurantId, 64);
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid restaurant ID' });

  const platform = sanitize(body.platform, 30);
  const contentType = sanitize(body.contentType, 30);

  if (!VALID_PLATFORMS.includes(platform))
    return respond(400, { error: `Invalid platform. Must be one of: ${VALID_PLATFORMS.join(', ')}` });
  if (!VALID_CONTENT_TYPES.includes(contentType))
    return respond(400, { error: `Invalid contentType. Must be one of: ${VALID_CONTENT_TYPES.join(', ')}` });

  const reviewId = randomUUID();
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60); // 90 days

  const item = {
    PK: `CREATOR#${userId}`,
    SK: `CONTENT_REVIEW#${reviewId}`,
    GSI1PK: `RESTAURANT#${restaurantId}#CONTENT_REVIEWS`,
    GSI1SK: `draft#${now}`,
    reviewId,
    creatorId: userId,
    restaurantId,
    restaurantName: sanitize(body.restaurantName, 200),
    campaignId: body.campaignId ? sanitize(body.campaignId, 64) : null,
    platform,
    contentType,
    contentUrl: sanitize(body.contentUrl, 500),
    caption: sanitize(body.caption, 2000),
    hashtagsProposed: Array.isArray(body.hashtagsProposed)
      ? body.hashtagsProposed.slice(0, 30).map((h) => sanitize(h, 50))
      : [],
    callToAction: body.callToAction ? sanitize(body.callToAction, 200) : null,
    status: 'draft',
    revisionCount: 0,
    revisionHistory: [],
    messages: [],
    createdAt: now,
    updatedAt: now,
    ttl,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return respond(201, stripDdbKeys(item));
}

// ─── POS Integration (Square OAuth) ───────────────────────────────────────

/**
 * Helper: Find which POS provider is connected for a restaurant.
 * Uses parallel lookups (not sequential) to minimize latency.
 * Returns { conn, provider } or null if none connected.
 */
async function findConnectedPos(restaurantId) {
  const POS_PROVIDERS = ['square', 'toast', 'clover'];
  const results = await Promise.all(
    POS_PROVIDERS.map((prov) =>
      ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: `POS_CONNECTION#${prov}` },
      })).then((r) => ({ provider: prov, item: r.Item })).catch(() => null)
    )
  );
  for (const r of results) {
    if (r?.item?.status === 'connected') return { conn: r.item, provider: r.provider };
  }
  return null;
}

/**
 * Helper: Convert buffer to base64url (no padding)
 */
function toBase64Url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Helper: Compute code challenge from verifier using S256
 */
function computeCodeChallenge(verifier) {
  const hash = createHash('sha256').update(verifier).digest();
  return toBase64Url(hash);
}

/**
 * POST /api/pos/connect/square — Initiate Square OAuth flow
 * Body: { restaurantId }
 */
async function initSquareOAuth(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  const restaurantId = sanitize(body.restaurantId || '', 256);
  if (!restaurantId) return respond(400, { error: 'restaurantId required' });

  // Only the restaurant's listing creator can manage POS integrations
  const restOwner = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  if (!restOwner.Item || restOwner.Item.creatorId !== userId) {
    return respond(403, { error: 'Only the creator who listed this restaurant can manage POS integrations' });
  }

  // Rate limit: max 5 connection attempts per user
  const allowed = await checkUserMutationRate(userId, 'POS_CONNECT', 5);
  if (!allowed) return respond(429, { error: 'Too many connection attempts. Try again later.' });

  try {
    // Generate PKCE parameters
    const state = randomUUID();
    const codeVerifier = toBase64Url(randomBytes(32));
    const codeChallenge = computeCodeChallenge(codeVerifier);

    const now = new Date();
    const ttlSeconds = 600; // 10 minutes
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    // Store pending connection in DDB
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `RESTAURANT#${restaurantId}`,
          SK: 'POS_CONNECTION#square',
          status: 'pending_oauth',
          oauthState: state,
          codeVerifier: codeVerifier,
          createdAt: now.toISOString(),
          expiresAt: expiresAt,
          ttl: Math.floor(now.getTime() / 1000) + ttlSeconds,
        },
      })
    );

    // Build authorization URL
    const SQUARE_APP_ID = process.env.SQUARE_APP_ID;
    const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';
    const baseUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    const authUrl = `${baseUrl}/oauth2/authorize?client_id=${SQUARE_APP_ID}&response_type=code&scope=MERCHANT_PROFILE_READ+ORDERS_READ+PAYMENTS_READ&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    return respond(200, {
      authorizationUrl: authUrl,
      state: state,
      expiresIn: 600,
    });
  } catch (err) {
    console.error('initSquareOAuth error:', err.message);
    return respond(500, { error: 'Failed to initiate Square OAuth' });
  }
}

/**
 * GET /api/pos/callback/square — Handle Square OAuth callback
 * Query params: code, state, restaurantId
 */
async function handleSquareCallback(event) {
  // H23: Auth + ownership check — was completely missing, any user could complete Square OAuth for any restaurant
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const code = sanitize(params.code || '', 512);
  const state = sanitize(params.state || '', 512);
  const restaurantId = sanitize(params.restaurantId || '', 256);

  if (!code || !state || !restaurantId) {
    return respond(400, { error: 'Missing required callback parameters' });
  }

  // Verify caller owns this restaurant before completing POS connection
  const restOwnerSquare = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  if (!restOwnerSquare.Item || restOwnerSquare.Item.creatorId !== userId) {
    return respond(403, { error: 'Only the creator who listed this restaurant can complete POS connections' });
  }

  try {
    // Look up pending connection
    const lookup = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'POS_CONNECTION#square' },
      })
    );

    if (!lookup.Item) {
      return respond(400, { error: 'No pending Square connection found' });
    }

    const pending = lookup.Item;
    if (pending.status !== 'pending_oauth') {
      return respond(400, { error: 'Connection is not in pending state' });
    }

    // Validate state
    if (pending.oauthState !== state) {
      return respond(400, { error: 'OAuth state mismatch — possible CSRF attack' });
    }

    // Development mode: if no SQUARE_APP_SECRET, simulate success
    const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET;
    if (!SQUARE_APP_SECRET) {
      // Dev mode — simulate successful connection
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'POS_CONNECTION#square' },
          UpdateExpression: 'SET #s = :connected, merchantId = :merchantId, connectedAt = :now, lastSyncedAt = :now, lastMetrics = :metrics, #env = :dev',
          ExpressionAttributeNames: {
            '#s': 'status',
            '#env': 'environment',
          },
          ExpressionAttributeValues: {
            ':connected': 'connected',
            ':merchantId': 'MOCK_MERCHANT_' + randomUUID().substring(0, 8),
            ':now': new Date().toISOString(),
            ':metrics': {
              avgCheckValue: 45,
              repeatCustomerRate: 0.35,
            },
            ':dev': 'development',
          },
        })
      );
      return respond(200, {
        status: 'connected',
        provider: 'square',
        mode: 'development',
        message: 'Development mode — using simulated merchant data',
      });
    }

    // Production mode: exchange code for tokens
    const SQUARE_APP_ID = process.env.SQUARE_APP_ID;
    const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';
    const tokenUrl = SQUARE_ENVIRONMENT === 'production'
      ? 'https://connect.squareup.com/oauth2/token'
      : 'https://connect.squareupsandbox.com/oauth2/token';

    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: SQUARE_APP_ID,
        client_secret: SQUARE_APP_SECRET,
        code: code,
        grant_type: 'authorization_code',
        code_verifier: pending.codeVerifier,
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenResponse.ok) {
      console.error('Square token exchange failed:', tokenResponse.status, tokenResponse.statusText);
      return respond(400, { error: 'Failed to exchange Square authorization code' });
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Fetch merchant info
    let merchantId = 'unknown';
    try {
      const merchantRes = await fetch('https://connect.squareup.com/v2/merchants/me', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (merchantRes.ok) {
        const merchantData = await merchantRes.json();
        merchantId = merchantData.merchant?.id || merchantId;
      }
    } catch (e) {
      console.warn('Failed to fetch merchant info:', e.message);
    }

    // KMS envelope encryption for POS OAuth tokens at rest
    const [encAccessToken, encRefreshToken] = await Promise.all([
      encryptPosToken(accessToken),
      encryptPosToken(refreshToken),
    ]);

    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'POS_CONNECTION#square' },
        UpdateExpression: 'SET #s = :connected, merchantId = :merchantId, accessToken = :accessToken, refreshToken = :refreshToken, tokenExpiresAt = :expiresAt, connectedAt = :now, lastSyncedAt = :now, tokenEncrypted = :enc',
        ExpressionAttributeNames: {
          '#s': 'status',
        },
        ExpressionAttributeValues: {
          ':connected': 'connected',
          ':merchantId': merchantId,
          ':accessToken': encAccessToken,
          ':refreshToken': encRefreshToken,
          ':expiresAt': expiresAt,
          ':now': new Date().toISOString(),
          ':enc': true,
        },
      })
    );

    return respond(200, {
      status: 'connected',
      provider: 'square',
      merchantId: merchantId,
      connectedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('handleSquareCallback error:', err.message);
    return respond(500, { error: 'Failed to complete Square OAuth callback' });
  }
}

/**
 * GET /api/pos/status — Get POS connection status
 * Query param: restaurantId
 */
async function getPosStatus(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const restaurantId = sanitize(params.restaurantId || '', 256);
  if (!restaurantId) return respond(400, { error: 'restaurantId required' });

  // Only the restaurant's listing creator can view POS status
  const restOwnerStatus = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  if (!restOwnerStatus.Item || restOwnerStatus.Item.creatorId !== userId) {
    return respond(403, { error: 'Only the creator who listed this restaurant can view POS status' });
  }

  try {
    const found = await findConnectedPos(restaurantId);
    if (found) {
      const conn = found.conn;
      return respond(200, {
        connected: true,
        provider: found.provider,
        status: conn.status,
        merchantId: conn.merchantId,
        merchantName: conn.merchantName,
        connectedAt: conn.connectedAt,
        lastSyncedAt: conn.lastSyncedAt,
        lastMetrics: conn.lastMetrics,
      });
    }
    return respond(200, { connected: false });
  } catch (err) {
    console.error('getPosStatus error:', err.message);
    return respond(500, { error: 'Failed to fetch POS status' });
  }
}

/**
 * PUT /api/pos/disconnect — Disconnect POS provider
 * Body: { restaurantId, provider? }
 */
async function disconnectPos(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  const restaurantId = sanitize(body.restaurantId || '', 256);
  if (!restaurantId) return respond(400, { error: 'restaurantId required' });

  // Only the restaurant's listing creator can disconnect POS
  const restOwnerDisc = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  if (!restOwnerDisc.Item || restOwnerDisc.Item.creatorId !== userId) {
    return respond(403, { error: 'Only the creator who listed this restaurant can disconnect POS' });
  }

  // Rate limit: max 3 disconnections per user
  const allowed = await checkUserMutationRate(userId, 'POS_DISCONNECT', 3);
  if (!allowed) return respond(429, { error: 'Too many disconnection attempts. Try again later.' });

  try {
    // Determine which provider to disconnect
    let provider = sanitize(body.provider || '', 20);
    let conn = null;

    if (provider && ['square', 'toast', 'clover'].includes(provider)) {
      // Specific provider requested
      const lookup = await ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `RESTAURANT#${restaurantId}`, SK: `POS_CONNECTION#${provider}` },
      }));
      conn = lookup.Item;
    } else {
      // Auto-detect the connected one (parallel lookup)
      const found = await findConnectedPos(restaurantId);
      if (found) {
        provider = found.provider;
        conn = found.conn;
      }
    }

    if (!conn) {
      return respond(404, { error: 'No POS connection found' });
    }

    // In production: call provider's revoke endpoint
    if (provider === 'square') {
      const SQUARE_APP_SECRET = process.env.SQUARE_APP_SECRET;
      if (SQUARE_APP_SECRET && conn.accessToken) {
        const SQUARE_ENVIRONMENT = process.env.SQUARE_ENVIRONMENT || 'sandbox';
        const revokeUrl = SQUARE_ENVIRONMENT === 'production'
          ? 'https://connect.squareup.com/oauth2/revoke'
          : 'https://connect.squareupsandbox.com/oauth2/revoke';

        try {
          await fetch(revokeUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              client_id: process.env.SQUARE_APP_ID,
              access_token: conn.accessToken,
            }).toString(),
            signal: AbortSignal.timeout(10000),
          });
        } catch (e) {
          console.warn('Failed to revoke Square token:', e.message);
        }
      }
    }

    // Delete the connection item from DDB
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: `POS_CONNECTION#${provider}` },
    }));

    return respond(200, { message: 'POS connection disconnected', provider });
  } catch (err) {
    console.error('disconnectPos error:', err.message);
    return respond(500, { error: 'Failed to disconnect POS' });
  }
}

// ─── Toast POS Integration ──────────────────────────────────────────────────

/**
 * POST /api/pos/connect/toast — Initiate Toast connection.
 * Toast uses partner API with bearer token authentication.
 * Body: { restaurantId, apiKey?, apiSecret? }
 */
async function initToastAuth(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  const allowed = await checkUserMutationRate(userId, 'POS_CONNECT_TOAST', 5);
  if (!allowed) return respond(429, { error: 'Too many connection attempts.' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const restaurantId = sanitize(body.restaurantId || '', 256);
  if (!restaurantId) return respond(400, { error: 'restaurantId required' });

  // Only the restaurant's listing creator can manage POS integrations
  const restOwnerToast = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  if (!restOwnerToast.Item || restOwnerToast.Item.creatorId !== userId) {
    return respond(403, { error: 'Only the creator who listed this restaurant can manage POS integrations' });
  }

  const now = new Date().toISOString();

  // Dev mode: no TOAST_API_KEY — simulate success
  if (!process.env.TOAST_API_KEY) {
    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `RESTAURANT#${restaurantId}`,
        SK: 'POS_CONNECTION#toast',
        provider: 'toast',
        status: 'connected',
        merchantId: `MOCK_TOAST_${randomUUID().substring(0, 12)}`,
        merchantName: 'Toast Demo Restaurant',
        environment: 'development',
        connectedAt: now,
        lastSyncedAt: now,
        lastMetrics: { avgCheckValue: 52, repeatCustomerRate: 0.38 },
        createdAt: now,
        updatedAt: now,
      },
    }));
    return respond(200, { status: 'connected', provider: 'toast', mode: 'development' });
  }

  // Production: Use Toast's partner auth endpoint
  try {
    const toastBase = 'https://api.toasttab.com';
    const resp = await fetch(`${toastBase}/authentication/v1/authentication/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: process.env.TOAST_API_KEY,
        clientSecret: process.env.TOAST_API_SECRET,
        userAccessType: 'TOAST_MACHINE_CLIENT',
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      return respond(400, { error: 'Toast authentication failed' });
    }

    const tokenData = await resp.json();

    // KMS envelope encryption for Toast OAuth token
    const encToastToken = await encryptPosToken(tokenData.token?.accessToken);

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `RESTAURANT#${restaurantId}`,
        SK: 'POS_CONNECTION#toast',
        provider: 'toast',
        status: 'connected',
        accessToken: encToastToken,
        tokenExpiresAt: tokenData.token?.expiresIn
          ? new Date(Date.now() + tokenData.token.expiresIn * 1000).toISOString()
          : null,
        merchantId: restaurantId,
        environment: 'production',
        tokenEncrypted: true,
        connectedAt: now,
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    }));

    return respond(200, { status: 'connected', provider: 'toast', mode: 'production' });
  } catch (err) {
    console.error('Toast auth error:', err.message);
    return respond(500, { error: 'Toast connection failed' });
  }
}

// ─── Clover POS Integration ────────────────────────────────────────────────

/**
 * POST /api/pos/connect/clover — Initiate Clover OAuth flow.
 * Standard OAuth 2.0 authorization code grant.
 * Body: { restaurantId }
 */
async function initCloverOAuth(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  const allowed = await checkUserMutationRate(userId, 'POS_CONNECT_CLOVER', 5);
  if (!allowed) return respond(429, { error: 'Too many connection attempts.' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const restaurantId = sanitize(body.restaurantId || '', 256);
  if (!restaurantId) return respond(400, { error: 'restaurantId required' });

  // Only the restaurant's listing creator can manage POS integrations
  const restOwnerClover = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  if (!restOwnerClover.Item || restOwnerClover.Item.creatorId !== userId) {
    return respond(403, { error: 'Only the creator who listed this restaurant can manage POS integrations' });
  }

  const state = randomUUID();
  const codeVerifier = toBase64Url(randomBytes(32));
  const codeChallenge = computeCodeChallenge(codeVerifier);
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + 600; // 10 min expiry

  // Store pending connection
  await ddb.send(new PutCommand({
    TableName: TABLE,
    Item: {
      PK: `RESTAURANT#${restaurantId}`,
      SK: 'POS_CONNECTION#clover',
      provider: 'clover',
      status: 'pending_oauth',
      oauthState: state,
      codeVerifier,
      createdAt: now,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      ttl,
    },
  }));

  const CLOVER_APP_ID = process.env.CLOVER_APP_ID || 'DEMO_CLOVER_APP';
  const cloverEnv = process.env.CLOVER_ENVIRONMENT === 'production'
    ? 'https://www.clover.com'
    : 'https://sandbox.dev.clover.com';

  const authUrl = `${cloverEnv}/oauth/authorize?client_id=${CLOVER_APP_ID}&response_type=code&state=${state}`;

  return respond(200, { authorizationUrl: authUrl, state, expiresIn: 600 });
}

/**
 * GET /api/pos/callback/clover — Clover OAuth callback.
 * Query: code, state, restaurantId
 */
async function handleCloverCallback(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const code = sanitize(params.code || '', 512);
  const state = sanitize(params.state || '', 512);
  const restaurantId = sanitize(params.restaurantId || '', 256);

  if (!code || !state || !restaurantId) {
    return respond(400, { error: 'code, state, and restaurantId are required' });
  }

  // Verify pending connection
  const lookup = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'POS_CONNECTION#clover' },
  }));

  if (!lookup.Item || lookup.Item.status !== 'pending_oauth') {
    return respond(400, { error: 'No pending Clover connection found' });
  }
  if (lookup.Item.oauthState !== state) {
    return respond(400, { error: 'Invalid state parameter' });
  }

  const now = new Date().toISOString();

  // Dev mode: no CLOVER_APP_SECRET
  if (!process.env.CLOVER_APP_SECRET) {
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'POS_CONNECTION#clover' },
      UpdateExpression: 'SET #s = :connected, merchantId = :mid, merchantName = :mname, environment = :env, connectedAt = :now, lastSyncedAt = :now, lastMetrics = :metrics, updatedAt = :now REMOVE oauthState, codeVerifier, expiresAt, #ttl',
      ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':connected': 'connected',
        ':mid': `MOCK_CLOVER_${randomUUID().substring(0, 12)}`,
        ':mname': 'Clover Demo Merchant',
        ':env': 'development',
        ':now': now,
        ':metrics': { avgCheckValue: 48, repeatCustomerRate: 0.36 },
      },
    }));
    return respond(200, { status: 'connected', provider: 'clover', mode: 'development' });
  }

  // Production: exchange code for access token
  try {
    const cloverEnv = process.env.CLOVER_ENVIRONMENT === 'production'
      ? 'https://www.clover.com'
      : 'https://sandbox.dev.clover.com';

    const tokenResp = await fetch(`${cloverEnv}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.CLOVER_APP_ID,
        client_secret: process.env.CLOVER_APP_SECRET,
        code,
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenResp.ok) {
      return respond(400, { error: 'Clover token exchange failed' });
    }

    const tokenData = await tokenResp.json();

    // KMS envelope encryption for Clover OAuth token
    const encCloverToken = await encryptPosToken(tokenData.access_token);

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'POS_CONNECTION#clover' },
      UpdateExpression: 'SET #s = :connected, accessToken = :token, merchantId = :mid, environment = :env, connectedAt = :now, lastSyncedAt = :now, updatedAt = :now, tokenEncrypted = :enc REMOVE oauthState, codeVerifier, expiresAt, #ttl',
      ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':connected': 'connected',
        ':token': encCloverToken,
        ':mid': tokenData.merchant_id || restaurantId,
        ':env': process.env.CLOVER_ENVIRONMENT || 'sandbox',
        ':now': now,
        ':enc': true,
      },
    }));

    return respond(200, { status: 'connected', provider: 'clover', mode: 'production', merchantId: tokenData.merchant_id });
  } catch (err) {
    console.error('Clover token exchange error:', err.message);
    return respond(500, { error: 'Clover connection failed' });
  }
}

// ─── POS Redemption Sync Engine ─────────────────────────────────────────────

/**
 * POST /api/pos/sync — Sync redemption data with POS transactions.
 * Matches QR redemptions against POS transactions to calculate real ROI.
 * Body: { restaurantId, date? }
 */
async function syncRedemptionData(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  const allowed = await checkUserMutationRate(userId, 'POS_SYNC', 3);
  if (!allowed) return respond(429, { error: 'Max 3 syncs per day. Try again tomorrow.' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const restaurantId = sanitize(body.restaurantId || '', 256);
  if (!restaurantId) return respond(400, { error: 'restaurantId required' });

  const targetDate = sanitize(body.date || new Date().toISOString().split('T')[0], 10);
  const MATCH_WINDOW_MS = parseInt(process.env.POS_SYNC_WINDOW_MS || '7200000', 10); // 2 hours default

  // Find which POS is connected
  const posFound = await findConnectedPos(restaurantId);
  const posConn = posFound?.conn ?? null;
  const provider = posFound?.provider ?? null;

  if (!posConn) {
    return respond(400, { error: 'No POS provider connected. Connect Square, Toast, or Clover first.' });
  }

  // Fetch our redemptions for this restaurant on the target date
  const dayStart = `${targetDate}T00:00:00.000Z`;
  const dayEnd = `${targetDate}T23:59:59.999Z`;

  const redemptionResult = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND SK BETWEEN :start AND :end',
    ExpressionAttributeValues: {
      ':pk': `RESTAURANT#${restaurantId}`,
      ':start': `REDEEM#${dayStart}`,
      ':end': `REDEEM#${dayEnd}z`,
    },
    Limit: 200,
  }));

  const redemptions = redemptionResult.Items || [];

  // In dev mode: generate synthetic match data
  if (posConn.environment === 'development') {
    const matchRate = 0.72 + Math.random() * 0.18; // 72-90% match rate
    const matched = Math.round(redemptions.length * matchRate) || Math.round(5 * matchRate);
    const totalCount = redemptions.length || 5;
    const unmatched = totalCount - matched;
    const avgTxnValue = posConn.lastMetrics?.avgCheckValue || 48;
    const totalRevenue = Math.round(matched * avgTxnValue * (0.85 + Math.random() * 0.3) * 100) / 100;

    const syncResult = {
      PK: `RESTAURANT#${restaurantId}`,
      SK: `REDEMPTION_SYNC#${targetDate}`,
      date: targetDate,
      syncedAt: new Date().toISOString(),
      provider,
      totalRedemptions: totalCount,
      matchedRedemptions: matched,
      unmatchedRedemptions: unmatched,
      matchRate: Math.round((matched / totalCount) * 100),
      totalRevenue,
      avgTransactionValue: Math.round((totalRevenue / Math.max(matched, 1)) * 100) / 100,
      repeatCustomerCount: Math.round(matched * (posConn.lastMetrics?.repeatCustomerRate || 0.35)),
      timeWindowMs: MATCH_WINDOW_MS,
      environment: 'development',
      ttl: Math.floor(Date.now() / 1000) + 90 * 86400, // 90-day TTL
      createdAt: new Date().toISOString(),
    };

    await ddb.send(new PutCommand({ TableName: TABLE, Item: syncResult }));

    // Update POS connection with latest metrics
    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: `POS_CONNECTION#${provider}` },
      UpdateExpression: 'SET lastSyncedAt = :now, lastMetrics = :metrics, updatedAt = :now',
      ExpressionAttributeValues: {
        ':now': new Date().toISOString(),
        ':metrics': {
          avgCheckValue: syncResult.avgTransactionValue,
          repeatCustomerRate: syncResult.repeatCustomerCount / Math.max(syncResult.matchedRedemptions, 1),
        },
      },
    }));

    return respond(200, {
      synced: true,
      date: targetDate,
      provider,
      totalRedemptions: syncResult.totalRedemptions,
      matchedRedemptions: syncResult.matchedRedemptions,
      matchRate: syncResult.matchRate,
      totalRevenue: syncResult.totalRevenue,
      avgTransactionValue: syncResult.avgTransactionValue,
      mode: 'development',
    });
  }

  // Production: Call POS API for transactions
  // (placeholder — requires real credentials and POS SDK integration)
  return respond(501, { error: `Production sync for ${provider} not yet implemented. Connect credentials first.` });
}

/**
 * GET /api/pos/sync/history — Get sync history for a restaurant.
 * Query: restaurantId, limit?
 */
async function getSyncHistory(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const restaurantId = sanitize(params.restaurantId, 256);
  if (!restaurantId) return respond(400, { error: 'restaurantId is required' });

  // H9: Verify caller owns this restaurant before exposing sync data
  const restCheck = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' },
      ProjectionExpression: 'creatorId',
    })
  );
  if (!restCheck.Item || restCheck.Item.creatorId !== userId) {
    return respond(403, { error: 'You do not have access to this restaurant\'s data' });
  }

  const limit = Math.min(parseInt(params.limit || '30', 10), 90);

  const result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `RESTAURANT#${restaurantId}`,
      ':prefix': 'REDEMPTION_SYNC#',
    },
    ScanIndexForward: false, // newest first
    Limit: limit,
  }));

  return respond(200, (result.Items || []).map(stripDdbKeys));
}

/**
 * PUT /api/content-reviews/{reviewId}/submit — Creator submits draft for restaurant review
 */
async function submitContentReview(reviewId, event) {
  if (!isValidId(reviewId)) return respond(400, { error: 'Invalid review ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'CONTENT_REVIEW_SUBMIT', 30))) {
    return respond(429, { error: 'Too many submissions. Please try again later.' });
  }

  // Find the review by creator PK first
  const find = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}`,
        ':sk': `CONTENT_REVIEW#${reviewId}`,
      },
    })
  );

  if (!find.Items?.length) return respond(404, { error: 'Content review not found' });
  const existing = find.Items[0];

  if (existing.status !== 'draft' && existing.status !== 'revision_requested') {
    return respond(400, { error: `Cannot submit from status '${existing.status}'` });
  }

  const now = new Date().toISOString();
  const gsi1sk = `submitted#${existing.createdAt}`;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: 'SET #s = :submitted, submittedAt = :now, #u = :now, GSI1SK = :gsi1sk',
      ExpressionAttributeNames: { '#s': 'status', '#u': 'updatedAt' },
      ExpressionAttributeValues: {
        ':submitted': 'submitted',
        ':now': now,
        ':gsi1sk': gsi1sk,
      },
    })
  );

  // Notify restaurant
  await createNotification(
    existing.restaurantId,
    'content_review_submitted',
    'New Content Review',
    `Creator submitted content for review: ${existing.contentType} on ${existing.platform}`,
    `/app/content-reviews/${reviewId}`,
    ''
  );

  return respond(200, { message: 'Content review submitted', reviewId });
}

/**
 * GET /api/content-reviews — List reviews
 * Query: ?inbox=true (for restaurant's pending reviews), or creator's own reviews
 */
async function listContentReviews(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(params.limit) || 25, 1), 100);
  const statusFilter = params.status ? sanitize(params.status, 30) : null;

  let result;

  if (params.inbox === 'true') {
    // Restaurant's pending reviews via GSI1
    result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk',
        ExpressionAttributeValues: {
          ':pk': `RESTAURANT#${userId}#CONTENT_REVIEWS`,
        },
        ScanIndexForward: false, // newest first
        Limit: limit,
      })
    );
  } else {
    // Creator's own reviews
    result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `CREATOR#${userId}`,
          ':prefix': 'CONTENT_REVIEW#',
        },
        ScanIndexForward: false,
        Limit: limit,
      })
    );
  }

  let items = result.Items || [];

  // Optional status filter
  if (statusFilter && VALID_REVIEW_STATUSES.includes(statusFilter)) {
    items = items.filter((r) => r.status === statusFilter);
  }

  return respond(200, stripAll(items));
}

/**
 * GET /api/content-reviews/{reviewId} — Get content review detail
 */
async function getContentReview(reviewId, event) {
  if (!isValidId(reviewId)) return respond(400, { error: 'Invalid review ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Try creator's PK first
  let result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}`,
        ':sk': `CONTENT_REVIEW#${reviewId}`,
      },
    })
  );

  if (result.Items?.length) {
    return respond(200, stripDdbKeys(result.Items[0]));
  }

  // Fall back to GSI1 for restaurant access
  result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `RESTAURANT#${userId}#CONTENT_REVIEWS`,
      },
      Limit: 100,
    })
  );

  const item = (result.Items || []).find((r) => r.reviewId === reviewId);
  if (!item) return respond(404, { error: 'Content review not found' });

  return respond(200, stripDdbKeys(item));
}

/**
 * PUT /api/content-reviews/{reviewId}/request-revision — Restaurant requests revision
 */
async function requestContentRevision(reviewId, event) {
  if (!isValidId(reviewId)) return respond(400, { error: 'Invalid review ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'CONTENT_REVIEW_REVISE', 30))) {
    return respond(429, { error: 'Too many revision requests. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const reason = sanitize(body.reason, 500);
  if (!reason) return respond(400, { error: 'Reason is required' });

  // Query via GSI1 to verify restaurant ownership
  const find = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `RESTAURANT#${userId}#CONTENT_REVIEWS`,
      },
      Limit: 100,
    })
  );

  const existing = (find.Items || []).find((r) => r.reviewId === reviewId);
  if (!existing) return respond(404, { error: 'Content review not found' });

  if (existing.status !== 'submitted' && existing.status !== 'revised') {
    return respond(400, { error: `Cannot request revision from status '${existing.status}'` });
  }

  if ((existing.revisionCount || 0) >= 3) {
    return respond(400, { error: 'Maximum 3 revisions reached. Please approve or reject.' });
  }
  const revisionCount = (existing.revisionCount || 0) + 1;
  const revisionHistory = existing.revisionHistory || [];
  revisionHistory.push({
    count: revisionCount,
    requestedAt: new Date().toISOString(),
    reason,
  });

  const now = new Date().toISOString();
  const gsi1sk = `revision_requested#${existing.createdAt}`;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: 'SET #s = :status, revisionCount = :count, revisionHistory = :history, #u = :now, GSI1SK = :gsi1sk',
      ExpressionAttributeNames: { '#s': 'status', '#u': 'updatedAt' },
      ExpressionAttributeValues: {
        ':status': 'revision_requested',
        ':count': revisionCount,
        ':history': revisionHistory,
        ':now': now,
        ':gsi1sk': gsi1sk,
      },
    })
  );

  // Notify creator
  await createNotification(
    existing.creatorId,
    'content_review_revision_requested',
    'Revision Requested',
    `${existing.restaurantName} requested changes: ${reason}`,
    `/app/content-reviews/${reviewId}`,
    ''
  );

  return respond(200, { message: 'Revision requested', reviewId, revisionCount });
}

/**
 * PUT /api/content-reviews/{reviewId}/approve — Restaurant approves
 */
async function approveContentReview(reviewId, event) {
  if (!isValidId(reviewId)) return respond(400, { error: 'Invalid review ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'CONTENT_REVIEW_APPROVE', 50))) {
    return respond(429, { error: 'Too many approvals. Please try again later.' });
  }

  // Query via GSI1 to verify restaurant ownership
  const find = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `RESTAURANT#${userId}#CONTENT_REVIEWS`,
      },
      Limit: 100,
    })
  );

  const existing = (find.Items || []).find((r) => r.reviewId === reviewId);
  if (!existing) return respond(404, { error: 'Content review not found' });

  if (existing.status !== 'submitted' && existing.status !== 'revised') {
    return respond(400, { error: `Cannot approve from status '${existing.status}'` });
  }

  const now = new Date().toISOString();
  const gsi1sk = `approved#${existing.createdAt}`;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: 'SET #s = :approved, approvedAt = :now, approvedBy = :userId, #u = :now, GSI1SK = :gsi1sk',
      ExpressionAttributeNames: { '#s': 'status', '#u': 'updatedAt' },
      ExpressionAttributeValues: {
        ':approved': 'approved',
        ':now': now,
        ':userId': userId,
        ':gsi1sk': gsi1sk,
      },
    })
  );

  // Notify creator
  await createNotification(
    existing.creatorId,
    'content_review_approved',
    'Content Approved',
    `${existing.restaurantName} approved your ${existing.contentType} content`,
    `/app/content-reviews/${reviewId}`,
    ''
  );

  return respond(200, { message: 'Content review approved', reviewId });
}

/**
 * PUT /api/content-reviews/{reviewId}/reject — Restaurant rejects
 */
async function rejectContentReview(reviewId, event) {
  if (!isValidId(reviewId)) return respond(400, { error: 'Invalid review ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'CONTENT_REVIEW_REJECT', 50))) {
    return respond(429, { error: 'Too many rejections. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const reason = sanitize(body.reason, 500);
  if (!reason) return respond(400, { error: 'Rejection reason is required' });

  // Query via GSI1 to verify restaurant ownership
  const find = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `RESTAURANT#${userId}#CONTENT_REVIEWS`,
      },
      Limit: 100,
    })
  );

  const existing = (find.Items || []).find((r) => r.reviewId === reviewId);
  if (!existing) return respond(404, { error: 'Content review not found' });

  if (existing.status !== 'submitted' && existing.status !== 'revised') {
    return respond(400, { error: `Cannot reject from status '${existing.status}'` });
  }

  const now = new Date().toISOString();
  const gsi1sk = `rejected#${existing.createdAt}`;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: existing.PK, SK: existing.SK },
      UpdateExpression: 'SET #s = :rejected, rejectedAt = :now, rejectionReason = :reason, #u = :now, GSI1SK = :gsi1sk',
      ExpressionAttributeNames: { '#s': 'status', '#u': 'updatedAt' },
      ExpressionAttributeValues: {
        ':rejected': 'rejected',
        ':now': now,
        ':reason': reason,
        ':gsi1sk': gsi1sk,
      },
    })
  );

  // Notify creator
  await createNotification(
    existing.creatorId,
    'content_review_rejected',
    'Content Rejected',
    `${existing.restaurantName} rejected your content: ${reason}`,
    `/app/content-reviews/${reviewId}`,
    ''
  );

  return respond(200, { message: 'Content review rejected', reviewId });
}

// ─── Social Media Integration (Creator OAuth Connections) ────────────────────

const SOCIAL_PLATFORMS = ['instagram', 'tiktok', 'youtube'];

const SOCIAL_MOCK_PROFILES = {
  instagram: {
    platformUserId: 'MOCK_IG_',
    username: 'spot_creator',
    displayName: 'Spot Creator',
    followerCount: 12500,
    mediaCount: 342,
    accountType: 'CREATOR',
  },
  tiktok: {
    platformUserId: 'MOCK_TT_',
    username: 'spot_tiktok',
    displayName: 'Spot TikTok Creator',
    followerCount: 45000,
    videoCount: 89,
  },
  youtube: {
    platformUserId: 'MOCK_YT_',
    username: 'SpotFoodCreator',
    displayName: 'Spot Food Creator',
    followerCount: 8200,
    videoCount: 156,
  },
};

function getSocialSecretEnvVar(platform) {
  const map = {
    instagram: 'INSTAGRAM_APP_SECRET',
    tiktok: 'TIKTOK_CLIENT_SECRET',
    youtube: 'YOUTUBE_CLIENT_SECRET',
  };
  return process.env[map[platform]] || null;
}

function getSocialAppIdEnvVar(platform) {
  const map = {
    instagram: process.env.INSTAGRAM_APP_ID || 'DEMO_IG_APP',
    tiktok: process.env.TIKTOK_CLIENT_KEY || 'DEMO_TT_APP',
    youtube: process.env.YOUTUBE_CLIENT_ID || 'DEMO_YT_APP',
  };
  return map[platform];
}

function buildSocialAuthUrl(platform, appId, state, codeChallenge, callbackBase) {
  const redirectUri = encodeURIComponent(`${callbackBase}/${platform}`);
  switch (platform) {
    case 'instagram':
      return `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=instagram_basic,instagram_manage_insights,pages_show_list&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256&response_type=code`;
    case 'tiktok':
      return `https://www.tiktok.com/v2/auth/authorize/?client_key=${appId}&scope=user.info.basic,user.info.stats,video.list&response_type=code&redirect_uri=${redirectUri}&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256`;
    case 'youtube':
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${encodeURIComponent('https://www.googleapis.com/auth/youtube.readonly')}&response_type=code&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=S256&access_type=offline&prompt=consent`;
    default:
      return null;
  }
}

/**
 * POST /api/social/connect/{platform} — Initiate social media OAuth flow
 */
async function initSocialOAuth(platform, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!SOCIAL_PLATFORMS.includes(platform)) return respond(400, { error: 'Invalid platform' });

  const allowed = await checkUserMutationRate(userId, 'SOCIAL_CONNECT', 5);
  if (!allowed) return respond(429, { error: 'Too many connection attempts. Try again later.' });

  try {
    const state = randomUUID();
    const codeVerifier = toBase64Url(randomBytes(32));
    const codeChallenge = computeCodeChallenge(codeVerifier);
    const now = new Date();
    const ttlSeconds = 600;
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

    await ddb.send(new PutCommand({
      TableName: TABLE,
      Item: {
        PK: `CREATOR#${userId}`,
        SK: `SOCIAL_CONNECTION#${platform}`,
        platform,
        status: 'pending_oauth',
        oauthState: state,
        codeVerifier,
        createdAt: now.toISOString(),
        expiresAt,
        ttl: Math.floor(now.getTime() / 1000) + ttlSeconds,
      },
    }));

    const hasSecret = !!getSocialSecretEnvVar(platform);
    const appId = getSocialAppIdEnvVar(platform);
    const callbackBase = process.env.SOCIAL_OAUTH_CALLBACK_BASE || 'https://main.dc04hhpr1ng78.amplifyapp.com/api/social/callback';
    const authUrl = buildSocialAuthUrl(platform, appId, state, codeChallenge, callbackBase);

    return respond(200, {
      authorizationUrl: authUrl,
      state,
      expiresIn: 600,
      ...(hasSecret ? {} : { mode: 'development' }),
    });
  } catch (err) {
    console.error('initSocialOAuth error:', err.message);
    return respond(500, { error: 'Failed to initiate social OAuth' });
  }
}

/**
 * GET /api/social/callback/{platform} — Handle social media OAuth callback
 * Query params: code, state
 */
async function handleSocialCallback(platform, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!SOCIAL_PLATFORMS.includes(platform)) return respond(400, { error: 'Invalid platform' });

  if (!(await checkUserMutationRate(userId, 'SOCIAL_CALLBACK', 10))) {
    return respond(429, { error: 'Too many callback attempts. Please try again later.' });
  }

  const params = event.queryStringParameters || {};
  const code = sanitize(params.code || '', 512);
  const state = sanitize(params.state || '', 512);
  if (!code || !state) return respond(400, { error: 'Missing code or state' });

  try {
    const lookup = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${platform}` },
    }));

    if (!lookup.Item) return respond(400, { error: 'No pending connection found' });
    if (lookup.Item.status !== 'pending_oauth') return respond(400, { error: 'Connection not in pending state' });
    if (lookup.Item.oauthState !== state) return respond(400, { error: 'OAuth state mismatch' });

    // Check TTL expiration — OAuth state should not be used after it expires
    if (lookup.Item.expiresAt && new Date(lookup.Item.expiresAt).getTime() < Date.now()) {
      return respond(400, { error: 'OAuth state has expired. Please restart the connection flow.' });
    }

    const now = new Date().toISOString();
    const hasSecret = !!getSocialSecretEnvVar(platform);

    if (!hasSecret) {
      // Dev mode — simulate connected state with mock profile
      const mock = SOCIAL_MOCK_PROFILES[platform];
      await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${platform}` },
        UpdateExpression: 'SET #s = :connected, platformUserId = :pid, username = :uname, displayName = :dname, followerCount = :fc, connectedAt = :now, updatedAt = :now, environment = :env REMOVE oauthState, codeVerifier, expiresAt, #ttl',
        ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
        ExpressionAttributeValues: {
          ':connected': 'connected',
          ':pid': mock.platformUserId + randomUUID().substring(0, 8),
          ':uname': mock.username,
          ':dname': mock.displayName,
          ':fc': mock.followerCount,
          ':now': now,
          ':env': 'development',
        },
      }));

      return respond(200, {
        status: 'connected',
        platform,
        mode: 'development',
        username: mock.username,
        followerCount: mock.followerCount,
      });
    }

    // Production mode — exchange code for tokens
    const appId = getSocialAppIdEnvVar(platform);
    const appSecret = getSocialSecretEnvVar(platform);
    const callbackBase = process.env.SOCIAL_OAUTH_CALLBACK_BASE || 'https://main.dc04hhpr1ng78.amplifyapp.com/api/social/callback';
    const redirectUri = `${callbackBase}/${platform}`;

    let tokenUrl, tokenBody, profileUrl, profileHeaders;

    switch (platform) {
      case 'instagram':
        tokenUrl = 'https://graph.facebook.com/v19.0/oauth/access_token';
        tokenBody = new URLSearchParams({ client_id: appId, client_secret: appSecret, code, redirect_uri: redirectUri, code_verifier: lookup.Item.codeVerifier }).toString();
        break;
      case 'tiktok':
        tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
        tokenBody = new URLSearchParams({ client_key: appId, client_secret: appSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: lookup.Item.codeVerifier }).toString();
        break;
      case 'youtube':
        tokenUrl = 'https://oauth2.googleapis.com/token';
        tokenBody = new URLSearchParams({ client_id: appId, client_secret: appSecret, code, grant_type: 'authorization_code', redirect_uri: redirectUri, code_verifier: lookup.Item.codeVerifier }).toString();
        break;
    }

    const tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
      signal: AbortSignal.timeout(10000),
    });

    if (!tokenRes.ok) {
      console.error(`${platform} token exchange failed:`, tokenRes.status);
      return respond(400, { error: `Failed to exchange ${platform} authorization code` });
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token || null;
    const expiresAt = tokenData.expires_in
      ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
      : null;

    // Fetch profile info
    let profileData = { platformUserId: 'unknown', username: 'unknown', displayName: 'unknown', followerCount: 0 };
    try {
      switch (platform) {
        case 'instagram': {
          const igRes = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessToken}`, { signal: AbortSignal.timeout(10000) });
          if (igRes.ok) {
            const pages = await igRes.json();
            const pageId = pages.data?.[0]?.id;
            if (pageId) {
              const igAcct = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${accessToken}`, { signal: AbortSignal.timeout(10000) });
              const igData = await igAcct.json();
              const igId = igData.instagram_business_account?.id;
              if (igId) {
                const igProfile = await fetch(`https://graph.facebook.com/v19.0/${igId}?fields=username,name,followers_count,media_count&access_token=${accessToken}`, { signal: AbortSignal.timeout(10000) });
                const igP = await igProfile.json();
                profileData = { platformUserId: igId, username: igP.username || 'unknown', displayName: igP.name || igP.username, followerCount: igP.followers_count || 0 };
              }
            }
          }
          break;
        }
        case 'tiktok': {
          const ttRes = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name,avatar_url,follower_count', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10000),
          });
          if (ttRes.ok) {
            const ttData = await ttRes.json();
            const user = ttData.data?.user;
            if (user) {
              profileData = { platformUserId: user.open_id, username: user.display_name, displayName: user.display_name, followerCount: user.follower_count || 0 };
            }
          }
          break;
        }
        case 'youtube': {
          const ytRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
            headers: { 'Authorization': `Bearer ${accessToken}` },
            signal: AbortSignal.timeout(10000),
          });
          if (ytRes.ok) {
            const ytData = await ytRes.json();
            const ch = ytData.items?.[0];
            if (ch) {
              profileData = { platformUserId: ch.id, username: ch.snippet?.title || 'unknown', displayName: ch.snippet?.title || 'unknown', followerCount: parseInt(ch.statistics?.subscriberCount || '0', 10) };
            }
          }
          break;
        }
      }
    } catch (e) {
      console.warn(`Failed to fetch ${platform} profile:`, e.message);
    }

    const [encAccessToken, encRefreshToken] = await Promise.all([
      encryptPosToken(accessToken),
      refreshToken ? encryptPosToken(refreshToken) : Promise.resolve(null),
    ]);

    const updateExpr = 'SET #s = :connected, platformUserId = :pid, username = :uname, displayName = :dname, followerCount = :fc, accessToken = :at, refreshToken = :rt, tokenExpiresAt = :texpr, tokenEncrypted = :enc, connectedAt = :now, updatedAt = :now REMOVE oauthState, codeVerifier, expiresAt, #ttl';

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${platform}` },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: { '#s': 'status', '#ttl': 'ttl' },
      ExpressionAttributeValues: {
        ':connected': 'connected',
        ':pid': profileData.platformUserId,
        ':uname': profileData.username,
        ':dname': profileData.displayName,
        ':fc': profileData.followerCount,
        ':at': encAccessToken,
        ':rt': encRefreshToken,
        ':texpr': expiresAt,
        ':enc': true,
        ':now': now,
      },
    }));

    return respond(200, {
      status: 'connected',
      platform,
      username: profileData.username,
      followerCount: profileData.followerCount,
    });
  } catch (err) {
    console.error('handleSocialCallback error:', err.message);
    return respond(500, { error: `Failed to complete ${platform} OAuth` });
  }
}

/**
 * GET /api/social/connections — List all social media connections for the creator
 */
async function listSocialConnections(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const results = await Promise.all(
    SOCIAL_PLATFORMS.map((p) =>
      ddb.send(new GetCommand({
        TableName: TABLE,
        Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${p}` },
      })).then((r) => r.Item ? stripDdbKeys(r.Item) : { platform: p, status: 'disconnected' })
        .catch(() => ({ platform: p, status: 'disconnected' }))
    )
  );

  return respond(200, results);
}

/**
 * GET /api/social/connection/{platform} — Get single social connection detail
 */
async function getSocialConnection(platform, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!SOCIAL_PLATFORMS.includes(platform)) return respond(400, { error: 'Invalid platform' });

  const result = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${platform}` },
  }));

  if (!result.Item) return respond(200, { platform, status: 'disconnected' });
  return respond(200, stripDdbKeys(result.Item));
}

/**
 * PUT /api/social/disconnect/{platform} — Disconnect a social media account
 */
async function disconnectSocial(platform, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!SOCIAL_PLATFORMS.includes(platform)) return respond(400, { error: 'Invalid platform' });

  const allowed = await checkUserMutationRate(userId, 'SOCIAL_DISCONNECT', 3);
  if (!allowed) return respond(429, { error: 'Too many disconnect attempts' });

  await ddb.send(new DeleteCommand({
    TableName: TABLE,
    Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${platform}` },
  }));

  return respond(200, { message: 'Social account disconnected', platform });
}

/**
 * POST /api/social/refresh/{platform} — Refresh an expired access token
 */
async function refreshSocialToken(platform, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!SOCIAL_PLATFORMS.includes(platform)) return respond(400, { error: 'Invalid platform' });

  if (!(await checkUserMutationRate(userId, 'REFRESH_TOKEN', 10))) {
    return respond(429, { error: 'Too many refresh attempts. Please try again later.' });
  }

  const conn = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${platform}` },
  }));

  if (!conn.Item || conn.Item.status !== 'connected') {
    return respond(400, { error: 'No connected account found' });
  }

  // Dev mode — no real refresh needed
  if (conn.Item.environment === 'development') {
    return respond(200, { message: 'Token refreshed (development)', platform });
  }

  if (!conn.Item.refreshToken) {
    return respond(400, { error: 'No refresh token available' });
  }

  try {
    const refreshToken = await decryptPosToken(conn.Item.refreshToken);
    const appId = getSocialAppIdEnvVar(platform);
    const appSecret = getSocialSecretEnvVar(platform);
    let tokenUrl, tokenBody;

    switch (platform) {
      case 'instagram':
        tokenUrl = 'https://graph.facebook.com/v19.0/oauth/access_token';
        tokenBody = new URLSearchParams({ grant_type: 'fb_exchange_token', client_id: appId, client_secret: appSecret, fb_exchange_token: refreshToken }).toString();
        break;
      case 'tiktok':
        tokenUrl = 'https://open.tiktokapis.com/v2/oauth/token/';
        tokenBody = new URLSearchParams({ client_key: appId, client_secret: appSecret, grant_type: 'refresh_token', refresh_token: refreshToken }).toString();
        break;
      case 'youtube':
        tokenUrl = 'https://oauth2.googleapis.com/token';
        tokenBody = new URLSearchParams({ client_id: appId, client_secret: appSecret, grant_type: 'refresh_token', refresh_token: refreshToken }).toString();
        break;
    }

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenBody,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return respond(400, { error: `Failed to refresh ${platform} token` });
    }

    const data = await res.json();
    const encToken = await encryptPosToken(data.access_token);
    const newRefresh = data.refresh_token ? await encryptPosToken(data.refresh_token) : conn.Item.refreshToken;
    const newExpiry = data.expires_in ? new Date(Date.now() + data.expires_in * 1000).toISOString() : conn.Item.tokenExpiresAt;

    await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${platform}` },
      UpdateExpression: 'SET accessToken = :at, refreshToken = :rt, tokenExpiresAt = :exp, updatedAt = :now',
      ExpressionAttributeValues: {
        ':at': encToken,
        ':rt': newRefresh,
        ':exp': newExpiry,
        ':now': new Date().toISOString(),
      },
    }));

    return respond(200, { message: 'Token refreshed', platform });
  } catch (err) {
    console.error('refreshSocialToken error:', err.message);
    return respond(500, { error: `Failed to refresh ${platform} token` });
  }
}

// ─── Content Review Extensions (Publishing & Metrics) ────────────────────────

/**
 * PUT /api/content-reviews/{reviewId}/publish — Mark approved content as published
 * Body: { publishedUrl, publishedAt? }
 */
async function markContentPublished(reviewId, event) {
  if (!isValidId(reviewId)) return respond(400, { error: 'Invalid review ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  if (!(await checkUserMutationRate(userId, 'PUBLISH_CONTENT', 20))) {
    return respond(429, { error: 'Too many publish attempts. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const publishedUrl = sanitize(body.publishedUrl, 500);
  if (!publishedUrl) return respond(400, { error: 'publishedUrl is required' });

  // Validate URL scheme — only allow https (or http for localhost dev)
  try {
    const parsed = new URL(publishedUrl);
    if (!['https:', 'http:'].includes(parsed.protocol)) {
      return respond(400, { error: 'publishedUrl must use https' });
    }
    if (parsed.protocol === 'http:' && !parsed.hostname.startsWith('localhost')) {
      return respond(400, { error: 'publishedUrl must use https' });
    }
  } catch {
    return respond(400, { error: 'publishedUrl must be a valid URL' });
  }

  const find = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `CREATOR#${userId}`,
      ':sk': `CONTENT_REVIEW#${reviewId}`,
    },
  }));

  if (!find.Items?.length) return respond(404, { error: 'Content review not found' });
  const existing = find.Items[0];

  if (existing.status !== 'approved') {
    return respond(400, { error: `Cannot publish from status '${existing.status}'. Must be approved first.` });
  }

  const now = new Date().toISOString();
  const gsi1sk = `published#${existing.createdAt}`;

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: existing.PK, SK: existing.SK },
    UpdateExpression: 'SET #s = :published, publishedUrl = :url, publishedAt = :pubAt, #u = :now, GSI1SK = :gsi1sk',
    ExpressionAttributeNames: { '#s': 'status', '#u': 'updatedAt' },
    ExpressionAttributeValues: {
      ':published': 'published',
      ':url': publishedUrl,
      ':pubAt': (body.publishedAt && !isNaN(new Date(sanitize(body.publishedAt, 30)).getTime())) ? sanitize(body.publishedAt, 30) : now,
      ':now': now,
      ':gsi1sk': gsi1sk,
    },
  }));

  await createNotification(
    existing.restaurantId,
    'content_review_approved',
    'Content Published',
    `Creator published ${existing.contentType} content on ${existing.platform}`,
    `/app/content-reviews/${reviewId}`,
    ''
  );

  return respond(200, { message: 'Content marked as published', reviewId });
}

/**
 * POST /api/content-reviews/{reviewId}/fetch-metrics — Fetch engagement metrics
 */
async function fetchContentMetrics(reviewId, event) {
  if (!isValidId(reviewId)) return respond(400, { error: 'Invalid review ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  if (!(await checkUserMutationRate(userId, 'FETCH_METRICS', 20))) {
    return respond(429, { error: 'Too many metric fetches. Please try again later.' });
  }

  const find = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `CREATOR#${userId}`,
      ':sk': `CONTENT_REVIEW#${reviewId}`,
    },
  }));

  if (!find.Items?.length) return respond(404, { error: 'Content review not found' });
  const existing = find.Items[0];

  if (existing.status !== 'published') {
    return respond(400, { error: 'Content must be published before fetching metrics' });
  }

  const now = new Date().toISOString();

  // Check if creator has a connected social account for this platform
  const socialConn = await ddb.send(new GetCommand({
    TableName: TABLE,
    Key: { PK: `CREATOR#${userId}`, SK: `SOCIAL_CONNECTION#${existing.platform}` },
  }));

  const isDevMode = !socialConn.Item || socialConn.Item.environment === 'development' || !getSocialSecretEnvVar(existing.platform);

  let metrics;
  if (isDevMode) {
    // Dev mode — return realistic mock metrics
    metrics = {
      likes: 500 + Math.floor(Math.random() * 5000),
      comments: 20 + Math.floor(Math.random() * 200),
      shares: 10 + Math.floor(Math.random() * 100),
      saves: 50 + Math.floor(Math.random() * 500),
      impressions: 5000 + Math.floor(Math.random() * 50000),
      reach: 3000 + Math.floor(Math.random() * 30000),
      views: 2000 + Math.floor(Math.random() * 40000),
    };
    metrics.engagementRate = parseFloat(((metrics.likes + metrics.comments + metrics.shares) / metrics.impressions * 100).toFixed(2));
  } else {
    // Production mode — fetch from platform API
    try {
      const accessToken = await decryptPosToken(socialConn.Item.accessToken);
      // Platform-specific API calls would go here
      // For now, return a placeholder that indicates production fetch
      metrics = { likes: 0, comments: 0, shares: 0, saves: 0, impressions: 0, reach: 0, views: 0, engagementRate: 0 };
      console.log(`Would fetch ${existing.platform} metrics with token for ${existing.publishedUrl}`);
    } catch (e) {
      console.error('Failed to fetch metrics:', e.message);
      return respond(500, { error: 'Failed to fetch metrics from platform' });
    }
  }

  // Store metrics on the content review
  const metricsHistory = existing.metricsHistory || [];
  metricsHistory.push({
    fetchedAt: now,
    likes: metrics.likes,
    comments: metrics.comments,
    shares: metrics.shares,
    impressions: metrics.impressions,
  });
  // Keep only last 20 snapshots
  if (metricsHistory.length > 20) metricsHistory.splice(0, metricsHistory.length - 20);

  await ddb.send(new UpdateCommand({
    TableName: TABLE,
    Key: { PK: existing.PK, SK: existing.SK },
    UpdateExpression: 'SET metrics = :m, metricsUpdatedAt = :now, metricsHistory = :mh, #u = :now',
    ExpressionAttributeNames: { '#u': 'updatedAt' },
    ExpressionAttributeValues: {
      ':m': metrics,
      ':now': now,
      ':mh': metricsHistory,
    },
  }));

  return respond(200, { metrics, metricsUpdatedAt: now, ...(isDevMode ? { mode: 'development' } : {}) });
}

/**
 * GET /api/content-reviews/{reviewId}/metrics — Get stored metrics
 */
async function getContentMetrics(reviewId, event) {
  if (!isValidId(reviewId)) return respond(400, { error: 'Invalid review ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Try creator's PK first
  let result = await ddb.send(new QueryCommand({
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND SK = :sk',
    ExpressionAttributeValues: {
      ':pk': `CREATOR#${userId}`,
      ':sk': `CONTENT_REVIEW#${reviewId}`,
    },
  }));

  let item = result.Items?.[0];

  if (!item) {
    // Fall back to GSI1 for restaurant access
    result = await ddb.send(new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: {
        ':pk': `RESTAURANT#${userId}#CONTENT_REVIEWS`,
      },
      Limit: 100,
    }));
    item = (result.Items || []).find((r) => r.reviewId === reviewId);
  }

  if (!item) return respond(404, { error: 'Content review not found' });

  return respond(200, {
    metrics: item.metrics || null,
    metricsUpdatedAt: item.metricsUpdatedAt || null,
    metricsHistory: item.metricsHistory || [],
  });
}

/**
 * PUT /api/proposals/expire — Expire stale proposals (7-day TTL).
 * Called periodically (could be EventBridge schedule).
 */
async function expireStaleProposals(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Rate limit: max 1 call per hour per user
  const allowed = await checkUserMutationRate(userId, 'EXPIRE_PROPOSALS', 1);
  if (!allowed) return respond(429, { error: 'Proposal expiration already ran recently. Try again later.' });

  // Find pending proposals older than 7 days for this user
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: '#s = :pending AND createdAt < :cutoff',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}`,
        ':prefix': 'PROPOSAL#',
        ':pending': 'pending',
        ':cutoff': sevenDaysAgo,
      },
      Limit: 50,
    })
  );

  const expiredItems = result.Items || [];
  let count = 0;

  // Process in batches of 10
  for (let i = 0; i < expiredItems.length; i += 10) {
    const batch = expiredItems.slice(i, i + 10);
    await Promise.all(batch.map(async (proposal) => {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: proposal.PK, SK: proposal.SK },
          UpdateExpression: 'SET #s = :expired, updatedAt = :now',
          ExpressionAttributeNames: { '#s': 'status' },
          ExpressionAttributeValues: {
            ':expired': 'expired',
            ':now': new Date().toISOString(),
          },
        })
      );

      // Notify the initiator
      await createNotification(
        proposal.initiatorId,
        'proposal_expiring',
        'Proposal Expired',
        `Your proposal has expired after 7 days without a response.`,
        '/app/proposals',
        ''
      );
      count++;
    }));
  }

  return respond(200, { message: `Expired ${count} stale proposals`, count });
}

// ─── Content Archive ─────────────────────────────────────────────────────────

async function listContent(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `CREATOR#${userId}`,
          ':prefix': 'CONTENT#',
        },
        Limit: 200,
        ScanIndexForward: false, // most recent first
      })
    );
    return respond(200, stripAll(result.Items || []));
  } catch (err) {
    console.error('listContent error:', err.message);
    return respond(500, { error: 'Failed to load content' });
  }
}

async function createContent(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'CREATE_CONTENT', 50))) {
    return respond(429, { error: 'Too many content items. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const id = randomUUID();
  const platform = ['instagram', 'tiktok', 'youtube'].includes(body.platform) ? body.platform : 'instagram';
  const restaurantName = sanitize(body.restaurantName, 200);
  if (!restaurantName) return respond(400, { error: 'Restaurant name is required' });

  const item = {
    PK: `CREATOR#${userId}`,
    SK: `CONTENT#${id}`,
    contentId: id,
    platform,
    restaurantName,
    caption: sanitize(body.caption || '', 1000),
    reach: Number(body.reach) || 0,
    likes: Number(body.likes) || 0,
    comments: Number(body.comments) || 0,
    saves: Number(body.saves) || 0,
    shares: Number(body.shares) || 0,
    postDate: body.postDate || new Date().toISOString().split('T')[0],
    tags: Array.isArray(body.tags) ? body.tags.slice(0, 10).map(t => sanitize(t, 50)) : [],
    campaignId: body.campaignId && isValidId(body.campaignId) ? body.campaignId : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return respond(201, stripDdbKeys(item));
  } catch (err) {
    console.error('createContent error:', err.message);
    return respond(500, { error: 'Failed to create content' });
  }
}

// ─── Editorial Calendar ──────────────────────────────────────────────────────

async function listCalendarSlots(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  try {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `CREATOR#${userId}`,
          ':prefix': 'CALSLOT#',
        },
        Limit: 200,
      })
    );
    return respond(200, stripAll(result.Items || []));
  } catch (err) {
    console.error('listCalendarSlots error:', err.message);
    return respond(500, { error: 'Failed to load calendar' });
  }
}

async function createCalendarSlot(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const slotId = randomUUID();
  const date = sanitize(body.date, 10);
  const restaurantName = sanitize(body.restaurantName, 200);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return respond(400, { error: 'Invalid date format (YYYY-MM-DD)' });
  if (!restaurantName) return respond(400, { error: 'Restaurant name is required' });

  const type = ['sponsored', 'organic', 'reshoot'].includes(body.type) ? body.type : 'organic';
  const status = ['planned', 'shot', 'editing', 'published'].includes(body.status) ? body.status : 'planned';

  const item = {
    PK: `CREATOR#${userId}`,
    SK: `CALSLOT#${slotId}`,
    slotId,
    date,
    restaurantName,
    type,
    status,
    notes: sanitize(body.notes || '', 500),
    campaignId: body.campaignId && isValidId(body.campaignId) ? body.campaignId : undefined,
    createdAt: new Date().toISOString(),
  };

  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    return respond(201, stripDdbKeys(item));
  } catch (err) {
    console.error('createCalendarSlot error:', err.message);
    return respond(500, { error: 'Failed to create slot' });
  }
}

async function updateCalendarSlot(slotId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(slotId)) return respond(400, { error: 'Invalid slot ID' });

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const allowed = ['date', 'restaurantName', 'type', 'status', 'notes', 'campaignId'];
  const updates = [];
  const names = {};
  const values = {};

  for (const field of allowed) {
    if (body[field] !== undefined) {
      const alias = `#f${updates.length}`;
      const valAlias = `:v${updates.length}`;
      names[alias] = field;
      if (field === 'date') {
        const d = sanitize(body.date, 10);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return respond(400, { error: 'Invalid date' });
        values[valAlias] = d;
      } else if (field === 'type') {
        values[valAlias] = ['sponsored', 'organic', 'reshoot'].includes(body.type) ? body.type : 'organic';
      } else if (field === 'status') {
        values[valAlias] = ['planned', 'shot', 'editing', 'published'].includes(body.status) ? body.status : 'planned';
      } else if (field === 'campaignId') {
        values[valAlias] = isValidId(body.campaignId) ? body.campaignId : null;
      } else {
        values[valAlias] = sanitize(String(body[field]), field === 'notes' ? 500 : 200);
      }
      updates.push(`${alias} = ${valAlias}`);
    }
  }

  if (updates.length === 0) return respond(400, { error: 'No valid fields to update' });

  values[':now'] = new Date().toISOString();
  names['#ua'] = 'updatedAt';
  updates.push('#ua = :now');

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `CREATOR#${userId}`, SK: `CALSLOT#${slotId}` },
        UpdateExpression: `SET ${updates.join(', ')}`,
        ExpressionAttributeNames: names,
        ExpressionAttributeValues: values,
        ConditionExpression: 'attribute_exists(PK)',
      })
    );
    return respond(200, { message: 'Slot updated' });
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return respond(404, { error: 'Slot not found' });
    console.error('updateCalendarSlot error:', err.message);
    return respond(500, { error: 'Failed to update slot' });
  }
}

async function deleteCalendarSlot(slotId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(slotId)) return respond(400, { error: 'Invalid slot ID' });

  try {
    await ddb.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `CREATOR#${userId}`, SK: `CALSLOT#${slotId}` },
        ConditionExpression: 'attribute_exists(PK)',
      })
    );
    return respond(200, { message: 'Slot deleted' });
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') return respond(404, { error: 'Slot not found' });
    console.error('deleteCalendarSlot error:', err.message);
    return respond(500, { error: 'Failed to delete slot' });
  }
}

// ─── Insider Deals ───────────────────────────────────────────────────────────

async function listDeals(event) {
  // Rate limit public endpoint to prevent scraping
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': 'DEALS' },
      Limit: 50, // Cap to prevent unbounded reads
    })
  );

  return respond(200, stripAll(result.Items || []));
}

async function redeemDeal(dealId, event) {
  if (!isValidId(dealId)) return respond(400, { error: 'Invalid deal ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Rate limit deal redemptions per user (reuse AI rate limiter pattern — 20 redemptions/hour)
  const hour = Math.floor(Date.now() / 3600000);
  try {
    const rateResult = await ddb.send(new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `RATE#DEAL#${userId}`, SK: `HR#${hour}` },
      UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, #ttl = :ttl',
      ExpressionAttributeNames: { '#c': 'cnt', '#ttl': 'ttl' },
      ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':ttl': Math.floor(Date.now() / 1000) + 7200 },
      ReturnValues: 'ALL_NEW',
    }));
    if ((rateResult.Attributes?.cnt || 0) > 20) {
      return respond(429, { error: 'Too many redemptions. Please try again later.' });
    }
  } catch (err) {
    console.error('Deal rate limit check failed:', err.message);
    return respond(503, { error: 'Service temporarily unavailable. Please try again.' });
  }

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
  if (!(await checkUserMutationRate(userId, 'SAVE_REST', 60))) {
    return respond(429, { error: 'Too many save operations. Please try again later.' });
  }

  try {
    await ddb.send(
      new DeleteCommand({
        TableName: TABLE,
        Key: { PK: `AUDIENCE#${userId}`, SK: `SAVE#${restaurantId}` },
      })
    );
    return respond(200, { message: 'Removed' });
  } catch (err) {
    console.error('removeSave error:', err.message);
    return respond(500, { error: 'Failed to remove save' });
  }
}

async function updateSaveNotes(restaurantId, event) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'SAVE_REST', 60))) {
    return respond(429, { error: 'Too many save operations. Please try again later.' });
  }
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  try {
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
  } catch (err) {
    console.error('updateSaveNotes error:', err.message);
    return respond(500, { error: 'Failed to update notes' });
  }
}

// ─── Google Places JIT ───────────────────────────────────────────────────────

async function getGoogleDetails(restaurantId, event) {
  if (!isValidId(restaurantId)) return respond(400, { error: 'Invalid ID' });

  // Rate limit — stricter than default (10 req / 5 min per IP) to protect paid API
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  // Get restaurant to find googlePlaceId — only allow lookups for known restaurants
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
  if (!googleKey) return respond(503, { error: 'Service temporarily unavailable' });

  const fields = 'displayName,formattedAddress,regularOpeningHours,rating,priceLevel,photos,websiteUri,nationalPhoneNumber,reviews,userRatingCount';
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

  if (!res.ok) return respond(502, { error: 'External service error' });
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

// ─── Google Places Autocomplete (for restaurant onboarding) ─────────────────

async function placesAutocomplete(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  // Rate limit to protect paid API (20 req / 5 min per user)
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  const qs = event.queryStringParameters || {};
  const query = (qs.query || '').trim();
  if (!query || query.length < 2) return respond(400, { error: 'Query too short' });

  const secrets = await getApiSecrets();
  const googleKey = secrets.GOOGLE_PLACES_API_KEY;
  if (!googleKey) return respond(503, { error: 'Service temporarily unavailable' });

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.types',
      },
      body: JSON.stringify({
        textQuery: query,
        includedType: 'restaurant',
        locationBias: {
          circle: {
            center: { latitude: 38.9072, longitude: -77.0369 }, // DC area
            radius: 50000,
          },
        },
        maxResultCount: 5,
      }),
    });

    if (!res.ok) return respond(502, { error: 'External service error' });
    const data = await res.json();

    // Return minimal data to client
    const results = (data.places || []).map(p => ({
      placeId: p.id,
      name: p.displayName?.text || '',
      address: p.formattedAddress || '',
    }));

    return respond(200, { results });
  } catch (err) {
    console.error('Places autocomplete error:', err);
    return respond(502, { error: 'External service error' });
  }
}

async function placesDetails(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  const qs = event.queryStringParameters || {};
  const placeId = (qs.placeId || '').trim();
  if (!placeId) return respond(400, { error: 'placeId is required' });

  // Check cache first
  const cacheKey = { PK: `GOOGLE_CACHE#${placeId}`, SK: 'DETAILS' };
  const cached = await ddb.send(new GetCommand({ TableName: TABLE, Key: cacheKey }));

  if (cached.Item && cached.Item.ttl > Math.floor(Date.now() / 1000)) {
    return respond(200, cached.Item.data);
  }

  const secrets = await getApiSecrets();
  const googleKey = secrets.GOOGLE_PLACES_API_KEY;
  if (!googleKey) return respond(503, { error: 'Service temporarily unavailable' });

  const fields = 'displayName,formattedAddress,regularOpeningHours,rating,priceLevel,photos,websiteUri,nationalPhoneNumber,reviews,userRatingCount,location,types';
  try {
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

    if (!res.ok) return respond(502, { error: 'External service error' });
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
  } catch (err) {
    console.error('Places details error:', err);
    return respond(502, { error: 'External service error' });
  }
}

// ─── Email Subscribe ──────────────────────────────────────────────────────────

async function subscribe(event) {
  // Rate limit public endpoint
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const email = sanitize(body.email, 200).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(400, { error: 'Invalid email' });

  try {
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
  } catch (err) {
    console.error('subscribe error:', err.message);
    return respond(500, { error: 'Failed to subscribe' });
  }
}

async function unsubscribe(event) {
  // Rate limit public endpoint
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });
  const email = sanitize(body.email, 200).toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(400, { error: 'Invalid email' });

  try {
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
  } catch (err) {
    console.error('unsubscribe error:', err.message);
    return respond(500, { error: 'Failed to unsubscribe' });
  }
}

// ─── Creator Profile ────────────────────────────────────────────────────────

async function getProfile(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  try {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `CREATOR#${userId}`, SK: 'PROFILE' },
      })
    );

    if (!result.Item) return respond(404, { error: 'Profile not found' });
    return respond(200, stripDdbKeys(result.Item));
  } catch (err) {
    console.error('getProfile error:', err.message);
    return respond(500, { error: 'Failed to load profile' });
  }
}

async function upsertProfile(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'PROFILE_UPDATE', 20))) {
    return respond(429, { error: 'Too many profile updates. Please try again later.' });
  }
  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const now = new Date();
  const item = {
    PK: `CREATOR#${userId}`,
    SK: 'PROFILE',
    GSI1PK: 'CREATORS',
    GSI1SK: `CREATOR#${userId}`,
    GSI3PK: 'USERS',
    GSI3SK: now.toISOString(),
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
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
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

  // Check if this creator is already a collaborator (prevent duplicate invites)
  const alreadyCollab = (collabCount.Items || []).find(c => c.SK === `COLLAB#${inviteeId}`);
  if (alreadyCollab) {
    return respond(409, { error: 'This creator is already a collaborator on this campaign' });
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

  // H19: Strip sensitive financial and internal fields from collaborator-visible campaigns
  const safeCampaigns = stripAll(acceptedCampaigns).map(c => {
    const { budget, activity, internalNotes, ...safe } = c;
    return safe;
  });
  return respond(200, safeCampaigns);
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

  // Verify the collaborator actually exists before deleting — prevents confusing 200 on no-op
  const collabCheck = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `CAMPAIGN#${campaignId}`, SK: `COLLAB#${creatorId}` },
      ProjectionExpression: 'PK',
    })
  );
  if (!collabCheck.Item) {
    return respond(404, { error: 'Collaborator not found on this campaign' });
  }

  // Atomic delete of both records — prevents orphaned invite if first delete succeeds but second fails
  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE,
            Key: { PK: `CAMPAIGN#${campaignId}`, SK: `COLLAB#${creatorId}` },
          },
        },
        {
          Delete: {
            TableName: TABLE,
            Key: { PK: `CREATOR#${creatorId}`, SK: `COLLAB_INVITE#${campaignId}` },
          },
        },
      ],
    })
  );

  return respond(200, { message: 'Collaborator removed' });
}

// ─── Proposals (Handshake Model) ─────────────────────────────────────────────

const VALID_PROPOSAL_TYPES = ['deal', 'campaign', 'qr_code', 'content_review'];
const VALID_PROPOSAL_STATUSES = ['pending', 'accepted', 'countered', 'declined', 'expired'];
const VALID_INITIATORS = ['creator', 'restaurant'];

/**
 * POST /api/proposals — Create a new proposal (either party).
 * Body: { proposalType, initiatedBy, initiatorId, targetId, terms, targetName? }
 */
async function createProposal(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'CREATE_PROP', 20))) {
    return respond(429, { error: 'Too many proposals. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const proposalType = sanitize(body.proposalType, 30);
  const targetId = sanitize(body.targetId, 128);

  if (!VALID_PROPOSAL_TYPES.includes(proposalType))
    return respond(400, { error: `Invalid proposalType. Must be one of: ${VALID_PROPOSAL_TYPES.join(', ')}` });
  if (!targetId || !isValidId(targetId))
    return respond(400, { error: 'Invalid targetId' });

  // H20: Verify target exists before creating proposal (prevents enumeration + spam)
  // Target can be either a creator (CREATOR#id) or a restaurant (RESTAURANT#id)
  let targetCheck = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `CREATOR#${targetId}`, SK: 'PROFILE' }, ProjectionExpression: 'PK' })
  );
  if (!targetCheck.Item) {
    // Also check if target is a restaurant
    targetCheck = await ddb.send(
      new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${targetId}`, SK: 'PROFILE' }, ProjectionExpression: 'PK' })
    );
  }
  if (!targetCheck.Item) {
    // Return generic 400 to prevent user enumeration
    return respond(400, { error: 'Invalid target' });
  }

  // Determine initiatedBy from caller identity — never trust user-supplied role.
  // Check if the caller is a restaurant listing creator for the targetId's restaurant context.
  // If they own a restaurant matching the context, they're acting as restaurant; otherwise creator.
  let initiatedBy = 'creator'; // default: authenticated users are creators
  const requestedRole = sanitize(body.initiatedBy || 'creator', 20);
  if (requestedRole === 'restaurant' && body.restaurantId) {
    const restId = sanitize(body.restaurantId, 64);
    if (restId && isValidId(restId)) {
      const restCheck = await ddb.send(
        new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
      );
      if (restCheck.Item?.creatorId === userId) {
        initiatedBy = 'restaurant';
      } else {
        return respond(403, { error: 'You are not authorized to initiate proposals as this restaurant' });
      }
    }
  }

  // Per-target rate limit: max 3 pending proposals to the same target
  const existingToTarget = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      FilterExpression: 'initiatorId = :uid',
      ExpressionAttributeValues: {
        ':pk': `PROPOSAL#PENDING#${targetId}`,
        ':uid': userId,
      },
      Select: 'COUNT',
      Limit: 10,
    })
  );
  if ((existingToTarget.Count || 0) >= 3) {
    return respond(429, { error: 'You already have 3 pending proposals to this recipient. Wait for a response before sending more.' });
  }

  // Validate terms — flexible JSON but cap size
  const terms = body.terms && typeof body.terms === 'object' ? body.terms : {};
  const termsStr = JSON.stringify(terms);
  if (termsStr.length > 5000)
    return respond(400, { error: 'Terms object too large (max 5KB)' });

  const proposalId = randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  const ttl = Math.floor(Date.now() / 1000) + (37 * 24 * 60 * 60); // cleanup after 37 days

  // PK is the initiator, so they can query "my sent proposals"
  const initiatorPrefix = initiatedBy === 'creator' ? 'CREATOR' : 'RESTAURANT';
  const targetPrefix = initiatedBy === 'creator' ? 'RESTAURANT' : 'CREATOR';

  const item = {
    PK: `${initiatorPrefix}#${userId}`,
    SK: `PROPOSAL#${proposalId}`,
    // GSI1: target can query their own copy by target+proposal
    GSI1PK: `${targetPrefix}#${targetId}#PROPOSALS`,
    GSI1SK: `PROPOSAL#${proposalId}`,
    // GSI2: inbox for pending proposals (target sees these)
    GSI2PK: `PROPOSAL#PENDING#${targetId}`,
    GSI2SK: now,
    proposalId,
    proposalType,
    initiatedBy,
    initiatorId: userId,
    targetId,
    initiatorName: sanitize(body.initiatorName || '', 200),
    targetName: sanitize(body.targetName || '', 200),
    status: 'pending',
    terms,
    counterTerms: null,
    expiresAt,
    messages: [],
    createdAt: now,
    updatedAt: now,
    ttl,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return respond(201, stripDdbKeys(item));
}

/**
 * GET /api/proposals/inbox — Pending proposals targeting current user.
 * Query: ?role=creator|restaurant
 */
async function listProposalInbox(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(params.limit) || 25, 1), 100);

  const nowISO = new Date().toISOString();
  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk',
      FilterExpression: 'attribute_not_exists(expiresAt) OR expiresAt > :now',
      ExpressionAttributeValues: {
        ':pk': `PROPOSAL#PENDING#${userId}`,
        ':now': nowISO,
      },
      ScanIndexForward: false, // newest first
      Limit: limit,
    })
  );

  return respond(200, {
    proposals: stripAll(result.Items || []),
    count: result.Count || 0,
  });
}

/**
 * GET /api/proposals/sent — Proposals initiated by current user.
 * Query: ?role=creator|restaurant
 */
async function listProposalSent(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(params.limit) || 25, 1), 100);

  // Query both creator and restaurant PKs in parallel
  const [result, restResult] = await Promise.all([
    ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `CREATOR#${userId}`,
          ':skPrefix': 'PROPOSAL#',
        },
        ScanIndexForward: false,
        Limit: limit,
      })
    ),
    ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `RESTAURANT#${userId}`,
          ':skPrefix': 'PROPOSAL#',
        },
        ScanIndexForward: false,
        Limit: limit,
      })
    ),
  ]);

  const all = [...(result.Items || []), ...(restResult.Items || [])];
  all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  return respond(200, {
    proposals: stripAll(all.slice(0, limit)),
    count: all.length,
  });
}

/**
 * GET /api/proposals/:id — Get a single proposal by ID.
 */
async function getProposal(proposalId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(proposalId)) return respond(400, { error: 'Invalid proposal ID' });

  // Try finding as initiator (creator or restaurant PK)
  for (const prefix of ['CREATOR', 'RESTAURANT']) {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `${prefix}#${userId}`, SK: `PROPOSAL#${proposalId}` },
      })
    );
    if (result.Item) return respond(200, stripDdbKeys(result.Item));
  }

  // Try finding as target via GSI1
  for (const prefix of ['CREATOR', 'RESTAURANT']) {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `${prefix}#${userId}#PROPOSALS`,
          ':sk': `PROPOSAL#${proposalId}`,
        },
      })
    );
    if (result.Items?.length) return respond(200, stripDdbKeys(result.Items[0]));
  }

  return respond(404, { error: 'Proposal not found' });
}

/**
 * Helper: Find a proposal and verify the user is the target (for accept/counter/decline).
 */
async function findProposalAsTarget(proposalId, userId) {
  for (const prefix of ['CREATOR', 'RESTAURANT']) {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        IndexName: 'GSI1',
        KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
        ExpressionAttributeValues: {
          ':pk': `${prefix}#${userId}#PROPOSALS`,
          ':sk': `PROPOSAL#${proposalId}`,
        },
      })
    );
    if (result.Items?.length) return result.Items[0];
  }
  return null;
}

/**
 * PUT /api/proposals/:id/accept — Target accepts a proposal.
 */
async function acceptProposal(proposalId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(proposalId)) return respond(400, { error: 'Invalid proposal ID' });
  if (!(await checkUserMutationRate(userId, 'PROP_ACTION', 60))) {
    return respond(429, { error: 'Too many proposal actions. Please try again later.' });
  }

  const proposal = await findProposalAsTarget(proposalId, userId);
  if (!proposal) return respond(404, { error: 'Proposal not found' });
  if (proposal.status !== 'pending' && proposal.status !== 'countered')
    return respond(400, { error: `Cannot accept a proposal with status "${proposal.status}"` });

  // Check if proposal has expired
  if (proposal.expiresAt && new Date(proposal.expiresAt) < new Date()) {
    return respond(410, { error: 'This proposal has expired and can no longer be accepted' });
  }

  const now = new Date().toISOString();
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: proposal.PK, SK: proposal.SK },
        UpdateExpression: 'SET #s = :status, updatedAt = :now, acceptedAt = :now, GSI2PK = :g2pk, GSI2SK = :g2sk',
        // Atomic guard: only accept if still pending/countered and not expired
        ConditionExpression: '#s IN (:pending, :countered) AND (attribute_not_exists(expiresAt) OR expiresAt > :now)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':status': 'accepted',
          ':pending': 'pending',
          ':countered': 'countered',
          ':now': now,
          ':g2pk': `PROPOSAL#ACCEPTED#${proposal.targetId}`,
          ':g2sk': now,
        },
      })
    );
  } catch (condErr) {
    if (condErr.name === 'ConditionalCheckFailedException') {
      return respond(409, { error: 'Proposal was already actioned or has expired (concurrent request)' });
    }
    throw condErr;
  }

  // Notify initiator their proposal was accepted
  await createNotification(
    proposal.initiatorId,
    'proposal_accepted',
    'Proposal Accepted!',
    `Your ${proposal.proposalType || 'deal'} proposal has been accepted.`,
    '/app/proposals',
    ''
  );
  await sendNotificationEmail(
    proposal.initiatorId,
    'Proposal Accepted!',
    `Your ${proposal.proposalType || 'deal'} proposal has been accepted! Log in to see the details and next steps.`
  );

  return respond(200, { message: 'Proposal accepted', proposalId, status: 'accepted' });
}

/**
 * PUT /api/proposals/:id/counter — Target counters with modified terms.
 * Body: { counterTerms: {...} }
 */
async function counterProposal(proposalId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(proposalId)) return respond(400, { error: 'Invalid proposal ID' });
  if (!(await checkUserMutationRate(userId, 'PROP_ACTION', 60))) {
    return respond(429, { error: 'Too many proposal actions. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const counterTerms = body.counterTerms && typeof body.counterTerms === 'object' ? body.counterTerms : null;
  if (!counterTerms) return respond(400, { error: 'counterTerms object is required' });
  if (JSON.stringify(counterTerms).length > 5000)
    return respond(400, { error: 'counterTerms too large (max 5KB)' });

  const proposal = await findProposalAsTarget(proposalId, userId);
  if (!proposal) return respond(404, { error: 'Proposal not found' });
  if (proposal.status !== 'pending' && proposal.status !== 'countered')
    return respond(400, { error: `Cannot counter a proposal with status "${proposal.status}"` });

  const now = new Date().toISOString();
  const message = {
    from: userId,
    text: `Counter-offer submitted`,
    timestamp: now,
  };

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: proposal.PK, SK: proposal.SK },
      UpdateExpression: 'SET #s = :status, counterTerms = :ct, updatedAt = :now, messages = list_append(if_not_exists(messages, :empty), :msg)',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: {
        ':status': 'countered',
        ':ct': counterTerms,
        ':now': now,
        ':msg': [message],
        ':empty': [],
      },
    })
  );

  return respond(200, { message: 'Counter-offer submitted', proposalId, status: 'countered' });
}

/**
 * PUT /api/proposals/:id/decline — Target declines a proposal.
 * Body: { reason?: string }
 */
async function declineProposal(proposalId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(proposalId)) return respond(400, { error: 'Invalid proposal ID' });
  if (!(await checkUserMutationRate(userId, 'PROP_ACTION', 60))) {
    return respond(429, { error: 'Too many proposal actions. Please try again later.' });
  }

  const body = parseBody(event) || {};
  const reason = sanitize(body.reason || '', 500);

  const proposal = await findProposalAsTarget(proposalId, userId);
  if (!proposal) return respond(404, { error: 'Proposal not found' });
  if (proposal.status === 'declined' || proposal.status === 'accepted')
    return respond(400, { error: `Cannot decline a proposal with status "${proposal.status}"` });

  const now = new Date().toISOString();
  const updateExpr = reason
    ? 'SET #s = :status, updatedAt = :now, declineReason = :reason, GSI2PK = :g2pk, GSI2SK = :g2sk'
    : 'SET #s = :status, updatedAt = :now, GSI2PK = :g2pk, GSI2SK = :g2sk';

  const exprValues = {
    ':status': 'declined',
    ':now': now,
    ':g2pk': `PROPOSAL#DECLINED#${proposal.targetId}`,
    ':g2sk': now,
  };
  if (reason) exprValues[':reason'] = reason;

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: proposal.PK, SK: proposal.SK },
      UpdateExpression: updateExpr,
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: exprValues,
    })
  );

  // Notify initiator their proposal was declined
  await createNotification(
    proposal.initiatorId,
    'proposal_declined',
    'Proposal Declined',
    reason ? `Your proposal was declined: "${reason}"` : 'Your proposal was declined.',
    '/app/proposals',
    ''
  );

  return respond(200, { message: 'Proposal declined', proposalId, status: 'declined' });
}

/**
 * POST /api/proposals/:id/message — Add a negotiation message.
 * Body: { text: string }
 */
async function addProposalMessage(proposalId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(proposalId)) return respond(400, { error: 'Invalid proposal ID' });
  if (!(await checkUserMutationRate(userId, 'PROP_MSG', 60))) {
    return respond(429, { error: 'Too many messages. Please slow down.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const text = sanitize(body.text, 1000);
  if (!text) return respond(400, { error: 'Message text is required (max 1000 chars)' });

  // Find the proposal — user could be initiator or target
  let proposal = null;
  for (const prefix of ['CREATOR', 'RESTAURANT']) {
    const result = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `${prefix}#${userId}`, SK: `PROPOSAL#${proposalId}` },
      })
    );
    if (result.Item) { proposal = result.Item; break; }
  }
  if (!proposal) {
    proposal = await findProposalAsTarget(proposalId, userId);
  }
  if (!proposal) return respond(404, { error: 'Proposal not found' });
  if (proposal.status === 'declined' || proposal.status === 'expired')
    return respond(400, { error: 'Cannot message on a closed proposal' });

  // Cap at 100 messages per proposal
  if ((proposal.messages || []).length >= 100)
    return respond(400, { error: 'Message limit reached for this proposal' });

  const now = new Date().toISOString();
  const message = { from: userId, text, timestamp: now };

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: proposal.PK, SK: proposal.SK },
      UpdateExpression: 'SET messages = list_append(if_not_exists(messages, :empty), :msg), updatedAt = :now',
      ExpressionAttributeValues: {
        ':msg': [message],
        ':empty': [],
        ':now': now,
      },
    })
  );

  return respond(200, { message: 'Message added', proposalId });
}

// ─── Offer Mutual Approval ────────────────────────────────────────────────────

/**
 * PUT /api/offers/{id}/submit-for-approval — Creator submits offer for restaurant approval.
 * Adds creatorTerms, sets approvalStatus to 'pending_restaurant'.
 */
async function submitOfferForApproval(offerId, event) {
  if (!isValidId(offerId)) return respond(400, { error: 'Invalid offer ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'OFFER_APPROVE', 30))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  // Find offer owned by user
  const ownerResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#OFFERS`,
        ':sk': `OFFER#${offerId}`,
      },
      Limit: 1,
    })
  );
  if (!ownerResult.Items?.length) return respond(404, { error: 'Offer not found' });
  const offer = ownerResult.Items[0];

  // Validate terms
  const terms = body.creatorTerms;
  if (!terms || !terms.discountType) {
    return respond(400, { error: 'Creator terms with discountType are required' });
  }
  const VALID_DISCOUNT_TYPES = ['percent', 'fixed', 'freeItem'];
  if (!VALID_DISCOUNT_TYPES.includes(terms.discountType)) {
    return respond(400, { error: 'Invalid discount type' });
  }

  const creatorTerms = {
    discountType: terms.discountType,
    discountValue: Math.max(0, Math.min(Number(terms.discountValue) || 0, 100)),
    freeItemDescription: terms.freeItemDescription ? sanitize(terms.freeItemDescription, 200) : undefined,
    maxRedemptions: terms.maxRedemptions ? Math.max(1, Math.min(Number(terms.maxRedemptions), 100000)) : undefined,
    blackoutDates: Array.isArray(terms.blackoutDates) ? terms.blackoutDates.slice(0, 30).map(d => sanitize(d, 12)) : [],
    validDays: Array.isArray(terms.validDays) ? terms.validDays.filter(d => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(d)) : [],
    minSpend: terms.minSpend ? Math.max(0, Number(terms.minSpend)) : undefined,
    notes: terms.notes ? sanitize(terms.notes, 500) : undefined,
  };

  const nowISO = new Date().toISOString();
  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: offer.PK, SK: offer.SK },
      UpdateExpression: 'SET approvalStatus = :status, creatorTerms = :terms, updatedAt = :now',
      ExpressionAttributeValues: {
        ':status': 'pending_restaurant',
        ':terms': creatorTerms,
        ':now': nowISO,
      },
    })
  );

  // Create notification for restaurant
  await createNotification(
    offer.restaurantId,
    'offer_approval_requested',
    'New Deal Awaiting Your Approval',
    `A creator has submitted a ${creatorTerms.discountType === 'percent' ? creatorTerms.discountValue + '% off' : creatorTerms.discountType === 'freeItem' ? 'free item' : '$' + creatorTerms.discountValue + ' off'} deal for your approval.`,
    `/app/partner/offers`,
    offer.restaurantName
  );

  return respond(200, { message: 'Offer submitted for restaurant approval', offerId, approvalStatus: 'pending_restaurant' });
}

/**
 * PUT /api/offers/{id}/approve — Restaurant approves (or sets own terms on) an offer.
 */
async function approveOffer(offerId, event) {
  if (!isValidId(offerId)) return respond(400, { error: 'Invalid offer ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'OFFER_APPROVE', 30))) {
    return respond(429, { error: 'Too many requests.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const restaurantId = sanitize(body.restaurantId, 64);
  if (!restaurantId || !isValidId(restaurantId)) return respond(400, { error: 'restaurantId is required' });

  // Find the offer
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: `OFFER#${offerId}` },
    })
  );
  const offer = result?.Item;
  if (!offer) return respond(404, { error: 'Offer not found' });

  // H16: Verify body.restaurantId matches the offer's actual restaurantId to prevent identity spoofing
  if (offer.restaurantId && offer.restaurantId !== restaurantId) {
    return respond(403, { error: 'Restaurant ID does not match offer record' });
  }

  // Only the restaurant's listing creator can approve — creators must NOT self-approve their own offers.
  // This prevents the attack where a creator submits an offer then immediately approves it themselves.
  const restCheck = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  const isRestaurantRep = restCheck.Item?.creatorId === userId;
  if (!isRestaurantRep) {
    return respond(403, { error: 'Only the restaurant representative can approve offers' });
  }

  if (offer.approvalStatus !== 'pending_restaurant') {
    return respond(400, { error: 'This offer is not pending restaurant approval' });
  }

  const nowISO = new Date().toISOString();
  // H22: Bound all numeric fields to prevent Infinity/NaN injection
  const safeNum = (v, fallback, min, max) => {
    const n = Number(v ?? fallback ?? 0);
    return Number.isFinite(n) ? Math.max(min, Math.min(n, max)) : fallback ?? 0;
  };
  const restaurantTerms = body.restaurantTerms ? {
    discountType: body.restaurantTerms.discountType || offer.creatorTerms?.discountType,
    discountValue: safeNum(body.restaurantTerms.discountValue, offer.creatorTerms?.discountValue, 0, 100),
    maxRedemptions: body.restaurantTerms.maxRedemptions
      ? safeNum(body.restaurantTerms.maxRedemptions, offer.creatorTerms?.maxRedemptions, 1, 100000)
      : offer.creatorTerms?.maxRedemptions,
    blackoutDates: Array.isArray(body.restaurantTerms.blackoutDates) ? body.restaurantTerms.blackoutDates.slice(0, 30) : offer.creatorTerms?.blackoutDates,
    validDays: Array.isArray(body.restaurantTerms.validDays) ? body.restaurantTerms.validDays.slice(0, 7) : offer.creatorTerms?.validDays,
    minSpend: body.restaurantTerms.minSpend != null
      ? safeNum(body.restaurantTerms.minSpend, 0, 0, 10000)
      : offer.creatorTerms?.minSpend,
    notes: body.restaurantTerms.notes ? sanitize(body.restaurantTerms.notes, 500) : undefined,
  } : offer.creatorTerms;

  // Conditional update prevents duplicate approvals from concurrent requests
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: offer.PK, SK: offer.SK },
        UpdateExpression: 'SET approvalStatus = :status, restaurantTerms = :terms, mutuallyApproved = :approved, approvedAt = :now, updatedAt = :now',
        ConditionExpression: 'approvalStatus = :pending',
        ExpressionAttributeValues: {
          ':status': 'approved',
          ':terms': restaurantTerms,
          ':approved': true,
          ':now': nowISO,
          ':pending': 'pending_restaurant',
        },
      })
    );
  } catch (condErr) {
    if (condErr.name === 'ConditionalCheckFailedException') {
      return respond(409, { error: 'This offer has already been processed' });
    }
    throw condErr;
  }

  // Notify the creator
  await createNotification(
    offer.creatorId,
    'offer_approved',
    'Deal Approved!',
    `${offer.restaurantName} approved your deal. QR code is now live!`,
    `/app/offers`,
    offer.restaurantName
  );

  // Send email to creator
  await sendNotificationEmail(
    offer.creatorId,
    'Deal Approved!',
    `Great news! ${offer.restaurantName} has approved your deal "${offer.description}". The QR code is now live and ready to share.`
  );

  return respond(200, { message: 'Offer approved', offerId, approvalStatus: 'approved' });
}

/**
 * PUT /api/offers/{id}/reject — Restaurant rejects an offer.
 */
async function rejectOffer(offerId, event) {
  if (!isValidId(offerId)) return respond(400, { error: 'Invalid offer ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'OFFER_APPROVE', 30))) {
    return respond(429, { error: 'Too many requests.' });
  }

  const body = parseBody(event);
  const reason = body?.reason ? sanitize(body.reason, 500) : '';

  const restaurantId = sanitize(body?.restaurantId, 64);
  if (!restaurantId || !isValidId(restaurantId)) return respond(400, { error: 'restaurantId is required' });

  // Find the offer
  const result = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `RESTAURANT#${restaurantId}`, SK: `OFFER#${offerId}` },
    })
  );
  const offer = result?.Item;
  if (!offer) return respond(404, { error: 'Offer not found' });

  // Only the restaurant's listing creator can reject — same rationale as approve.
  const restCheck = await ddb.send(
    new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restaurantId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
  );
  const isRestaurantRep = restCheck.Item?.creatorId === userId;
  if (!isRestaurantRep) {
    return respond(403, { error: 'Only the restaurant representative can reject offers' });
  }

  if (offer.approvalStatus !== 'pending_restaurant') {
    return respond(400, { error: 'This offer is not pending approval' });
  }

  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: offer.PK, SK: offer.SK },
        UpdateExpression: 'SET approvalStatus = :status, updatedAt = :now',
        ConditionExpression: 'approvalStatus = :pending',
        ExpressionAttributeValues: {
          ':status': 'rejected',
          ':now': new Date().toISOString(),
          ':pending': 'pending_restaurant',
        },
      })
    );
  } catch (condErr) {
    if (condErr.name === 'ConditionalCheckFailedException') {
      return respond(409, { error: 'This offer has already been processed' });
    }
    throw condErr;
  }

  await createNotification(
    offer.creatorId,
    'offer_rejected',
    'Deal Not Approved',
    reason ? `${offer.restaurantName} declined your deal: "${reason}"` : `${offer.restaurantName} declined your deal.`,
    `/app/offers`,
    offer.restaurantName
  );

  return respond(200, { message: 'Offer rejected', offerId, approvalStatus: 'rejected' });
}

/**
 * PUT /api/offers/{id}/pause — Either party pauses an approved offer.
 */
async function pauseOffer(offerId, event) {
  if (!isValidId(offerId)) return respond(400, { error: 'Invalid offer ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'OFFER_PAUSE', 30))) {
    return respond(429, { error: 'Too many requests.' });
  }

  const body = parseBody(event);
  const reason = body?.reason ? sanitize(body.reason, 500) : '';

  // Determine caller's actual role — don't trust user-supplied 'role' field.
  // Try creator GSI first, then restaurant key, to find the offer AND determine role.
  let offer = null;
  let callerRole = ''; // will be set to 'creator' or 'restaurant' based on how we found the offer

  // Try as offer creator first
  const gsiResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#OFFERS`,
        ':sk': `OFFER#${offerId}`,
      },
      Limit: 1,
    })
  );
  if (gsiResult.Items?.[0]) {
    offer = gsiResult.Items[0];
    callerRole = 'creator';
  }

  // If not found as creator, try as restaurant listing creator
  if (!offer && body?.restaurantId) {
    const restId = sanitize(body.restaurantId, 64);
    if (restId && isValidId(restId)) {
      const restCheck = await ddb.send(
        new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
      );
      if (restCheck.Item?.creatorId === userId) {
        const restResult = await ddb.send(
          new GetCommand({
            TableName: TABLE,
            Key: { PK: `RESTAURANT#${restId}`, SK: `OFFER#${offerId}` },
          })
        );
        if (restResult.Item) {
          offer = restResult.Item;
          callerRole = 'restaurant';
        }
      }
    }
  }
  if (!offer) return respond(404, { error: 'Offer not found' });

  if (offer.approvalStatus !== 'approved' && offer.approvalStatus !== 'creator_only') {
    return respond(400, { error: 'Can only pause active/approved offers' });
  }

  // callerRole is derived from HOW we found the offer, not user input
  const pausedBy = callerRole;
  const nowISO = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: offer.PK, SK: offer.SK },
      UpdateExpression: 'SET approvalStatus = :status, pausedBy = :by, pausedAt = :now, pauseReason = :reason, isActive = :inactive, updatedAt = :now',
      ExpressionAttributeValues: {
        ':status': pausedBy === 'creator' ? 'paused_by_creator' : 'paused_by_restaurant',
        ':by': pausedBy,
        ':now': nowISO,
        ':reason': reason,
        ':inactive': false,
      },
    })
  );

  // Update lookup record
  if (offer.code) {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `OFFER_CODE#${offer.code}`, SK: 'LOOKUP' },
          UpdateExpression: 'SET isActive = :val',
          ExpressionAttributeValues: { ':val': false },
        })
      );
    } catch (e) { console.warn(`Lookup update failed: ${e.message}`); }
  }

  // Notify the other party
  const notifyTarget = pausedBy === 'creator' ? offer.restaurantId : offer.creatorId;
  const notifyType = 'offer_paused';
  await createNotification(
    notifyTarget,
    notifyType,
    'Deal Paused',
    `A deal for ${offer.restaurantName} has been paused by the ${pausedBy}${reason ? ': "' + reason + '"' : '.'}`,
    pausedBy === 'creator' ? '/app/partner/offers' : '/app/offers',
    offer.restaurantName
  );

  return respond(200, { message: 'Offer paused', offerId, pausedBy });
}

/**
 * PUT /api/offers/{id}/resume — Resume a paused offer.
 */
async function resumeOffer(offerId, event) {
  if (!isValidId(offerId)) return respond(400, { error: 'Invalid offer ID' });
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'OFFER_RESUME', 30))) {
    return respond(429, { error: 'Too many requests.' });
  }

  // Same role-derivation pattern as pauseOffer — determine role from how we find the offer
  let offer = null;
  let callerRole = '';

  const gsiResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk AND GSI1SK = :sk',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}#OFFERS`,
        ':sk': `OFFER#${offerId}`,
      },
      Limit: 1,
    })
  );
  if (gsiResult.Items?.[0]) {
    offer = gsiResult.Items[0];
    callerRole = 'creator';
  }

  const body = parseBody(event);
  if (!offer && body?.restaurantId) {
    const restId = sanitize(body.restaurantId, 64);
    if (restId && isValidId(restId)) {
      const restCheck = await ddb.send(
        new GetCommand({ TableName: TABLE, Key: { PK: `RESTAURANT#${restId}`, SK: 'PROFILE' }, ProjectionExpression: 'creatorId' })
      );
      if (restCheck.Item?.creatorId === userId) {
        const restResult = await ddb.send(
          new GetCommand({
            TableName: TABLE,
            Key: { PK: `RESTAURANT#${restId}`, SK: `OFFER#${offerId}` },
          })
        );
        if (restResult.Item) {
          offer = restResult.Item;
          callerRole = 'restaurant';
        }
      }
    }
  }
  if (!offer) return respond(404, { error: 'Offer not found' });

  if (!offer.approvalStatus?.startsWith('paused_by_')) {
    return respond(400, { error: 'Offer is not paused' });
  }

  const previousStatus = offer.mutuallyApproved ? 'approved' : 'creator_only';
  const nowISO = new Date().toISOString();

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: offer.PK, SK: offer.SK },
      UpdateExpression: 'SET approvalStatus = :status, isActive = :active, updatedAt = :now REMOVE pausedBy, pausedAt, pauseReason',
      ExpressionAttributeValues: {
        ':status': previousStatus,
        ':active': true,
        ':now': nowISO,
      },
    })
  );

  // Update lookup record
  if (offer.code) {
    try {
      await ddb.send(
        new UpdateCommand({
          TableName: TABLE,
          Key: { PK: `OFFER_CODE#${offer.code}`, SK: 'LOOKUP' },
          UpdateExpression: 'SET isActive = :val',
          ExpressionAttributeValues: { ':val': true },
        })
      );
    } catch (e) { console.warn(`Lookup update failed: ${e.message}`); }
  }

  return respond(200, { message: 'Offer resumed', offerId, approvalStatus: previousStatus });
}

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * Create a notification for a user and optionally trigger SES email.
 */
async function createNotification(targetUserId, type, title, body, link, entityName) {
  if (!targetUserId) return;
  const notificationId = randomUUID();
  const nowISO = new Date().toISOString();

  const item = {
    PK: `USER#${targetUserId}`,
    SK: `NOTIF#${nowISO}#${notificationId}`,
    notificationId,
    userId: targetUserId,
    type,
    title: sanitize(title, 200),
    body: sanitize(body, 500),
    link: link || '',
    isRead: false,
    emailSent: false,
    createdAt: nowISO,
    // TTL: expire after 90 days
    ttl: Math.floor(Date.now() / 1000) + 90 * 24 * 60 * 60,
  };

  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  } catch (err) {
    console.error(`Failed to create notification: ${err.message}`);
  }

  return notificationId;
}

/**
 * GET /api/notifications — List notifications for current user.
 */
async function listNotifications(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const qs = event.queryStringParameters || {};
  const limit = Math.min(Number(qs.limit) || 30, 100);
  const unreadOnly = qs.unread === 'true';

  const params = {
    TableName: TABLE,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': `USER#${userId}`,
      ':prefix': 'NOTIF#',
    },
    ScanIndexForward: false, // newest first
    Limit: limit,
  };

  if (unreadOnly) {
    params.FilterExpression = 'isRead = :unread';
    params.ExpressionAttributeValues[':unread'] = false;
  }

  const result = await ddb.send(new QueryCommand(params));
  const notifications = (result.Items || []).map(stripDdbKeys);

  // Compute unread count from fetched items (avoids second DDB query)
  // For small notification sets (limit ≤ 100), counting from result is accurate enough
  const unreadCount = (result.Items || []).filter(n => n.isRead === false).length;

  return respond(200, { notifications, unreadCount });
}

/**
 * PUT /api/notifications/read — Mark notifications as read.
 */
async function markNotificationsRead(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'NOTIF_READ', 60))) {
    return respond(429, { error: 'Too many requests.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  // Mark specific IDs or mark all as read
  const markAll = body.markAll === true;
  const ids = Array.isArray(body.notificationIds) ? body.notificationIds.slice(0, 50) : [];

  if (markAll) {
    // Get up to 25 unread notifications (capped to limit write cost)
    const unreadResult = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: 'isRead = :unread',
        ExpressionAttributeValues: {
          ':pk': `USER#${userId}`,
          ':prefix': 'NOTIF#',
          ':unread': false,
        },
        Limit: 25,
      })
    );

    const items = unreadResult.Items || [];
    // Process in batches of 10 to avoid write spikes
    let updated = 0;
    for (let i = 0; i < items.length; i += 10) {
      const batch = items.slice(i, i + 10);
      await Promise.all(batch.map(item =>
        ddb.send(
          new UpdateCommand({
            TableName: TABLE,
            Key: { PK: item.PK, SK: item.SK },
            UpdateExpression: 'SET isRead = :read',
            ExpressionAttributeValues: { ':read': true },
          })
        )
      ));
      updated += batch.length;
    }
    return respond(200, { message: 'All notifications marked as read', count: updated });
  }

  // Mark specific IDs
  if (!ids.length) return respond(400, { error: 'Provide notificationIds or markAll: true' });

  // Look up each notification and mark read
  const notifResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${userId}`,
        ':prefix': 'NOTIF#',
      },
      Limit: 200,
    })
  );

  const toUpdate = (notifResult.Items || []).filter(i => ids.includes(i.notificationId));
  const updates = toUpdate.map(item =>
    ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: item.PK, SK: item.SK },
        UpdateExpression: 'SET isRead = :read',
        ExpressionAttributeValues: { ':read': true },
      })
    )
  );
  await Promise.all(updates);
  return respond(200, { message: 'Notifications marked as read', count: updates.length });
}

// ─── SES Email Notifications ─────────────────────────────────────────────────

/**
 * Send a notification email to a user. Looks up user profile for email.
 * Fails silently if SES is not configured or user email not found.
 */
async function sendNotificationEmail(targetUserId, subject, htmlBody) {
  try {
    // H10: Atomic SES rate limit — max 10 emails per user per hour (race-safe)
    const emailRateKey = `RATE#EMAIL#${targetUserId}`;
    const hourWindow = Math.floor(Date.now() / 1000 / 3600);
    try {
      const incResult = await ddb.send(new UpdateCommand({
        TableName: TABLE,
        Key: { PK: emailRateKey, SK: `HOUR#${hourWindow}` },
        UpdateExpression: 'SET #c = if_not_exists(#c, :zero) + :inc, #t = if_not_exists(#t, :ttl)',
        ConditionExpression: 'attribute_not_exists(#c) OR #c < :limit',
        ExpressionAttributeNames: { '#c': 'count', '#t': 'ttl' },
        ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':limit': 10, ':ttl': Math.floor(Date.now() / 1000) + 7200 },
        ReturnValues: 'ALL_NEW',
      }));
    } catch (rateErr) {
      if (rateErr.name === 'ConditionalCheckFailedException') {
        console.warn(`Email rate limit exceeded for user ${targetUserId}`);
        return;
      }
      throw rateErr;
    }

    // Look up user email from profile
    const profileResult = await ddb.send(
      new GetCommand({
        TableName: TABLE,
        Key: { PK: `USER#${targetUserId}`, SK: 'PROFILE' },
        ProjectionExpression: 'email, #n',
        ExpressionAttributeNames: { '#n': 'name' },
      })
    );
    if (!profileResult.Item?.email) return;

    const toEmail = profileResult.Item.email;
    const userName = profileResult.Item.name || 'there';

    await sesClient.send(
      new SendEmailCommand({
        Source: SES_FROM_EMAIL,
        Destination: { ToAddresses: [toEmail] },
        Message: {
          Subject: { Data: `Spot | ${subject}`, Charset: 'UTF-8' },
          Body: {
            Html: {
              Data: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0f; color: #fff; padding: 32px;">
                  <div style="text-align: center; margin-bottom: 24px;">
                    <span style="font-size: 24px; font-weight: 700; color: #ff6b35;">Spot</span>
                  </div>
                  <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 24px;">
                    <p style="color: rgba(255,255,255,0.7);">Hi ${escapeHtml(sanitize(userName, 50))},</p>
                    <p style="color: #fff; line-height: 1.6;">${escapeHtml(htmlBody)}</p>
                  </div>
                  <div style="text-align: center; margin-top: 24px;">
                    <a href="https://tryspot.app/app/dashboard" style="color: #ff6b35; text-decoration: none; font-weight: 600;">Open Spot Dashboard</a>
                  </div>
                  <p style="text-align: center; color: rgba(255,255,255,0.3); font-size: 12px; margin-top: 32px;">
                    You're receiving this because you're a Spot user. <a href="https://tryspot.app/app/settings" style="color: rgba(255,255,255,0.4);">Unsubscribe</a>
                  </p>
                </div>
              `,
              Charset: 'UTF-8',
            },
          },
        },
      })
    );

    console.log(`Email sent successfully: subject="${subject}"`);
  } catch (err) {
    // Fail silently — email is best-effort (H18: no PII in logs)
    console.warn(`SES email delivery failed: ${err.code || err.name || 'unknown'}`);
  }
}

// ─── Raffles (Spot Raffles) ───────────────────────────────────────────────────

const VALID_RAFFLE_STATUSES = ['draft', 'active', 'closed', 'drawn', 'cancelled'];
const MAX_RAFFLE_ENTRIES = 10000;
const MAX_RAFFLE_DURATION_DAYS = 60;

/**
 * POST /api/raffles — Create a new raffle.
 */
async function createRaffle(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!(await checkUserMutationRate(userId, 'CREATE_RAFFLE', 20))) {
    return respond(429, { error: 'Too many raffle creations. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const title = sanitize(body.title, 200);
  const description = sanitize(body.description, 500);
  const prizeDescription = sanitize(body.prizeDescription, 500);
  const videoUrl = sanitize(body.videoUrl, 500);
  const restaurantId = sanitize(body.restaurantId, 64);
  const restaurantName = sanitize(body.restaurantName, 200);
  const creatorName = sanitize(body.creatorName, 200);

  if (!title || title.length < 1) return respond(400, { error: 'Title is required (1-200 chars)' });
  if (!prizeDescription) return respond(400, { error: 'Prize description is required' });
  if (!restaurantId) return respond(400, { error: 'Restaurant ID is required' });

  const now = new Date();
  const startsAt = body.startsAt ? new Date(body.startsAt) : now;
  const endsAt = body.endsAt ? new Date(body.endsAt) : null;
  if (!endsAt || isNaN(endsAt.getTime())) return respond(400, { error: 'Valid endsAt date is required' });
  if (endsAt < now) return respond(400, { error: 'endsAt must be in the future' });
  const maxEnd = new Date(now.getTime() + MAX_RAFFLE_DURATION_DAYS * 24 * 60 * 60 * 1000);
  if (endsAt > maxEnd) return respond(400, { error: `Raffle duration cannot exceed ${MAX_RAFFLE_DURATION_DAYS} days` });

  const raffleId = randomUUID();
  const nowISO = now.toISOString();
  const ttl = Math.floor(endsAt.getTime() / 1000) + (90 * 24 * 60 * 60); // 90 days after end

  const item = {
    PK: `CREATOR#${userId}`,
    SK: `RAFFLE#${raffleId}`,
    GSI1PK: `RAFFLE#${raffleId}`,
    GSI1SK: `STATUS#draft`,
    GSI2PK: 'RAFFLE#ALL',
    GSI2SK: endsAt.toISOString(),
    raffleId,
    creatorId: userId,
    creatorName,
    restaurantId,
    restaurantName,
    title,
    description,
    prizeDescription,
    videoUrl,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: 'draft',
    entryCount: 0,
    maxEntries: Math.max(1, Math.min(Math.floor(Number(body.maxEntries)) || MAX_RAFFLE_ENTRIES, MAX_RAFFLE_ENTRIES)),
    platformFee: 50, // Phase B: calculate from restaurant tier
    creatorRevenue: 18,
    winner: null,
    createdAt: nowISO,
    updatedAt: nowISO,
    ttl,
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
  return respond(201, stripDdbKeys(item));
}

/**
 * GET /api/raffles — List raffles for the authenticated user.
 */
async function listRaffles(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(params.limit) || 25, 1), 100);

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `CREATOR#${userId}`,
        ':skPrefix': 'RAFFLE#',
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return respond(200, {
    raffles: stripAll(result.Items || []),
    count: result.Count || 0,
  });
}

/**
 * GET /api/raffles/{id} — Get raffle details (PUBLIC — for entry page).
 */
async function getRaffle(raffleId) {
  if (!isValidId(raffleId)) return respond(400, { error: 'Invalid raffle ID' });

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `RAFFLE#${raffleId}` },
      Limit: 1,
    })
  );

  if (!result.Items?.length) return respond(404, { error: 'Raffle not found' });
  const raffle = result.Items[0];

  // Hide non-public raffles (draft/cancelled)
  if (!['active', 'closed', 'drawn'].includes(raffle.status)) {
    return respond(404, { error: 'Raffle not found' });
  }

  // Public view: return only safe fields
  return respond(200, {
    raffleId: raffle.raffleId,
    creatorName: raffle.creatorName,
    restaurantId: raffle.restaurantId,
    restaurantName: raffle.restaurantName,
    title: raffle.title,
    description: raffle.description,
    prizeDescription: raffle.prizeDescription,
    videoUrl: raffle.videoUrl,
    startsAt: raffle.startsAt,
    endsAt: raffle.endsAt,
    status: raffle.status,
    entryCount: raffle.entryCount || 0,
    maxEntries: raffle.maxEntries,
    winner: raffle.status === 'drawn' ? raffle.winner : null,
    createdAt: raffle.createdAt,
    updatedAt: raffle.updatedAt,
  });
}

/**
 * PUT /api/raffles/{id} — Update a raffle (draft only).
 */
async function updateRaffle(raffleId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(raffleId)) return respond(400, { error: 'Invalid raffle ID' });
  if (!(await checkUserMutationRate(userId, 'UPD_RAFFLE', 60))) {
    return respond(429, { error: 'Too many updates. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  // Find raffle owned by user
  const find = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `RAFFLE#${raffleId}` },
    })
  );
  if (!find.Item) return respond(404, { error: 'Raffle not found' });

  const raffle = find.Item;
  // Status transitions
  const ALLOWED_STATUS_UPDATES = {
    draft: ['active', 'cancelled'],
    active: ['closed', 'cancelled'],
    closed: ['drawn'],
  };

  const newStatus = body.status ? sanitize(body.status, 20) : null;
  if (newStatus && !ALLOWED_STATUS_UPDATES[raffle.status]?.includes(newStatus)) {
    return respond(400, { error: `Cannot transition from "${raffle.status}" to "${newStatus}"` });
  }

  // Only allow field edits on draft raffles (except status changes)
  const isFieldEdit = body.title || body.description || body.prizeDescription || body.videoUrl || body.endsAt;
  if (isFieldEdit && raffle.status !== 'draft') {
    return respond(400, { error: 'Can only edit fields on draft raffles' });
  }

  const updates = [];
  const names = {};
  const values = { ':now': new Date().toISOString() };
  updates.push('updatedAt = :now');

  if (newStatus) {
    updates.push('#s = :status');
    names['#s'] = 'status';
    values[':status'] = newStatus;
    // Update GSI1SK for status queries
    updates.push('GSI1SK = :g1sk');
    values[':g1sk'] = `STATUS#${newStatus}`;
    // If activating, set GSI2 for active raffles
    if (newStatus === 'active') {
      updates.push('GSI2PK = :g2pk');
      values[':g2pk'] = 'RAFFLE#ACTIVE';
    } else if (newStatus === 'cancelled' || newStatus === 'closed') {
      updates.push('GSI2PK = :g2pk');
      values[':g2pk'] = `RAFFLE#${newStatus.toUpperCase()}`;
    }
  }
  if (body.title) { updates.push('title = :title'); values[':title'] = sanitize(body.title, 200); }
  if (body.description !== undefined) { updates.push('description = :desc'); values[':desc'] = sanitize(body.description, 500); }
  if (body.prizeDescription) { updates.push('prizeDescription = :prize'); values[':prize'] = sanitize(body.prizeDescription, 500); }
  if (body.videoUrl !== undefined) { updates.push('videoUrl = :vid'); values[':vid'] = sanitize(body.videoUrl, 500); }
  if (body.endsAt) {
    const newEnd = new Date(body.endsAt);
    if (isNaN(newEnd.getTime()) || newEnd < new Date()) return respond(400, { error: 'Invalid endsAt' });
    updates.push('endsAt = :end');
    values[':end'] = newEnd.toISOString();
  }

  await ddb.send(
    new UpdateCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `RAFFLE#${raffleId}` },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ...(Object.keys(names).length ? { ExpressionAttributeNames: names } : {}),
      ExpressionAttributeValues: values,
    })
  );

  return respond(200, { message: 'Raffle updated', raffleId, status: newStatus || raffle.status });
}

/**
 * POST /api/raffles/{id}/enter — Public raffle entry.
 */
async function enterRaffle(raffleId, event) {
  if (!isValidId(raffleId)) return respond(400, { error: 'Invalid raffle ID' });
  if (!(await checkPublicRateLimit(event))) {
    return respond(429, { error: 'Too many requests. Please try again later.' });
  }

  const body = parseBody(event);
  if (!body) return respond(400, { error: 'Invalid JSON body' });

  const email = normalizeEmail(body.email);
  if (!email) return respond(400, { error: 'Valid email is required' });

  const name = sanitize(body.name, 100);
  if (!name || name.length < 1) return respond(400, { error: 'Name is required (1-100 chars)' });

  const socialHandle = sanitize(body.socialHandle || '', 50);

  // Fetch raffle via GSI1
  const raffleResult = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `RAFFLE#${raffleId}` },
      Limit: 1,
    })
  );
  if (!raffleResult.Items?.length) return respond(404, { error: 'Raffle not found' });
  const raffle = raffleResult.Items[0];

  // Validate raffle is accepting entries
  if (raffle.status !== 'active') return respond(400, { error: 'This raffle is not currently accepting entries' });
  if (new Date(raffle.endsAt) < new Date()) return respond(400, { error: 'This raffle has ended' });
  if (raffle.entryCount >= raffle.maxEntries) return respond(400, { error: 'This raffle has reached its entry limit' });

  // Email dedup — check GSI2 for existing entry with same email in this raffle
  const emailCheck = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      IndexName: 'GSI2',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `ENTRY#EMAIL#${email}`,
        ':skPrefix': `RAFFLE#${raffleId}`,
      },
      Limit: 1,
    })
  );
  if (emailCheck.Items?.length) {
    return respond(409, { error: 'You have already entered this raffle', alreadyEntered: true });
  }

  // IP dedup — rate limit per IP per raffle per day
  const sourceIp = event.requestContext?.identity?.sourceIp || 'unknown';
  const ipHashed = hashIp(sourceIp, raffleId);
  const dayWindow = Math.floor(Date.now() / 1000 / 86400);
  try {
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: `RATE#RAFFLE_IP#${ipHashed}`,
          SK: `RAFFLE#${raffleId}#DAY#${dayWindow}`,
          ttl: Math.floor(Date.now() / 1000) + 172800, // 2 days
        },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      return respond(409, { error: 'One entry per device per day', alreadyEntered: true });
    }
    throw err; // unexpected error
  }

  // Atomically increment entry count FIRST — prevents race condition where two concurrent
  // requests both pass the entryCount check and both create entries, exceeding maxEntries.
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: raffle.PK, SK: raffle.SK },
        UpdateExpression: 'SET entryCount = if_not_exists(entryCount, :zero) + :inc',
        ConditionExpression: 'attribute_not_exists(entryCount) OR entryCount < :maxEntries',
        ExpressionAttributeValues: { ':zero': 0, ':inc': 1, ':maxEntries': raffle.maxEntries },
      })
    );
  } catch (condErr) {
    if (condErr.name === 'ConditionalCheckFailedException') {
      return respond(400, { error: 'This raffle has reached its entry limit' });
    }
    throw condErr;
  }

  // Create entry only after count was successfully reserved
  const entryId = randomUUID();
  const now = new Date().toISOString();
  const entry = {
    PK: `RAFFLE#${raffleId}`,
    SK: `ENTRY#${entryId}`,
    GSI2PK: `ENTRY#EMAIL#${email}`,
    GSI2SK: `RAFFLE#${raffleId}#${now}`,
    entryId,
    raffleId,
    email,
    name,
    socialHandle,
    ipHash: ipHashed,
    createdAt: now,
    ttl: Math.floor(new Date(raffle.endsAt).getTime() / 1000) + (90 * 24 * 60 * 60),
  };

  await ddb.send(new PutCommand({ TableName: TABLE, Item: entry }));

  return respond(201, { entryId, email, message: 'Entry submitted successfully' });
}

/**
 * GET /api/raffles/{id}/entries — List entries for a raffle (creator only).
 */
async function listRaffleEntries(raffleId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(raffleId)) return respond(400, { error: 'Invalid raffle ID' });

  // Verify ownership
  const raffle = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `RAFFLE#${raffleId}` },
    })
  );
  if (!raffle.Item) return respond(404, { error: 'Raffle not found or not owned by you' });

  const params = event.queryStringParameters || {};
  const limit = Math.min(Math.max(Number(params.limit) || 50, 1), 100);
  let exclusiveStartKey;
  if (params.nextToken) {
    try { exclusiveStartKey = JSON.parse(Buffer.from(params.nextToken, 'base64').toString()); } catch { return respond(400, { error: 'Invalid pagination token' }); }
    // H11: Validate pagination token structure to prevent key injection
    if (!exclusiveStartKey.PK || !exclusiveStartKey.SK || typeof exclusiveStartKey.PK !== 'string') {
      return respond(400, { error: 'Malformed pagination token' });
    }
  }

  const result = await ddb.send(
    new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `RAFFLE#${raffleId}`,
        ':skPrefix': 'ENTRY#',
      },
      Limit: limit,
      ...(exclusiveStartKey && { ExclusiveStartKey: exclusiveStartKey }),
    })
  );

  const nextToken = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;

  return respond(200, {
    entries: (result.Items || []).map(e => ({
      entryId: e.entryId,
      name: e.name,
      email: e.email,
      socialHandle: e.socialHandle,
      createdAt: e.createdAt,
    })),
    count: result.Count || 0,
    nextToken,
  });
}

/**
 * POST /api/raffles/{id}/draw — Draw a winner.
 */
async function drawRaffleWinner(raffleId, event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });
  if (!isValidId(raffleId)) return respond(400, { error: 'Invalid raffle ID' });
  if (!(await checkUserMutationRate(userId, 'DRAW_RAFFLE', 10))) {
    return respond(429, { error: 'Too many draw attempts. Please try again later.' });
  }

  // Verify ownership
  const find = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: `CREATOR#${userId}`, SK: `RAFFLE#${raffleId}` },
    })
  );
  if (!find.Item) return respond(404, { error: 'Raffle not found' });

  const raffle = find.Item;
  if (raffle.winner) return respond(400, { error: 'Winner has already been drawn for this raffle' });
  if (raffle.status !== 'active' && raffle.status !== 'closed')
    return respond(400, { error: `Cannot draw winner when raffle status is "${raffle.status}"` });

  // Fetch all entries in pages of 100 (memory-safe pagination)
  const entries = [];
  let lastKey = undefined;
  do {
    const result = await ddb.send(
      new QueryCommand({
        TableName: TABLE,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
        ExpressionAttributeValues: {
          ':pk': `RAFFLE#${raffleId}`,
          ':skPrefix': 'ENTRY#',
        },
        Limit: 100,
        ExclusiveStartKey: lastKey,
      })
    );
    entries.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
    if (entries.length >= MAX_RAFFLE_ENTRIES) break; // safety cap
  } while (lastKey);

  if (entries.length === 0) return respond(400, { error: 'No entries to draw from' });

  // Cryptographically random selection
  const winnerIndex = randomInt(entries.length);
  const winnerEntry = entries[winnerIndex];
  const claimCode = randomUUID().slice(0, 8).toUpperCase();
  const now = new Date().toISOString();

  const winner = {
    email: winnerEntry.email,
    name: winnerEntry.name,
    claimCode,
    drawnAt: now,
  };

  // Update raffle with winner + status — conditional lock prevents concurrent draws
  try {
    await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: { PK: `CREATOR#${userId}`, SK: `RAFFLE#${raffleId}` },
        UpdateExpression: 'SET winner = :winner, #s = :status, updatedAt = :now, GSI1SK = :g1sk, GSI2PK = :g2pk',
        ConditionExpression: 'attribute_not_exists(winner) AND #s IN (:active, :closed)',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: {
          ':winner': winner,
          ':status': 'drawn',
          ':now': now,
          ':g1sk': 'STATUS#drawn',
          ':g2pk': 'RAFFLE#DRAWN',
          ':active': 'active',
          ':closed': 'closed',
        },
      })
    );
  } catch (condErr) {
    if (condErr.name === 'ConditionalCheckFailedException') {
      return respond(409, { error: 'Winner has already been drawn (concurrent request)' });
    }
    throw condErr;
  }

  return respond(200, {
    message: 'Winner drawn!',
    winner: { name: winner.name, email: winner.email, claimCode },
    totalEntries: entries.length,
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  setRequestOrigin(event); // Dynamic CORS — match request origin against allowed list
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
    if (path.match(/\/api\/restaurants\/[^/]+\/offers$/) && method === 'GET') {
      const restId = pathParts[pathParts.length - 2];
      return listRestaurantOffers(restId, event);
    }
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

    // Offer update (authenticated — creator toggles active/inactive)
    if (path.match(/\/api\/offers\/[^/]+$/) && method === 'PUT')
      return updateOffer(pathParts[pathParts.length - 1], event);

    // Offer mutual approval endpoints
    if (path.match(/\/api\/offers\/[^/]+\/submit-for-approval$/) && method === 'PUT')
      return submitOfferForApproval(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/offers\/[^/]+\/approve$/) && method === 'PUT')
      return approveOffer(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/offers\/[^/]+\/reject$/) && method === 'PUT')
      return rejectOffer(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/offers\/[^/]+\/pause$/) && method === 'PUT')
      return pauseOffer(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/offers\/[^/]+\/resume$/) && method === 'PUT')
      return resumeOffer(pathParts[pathParts.length - 2], event);

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

    // Content Archive
    if (path.match(/\/api\/spotops\/content$/) && method === 'GET')
      return listContent(event);
    if (path.match(/\/api\/spotops\/content$/) && method === 'POST')
      return createContent(event);

    // Editorial Calendar
    if (path.match(/\/api\/spotops\/calendar$/) && method === 'GET')
      return listCalendarSlots(event);
    if (path.match(/\/api\/spotops\/calendar$/) && method === 'POST')
      return createCalendarSlot(event);
    if (path.match(/\/api\/spotops\/calendar\/[^/]+$/) && method === 'PUT')
      return updateCalendarSlot(pathParts[pathParts.length - 1], event);
    if (path.match(/\/api\/spotops\/calendar\/[^/]+$/) && method === 'DELETE')
      return deleteCalendarSlot(pathParts[pathParts.length - 1], event);

    // Partner portal
    if (path.match(/\/api\/partner\/campaigns$/) && method === 'GET')
      return listCampaigns(event);
    if (path.match(/\/api\/partner\/offers$/) && method === 'GET')
      return listOffers(event);
    if (path.match(/\/api\/partner\/reports$/) && method === 'GET')
      return listReports(event);
    if (path.match(/\/api\/partner\/analytics$/) && method === 'GET')
      return getPartnerAnalytics(event);
    if (path.match(/\/api\/proposals\/expire$/) && method === 'PUT')
      return expireStaleProposals(event);

    // Insider deals (public — rate limited by IP)
    if (path.match(/\/api\/insider\/deals$/) && method === 'GET')
      return listDeals(event);
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

    // Google Places JIT (rate-limited to protect paid API)
    if (path.match(/\/api\/restaurants\/[^/]+\/google-details$/) && method === 'GET')
      return getGoogleDetails(pathParts[pathParts.length - 2], event);

    // Google Places Autocomplete & Details (for restaurant onboarding)
    if (path === '/api/places/autocomplete' && method === 'GET')
      return placesAutocomplete(event);
    if (path === '/api/places/details' && method === 'GET')
      return placesDetails(event);

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

    // Raffles (Spot Raffles)
    if (path.match(/\/api\/raffles$/) && method === 'POST')
      return createRaffle(event);
    if (path.match(/\/api\/raffles$/) && method === 'GET')
      return listRaffles(event);
    if (path.match(/\/api\/raffles\/[^/]+\/enter$/) && method === 'POST')
      return enterRaffle(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/raffles\/[^/]+\/entries$/) && method === 'GET')
      return listRaffleEntries(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/raffles\/[^/]+\/draw$/) && method === 'POST')
      return drawRaffleWinner(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/raffles\/[^/]+$/) && method === 'GET')
      return getRaffle(pathParts[pathParts.length - 1]);
    if (path.match(/\/api\/raffles\/[^/]+$/) && method === 'PUT')
      return updateRaffle(pathParts[pathParts.length - 1], event);

    // Proposals (Handshake Model)
    if (path.match(/\/api\/proposals$/) && method === 'POST')
      return createProposal(event);
    if (path.match(/\/api\/proposals\/inbox$/) && method === 'GET')
      return listProposalInbox(event);
    if (path.match(/\/api\/proposals\/sent$/) && method === 'GET')
      return listProposalSent(event);
    if (path.match(/\/api\/proposals\/[^/]+$/) && method === 'GET')
      return getProposal(pathParts[pathParts.length - 1], event);
    if (path.match(/\/api\/proposals\/[^/]+\/accept$/) && method === 'PUT')
      return acceptProposal(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/proposals\/[^/]+\/counter$/) && method === 'PUT')
      return counterProposal(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/proposals\/[^/]+\/decline$/) && method === 'PUT')
      return declineProposal(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/proposals\/[^/]+\/message$/) && method === 'POST')
      return addProposalMessage(pathParts[pathParts.length - 2], event);

    // Notifications
    if (path.match(/\/api\/notifications$/) && method === 'GET')
      return listNotifications(event);
    if (path.match(/\/api\/notifications\/read$/) && method === 'PUT')
      return markNotificationsRead(event);

    // Content Reviews
    if (path.match(/\/api\/content-reviews$/) && method === 'POST')
      return createContentReview(event);
    if (path.match(/\/api\/content-reviews$/) && method === 'GET')
      return listContentReviews(event);
    if (path.match(/\/api\/content-reviews\/[^/]+\/submit$/) && method === 'PUT')
      return submitContentReview(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/content-reviews\/[^/]+\/request-revision$/) && method === 'PUT')
      return requestContentRevision(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/content-reviews\/[^/]+\/approve$/) && method === 'PUT')
      return approveContentReview(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/content-reviews\/[^/]+\/reject$/) && method === 'PUT')
      return rejectContentReview(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/content-reviews\/[^/]+$/) && method === 'GET')
      return getContentReview(pathParts[pathParts.length - 1], event);

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

    // Social Media Integration
    if (path.match(/\/api\/social\/connect\/(instagram|tiktok|youtube)$/) && method === 'POST')
      return initSocialOAuth(pathParts[pathParts.length - 1], event);
    if (path.match(/\/api\/social\/callback\/(instagram|tiktok|youtube)$/) && method === 'GET')
      return handleSocialCallback(pathParts[pathParts.length - 1], event);
    if (path.match(/\/api\/social\/connections$/) && method === 'GET')
      return listSocialConnections(event);
    if (path.match(/\/api\/social\/connection\/(instagram|tiktok|youtube)$/) && method === 'GET')
      return getSocialConnection(pathParts[pathParts.length - 1], event);
    if (path.match(/\/api\/social\/disconnect\/(instagram|tiktok|youtube)$/) && method === 'PUT')
      return disconnectSocial(pathParts[pathParts.length - 1], event);
    if (path.match(/\/api\/social\/refresh\/(instagram|tiktok|youtube)$/) && method === 'POST')
      return refreshSocialToken(pathParts[pathParts.length - 1], event);

    // Content Review Extensions (Publishing & Metrics)
    if (path.match(/\/api\/content-reviews\/[^/]+\/publish$/) && method === 'PUT')
      return markContentPublished(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/content-reviews\/[^/]+\/fetch-metrics$/) && method === 'POST')
      return fetchContentMetrics(pathParts[pathParts.length - 2], event);
    if (path.match(/\/api\/content-reviews\/[^/]+\/metrics$/) && method === 'GET')
      return getContentMetrics(pathParts[pathParts.length - 2], event);

    // POS Integration (Square, Toast, Clover)
    if (path.match(/\/api\/pos\/connect\/square$/) && method === 'POST')
      return initSquareOAuth(event);
    if (path.match(/\/api\/pos\/callback\/square$/) && method === 'GET')
      return handleSquareCallback(event);
    if (path.match(/\/api\/pos\/connect\/toast$/) && method === 'POST')
      return initToastAuth(event);
    if (path.match(/\/api\/pos\/connect\/clover$/) && method === 'POST')
      return initCloverOAuth(event);
    if (path.match(/\/api\/pos\/callback\/clover$/) && method === 'GET')
      return handleCloverCallback(event);
    if (path.match(/\/api\/pos\/status$/) && method === 'GET')
      return getPosStatus(event);
    if (path.match(/\/api\/pos\/disconnect$/) && method === 'PUT')
      return disconnectPos(event);
    if (path.match(/\/api\/pos\/sync$/) && method === 'POST')
      return syncRedemptionData(event);
    if (path.match(/\/api\/pos\/sync\/history$/) && method === 'GET')
      return getSyncHistory(event);

    return respond(404, { error: 'Not found' });
  } catch (err) {
    const errorId = randomUUID().slice(0, 12);
    console.error(JSON.stringify({
      level: 'ERROR',
      errorId,
      message: err.message,
      stack: err.stack?.split('\n').slice(0, 5).join(' | '),
      path: event?.rawPath || event?.path,
      method: event?.requestContext?.http?.method,
    }));
    return respond(500, { error: 'Internal server error', errorId });
  }
};
