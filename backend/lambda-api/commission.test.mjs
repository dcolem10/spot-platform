import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  computeCommission,
  resolveCommissionConfig,
  dollarsToCents,
  centsToDollars,
  billingPeriod,
  DEFAULT_FEE_PCT,
  DEFAULT_CREATOR_SHARE_PCT,
  DEFAULT_MONTHLY_CAP_CENTS,
} from './commission.mjs';

describe('dollarsToCents / centsToDollars', () => {
  test('rounds dollars to integer cents', () => {
    assert.strictEqual(dollarsToCents(85), 8500);
    assert.strictEqual(dollarsToCents(48.99), 4899);
    assert.strictEqual(dollarsToCents(0.1 + 0.2), 30); // float-safe
  });
  test('non-positive or invalid dollars become 0', () => {
    assert.strictEqual(dollarsToCents(-5), 0);
    assert.strictEqual(dollarsToCents('abc'), 0);
    assert.strictEqual(dollarsToCents(undefined), 0);
  });
  test('centsToDollars inverts', () => {
    assert.strictEqual(centsToDollars(8500), 85);
    assert.strictEqual(centsToDollars(4899), 48.99);
  });
});

describe('computeCommission — basic split', () => {
  test('$85 attributed at 12% fee, 60/40 split', () => {
    const r = computeCommission({
      grossSaleCents: 8500,
      feePct: 0.12,
      creatorSharePct: 0.60,
      monthlyCapCents: 0, // uncapped for this case
    });
    assert.strictEqual(r.rawFeeCents, 1020); // $10.20
    assert.strictEqual(r.feeCents, 1020);
    assert.strictEqual(r.creatorCutCents, 612); // $6.12
    assert.strictEqual(r.platformCutCents, 408); // $4.08
    assert.strictEqual(r.capReached, false);
  });

  test('cuts always sum to the charged fee (rounding remainder to platform)', () => {
    // 333 cents * 0.6 = 199.8 -> creator 200, platform 133? check exact sum
    const r = computeCommission({ grossSaleCents: 2775, feePct: 0.12, creatorSharePct: 0.6, monthlyCapCents: 0 });
    assert.strictEqual(r.creatorCutCents + r.platformCutCents, r.feeCents);
  });

  test('uses documented defaults when pcts omitted', () => {
    const r = computeCommission({ grossSaleCents: 10000, monthlyCapCents: 0 });
    assert.strictEqual(r.feeCents, Math.round(10000 * DEFAULT_FEE_PCT));
    assert.strictEqual(r.creatorCutCents, Math.round(r.feeCents * DEFAULT_CREATOR_SHARE_PCT));
  });
});

describe('computeCommission — monthly cap', () => {
  test('caps the fee when prior accrual leaves limited room', () => {
    // cap $50 = 5000c, already accrued 4500c -> only 500c room
    const r = computeCommission({
      grossSaleCents: 50000, // raw fee would be 6000c
      feePct: 0.12,
      creatorSharePct: 0.6,
      monthlyCapCents: 5000,
      priorFeeThisPeriodCents: 4500,
    });
    assert.strictEqual(r.rawFeeCents, 6000);
    assert.strictEqual(r.feeCents, 500); // clamped to remaining room
    assert.strictEqual(r.capReached, true);
    assert.strictEqual(r.remainingCapCents, 0);
  });

  test('no fee once cap already fully accrued', () => {
    const r = computeCommission({
      grossSaleCents: 10000,
      monthlyCapCents: 5000,
      priorFeeThisPeriodCents: 5000,
    });
    assert.strictEqual(r.feeCents, 0);
    assert.strictEqual(r.creatorCutCents, 0);
    assert.strictEqual(r.platformCutCents, 0);
    assert.strictEqual(r.capReached, true);
  });

  test('cap of 0 means uncapped', () => {
    const r = computeCommission({ grossSaleCents: 1000000, monthlyCapCents: 0 });
    assert.strictEqual(r.feeCents, r.rawFeeCents);
    assert.strictEqual(r.remainingCapCents, Infinity);
    assert.strictEqual(r.capReached, false);
  });
});

describe('computeCommission — guards', () => {
  test('negative / invalid gross yields zero fee', () => {
    assert.strictEqual(computeCommission({ grossSaleCents: -500 }).feeCents, 0);
    assert.strictEqual(computeCommission({ grossSaleCents: 'x' }).feeCents, 0);
    assert.strictEqual(computeCommission({}).feeCents, 0);
  });
  test('out-of-range percentages are clamped to [0,1]', () => {
    const hi = computeCommission({ grossSaleCents: 10000, feePct: 5, creatorSharePct: 9, monthlyCapCents: 0 });
    assert.strictEqual(hi.feeCents, 10000); // feePct clamped to 1.0
    assert.strictEqual(hi.creatorCutCents, 10000); // share clamped to 1.0
    const lo = computeCommission({ grossSaleCents: 10000, feePct: -1, monthlyCapCents: 0 });
    assert.strictEqual(lo.feeCents, 0);
  });
});

describe('resolveCommissionConfig', () => {
  test('falls back to code defaults with no env/override', () => {
    const c = resolveCommissionConfig(null, {});
    assert.strictEqual(c.feePct, DEFAULT_FEE_PCT);
    assert.strictEqual(c.creatorSharePct, DEFAULT_CREATOR_SHARE_PCT);
    assert.strictEqual(c.monthlyCapCents, DEFAULT_MONTHLY_CAP_CENTS);
    assert.strictEqual(c.enabled, true);
  });
  test('env overrides defaults', () => {
    const c = resolveCommissionConfig(null, {
      SPOT_COMMISSION_FEE_PCT: '0.15',
      SPOT_CREATOR_SHARE_PCT: '0.5',
      SPOT_MONTHLY_CAP_CENTS: '100000',
    });
    assert.strictEqual(c.feePct, 0.15);
    assert.strictEqual(c.creatorSharePct, 0.5);
    assert.strictEqual(c.monthlyCapCents, 100000);
  });
  test('per-restaurant override wins over env', () => {
    const c = resolveCommissionConfig(
      { feePct: 0.08, monthlyCapCents: 20000, enabled: false },
      { SPOT_COMMISSION_FEE_PCT: '0.15' }
    );
    assert.strictEqual(c.feePct, 0.08);
    assert.strictEqual(c.monthlyCapCents, 20000);
    assert.strictEqual(c.enabled, false);
  });
});

describe('billingPeriod', () => {
  test('formats YYYY-MM in UTC', () => {
    assert.strictEqual(billingPeriod(new Date('2026-06-19T12:00:00Z')), '2026-06');
    assert.strictEqual(billingPeriod(new Date('2026-01-01T00:00:00Z')), '2026-01');
  });
});
