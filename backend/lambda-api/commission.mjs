/**
 * Commission / revenue-split engine — pure functions, no I/O.
 *
 * This is the heart of Spot's "split design": a restaurant pays a small fee on
 * POS-*attributed* sales (never upfront — see business-context "nobody gets
 * exploited"), and that fee is split between the creator who drove the visit
 * and the platform. Creators are paid out via Stripe Connect.
 *
 * Money is handled in integer **cents** throughout to avoid floating-point
 * drift — the same unit Stripe transfers use. Convert at the edges with
 * dollarsToCents / centsToDollars.
 *
 * Defaults are overridable per-environment (env vars) and per-restaurant
 * (a COMMISSION_CONFIG item), resolved by resolveCommissionConfig().
 */

// ─── Defaults (overridable via env, then per-restaurant) ──────────────────────
// Restaurant fee as a fraction of attributed sales. Decision: 12%.
export const DEFAULT_FEE_PCT = 0.12;
// Creator's share of that fee. Decision: 60% creator / 40% platform.
export const DEFAULT_CREATOR_SHARE_PCT = 0.60;
// Per-restaurant monthly fee ceiling, in cents. Protects scarce early partners
// from a shock bill on a viral month. 0 (or negative) means uncapped.
export const DEFAULT_MONTHLY_CAP_CENTS = 50000; // $500

const clampFraction = (n, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(1, Math.max(0, v));
};

export function dollarsToCents(dollars) {
  const v = Number(dollars);
  if (!Number.isFinite(v) || v <= 0) return 0;
  return Math.round(v * 100);
}

export function centsToDollars(cents) {
  return Math.round(Number(cents) || 0) / 100;
}

/**
 * Resolve effective config from env defaults + an optional per-restaurant
 * override item ({ feePct, creatorSharePct, monthlyCapCents, enabled }).
 * Per-restaurant values win; anything missing falls back to env, then code.
 */
export function resolveCommissionConfig(override = null, env = process.env) {
  const feePct = clampFraction(
    override?.feePct ?? env.SPOT_COMMISSION_FEE_PCT,
    DEFAULT_FEE_PCT
  );
  const creatorSharePct = clampFraction(
    override?.creatorSharePct ?? env.SPOT_CREATOR_SHARE_PCT,
    DEFAULT_CREATOR_SHARE_PCT
  );
  const rawCap = override?.monthlyCapCents ?? env.SPOT_MONTHLY_CAP_CENTS;
  const monthlyCapCents = rawCap === undefined || rawCap === null || rawCap === ''
    ? DEFAULT_MONTHLY_CAP_CENTS
    : Math.max(0, Math.round(Number(rawCap) || 0));
  // A restaurant can be explicitly opted out of commission billing.
  const enabled = override?.enabled !== false;
  return { feePct, creatorSharePct, monthlyCapCents, enabled };
}

/**
 * Compute the commission for a single accrual of attributed sales, honoring a
 * per-period (monthly) cap that has already accrued `priorFeeThisPeriodCents`.
 *
 * Returns everything the caller needs to write ledger entries:
 *   - rawFeeCents:      fee before the cap
 *   - feeCents:         fee actually charged this accrual (after cap room)
 *   - creatorCutCents:  creator's share of feeCents
 *   - platformCutCents: remainder (kept by Spot) — gets any rounding cent
 *   - capReached:       true if the cap limited this accrual or is now hit
 *   - remainingCapCents: cap room left after this accrual (Infinity if uncapped)
 */
export function computeCommission({
  grossSaleCents,
  feePct = DEFAULT_FEE_PCT,
  creatorSharePct = DEFAULT_CREATOR_SHARE_PCT,
  monthlyCapCents = DEFAULT_MONTHLY_CAP_CENTS,
  priorFeeThisPeriodCents = 0,
} = {}) {
  const gross = Math.max(0, Math.round(Number(grossSaleCents) || 0));
  const fee = clampFraction(feePct, DEFAULT_FEE_PCT);
  const share = clampFraction(creatorSharePct, DEFAULT_CREATOR_SHARE_PCT);
  const cap = Math.max(0, Math.round(Number(monthlyCapCents) || 0));
  const prior = Math.max(0, Math.round(Number(priorFeeThisPeriodCents) || 0));

  const rawFeeCents = Math.round(gross * fee);

  // Apply remaining monthly cap room (cap === 0 means uncapped).
  const uncapped = cap === 0;
  const roomCents = uncapped ? Infinity : Math.max(0, cap - prior);
  const feeCents = Math.min(rawFeeCents, roomCents);

  // Split the *charged* fee. Platform absorbs the rounding remainder so the
  // two cuts always sum exactly to feeCents.
  const creatorCutCents = Math.round(feeCents * share);
  const platformCutCents = feeCents - creatorCutCents;

  const remainingCapCents = uncapped ? Infinity : Math.max(0, roomCents - feeCents);
  const capReached = !uncapped && (feeCents < rawFeeCents || remainingCapCents === 0);

  return {
    grossSaleCents: gross,
    rawFeeCents,
    feeCents,
    creatorCutCents,
    platformCutCents,
    capReached,
    remainingCapCents,
  };
}

/** YYYY-MM billing period for a Date (UTC), used as the ledger partition. */
export function billingPeriod(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
