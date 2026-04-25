import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimate, type EstimateInput } from '../src/lib/overcharge';
import { getIncrease } from '../src/lib/rgb';

const ASOF_TODAY = '2026-04-25';

function near(actual: number, expected: number, tolerance = 0.05) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `expected ~${expected} (±${tolerance}), got ${actual}`,
  );
}

test('rgb: 2023-10-01 1-year is 3.0%, 2-year is 6.04%', () => {
  const oneYr = getIncrease('2023-10-01', 12);
  const twoYr = getIncrease('2023-10-01', 24);
  assert.equal(oneYr?.pct, 3.0);
  assert.equal(twoYr?.pct, 6.04);
  assert.equal(oneYr?.orderNo, 55);
});

test('rgb: returns null for dates before any RGB order', () => {
  const result = getIncrease('1960-01-01', 12);
  assert.equal(result, null);
});

test('overcharge: rent at exactly RGB ceiling produces no overcharge', () => {
  const input: EstimateInput = {
    history: [
      { startDate: '2022-10-01', endDate: '2023-09-30', monthlyRent: 2000, leaseTermMonths: 12 },
      { startDate: '2023-10-01', endDate: '2024-09-30', monthlyRent: 2060, leaseTermMonths: 12 },
    ],
    asOfDate: ASOF_TODAY,
  };
  const result = estimate(input);
  assert.equal(result.mode, 'history_only');
  assert.equal(result.overcharge_monthly, 0);
  assert.equal(result.overcharge_total_within_limit, 0);
  assert.equal(result.years_analyzed.length, 1);
  assert.equal(result.years_analyzed[0].allowed_pct, 3.0);
  near(result.years_analyzed[0].legal_monthly, 2060);
});

test('overcharge: mid-stream jump above RGB is flagged', () => {
  const input: EstimateInput = {
    history: [
      { startDate: '2022-10-01', endDate: '2023-09-30', monthlyRent: 2000, leaseTermMonths: 12 },
      { startDate: '2023-10-01', endDate: '2024-09-30', monthlyRent: 2200, leaseTermMonths: 12 },
    ],
    asOfDate: ASOF_TODAY,
  };
  const result = estimate(input);
  near(result.years_analyzed[0].legal_monthly, 2060);
  near(result.years_analyzed[0].overcharge_monthly, 140);
  near(result.legal_rent_monthly, 2060);
  assert.equal(result.actual_rent_monthly, 2200);
  near(result.overcharge_monthly, 140);
  // 12 months × $140 ≈ $1680
  near(result.overcharge_total_within_limit, 1680, 5);
});

test('overcharge: undercharge in later year does NOT offset prior overcharge', () => {
  const input: EstimateInput = {
    history: [
      { startDate: '2022-10-01', endDate: '2023-09-30', monthlyRent: 2000, leaseTermMonths: 12 },
      { startDate: '2023-10-01', endDate: '2024-09-30', monthlyRent: 2200, leaseTermMonths: 12 },
      // 2024-10-01: order 56, 1yr=2.75%. Legal compounds on prior LEGAL (2060) → 2060 × 1.0275 = 2116.65.
      // User charged 2050 — below legal, no overcharge for this year (and we don't credit them back).
      { startDate: '2024-10-01', endDate: '2025-09-30', monthlyRent: 2050, leaseTermMonths: 12 },
    ],
    asOfDate: ASOF_TODAY,
  };
  const result = estimate(input);
  assert.equal(result.years_analyzed.length, 2);
  near(result.years_analyzed[0].overcharge_monthly, 140); // 2023-10
  assert.equal(result.years_analyzed[1].overcharge_monthly, 0); // 2024-10 undercharged
  // Total only counts the year-2 overcharge.
  near(result.overcharge_total_within_limit, 1680, 5);
  // Note: the latest "legal" rent (2116.65) > "actual" (2050) — no current overcharge.
  assert.equal(result.overcharge_monthly, 0);
});

test('overcharge: with registered base rent walks forward from base', () => {
  const input: EstimateInput = {
    history: [
      { startDate: '2022-10-01', endDate: '2023-09-30', monthlyRent: 1100, leaseTermMonths: 12 },
    ],
    baseRent: { amount: 1000, asOfDate: '2022-01-01', termMonths: 12 },
    asOfDate: ASOF_TODAY,
  };
  const result = estimate(input);
  assert.equal(result.mode, 'with_base_rent');
  // Order 54 (2022-10-01): 1yr = 3.25%. 1000 × 1.0325 = 1032.50
  near(result.years_analyzed[0].legal_monthly, 1032.5);
  near(result.years_analyzed[0].overcharge_monthly, 67.5);
  near(result.overcharge_total_within_limit, 67.5 * 12, 5);
});

test('overcharge: pre-statute leases do not count toward 4-year window total', () => {
  // asOfDate = 2026-04-25 → statute starts 2022-04-25.
  // Lease 1 (2018-19) is baseline. Lease 2 (2019-20) is overcharged but pre-statute.
  // Lease 3 (2023-24) is overcharged and inside the window.
  const input: EstimateInput = {
    history: [
      { startDate: '2018-10-01', endDate: '2019-09-30', monthlyRent: 1500, leaseTermMonths: 12 },
      { startDate: '2019-10-01', endDate: '2020-09-30', monthlyRent: 1700, leaseTermMonths: 12 },
      { startDate: '2023-10-01', endDate: '2024-09-30', monthlyRent: 1800, leaseTermMonths: 12 },
    ],
    asOfDate: ASOF_TODAY,
  };
  const result = estimate(input);
  assert.equal(result.years_analyzed.length, 2);

  // Year 2 (2019-10): pre-statute. Has overcharge but window-clipped to 0.
  const y2 = result.years_analyzed[0];
  assert.ok(y2.overcharge_monthly > 0, 'year 2 should show monthly overcharge');
  assert.equal(y2.months_within_limit, 0);
  assert.equal(y2.overcharge_within_limit, 0);

  // Year 3 (2023-10): inside window, ~12 months counted.
  const y3 = result.years_analyzed[1];
  assert.ok(y3.overcharge_monthly > 0, 'year 3 should show monthly overcharge');
  near(y3.months_within_limit, 12, 0.5);
  near(y3.overcharge_within_limit, y3.overcharge_monthly * 12, 5);

  near(result.overcharge_total_within_limit, y3.overcharge_within_limit, 5);
});

test('overcharge: empty history returns zeros with caveat', () => {
  const result = estimate({ history: [], asOfDate: ASOF_TODAY });
  assert.equal(result.actual_rent_monthly, 0);
  assert.equal(result.legal_rent_monthly, 0);
  assert.equal(result.overcharge_monthly, 0);
  assert.equal(result.overcharge_total_within_limit, 0);
  assert.equal(result.years_analyzed.length, 0);
  assert.ok(result.caveats.some((c) => c.includes('No lease history')));
});

test('overcharge: 24-month lease uses 2-year RGB rate', () => {
  // Order 54 (2022-10-01): 2-yr = 5.0%. 2000 × 1.05 = 2100. User charges 2150 → $50/mo overcharge.
  const input: EstimateInput = {
    history: [
      { startDate: '2020-10-01', endDate: '2022-09-30', monthlyRent: 2000, leaseTermMonths: 24 },
      { startDate: '2022-10-01', endDate: '2024-09-30', monthlyRent: 2150, leaseTermMonths: 24 },
    ],
    asOfDate: ASOF_TODAY,
  };
  const result = estimate(input);
  assert.equal(result.years_analyzed[0].term_months, 24);
  assert.equal(result.years_analyzed[0].allowed_pct, 5.0);
  near(result.years_analyzed[0].legal_monthly, 2100);
  near(result.years_analyzed[0].overcharge_monthly, 50);
});

test('overcharge: missing RGB order carries legal rent forward unchanged', () => {
  // 1965 is before order #1 (1968). Legal rent should carry forward; caveat added.
  const input: EstimateInput = {
    history: [
      { startDate: '1960-01-01', endDate: '1962-12-31', monthlyRent: 100, leaseTermMonths: 12 },
      { startDate: '1965-01-01', endDate: '1965-12-31', monthlyRent: 150, leaseTermMonths: 12 },
    ],
    asOfDate: ASOF_TODAY,
  };
  const result = estimate(input);
  assert.equal(result.years_analyzed[0].allowed_pct, null);
  assert.equal(result.years_analyzed[0].legal_monthly, 100);
  near(result.years_analyzed[0].overcharge_monthly, 50);
  assert.ok(result.caveats.some((c) => c.includes('No RGB order found')));
});
