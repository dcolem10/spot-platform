/**
 * Pure helper functions for the Lambda API.
 * These are extracted for testability and reusability.
 */
import { createHash } from 'crypto';

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
export const DDB_KEYS = new Set([
  // DynamoDB internal keys
  'PK', 'SK', 'GSI1PK', 'GSI1SK', 'GSI2PK', 'GSI2SK', 'GSI3PK', 'GSI3SK',
  'creatorId', 'ttl',
  // OAuth / auth secrets — must never leak to clients
  'oauthState', 'codeVerifier', 'codeChallenge', 'accessToken', 'refreshToken',
  // API / webhook secrets — future-proof blocklist
  'apiKey', 'apiSecret', 'webhookSecret', 'merchantSecret', 'secretKey',
  'stripeCustomerId', 'internalNotes',
]);

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
/**
 * Normalize an email address for deduplication
 * @param {string} email - Email to normalize
 * @returns {string|null} Normalized email or null if invalid
 */
export function normalizeEmail(email) {
  if (typeof email !== 'string') return null;
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length > 255 || trimmed.length < 5) return null;
  // Basic email format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Create a privacy-safe hash of an IP address with a salt
 * @param {string} ip - IP address
 * @param {string} salt - Per-raffle salt (e.g., raffleId)
 * @returns {string} SHA-256 hex hash
 */
export function hashIp(ip, salt) {
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}

export function calculateTier(count) {
  if (count >= 15) return 'gold';
  if (count >= 5) return 'silver';
  return 'bronze';
}

/**
 * Escape HTML special characters to prevent XSS in email templates.
 * @param {string} text - Raw text to escape
 * @returns {string} HTML-safe text
 */
const HTML_ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
export function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPE_MAP[c]);
}
