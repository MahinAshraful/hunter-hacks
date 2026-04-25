import Anthropic from '@anthropic-ai/sdk';
import type { Verdict } from './stabilization';
import type { Estimate } from './overcharge';
import {
  COMPLAINT_MAX_TOKENS,
  COMPLAINT_MODEL,
  COMPLAINT_SYSTEM_PROMPT,
} from './complaint-template';

export type ComplaintInput = {
  verdict: Verdict;
  estimate: Estimate;
  address: string;
  tenantName?: string;
  unit?: string;
};

export type FieldMap = {
  tenant_name: string;
  unit: string;
  address: string;
  bbl: string;
  legal_rent_monthly: number;
  actual_rent_monthly: number;
  overcharge_monthly: number;
  overcharge_total_within_limit: number;
  filing_url: string;
};

// Direct-link to the RA-89 PDF; landing fallback at /tenant-owner-forms.
// (The legacy /forms-publications path 404s.)
const FILING_URL = 'https://hcr.ny.gov/form-ra-89';

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured.');
  }
  client = new Anthropic({ apiKey });
  return client;
}

export function buildFieldMap(input: ComplaintInput): FieldMap {
  return {
    tenant_name: input.tenantName?.trim() || '[YOUR NAME]',
    unit: input.unit?.trim() || '[UNIT #]',
    address: input.address,
    bbl: input.verdict.bbl,
    legal_rent_monthly: input.estimate.legal_rent_monthly,
    actual_rent_monthly: input.estimate.actual_rent_monthly,
    overcharge_monthly: input.estimate.overcharge_monthly,
    overcharge_total_within_limit: input.estimate.overcharge_total_within_limit,
    filing_url: FILING_URL,
  };
}

function buildUserMessage(input: ComplaintInput, fields: FieldMap): string {
  const overchargeYears = input.estimate.years_analyzed.filter(
    (y) => y.overcharge_monthly > 0,
  );

  const payload = {
    tenant: {
      name: fields.tenant_name,
      unit: fields.unit,
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
    estimate: {
      mode: input.estimate.mode,
      legal_rent_monthly: input.estimate.legal_rent_monthly,
      actual_rent_monthly: input.estimate.actual_rent_monthly,
      overcharge_monthly: input.estimate.overcharge_monthly,
      overcharge_total_within_limit: input.estimate.overcharge_total_within_limit,
      years_with_overcharge: overchargeYears.map((y) => ({
        lease_start: y.lease_start,
        lease_end: y.lease_end,
        term_months: y.term_months,
        allowed_pct: y.allowed_pct,
        actual_pct: y.actual_pct,
        legal_monthly: y.legal_monthly,
        actual_monthly: y.actual_monthly,
        overcharge_monthly: y.overcharge_monthly,
        overcharge_within_limit: y.overcharge_within_limit,
      })),
      caveats: input.estimate.caveats,
    },
  };

  return `Draft a DHCR Form RA-89 overcharge complaint from the following data. Use only these figures; do not invent any others.\n\n${JSON.stringify(
    payload,
    null,
    2,
  )}`;
}

/**
 * Stream complaint text deltas as plain UTF-8 chunks.
 * Yields strings (text-delta events only) so callers can pipe into a Response stream.
 *
 * `signal` is passed through to the SDK so a client disconnect aborts the
 * upstream Anthropic request — without this, billing keeps ticking after the
 * browser hangs up.
 */
export async function* streamComplaint(
  input: ComplaintInput,
  signal?: AbortSignal,
): AsyncGenerator<string> {
  const fields = buildFieldMap(input);
  const userMessage = buildUserMessage(input, fields);

  const stream = getClient().messages.stream(
    {
      model: COMPLAINT_MODEL,
      max_tokens: COMPLAINT_MAX_TOKENS,
      system: [
        {
          type: 'text',
          text: COMPLAINT_SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [{ role: 'user', content: userMessage }],
    },
    { signal },
  );

  for await (const event of stream) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta'
    ) {
      yield event.delta.text;
    }
  }
}
