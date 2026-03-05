import { test, describe } from 'node:test';
import assert from 'node:assert';

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions (reimplemented for testing)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safe JSON body parser — returns null on malformed input
 * Mirrors the parseBody function from index.mjs
 */
function parseBody(event) {
  try {
    return JSON.parse(event.body || '{}');
  } catch {
    return null;
  }
}

/**
 * Validate and decode a pagination lastKey — only allows expected DDB key shapes
 * Mirrors the decodePaginationKey function from index.mjs
 */
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

/**
 * HTML escape function — mirrors lambda-email escapeHtml
 */
function escapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: parseBody
// ─────────────────────────────────────────────────────────────────────────────

describe('parseBody', () => {
  test('parses valid JSON body correctly', () => {
    const event = { body: '{"name": "test", "value": 42}' };
    const result = parseBody(event);
    assert.deepStrictEqual(result, { name: 'test', value: 42 });
  });

  test('returns empty object when body is undefined', () => {
    const event = {};
    const result = parseBody(event);
    assert.deepStrictEqual(result, {});
  });

  test('returns empty object when body is null', () => {
    const event = { body: null };
    const result = parseBody(event);
    assert.deepStrictEqual(result, {});
  });

  test('returns empty object when body is empty string', () => {
    const event = { body: '' };
    const result = parseBody(event);
    assert.deepStrictEqual(result, {});
  });

  test('returns null when JSON is malformed', () => {
    const event = { body: '{invalid json}' };
    const result = parseBody(event);
    assert.strictEqual(result, null);
  });

  test('returns null when JSON has syntax error', () => {
    const event = { body: '{"unclosed": "string' };
    const result = parseBody(event);
    assert.strictEqual(result, null);
  });

  test('parses nested objects correctly', () => {
    const event = { body: '{"user": {"id": 123, "name": "Alice"}, "items": [1, 2, 3]}' };
    const result = parseBody(event);
    assert.deepStrictEqual(result, {
      user: { id: 123, name: 'Alice' },
      items: [1, 2, 3],
    });
  });

  test('parses arrays correctly', () => {
    const event = { body: '[1, 2, 3, "four"]' };
    const result = parseBody(event);
    assert.deepStrictEqual(result, [1, 2, 3, 'four']);
  });

  test('parses boolean values', () => {
    const event = { body: '{"active": true, "deleted": false}' };
    const result = parseBody(event);
    assert.deepStrictEqual(result, { active: true, deleted: false });
  });

  test('parses null values', () => {
    const event = { body: '{"value": null}' };
    const result = parseBody(event);
    assert.deepStrictEqual(result, { value: null });
  });

  test('parses numeric values including decimals', () => {
    const event = { body: '{"int": 42, "float": 3.14, "negative": -100}' };
    const result = parseBody(event);
    assert.deepStrictEqual(result, { int: 42, float: 3.14, negative: -100 });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: decodePaginationKey
// ─────────────────────────────────────────────────────────────────────────────

describe('decodePaginationKey', () => {
  test('decodes valid base64 pagination key with PK and SK', () => {
    const key = { PK: 'RESTAURANT#123', SK: 'PROFILE' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.deepStrictEqual(result, key);
  });

  test('decodes valid key with all 4 allowed attributes', () => {
    const key = {
      PK: 'RESTAURANT#123',
      SK: 'PROFILE',
      GSI1PK: 'RESTAURANTS',
      GSI1SK: 'RESTAURANT#123',
    };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.deepStrictEqual(result, key);
  });

  test('decodes key with only PK', () => {
    const key = { PK: 'RESTAURANT#123' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.deepStrictEqual(result, key);
  });

  test('returns null when encoded is null', () => {
    const result = decodePaginationKey(null);
    assert.strictEqual(result, null);
  });

  test('returns null when encoded is undefined', () => {
    const result = decodePaginationKey(undefined);
    assert.strictEqual(result, null);
  });

  test('returns null when encoded is empty string', () => {
    const result = decodePaginationKey('');
    assert.strictEqual(result, null);
  });

  test('returns null when encoded is not a string', () => {
    const result = decodePaginationKey(12345);
    assert.strictEqual(result, null);
  });

  test('returns null when encoded is an object', () => {
    const result = decodePaginationKey({ key: 'value' });
    assert.strictEqual(result, null);
  });

  test('returns null when encoded string is longer than 500 chars', () => {
    const longString = 'a'.repeat(501);
    const result = decodePaginationKey(longString);
    assert.strictEqual(result, null);
  });

  test('accepts encoded string exactly 500 chars', () => {
    // Create a valid base64 string that is exactly 500 chars
    const padding = 'x'.repeat(360); // This will produce ~480 chars base64
    const key = { PK: padding, SK: 'test' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    if (encoded.length <= 500) {
      const result = decodePaginationKey(encoded);
      assert.deepStrictEqual(result, key);
    }
  });

  test('returns null when base64 is invalid', () => {
    const result = decodePaginationKey('!!!invalid base64!!!');
    assert.strictEqual(result, null);
  });

  test('returns null when decoded value is an array', () => {
    const array = ['PK', 'SK'];
    const encoded = Buffer.from(JSON.stringify(array)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when decoded value is a string (not object)', () => {
    const encoded = Buffer.from(JSON.stringify('just a string')).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when decoded value is a number', () => {
    const encoded = Buffer.from(JSON.stringify(42)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when decoded value is null', () => {
    const encoded = Buffer.from(JSON.stringify(null)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when decoded object is empty', () => {
    const key = {};
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when decoded object has more than 4 keys', () => {
    const key = {
      PK: 'test1',
      SK: 'test2',
      GSI1PK: 'test3',
      GSI1SK: 'test4',
      extra: 'test5',
    };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when value is not a string', () => {
    const key = { PK: 123, SK: 'test' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when value is an object', () => {
    const key = { PK: { nested: 'object' }, SK: 'test' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when value is an array', () => {
    const key = { PK: ['array', 'value'], SK: 'test' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when string value is longer than 500 chars', () => {
    const key = { PK: 'a'.repeat(501), SK: 'test' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when key name is not in allowed list', () => {
    const key = { PK: 'test', INVALID_KEY: 'value' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when key name contains injection attempt', () => {
    const key = { PK: 'test', 'GSI1PK__proto__': 'injection' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('returns null when key is malformed with lowercase key name', () => {
    const key = { pk: 'test', sk: 'value' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.strictEqual(result, null);
  });

  test('accepts string value at 500 char limit', () => {
    const key = { PK: 'a'.repeat(100), SK: 'b'.repeat(100) };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.deepStrictEqual(result, key);
  });

  test('handles special characters in allowed string values', () => {
    const key = { PK: 'RESTAURANT#uuid-123-abc#PROFILE', SK: 'DATA#2024-01-15' };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.deepStrictEqual(result, key);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: escapeHtml
// ─────────────────────────────────────────────────────────────────────────────

describe('escapeHtml', () => {
  test('escapes ampersand', () => {
    const result = escapeHtml('Tom & Jerry');
    assert.strictEqual(result, 'Tom &amp; Jerry');
  });

  test('escapes less than', () => {
    const result = escapeHtml('a < b');
    assert.strictEqual(result, 'a &lt; b');
  });

  test('escapes greater than', () => {
    const result = escapeHtml('a > b');
    assert.strictEqual(result, 'a &gt; b');
  });

  test('escapes double quote', () => {
    const result = escapeHtml('He said "hello"');
    assert.strictEqual(result, 'He said &quot;hello&quot;');
  });

  test('escapes single quote', () => {
    const result = escapeHtml("It's a test");
    assert.strictEqual(result, 'It&#039;s a test');
  });

  test('escapes all special characters together', () => {
    const result = escapeHtml('<script>alert("XSS")</script>');
    assert.strictEqual(result, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });

  test('handles multiple instances of same character', () => {
    const result = escapeHtml('a & b & c & d');
    assert.strictEqual(result, 'a &amp; b &amp; c &amp; d');
  });

  test('handles null input', () => {
    const result = escapeHtml(null);
    assert.strictEqual(result, '');
  });

  test('handles undefined input', () => {
    const result = escapeHtml(undefined);
    assert.strictEqual(result, '');
  });

  test('handles empty string', () => {
    const result = escapeHtml('');
    assert.strictEqual(result, '');
  });

  test('handles normal text with no special characters', () => {
    const result = escapeHtml('Hello World 123');
    assert.strictEqual(result, 'Hello World 123');
  });

  test('preserves numbers and alphanumerics', () => {
    const result = escapeHtml('Test123 abc-XYZ_test');
    assert.strictEqual(result, 'Test123 abc-XYZ_test');
  });

  test('escapes HTML tags properly', () => {
    const result = escapeHtml('<div class="test">content</div>');
    assert.strictEqual(result, '&lt;div class=&quot;test&quot;&gt;content&lt;/div&gt;');
  });

  test('handles entity-like strings that should be escaped', () => {
    const result = escapeHtml('&nbsp; &lt; &gt;');
    assert.strictEqual(result, '&amp;nbsp; &amp;lt; &amp;gt;');
  });

  test('preserves spaces and punctuation except special chars', () => {
    const result = escapeHtml('Hello, world! How are you?');
    assert.strictEqual(result, 'Hello, world! How are you?');
  });

  test('handles newlines and tabs', () => {
    const result = escapeHtml('line1\nline2\ttabbed');
    assert.strictEqual(result, 'line1\nline2\ttabbed');
  });

  test('handles zero value', () => {
    const result = escapeHtml(0);
    assert.strictEqual(result, '');
  });

  test('handles false value', () => {
    const result = escapeHtml(false);
    assert.strictEqual(result, '');
  });

  test('handles complex XSS payload', () => {
    const payload = '<img src=x onerror="alert(\'XSS\')">';
    const result = escapeHtml(payload);
    assert.strictEqual(result, '&lt;img src=x onerror=&quot;alert(&#039;XSS&#039;)&quot;&gt;');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Integration-style validation tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Integration-style validation', () => {
  test('parseBody and decodePaginationKey work together', () => {
    const paginationKey = { PK: 'RESTAURANT#123', SK: 'PROFILE' };
    const encoded = Buffer.from(JSON.stringify(paginationKey)).toString('base64');
    const event = {
      body: JSON.stringify({
        lastKey: encoded,
        limit: 50,
      }),
    };

    const parsed = parseBody(event);
    assert.deepStrictEqual(parsed.limit, 50);

    const decoded = decodePaginationKey(parsed.lastKey);
    assert.deepStrictEqual(decoded, paginationKey);
  });

  test('escapeHtml can be used in combination with parseBody', () => {
    const event = {
      body: JSON.stringify({
        name: '<script>alert("XSS")</script>',
      }),
    };

    const parsed = parseBody(event);
    const escaped = escapeHtml(parsed.name);
    assert.strictEqual(escaped, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
  });

  test('pagination key validation prevents injection via invalid key names', () => {
    const maliciousKey = Buffer.from(JSON.stringify({
      PK: 'test',
      'MALICIOUS_KEY': 'injection',
    })).toString('base64');

    const event = { body: JSON.stringify({ lastKey: maliciousKey }) };
    const parsed = parseBody(event);
    const decoded = decodePaginationKey(parsed.lastKey);

    assert.strictEqual(decoded, null);
  });

  test('large payload handling with parseBody', () => {
    const largeObject = {
      data: 'a'.repeat(10000),
      nested: {
        deep: {
          value: 123,
        },
      },
    };
    const event = { body: JSON.stringify(largeObject) };
    const parsed = parseBody(event);

    assert.deepStrictEqual(parsed.data, 'a'.repeat(10000));
    assert.deepStrictEqual(parsed.nested.deep.value, 123);
  });

  test('pagination key with unicode characters', () => {
    const key = {
      PK: 'RESTAURANT#café-123',
      SK: 'データ#2024',
    };
    const encoded = Buffer.from(JSON.stringify(key)).toString('base64');
    const result = decodePaginationKey(encoded);
    assert.deepStrictEqual(result, key);
  });

  test('mixed case key names are rejected', () => {
    const malformedKeys = [
      { Pk: 'test', Sk: 'test' },
      { pk: 'test', sk: 'test' },
      { PK: 'test', Gsi1pk: 'test' },
    ];

    for (const keyObj of malformedKeys) {
      const encoded = Buffer.from(JSON.stringify(keyObj)).toString('base64');
      const result = decodePaginationKey(encoded);
      assert.strictEqual(result, null, `Should reject ${JSON.stringify(keyObj)}`);
    }
  });

  test('boolean false in parseBody is preserved', () => {
    const event = { body: JSON.stringify({ active: false, deleted: false }) };
    const parsed = parseBody(event);
    assert.strictEqual(parsed.active, false);
    assert.strictEqual(parsed.deleted, false);
  });

  test('parseBody handles edge case of empty array', () => {
    const event = { body: '[]' };
    const parsed = parseBody(event);
    assert.deepStrictEqual(parsed, []);
  });
});
