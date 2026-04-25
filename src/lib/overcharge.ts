import { getIncrease, type LeaseTerm } from './rgb';

export type LeaseEntry = {
  startDate: string;
  endDate: string;
  monthlyRent: number;
  leaseTermMonths: LeaseTerm;
};

export type BaseRent = {
  amount: number;
  asOfDate: string;
  termMonths: LeaseTerm;
};

export type EstimateInput = {
  history: LeaseEntry[];
  baseRent?: BaseRent;
  asOfDate?: string;
};

export type YearAnalysis = {
  year: number;
  lease_start: string;
  lease_end: string;
  term_months: LeaseTerm;
  allowed_pct: number | null;
  actual_pct: number | null;
  legal_monthly: number;
  actual_monthly: number;
  overcharge_monthly: number;
  months_in_lease: number;
  months_within_limit: number;
  overcharge_within_limit: number;
};

export type Estimate = {
  mode: 'with_base_rent' | 'history_only';
  legal_rent_monthly: number;
  actual_rent_monthly: number;
  overcharge_monthly: number;
  overcharge_total_within_limit: number;
  years_analyzed: YearAnalysis[];
  caveats: string[];
};

const STATUTE_YEARS = 4;
const ROUND_CENTS = (n: number) => Math.round(n * 100) / 100;

function parseDate(iso: string): Date {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`);
}

function addYearsUtc(d: Date, years: number): Date {
  const out = new Date(d.getTime());
  out.setUTCFullYear(out.getUTCFullYear() + years);
  return out;
}

function monthsBetween(startIso: string, endIso: string): number {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  if (end <= start) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.max(0, ms / (1000 * 60 * 60 * 24 * 30.4375));
}

function monthsOverlapping(leaseStart: string, leaseEnd: string, windowStart: string): number {
  const startMs = Math.max(parseDate(leaseStart).getTime(), parseDate(windowStart).getTime());
  const endMs = parseDate(leaseEnd).getTime();
  if (endMs <= startMs) return 0;
  return (endMs - startMs) / (1000 * 60 * 60 * 24 * 30.4375);
}

function sortHistory(history: LeaseEntry[]): LeaseEntry[] {
  return history.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export function estimate(input: EstimateInput): Estimate {
  const caveats: string[] = [
    'MCI (Major Capital Improvement) and IAI (Individual Apartment Improvement) increases are not modeled — these can legally raise the legal rent above what RGB alone would allow.',
    'Vacancy allowances (pre-2019, under prior law) are not modeled.',
    `Overcharge totals are limited to the ${STATUTE_YEARS}-year statute window prior to today.`,
  ];

  const fullHistory = sortHistory(input.history);
  if (fullHistory.length === 0) {
    return {
      mode: input.baseRent ? 'with_base_rent' : 'history_only',
      legal_rent_monthly: input.baseRent?.amount ?? 0,
      actual_rent_monthly: 0,
      overcharge_monthly: 0,
      overcharge_total_within_limit: 0,
      years_analyzed: [],
      caveats: ['No lease history provided.', ...caveats],
    };
  }

  const history = input.baseRent
    ? fullHistory.filter((l) => l.startDate >= input.baseRent!.asOfDate)
    : fullHistory;

  if (history.length === 0) {
    return {
      mode: 'with_base_rent',
      legal_rent_monthly: input.baseRent!.amount,
      actual_rent_monthly: fullHistory[fullHistory.length - 1].monthlyRent,
      overcharge_monthly: 0,
      overcharge_total_within_limit: 0,
      years_analyzed: [],
      caveats: [
        'All provided leases pre-date the registered base rent — nothing to analyze going forward.',
        ...caveats,
      ],
    };
  }

  const today = input.asOfDate ?? new Date().toISOString().slice(0, 10);
  const statuteStart = addYearsUtc(parseDate(today), -STATUTE_YEARS).toISOString().slice(0, 10);

  const years: YearAnalysis[] = [];
  const mode: 'with_base_rent' | 'history_only' = input.baseRent ? 'with_base_rent' : 'history_only';

  let prevLegalRent: number;
  let startIndex: number;
  if (input.baseRent) {
    prevLegalRent = input.baseRent.amount;
    startIndex = 0;
  } else {
    prevLegalRent = history[0].monthlyRent;
    startIndex = 1;
    caveats.unshift(
      'No registered base rent supplied — the first lease in your history is treated as the starting legal rent. If that first rent was itself an overcharge, this estimator cannot detect it. Request your DHCR rent history (Form RA-90) to anchor on a registered base.',
    );
  }

  for (let i = startIndex; i < history.length; i++) {
    const lease = history[i];
    const increase = getIncrease(lease.startDate, lease.leaseTermMonths);
    const allowedPct = increase?.pct ?? null;

    const legalMonthly = allowedPct === null
      ? prevLegalRent
      : ROUND_CENTS(prevLegalRent * (1 + allowedPct / 100));

    const actualPct = prevLegalRent > 0
      ? ROUND_CENTS(((lease.monthlyRent - prevLegalRent) / prevLegalRent) * 100)
      : null;

    const overchargeMonthly = Math.max(0, ROUND_CENTS(lease.monthlyRent - legalMonthly));
    const monthsInLease = monthsBetween(lease.startDate, lease.endDate);
    const monthsWithinLimit = monthsOverlapping(lease.startDate, lease.endDate, statuteStart);
    const overchargeWithinLimit = ROUND_CENTS(overchargeMonthly * monthsWithinLimit);

    years.push({
      year: parseDate(lease.startDate).getUTCFullYear(),
      lease_start: lease.startDate,
      lease_end: lease.endDate,
      term_months: lease.leaseTermMonths,
      allowed_pct: allowedPct,
      actual_pct: actualPct,
      legal_monthly: legalMonthly,
      actual_monthly: lease.monthlyRent,
      overcharge_monthly: overchargeMonthly,
      months_in_lease: ROUND_CENTS(monthsInLease),
      months_within_limit: ROUND_CENTS(monthsWithinLimit),
      overcharge_within_limit: overchargeWithinLimit,
    });

    if (allowedPct === null) {
      caveats.push(
        `No RGB order found for lease starting ${lease.startDate}; legal rent for that period was carried forward unchanged.`,
      );
    }

    prevLegalRent = legalMonthly;
  }

  const lastLease = history[history.length - 1];
  const lastAnalysis = years[years.length - 1];
  const legalRentMonthly = lastAnalysis ? lastAnalysis.legal_monthly : prevLegalRent;
  const actualRentMonthly = lastLease.monthlyRent;
  const overchargeMonthly = Math.max(0, ROUND_CENTS(actualRentMonthly - legalRentMonthly));
  const overchargeTotalWithinLimit = ROUND_CENTS(
    years.reduce((acc, y) => acc + y.overcharge_within_limit, 0),
  );

  return {
    mode,
    legal_rent_monthly: legalRentMonthly,
    actual_rent_monthly: actualRentMonthly,
    overcharge_monthly: overchargeMonthly,
    overcharge_total_within_limit: overchargeTotalWithinLimit,
    years_analyzed: years,
    caveats,
  };
}
