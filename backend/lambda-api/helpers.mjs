/**
 * Pure helper functions for the Lambda API.
 * These are extracted for testability and reusability.
 */

/**
 * Sanitize and truncate a string value
 * @param {*} s - Value to sanitize
 * @param {number} max - Maximum length (default 500)
 * @returns {string} Trimmed and truncated string, or empty string if not a string
 */
export function sanitize(s, max = 500) {
  return typeof s === 'string' ? s.trim().slice(0, max) : '';
}

/**
 * Validate if an ID matches expected format
 * @param {*} id - ID to validate
 * @returns {boolean} True if ID is valid (alphanumeric, underscore, dash, 1-64 chars)
 */
export function isValidId(id) {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(id);
}

/**
 * DynamoDB internal keys that should be stripped from responses
 */
export const DDB_KEYS = new Set(['PK', 'SK', 'GSI1PK', 'GSI1SK', 'creatorId']);

/**
 * Remove DynamoDB internal keys from an item
 * @param {Object} item - DynamoDB item
 * @returns {Object} Item with DDB keys removed
 */
export function stripDdbKeys(item) {
  const clean = {};
  for (const [k, v] of Object.entries(item)) {
    if (!DDB_KEYS.has(k)) clean[k] = v;
  }
  return clean;
}

/**
 * Calculate ambassador tier based on referral count
 * @param {number} count - Referral count
 * @returns {string} Tier: 'bronze' (<5), 'silver' (5-14), 'gold' (15+)
 */
export function calculateTier(count) {
  if (count >= 15) return 'gold';
  if (count >= 5) return 'silver';
  return 'bronze';
}
