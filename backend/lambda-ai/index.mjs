import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const smClient = new SecretsManagerClient({});
const TABLE = process.env.TABLE_NAME;
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const CACHE_TTL = 3600;

// ─── Secrets (fetched once per cold start, cached in memory) ─────────────────
let _secrets = null;
async function getSecrets() {
  if (_secrets) return _secrets;
  const { SecretString } = await smClient.send(
    new GetSecretValueCommand({ SecretId: process.env.SECRETS_ARN })
  );
  _secrets = JSON.parse(SecretString);
  return _secrets;
}
async function getApiKey() {
  const s = await getSecrets();
  return s.ANTHROPIC_API_KEY;
}

// H4: Rate limiting is enforced at two layers:
// 1. API Gateway MethodSettings — stage-level throttle (50 burst / 20 sustained rps)
// 2. Caching — AI responses cached in DynamoDB with 1hr TTL to reduce Anthropic API calls.
// For production, consider adding per-user rate limiting via a Usage Plan + API Keys,
// or an in-Lambda token-bucket backed by DynamoDB atomic counters.

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
};

const respond = (statusCode, body, customHeaders = {}) => ({
  statusCode,
  headers: { ...headers, ...customHeaders },
  body: JSON.stringify(body),
});

const INJECTION_PATTERNS = [
  /ignore\s+(previous|above|all)\s+instructions/i,
  /you\s+are\s+now/i,
  /system\s*:\s*/i,
  /override\s+(your|the)\s+(instructions|rules)/i,
  /pretend\s+(you|to\s+be)/i,
  /act\s+as\s+(if|a|an)/i,
  /forget\s+(everything|all|your)/i,
  /new\s+instructions?\s*:/i,
  /\bDAN\b/,
  /jailbreak/i,
];

function detectInjection(text) {
  return INJECTION_PATTERNS.some((p) => p.test(text));
}

// ─── User ID Extraction ───────────────────────────────────────────────────────

function getUserId(event) {
  return event.requestContext?.authorizer?.claims?.sub || null;
}

// ─── Per-User Rate Limiting ───────────────────────────────────────────────────
// Limits each user to MAX_AI_REQUESTS_PER_HOUR AI requests per hour.
// Uses DynamoDB atomic counters with TTL for automatic cleanup.

const MAX_AI_REQUESTS_PER_HOUR = 10;
const RATE_LIMIT_WINDOW = 3600; // 1 hour in seconds

async function checkRateLimit(userId) {
  if (!userId) return { allowed: false, reason: 'No user ID' };

  const now = Math.floor(Date.now() / 1000);
  const windowKey = Math.floor(now / RATE_LIMIT_WINDOW); // changes every hour

  try {
    const result = await ddb.send(
      new UpdateCommand({
        TableName: TABLE,
        Key: {
          PK: `RATE_LIMIT#${userId}`,
          SK: `AI#${windowKey}`,
        },
        UpdateExpression: 'SET #count = if_not_exists(#count, :zero) + :inc, #ttl = :ttl',
        ExpressionAttributeNames: {
          '#count': 'requestCount',
          '#ttl': 'ttl',
        },
        ExpressionAttributeValues: {
          ':zero': 0,
          ':inc': 1,
          ':ttl': now + RATE_LIMIT_WINDOW + 60, // TTL: window + 1 min buffer
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    const count = result.Attributes?.requestCount || 0;

    if (count > MAX_AI_REQUESTS_PER_HOUR) {
      return {
        allowed: false,
        reason: `Rate limit exceeded. Max ${MAX_AI_REQUESTS_PER_HOUR} AI requests per hour.`,
        remaining: 0,
        resetAt: (windowKey + 1) * RATE_LIMIT_WINDOW,
      };
    }

    return {
      allowed: true,
      remaining: MAX_AI_REQUESTS_PER_HOUR - count,
      resetAt: (windowKey + 1) * RATE_LIMIT_WINDOW,
    };
  } catch (err) {
    // If rate limit check fails, allow the request (fail open)
    // but log the error for monitoring
    console.error('Rate limit check failed:', err.message);
    return { allowed: true, remaining: -1 };
  }
}

// ─── AI Recommendations ───────────────────────────────────────────────────────

async function handleRecommendations(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return respond(429, {
      error: rateCheck.reason,
      remaining: rateCheck.remaining,
      resetAt: rateCheck.resetAt,
    });
  }

  const body = JSON.parse(event.body || '{}');
  const query = (body.query || '').trim().slice(0, 500);

  if (!query) return respond(400, { error: 'Query is required' });
  if (detectInjection(query))
    return respond(400, { error: 'Invalid query content' });

  // Check cache
  const cacheKey = `REC#${query.toLowerCase().replace(/\s+/g, '-').slice(0, 100)}`;
  const cached = await ddb.send(
    new GetCommand({
      TableName: TABLE,
      Key: { PK: 'AI_CACHE#recommendations', SK: cacheKey },
    })
  );

  if (cached.Item && Date.now() / 1000 < (cached.Item.ttl || 0)) {
    return respond(200, { recommendations: cached.Item.payload, cached: true }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return respond(200, {
      recommendations: getFallbackRecommendations(query),
      cached: false,
      fallback: true,
    }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  }

  try {
    const systemPrompt = `You are a knowledgeable DC/DMV food recommender. The user is asking for restaurant suggestions. Respond with 3-5 restaurant recommendations in JSON format. Each recommendation should have: name, neighborhood, cuisine, whyRecommended (1-2 sentences), priceLevel (1-4), and vibes (array of strings). Only recommend real DC/DMV restaurants. Be specific and helpful.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2000,
        system: systemPrompt,
        messages: [{ role: 'user', content: query }],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '[]';

    // Parse JSON from response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    // Cache
    await ddb.send(
      new PutCommand({
        TableName: TABLE,
        Item: {
          PK: 'AI_CACHE#recommendations',
          SK: cacheKey,
          payload: recommendations,
          cachedAt: new Date().toISOString(),
          ttl: Math.floor(Date.now() / 1000) + CACHE_TTL,
        },
      })
    );

    return respond(200, { recommendations, cached: false }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  } catch (err) {
    console.error('AI recommendation error:', err);
    return respond(200, {
      recommendations: getFallbackRecommendations(query),
      cached: false,
      fallback: true,
    }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  }
}

// ─── Content Ideas ────────────────────────────────────────────────────────────

async function handleContentIdeas(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return respond(429, {
      error: rateCheck.reason,
      remaining: rateCheck.remaining,
      resetAt: rateCheck.resetAt,
    });
  }

  const body = JSON.parse(event.body || '{}');

  // H7: Prompt injection detection on user-supplied context
  if (body.context && typeof body.context === 'string' && detectInjection(body.context)) {
    return respond(400, { error: 'Invalid context content' });
  }
  if (body.context && typeof body.context === 'object') {
    const contextStr = JSON.stringify(body.context);
    if (detectInjection(contextStr)) {
      return respond(400, { error: 'Invalid context content' });
    }
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return respond(200, {
      ideas: [
        { title: 'New opening spotlight', description: 'Feature a restaurant that opened in the last 2 weeks', type: 'reel' },
        { title: 'Hidden gem series', description: 'Showcase an under-the-radar spot your audience hasn\'t seen', type: 'reel' },
        { title: 'Weekend brunch guide', description: 'Round up your top 3 brunch spots for the weekend', type: 'story' },
        { title: 'Neighborhood deep dive', description: 'Cover 4-5 spots in one neighborhood', type: 'reel' },
        { title: 'Price point challenge', description: 'Best meal under $15 in a specific area', type: 'tiktok' },
      ],
      fallback: true,
    }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system:
          'You are a content strategist for a DC/DMV food influencer. Generate 5 content ideas. Return JSON array with: title, description, type (reel/story/tiktok/post). Focus on what performs well for local food content.',
        messages: [
          {
            role: 'user',
            content: `Generate content ideas for this week. Context: ${JSON.stringify(body.context || {})}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '[]';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const ideas = jsonMatch ? JSON.parse(jsonMatch[0]) : [];

    return respond(200, { ideas }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  } catch (err) {
    console.error('Content ideas error:', err);
    return respond(500, { error: 'Failed to generate ideas' }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  }
}

// ─── Campaign Insights ────────────────────────────────────────────────────────

async function handleCampaignInsights(event) {
  const userId = getUserId(event);
  if (!userId) return respond(401, { error: 'Unauthorized' });

  const rateCheck = await checkRateLimit(userId);
  if (!rateCheck.allowed) {
    return respond(429, {
      error: rateCheck.reason,
      remaining: rateCheck.remaining,
      resetAt: rateCheck.resetAt,
    });
  }

  const body = JSON.parse(event.body || '{}');

  // H7: Prompt injection detection on user-supplied campaign data
  if (body.campaignData) {
    const dataStr = typeof body.campaignData === 'string'
      ? body.campaignData
      : JSON.stringify(body.campaignData);
    if (detectInjection(dataStr)) {
      return respond(400, { error: 'Invalid campaign data content' });
    }
  }

  const apiKey = await getApiKey();
  if (!apiKey) {
    return respond(200, {
      insights: [
        'Campaigns with Reels as the primary deliverable see 40% higher engagement than Stories-only packages.',
        'Weekend posts generate 25% more saves than weekday posts for restaurant content.',
        'Partner restaurants in emerging neighborhoods see higher click-through rates than established areas.',
        'Including a limited-time offer in the caption increases QR scan rates by 60%.',
      ],
      fallback: true,
    }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        system:
          'You are an analytics advisor for a food influencer marketing platform. Analyze the campaign data and provide 4-5 actionable insights. Be specific with numbers and recommendations.',
        messages: [
          {
            role: 'user',
            content: `Analyze this campaign data and provide insights: ${JSON.stringify(body.campaignData || {})}`,
          },
        ],
      }),
    });

    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    const insights = text.split('\n').filter((l) => l.trim().length > 10);

    return respond(200, { insights }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  } catch (err) {
    console.error('Campaign insights error:', err);
    return respond(500, { error: 'Failed to generate insights' }, {
      'X-RateLimit-Remaining': String(rateCheck.remaining),
      'X-RateLimit-Reset': String(rateCheck.resetAt),
    });
  }
}

// ─── Fallback Recommendations ─────────────────────────────────────────────────

function getFallbackRecommendations(query) {
  const q = query.toLowerCase();
  if (q.includes('date') || q.includes('romantic')) {
    return [
      { name: 'The Dabney', neighborhood: 'Shaw', cuisine: 'American', whyRecommended: 'Intimate Mid-Atlantic tasting menu with a wood-fired hearth.', priceLevel: 4, vibes: ['Romantic', 'Special Occasion'] },
      { name: 'Tail Up Goat', neighborhood: 'Adams Morgan', cuisine: 'Mediterranean', whyRecommended: 'Creative Mediterranean with an incredible bread program.', priceLevel: 3, vibes: ['Date Night', 'Cozy'] },
    ];
  }
  if (q.includes('brunch')) {
    return [
      { name: 'Founding Farmers', neighborhood: 'Foggy Bottom', cuisine: 'American', whyRecommended: 'Classic DC brunch with farm-to-table focus and great cocktails.', priceLevel: 2, vibes: ['Brunch', 'Group Friendly'] },
      { name: 'Duke\'s Grocery', neighborhood: 'Dupont Circle', cuisine: 'British', whyRecommended: 'Best burger in DC and a chill brunch vibe.', priceLevel: 2, vibes: ['Brunch', 'Casual'] },
    ];
  }
  return [
    { name: 'Rasika', neighborhood: 'Penn Quarter', cuisine: 'Indian', whyRecommended: 'Modern Indian cuisine — the palak chaat is legendary.', priceLevel: 3, vibes: ['Upscale', 'Business Dinner'] },
    { name: 'Bad Saint', neighborhood: 'Columbia Heights', cuisine: 'Filipino', whyRecommended: 'Tiny but mighty Filipino spot. No reservations, worth the wait.', priceLevel: 2, vibes: ['Hidden Gem', 'Adventurous'] },
    { name: 'Compass Rose', neighborhood: '14th Street', cuisine: 'Global', whyRecommended: 'Travel-inspired small plates from around the world. Great cocktails.', priceLevel: 3, vibes: ['Date Night', 'Global'] },
  ];
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path || '';

  try {
    if (method === 'OPTIONS') return respond(200, {}, { 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS' });

    if (path.includes('/ai/recommendations') && method === 'POST')
      return handleRecommendations(event);
    if (path.includes('/ai/content-ideas') && method === 'POST')
      return handleContentIdeas(event);
    if (path.includes('/ai/campaign-insights') && method === 'POST')
      return handleCampaignInsights(event);

    return respond(404, { error: 'Not found' });
  } catch (err) {
    console.error('AI handler error:', err);
    return respond(500, { error: 'Internal server error' });
  }
};
