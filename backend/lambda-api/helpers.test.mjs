/**
 * Tests for helper functions
 * Run with: node --test helpers.test.mjs
 */

import { test } from 'node:test';
import assert from 'node:assert';
import {
  sanitize,
  isValidId,
  stripDdbKeys,
  calculateTier,
  DDB_KEYS,
} from './helpers.mjs';

// ─── Test sanitize() ──────────────────────────────────────────────────────

test('sanitize: trims whitespace', () => {
  assert.strictEqual(sanitize('  hello  '), 'hello');
  assert.strictEqual(sanitize('\n\ttest\n'), 'test');
});

test('sanitize: truncates to max length', () => {
  const longString = 'a'.repeat(100);
  assert.strictEqual(sanitize(longString, 50).length, 50);
  assert.strictEqual(sanitize(longString, 50), 'a'.repeat(50));
});

test('sanitize: handles default max of 500', () => {
  const string500 = 'x'.repeat(500);
  const string501 = 'x'.repeat(501);
  assert.strictEqual(sanitize(string500).length, 500);
  assert.strictEqual(sanitize(string501).length, 500);
});

test('sanitize: returns empty string for non-strings', () => {
  assert.strictEqual(sanitize(null), '');
  assert.strictEqual(sanitize(undefined), '');
  assert.strictEqual(sanitize(123), '');
  assert.strictEqual(sanitize({}), '');
  assert.strictEqual(sanitize([]), '');
});

test('sanitize: trims before truncating', () => {
  const input = '  ' + 'a'.repeat(100) + '  ';
  const result = sanitize(input, 50);
  assert.strictEqual(result.length, 50);
  assert.strictEqual(result, 'a'.repeat(50));
});

// ─── Test isValidId() ──────────────────────────────────────────────────────

test('isValidId: accepts valid IDs', () => {
  assert.strictEqual(isValidId('abc123'), true);
  assert.strictEqual(isValidId('test_id'), true);
  assert.strictEqual(isValidId('test-id'), true);
  assert.strictEqual(isValidId('a'), true);
  assert.strictEqual(isValidId('Z'), true);
  assert.strictEqual(isValidId('0'), true);
});

test('isValidId: rejects IDs with special characters', () => {
  assert.strictEqual(isValidId('test@id'), false);
  assert.strictEqual(isValidId('test.id'), false);
  assert.strictEqual(isValidId('test id'), false);
  assert.strictEqual(isValidId('test/id'), false);
  assert.strictEqual(isValidId('test#id'), false);
});

test('isValidId: rejects empty string', () => {
  assert.strictEqual(isValidId(''), false);
});

test('isValidId: rejects IDs longer than 64 characters', () => {
  const longId = 'a'.repeat(65);
  assert.strictEqual(isValidId(longId), false);
  const validId = 'a'.repeat(64);
  assert.strictEqual(isValidId(validId), true);
});

test('isValidId: rejects non-strings', () => {
  assert.strictEqual(isValidId(123), false);
  assert.strictEqual(isValidId(null), false);
  assert.strictEqual(isValidId(undefined), false);
  assert.strictEqual(isValidId({ id: 'test' }), false);
  assert.strictEqual(isValidId(['test']), false);
});

// ─── Test stripDdbKeys() ──────────────────────────────────────────────────

test('stripDdbKeys: removes PK and SK', () => {
  const item = {
    PK: 'RESTAURANT#123',
    SK: 'PROFILE',
    name: 'Test Restaurant',
    city: 'NYC',
  };
  const result = stripDdbKeys(item);
  assert.deepStrictEqual(result, { name: 'Test Restaurant', city: 'NYC' });
  assert.strictEqual(result.PK, undefined);
  assert.strictEqual(result.SK, undefined);
});

test('stripDdbKeys: removes GSI1PK and GSI1SK', () => {
  const item = {
    GSI1PK: 'RESTAURANTS',
    GSI1SK: 'NAME#Test',
    name: 'Test',
  };
  const result = stripDdbKeys(item);
  assert.deepStrictEqual(result, { name: 'Test' });
});

test('stripDdbKeys: removes creatorId', () => {
  const item = {
    creatorId: 'user-123',
    name: 'Created Item',
    description: 'A thing',
  };
  const result = stripDdbKeys(item);
  assert.deepStrictEqual(result, { name: 'Created Item', description: 'A thing' });
});

test('stripDdbKeys: keeps all other fields', () => {
  const item = {
    PK: 'key',
    SK: 'sort',
    name: 'Name',
    email: 'test@example.com',
    isPartner: true,
    count: 42,
    nested: { value: 'obj' },
  };
  const result = stripDdbKeys(item);
  assert.deepStrictEqual(result, {
    name: 'Name',
    email: 'test@example.com',
    isPartner: true,
    count: 42,
    nested: { value: 'obj' },
  });
});

test('stripDdbKeys: handles empty object', () => {
  const result = stripDdbKeys({});
  assert.deepStrictEqual(result, {});
});

test('stripDdbKeys: handles object with only DDB keys', () => {
  const item = { PK: 'p', SK: 's', GSI1PK: 'g1', GSI1SK: 'g1s', creatorId: 'u1' };
  const result = stripDdbKeys(item);
  assert.deepStrictEqual(result, {});
});

// ─── Test calculateTier() ─────────────────────────────────────────────────

test('calculateTier: returns bronze for less than 5', () => {
  assert.strictEqual(calculateTier(0), 'bronze');
  assert.strictEqual(calculateTier(1), 'bronze');
  assert.strictEqual(calculateTier(4), 'bronze');
});

test('calculateTier: returns silver for 5-14', () => {
  assert.strictEqual(calculateTier(5), 'silver');
  assert.strictEqual(calculateTier(10), 'silver');
  assert.strictEqual(calculateTier(14), 'silver');
});

test('calculateTier: returns gold for 15 and above', () => {
  assert.strictEqual(calculateTier(15), 'gold');
  assert.strictEqual(calculateTier(20), 'gold');
  assert.strictEqual(calculateTier(1000), 'gold');
});

test('calculateTier: tier boundaries are correct', () => {
  // Just below silver
  assert.strictEqual(calculateTier(4), 'bronze');
  // At silver threshold
  assert.strictEqual(calculateTier(5), 'silver');
  // Just below gold
  assert.strictEqual(calculateTier(14), 'silver');
  // At gold threshold
  assert.strictEqual(calculateTier(15), 'gold');
});

// ─── Test DDB_KEYS constant ───────────────────────────────────────────────

test('DDB_KEYS: is a Set with expected keys', () => {
  assert(DDB_KEYS instanceof Set);
  assert.strictEqual(DDB_KEYS.has('PK'), true);
  assert.strictEqual(DDB_KEYS.has('SK'), true);
  assert.strictEqual(DDB_KEYS.has('GSI1PK'), true);
  assert.strictEqual(DDB_KEYS.has('GSI1SK'), true);
  assert.strictEqual(DDB_KEYS.has('creatorId'), true);
});
