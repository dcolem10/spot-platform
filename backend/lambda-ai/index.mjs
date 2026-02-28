import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);
const TABLE = process.env.TABLE_NAME;
const ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const API_KEY = process.env.ANTHROPIC_API_KEY;
const CACHE_TTL = 3600;

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

// ─── AI Recommendations ───────────────────────────────────────────────────────

async function handleRecommendations(event) {
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
    return respond(200, { recommendations: cached.Item.payload, cached: true });
  }

  if (!API_KEY) {
    return respond(200, {
      recommendations: getFallbackRecommendations(query),
      cached: false,
      fallback: true,
    });
  }

  try {
    const systemPrompt = `You are a knowledgeable DC/DMV food recommender. The user is asking for restaurant suggestions. Respond with 3-5 restaurant recommendations in JSON format. Each recommendation should have: name, neighborhood, cuisine, whyRecommended (1-2 sentences), priceLevel (1-4), and vibes (array of strings). Only recommend real DC/DMV restaurants. Be specific and helpful.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
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

    return respond(200, { recommendations, cached: false });
  } catch (err) {
    console.error('AI recommendation error:', err);
    return respond(200, {
      recommendations: getFallbackRecommendations(query),
      cached: false,
      fallback: true,
    });
  }
}

// ─── Content Ideas ────────────────────────────────────────────────────────────

async function handleContentIdeas(event) {
  const body = JSON.parse(event.body || '{}');
  if (!API_KEY) {
    return respond(200, {
      ideas: [
        { title: 'New opening spotlight', description: 'Feature a restaurant that opened in the last 2 weeks', type: 'reel' },
        { title: 'Hidden gem series', description: 'Showcase an under-the-radar spot your audience hasn\'t seen', type: 'reel' },
        { title: 'Weekend brunch guide', description: 'Round up your top 3 brunch spots for the weekend', type: 'story' },
        { title: 'Neighborhood deep dive', description: 'Cover 4-5 spots in one neighborhood', type: 'reel' },
        { title: 'Price point challenge', description: 'Best meal under $15 in a specific area', type: 'tiktok' },
      ],
      fallback: true,
    });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
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

    return respond(200, { ideas });
  } catch (err) {
    console.error('Content ideas error:', err);
    return respond(500, { error: 'Failed to generate ideas' });
  }
}

// ─── Campaign Insights ────────────────────────────────────────────────────────

async function handleCampaignInsights(event) {
  const body = JSON.parse(event.body || '{}');
  if (!API_KEY) {
    return respond(200, {
      insights: [
        'Campaigns with Reels as the primary deliverable see 40% higher engagement than Stories-only packages.',
        'Weekend posts generate 25% more saves than weekday posts for restaurant content.',
        'Partner restaurants in emerging neighborhoods see higher click-through rates than established areas.',
        'Including a limited-time offer in the caption increases QR scan rates by 60%.',
      ],
      fallback: true,
    });
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
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

    return respond(200, { insights });
  } catch (err) {
    console.error('Campaign insights error:', err);
    return respond(500, { error: 'Failed to generate insights' });
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
    if (method === 'OPTIONS') return respond(200, {});

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
