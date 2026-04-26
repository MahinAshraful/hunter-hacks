import type { Verdict } from './stabilization';
import type { Estimate } from './overcharge';
import { getIncrease } from './rgb';
import {
  COMPLAINT_MAX_TOKENS,
  COMPLAINT_SYSTEM_PROMPT,
} from './complaint-template';
import { pickProvider, type LLMProvider } from './providers';

// RA-89 §13 cause codes — checkboxes on the form.
export type OverchargeCause =
  | 'mci'
  | 'iai'
  | 'rent_reduction_order'
  | 'missing_registrations'
  | 'fmra'
  | 'parking'
  | 'illegal_fees'
  | 'security_deposit'
  | 'other';

export type TenantType = 'prime' | 'sub' | 'hotel' | 'roommate';
export type Section8Program = 'none' | 'hud' | 'nycha' | 'hcv' | 'hpd';
export type Tone = 'neutral' | 'assertive' | 'conciliatory';

export type ComplaintInput = {
  verdict: Verdict;
  estimate: Estimate;
  address: string;

  // §1 + §6 — tenant identity
  tenantName?: string;
  unit?: string;

  // §2-3 — tenant mailing address (defaults to subject building if absent)
  mailingAddress?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;

  // §5 — phone
  tenantPhoneHome?: string;
  tenantPhoneDay?: string;

  // §6 — tenant type / programs
  tenantType?: TenantType;
  scrieDrie?: boolean;
  section8?: Section8Program;
  coop?: boolean;

  // §8 — move-in
  moveInDate?: string;
  initialRent?: number;

  // §10 — utilities
  electricityIncluded?: boolean;

  // §11 — owner / managing agent
  ownerName?: string;
  ownerAddress?: string;
  ownerPhone?: string;

  // §13 — causes the tenant ticks
  causes?: OverchargeCause[];

  // §15 — security deposit
  securityDepositAmount?: number;
  securityDepositPaidOn?: string;

  // §16 — court history
  raisedInCourt?: boolean;
  courtIndexNo?: string;

  // Style controls (do NOT change facts, only block-B wording)
  tone?: Tone;
};

export type FieldMap = {
  // Mirrors what the user typed plus our derived defaults — the UI
  // surfaces this as a "we sent the model exactly this" preview card.
  tenant_name: string;
  unit: string;
  address: string;
  mailing_address: string;
  bbl: string;
  phone_home: string;
  phone_day: string;
  owner_name: string;
  owner_address: string;
  owner_phone: string;
  legal_rent_monthly: number;
  actual_rent_monthly: number;
  overcharge_monthly: number;
  overcharge_total_within_limit: number;
  causes: OverchargeCause[];
  tone: Tone;
  filing_url: string;
  filing_address: string;
};

const FILING_URL = 'https://hcr.ny.gov/form-ra-89';
const FILING_ADDRESS =
  'DHCR — Office of Rent Administration · Gertz Plaza · 92-31 Union Hall Street, 6th Floor · Jamaica, NY 11433';

const PLACEHOLDER = {
  name: '[YOUR NAME]',
  unit: '[UNIT #]',
  phone: '[YOUR PHONE]',
  ownerName: '[OWNER / AGENT NAME — find on your lease, rent bill, or HPD lookup]',
  ownerAddress: '[OWNER / AGENT MAILING ADDRESS]',
  ownerPhone: '[OWNER / AGENT PHONE]',
} as const;

function trimOr(value: string | undefined, fallback: string): string {
  const v = value?.trim();
  return v && v.length > 0 ? v : fallback;
}

export function buildFieldMap(input: ComplaintInput): FieldMap {
  return {
    tenant_name: trimOr(input.tenantName, PLACEHOLDER.name),
    unit: trimOr(input.unit, PLACEHOLDER.unit),
    address: input.address,
    mailing_address: trimOr(input.mailingAddress, input.address),
    bbl: input.verdict.bbl,
    phone_home: trimOr(input.tenantPhoneHome, PLACEHOLDER.phone),
    phone_day: trimOr(input.tenantPhoneDay, PLACEHOLDER.phone),
    owner_name: trimOr(input.ownerName, PLACEHOLDER.ownerName),
    owner_address: trimOr(input.ownerAddress, PLACEHOLDER.ownerAddress),
    owner_phone: trimOr(input.ownerPhone, PLACEHOLDER.ownerPhone),
    legal_rent_monthly: input.estimate.legal_rent_monthly,
    actual_rent_monthly: input.estimate.actual_rent_monthly,
    overcharge_monthly: input.estimate.overcharge_monthly,
    overcharge_total_within_limit: input.estimate.overcharge_total_within_limit,
    causes: input.causes && input.causes.length > 0 ? input.causes : ['other'],
    tone: input.tone ?? 'neutral',
    filing_url: FILING_URL,
    filing_address: FILING_ADDRESS,
  };
}

function buildUserMessage(input: ComplaintInput, fields: FieldMap): string {
  const overchargeYears = input.estimate.years_analyzed.filter(
    (y) => y.overcharge_monthly > 0,
  );

  // ── Derive defaults from lease history when the tenant didn't supply them.
  // These are conservative — they read directly from data we already have,
  // not invented. The prompt is told to use these and never replace them
  // with [ASK TENANT] placeholders.
  const sortedLeases = input.estimate.years_analyzed
    .slice()
    .sort((a, b) => a.lease_start.localeCompare(b.lease_start));
  const firstLease = sortedLeases[0];

  const moveInDate = input.moveInDate ?? firstLease?.lease_start ?? null;
  const initialRent = input.initialRent ?? firstLease?.actual_monthly ?? null;
  const initialTermYears = firstLease ? (firstLease.term_months === 24 ? 2 : 1) : null;

  // Security deposit: if the tenant didn't tell us, presume one month's rent
  // (the legal cap under NY GOL §7-108 since 2019). Marked "presumed" so the
  // model labels it accordingly in the PDF.
  const securityDepositPresumed =
    input.securityDepositAmount === undefined && initialRent !== null
      ? initialRent
      : null;

  // The shape below is what the system prompt's §17 / §14 references.
  const payload = {
    tone: fields.tone,
    today: new Date().toISOString().slice(0, 10),
    tenant: {
      name: fields.tenant_name,
      unit: fields.unit,
      mailing_address: fields.mailing_address,
      mailing_city: input.mailingCity,
      mailing_state: input.mailingState,
      mailing_zip: input.mailingZip,
      phone_home: fields.phone_home,
      phone_day: fields.phone_day,
      type: input.tenantType ?? 'prime',
      scrie_drie: input.scrieDrie ?? false,
      section_8: input.section8 ?? 'none',
      coop: input.coop ?? false,
    },
    premises: {
      address: input.address,
      bbl: input.verdict.bbl,
      stabilization_status: input.verdict.status,
      on_dhcr_list_latest: input.verdict.on_dhcr_list_latest,
      unit_count_latest: input.verdict.unit_count_latest,
      unit_count_year: input.verdict.unit_count_year,
      source_year_max: input.verdict.source_year_max,
    },
    move_in: {
      date: moveInDate,
      initial_rent: initialRent,
      lease_term_years: initialTermYears,
      derived: input.moveInDate === undefined && firstLease !== undefined,
    },
    electricity_included: input.electricityIncluded ?? null,
    owner: {
      name: fields.owner_name,
      address: fields.owner_address,
      phone: fields.owner_phone,
    },
    causes_checked: fields.causes,
    security_deposit: {
      amount: input.securityDepositAmount ?? null,
      paid_on: input.securityDepositPaidOn ?? null,
      presumed: securityDepositPresumed,
    },
    court: {
      raised: input.raisedInCourt ?? false,
      index_no: input.courtIndexNo ?? null,
    },
    estimate: {
      mode: input.estimate.mode,
      legal_rent_monthly: input.estimate.legal_rent_monthly,
      actual_rent_monthly: input.estimate.actual_rent_monthly,
      overcharge_monthly: input.estimate.overcharge_monthly,
      overcharge_total_within_limit: input.estimate.overcharge_total_within_limit,
      years_analyzed: input.estimate.years_analyzed.map((y) => ({
        lease_start: y.lease_start,
        lease_end: y.lease_end,
        term_months: y.term_months,
        allowed_pct: y.allowed_pct,
        actual_pct: y.actual_pct,
        legal_monthly: y.legal_monthly,
        actual_monthly: y.actual_monthly,
        overcharge_monthly: y.overcharge_monthly,
        overcharge_within_limit: y.overcharge_within_limit,
        order_no: getIncrease(y.lease_start, y.term_months)?.orderNo ?? null,
      })),
      years_with_overcharge: overchargeYears.map((y) => ({
        lease_start: y.lease_start,
        allowed_pct: y.allowed_pct,
        actual_pct: y.actual_pct,
        legal_monthly: y.legal_monthly,
        actual_monthly: y.actual_monthly,
        overcharge_monthly: y.overcharge_monthly,
        order_no: getIncrease(y.lease_start, y.term_months)?.orderNo ?? null,
      })),
      caveats: input.estimate.caveats,
    },
    overcharge_period: deriveOverchargePeriod(input.estimate.years_analyzed),
  };

  return `Generate the RA-89 attachment for this tenant. Use only the figures below; do not invent any others.\n\n${JSON.stringify(
    payload,
    null,
    2,
  )}`;
}

function deriveOverchargePeriod(
  years: { lease_start: string; lease_end: string; overcharge_monthly: number }[],
): { from: string; to: string } | null {
  const overcharged = years.filter((y) => y.overcharge_monthly > 0);
  if (overcharged.length === 0) return null;
  const from = overcharged[0].lease_start;
  const to = overcharged[overcharged.length - 1].lease_end;
  return { from, to };
}

/**
 * Stream the complaint text deltas as plain UTF-8 chunks, yielded one
 * delta at a time. Provider is selected at call time:
 *   - OpenAI (gpt-4o) if OPENAI_API_KEY is set
 *   - Anthropic (claude-sonnet-4-6) if only ANTHROPIC_API_KEY is set
 *   - throws if neither is configured (the route turns this into a 503)
 *
 * `signal` is forwarded so a client disconnect aborts the upstream call.
 */
export async function* streamComplaint(
  input: ComplaintInput,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const provider: LLMProvider | null = pickProvider();
  if (!provider) {
    throw new Error(
      'No LLM provider configured. Set OPENAI_API_KEY (preferred) or ANTHROPIC_API_KEY in .env.local.',
    );
  }

  const fields = buildFieldMap(input);
  const userMessage = buildUserMessage(input, fields);

  yield* provider.stream({
    systemPrompt: COMPLAINT_SYSTEM_PROMPT,
    userMessage,
    maxTokens: COMPLAINT_MAX_TOKENS,
    signal,
  });
}

export function activeProviderName(): 'openai' | 'anthropic' | null {
  return pickProvider()?.name ?? null;
}
