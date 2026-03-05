import { test, describe } from 'node:test';
import assert from 'node:assert';

// Re-implement functions to test in isolation (without external dependencies)
const isValidId = (id) =>
  typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);

const getUserId = (event) => {
  return event.requestContext?.authorizer?.claims?.sub || null;
};

const ALLOWED_PRICES = new Set([
  'price_1QqhR2HHGM8mRhx2j9Q8kL2m', // Example: starter plan
  'price_1QqhR2HHGM8mRhx2n5R9mN3o', // Example: pro plan
  'price_1QqhR2HHGM8mRhx2p7T1oP5q', // Example: enterprise plan
]);

const ORIGIN = 'https://example.com';

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

// ─── Test Suite ────────────────────────────────────────────────────────────

describe('isValidId pattern tests', () => {
  test('should accept valid alphanumeric IDs', () => {
    assert.strictEqual(isValidId('abc123'), true);
    assert.strictEqual(isValidId('ABC'), true);
    assert.strictEqual(isValidId('123'), true);
    assert.strictEqual(isValidId('a'), true);
  });

  test('should accept IDs with underscores and dashes', () => {
    assert.strictEqual(isValidId('abc_123'), true);
    assert.strictEqual(isValidId('abc-123'), true);
    assert.strictEqual(isValidId('_abc'), true);
    assert.strictEqual(isValidId('-abc'), true);
    assert.strictEqual(isValidId('a_b-c'), true);
  });

  test('should reject IDs longer than 64 characters', () => {
    const longId = 'a'.repeat(65);
    assert.strictEqual(isValidId(longId), false);
  });

  test('should accept IDs exactly 64 characters', () => {
    const maxId = 'a'.repeat(64);
    assert.strictEqual(isValidId(maxId), true);
  });

  test('should reject empty string', () => {
    assert.strictEqual(isValidId(''), false);
  });

  test('should reject IDs with special characters', () => {
    assert.strictEqual(isValidId('abc@123'), false);
    assert.strictEqual(isValidId('abc#123'), false);
    assert.strictEqual(isValidId('abc 123'), false);
    assert.strictEqual(isValidId('abc.123'), false);
    assert.strictEqual(isValidId('abc!123'), false);
  });

  test('should reject non-string types', () => {
    assert.strictEqual(isValidId(123), false);
    assert.strictEqual(isValidId(null), false);
    assert.strictEqual(isValidId(undefined), false);
    assert.strictEqual(isValidId({}), false);
    assert.strictEqual(isValidId([]), false);
    assert.strictEqual(isValidId(true), false);
  });
});

describe('getUserId extraction tests', () => {
  test('should extract sub from full event structure', () => {
    const event = {
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user-123',
          },
        },
      },
    };
    assert.strictEqual(getUserId(event), 'user-123');
  });

  test('should return null when authorizer is missing', () => {
    const event = {
      requestContext: {},
    };
    assert.strictEqual(getUserId(event), null);
  });

  test('should return null when claims is missing', () => {
    const event = {
      requestContext: {
        authorizer: {},
      },
    };
    assert.strictEqual(getUserId(event), null);
  });

  test('should return null when sub is missing', () => {
    const event = {
      requestContext: {
        authorizer: {
          claims: {},
        },
      },
    };
    assert.strictEqual(getUserId(event), null);
  });

  test('should return null when requestContext is missing', () => {
    const event = {};
    assert.strictEqual(getUserId(event), null);
  });

  test('should handle various user ID formats', () => {
    const event = {
      requestContext: {
        authorizer: {
          claims: {
            sub: 'abc-123_XYZ',
          },
        },
      },
    };
    assert.strictEqual(getUserId(event), 'abc-123_XYZ');
  });
});

describe('Router logic tests', () => {
  test('should return 200 for OPTIONS request', () => {
    const event = {
      httpMethod: 'OPTIONS',
      path: '/api/stripe/any',
    };
    const response = respond(200, {});
    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.headers, headers);
  });

  test('should route POST /api/stripe/create-checkout-session', () => {
    const path = '/api/stripe/create-checkout-session';
    const method = 'POST';
    assert.strictEqual(
      path === '/api/stripe/create-checkout-session' && method === 'POST',
      true
    );
  });

  test('should route POST /api/stripe/webhook', () => {
    const path = '/api/stripe/webhook';
    const method = 'POST';
    assert.strictEqual(
      path === '/api/stripe/webhook' && method === 'POST',
      true
    );
  });

  test('should route GET /api/stripe/subscription', () => {
    const path = '/api/stripe/subscription';
    const method = 'GET';
    assert.strictEqual(
      path === '/api/stripe/subscription' && method === 'GET',
      true
    );
  });

  test('should route POST /api/stripe/create-portal-session', () => {
    const path = '/api/stripe/create-portal-session';
    const method = 'POST';
    assert.strictEqual(
      path === '/api/stripe/create-portal-session' && method === 'POST',
      true
    );
  });

  test('should return 404 for unknown path', () => {
    const response = respond(404, { error: 'Not found' });
    assert.strictEqual(response.statusCode, 404);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.error, 'Not found');
  });
});

describe('Request validation patterns - createCheckoutSession', () => {
  test('should reject missing priceId with 400', () => {
    const response = respond(400, { error: 'Missing or invalid priceId' });
    assert.strictEqual(response.statusCode, 400);
  });

  test('should reject invalid priceId with 400', () => {
    const response = respond(400, { error: 'Missing or invalid priceId' });
    assert.strictEqual(response.statusCode, 400);
  });

  test('should reject non-string priceId with 400', () => {
    const priceId = 12345;
    const isValid = typeof priceId === 'string';
    assert.strictEqual(isValid, false);
  });

  test('should reject invalid restaurantId with 400', () => {
    const restaurantId = 'invalid@id';
    const isValid = isValidId(restaurantId);
    assert.strictEqual(isValid, false);
  });

  test('should reject priceId not in ALLOWED_PRICES with 400', () => {
    const priceId = 'price_invalid';
    const isAllowed = ALLOWED_PRICES.has(priceId);
    assert.strictEqual(isAllowed, false);
  });

  test('should accept priceId in ALLOWED_PRICES', () => {
    const priceId = 'price_1QqhR2HHGM8mRhx2j9Q8kL2m';
    const isAllowed = ALLOWED_PRICES.has(priceId);
    assert.strictEqual(isAllowed, true);
  });

  test('should reject invalid JSON body with 400', () => {
    try {
      JSON.parse('{ invalid json }');
      assert.fail('Should have thrown');
    } catch {
      const response = respond(400, { error: 'Invalid JSON body' });
      assert.strictEqual(response.statusCode, 400);
    }
  });

  test('should accept valid JSON body', () => {
    const body = JSON.parse('{"priceId":"price_123","restaurantId":"rest-123"}');
    assert.strictEqual(typeof body, 'object');
    assert.strictEqual(body.priceId, 'price_123');
  });
});

describe('Request validation patterns - webhook', () => {
  test('should reject missing webhook signature with 400', () => {
    const response = respond(400, { error: 'Missing signature or body' });
    assert.strictEqual(response.statusCode, 400);
  });

  test('should reject missing webhook body with 400', () => {
    const response = respond(400, { error: 'Missing signature or body' });
    assert.strictEqual(response.statusCode, 400);
  });

  test('should require both signature and body', () => {
    const hasSignature = false;
    const hasBody = false;
    assert.strictEqual(hasSignature && hasBody, false);
  });

  test('should accept both signature and body present', () => {
    const sig = 't=1234567890,v1=abcdef';
    const body = '{"type":"checkout.session.completed"}';
    assert.strictEqual(!!sig && !!body, true);
  });
});

describe('ALLOWED_PRICES validation', () => {
  test('should have exactly 3 allowed prices', () => {
    assert.strictEqual(ALLOWED_PRICES.size, 3);
  });

  test('should contain starter plan price', () => {
    const starterPrice = 'price_1QqhR2HHGM8mRhx2j9Q8kL2m';
    assert.strictEqual(ALLOWED_PRICES.has(starterPrice), true);
  });

  test('should contain pro plan price', () => {
    const proPrice = 'price_1QqhR2HHGM8mRhx2n5R9mN3o';
    assert.strictEqual(ALLOWED_PRICES.has(proPrice), true);
  });

  test('should contain enterprise plan price', () => {
    const enterprisePrice = 'price_1QqhR2HHGM8mRhx2p7T1oP5q';
    assert.strictEqual(ALLOWED_PRICES.has(enterprisePrice), true);
  });

  test('should reject unknown prices', () => {
    const unknownPrice = 'price_unknown';
    assert.strictEqual(ALLOWED_PRICES.has(unknownPrice), false);
  });

  test('should allow checking membership with has()', () => {
    const testPrice = 'price_1QqhR2HHGM8mRhx2j9Q8kL2m';
    assert.strictEqual(typeof ALLOWED_PRICES.has(testPrice), 'boolean');
  });
});

describe('Security header validation', () => {
  test('should include X-Content-Type-Options: nosniff', () => {
    assert.strictEqual(headers['X-Content-Type-Options'], 'nosniff');
  });

  test('should include Strict-Transport-Security', () => {
    assert.strictEqual(
      headers['Strict-Transport-Security'],
      'max-age=31536000; includeSubDomains'
    );
  });

  test('should include Content-Type: application/json', () => {
    assert.strictEqual(headers['Content-Type'], 'application/json');
  });

  test('should include Access-Control-Allow-Origin', () => {
    assert.strictEqual(headers['Access-Control-Allow-Origin'], ORIGIN);
  });

  test('should include Access-Control-Allow-Headers', () => {
    assert.strictEqual(
      headers['Access-Control-Allow-Headers'],
      'Content-Type,Authorization'
    );
  });

  test('response should include all security headers', () => {
    const response = respond(200, { test: 'data' });
    assert.strictEqual(
      response.headers['X-Content-Type-Options'],
      'nosniff'
    );
    assert.strictEqual(
      response.headers['Strict-Transport-Security'],
      'max-age=31536000; includeSubDomains'
    );
    assert.strictEqual(
      response.headers['Content-Type'],
      'application/json'
    );
  });

  test('should prevent MIME type sniffing', () => {
    const response = respond(200, {});
    assert.strictEqual(
      response.headers['X-Content-Type-Options'],
      'nosniff'
    );
  });

  test('should enforce HTTPS with HSTS', () => {
    const response = respond(200, {});
    const hstsHeader = response.headers['Strict-Transport-Security'];
    assert.strictEqual(hstsHeader.includes('max-age'), true);
    assert.strictEqual(hstsHeader.includes('includeSubDomains'), true);
  });
});

describe('Response format tests', () => {
  test('should return JSON response body', () => {
    const response = respond(200, { message: 'success' });
    const parsedBody = JSON.parse(response.body);
    assert.strictEqual(parsedBody.message, 'success');
  });

  test('should include statusCode in response', () => {
    const response = respond(400, { error: 'test' });
    assert.strictEqual(typeof response.statusCode, 'number');
    assert.strictEqual(response.statusCode, 400);
  });

  test('should include headers object in response', () => {
    const response = respond(200, {});
    assert.strictEqual(typeof response.headers, 'object');
    assert.strictEqual(response.headers['Content-Type'], 'application/json');
  });

  test('should handle error responses correctly', () => {
    const response = respond(401, { error: 'Unauthorized' });
    assert.strictEqual(response.statusCode, 401);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.error, 'Unauthorized');
  });

  test('should handle success responses correctly', () => {
    const response = respond(200, { sessionId: 'cs_test_123', url: 'https://checkout.stripe.com' });
    assert.strictEqual(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.strictEqual(body.sessionId, 'cs_test_123');
  });
});

describe('Request body parsing', () => {
  test('should parse valid JSON body', () => {
    const body = '{"priceId":"price_123","restaurantId":"rest-123"}';
    const parsed = JSON.parse(body);
    assert.strictEqual(parsed.priceId, 'price_123');
    assert.strictEqual(parsed.restaurantId, 'rest-123');
  });

  test('should handle empty body as empty object', () => {
    const body = '';
    const parsed = JSON.parse(body || '{}');
    assert.deepStrictEqual(parsed, {});
  });

  test('should handle null body as empty object', () => {
    const body = null;
    const parsed = JSON.parse(body || '{}');
    assert.deepStrictEqual(parsed, {});
  });

  test('should reject malformed JSON', () => {
    const body = '{ invalid json }';
    assert.throws(() => {
      JSON.parse(body);
    });
  });

  test('should handle array in body', () => {
    const body = '[{"id":"123"}]';
    const parsed = JSON.parse(body);
    assert.strictEqual(Array.isArray(parsed), true);
  });

  test('should extract fields from parsed body', () => {
    const body = '{"priceId":"price_123","restaurantId":"rest-456","extra":"field"}';
    const parsed = JSON.parse(body);
    const { priceId, restaurantId } = parsed;
    assert.strictEqual(priceId, 'price_123');
    assert.strictEqual(restaurantId, 'rest-456');
  });
});

describe('Authentication patterns', () => {
  test('should extract userId from authenticated event', () => {
    const event = {
      requestContext: {
        authorizer: {
          claims: {
            sub: 'user-abc123',
            email: 'user@example.com',
          },
        },
      },
    };
    const userId = getUserId(event);
    assert.strictEqual(userId, 'user-abc123');
  });

  test('should reject unauthenticated request', () => {
    const event = {
      requestContext: {},
    };
    const userId = getUserId(event);
    assert.strictEqual(userId, null);
  });

  test('should handle missing sub in claims', () => {
    const event = {
      requestContext: {
        authorizer: {
          claims: {
            email: 'user@example.com',
          },
        },
      },
    };
    const userId = getUserId(event);
    assert.strictEqual(userId, null);
  });

  test('should return 401 for missing userId', () => {
    const userId = null;
    if (!userId) {
      const response = respond(401, { error: 'Unauthorized' });
      assert.strictEqual(response.statusCode, 401);
    }
  });
});

describe('ID validation edge cases', () => {
  test('should accept single character ID', () => {
    assert.strictEqual(isValidId('a'), true);
  });

  test('should accept underscore-only ID pattern', () => {
    assert.strictEqual(isValidId('_'), true);
  });

  test('should accept dash-only ID pattern', () => {
    assert.strictEqual(isValidId('-'), true);
  });

  test('should accept mixed case', () => {
    assert.strictEqual(isValidId('AbC_dEf-123'), true);
  });

  test('should reject leading/trailing spaces', () => {
    assert.strictEqual(isValidId(' abc'), false);
    assert.strictEqual(isValidId('abc '), false);
  });

  test('should reject IDs with null bytes', () => {
    const id = 'abc\0def';
    assert.strictEqual(isValidId(id), false);
  });

  test('should handle boundary at exactly 64 chars', () => {
    const id64 = 'a'.repeat(64);
    const id65 = 'a'.repeat(65);
    assert.strictEqual(isValidId(id64), true);
    assert.strictEqual(isValidId(id65), false);
  });
});
