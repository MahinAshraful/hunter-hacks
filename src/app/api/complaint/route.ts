import { z } from 'zod';
import {
  buildFieldMap,
  streamComplaint,
  activeProviderName,
  type ComplaintInput,
} from '@/lib/complaint';

export const runtime = 'nodejs';
// Streaming the full RA-89 attachment can take 30-40s on a long lease history.
// Default Hobby cap is 10s; bump to 60 (Hobby max) so streams aren't cut.
export const maxDuration = 60;

const VerdictSchema = z.object({
  bbl: z.string().min(1).max(20),
  status: z.enum(['likely_stabilized', 'not_listed', 'unknown']),
  unit_count_latest: z.number().int().min(0).max(100_000).optional(),
  unit_count_year: z.number().int().min(1900).max(2100).optional(),
  on_dhcr_list_latest: z.boolean(),
  source_year_max: z.number().int().min(1900).max(2100).optional(),
  dhcr_verify_url: z.string().max(500),
});

const YearAnalysisSchema = z.object({
  year: z.number(),
  lease_start: z.string(),
  lease_end: z.string(),
  term_months: z.union([z.literal(12), z.literal(24)]),
  allowed_pct: z.number().nullable(),
  actual_pct: z.number().nullable(),
  legal_monthly: z.number(),
  actual_monthly: z.number(),
  overcharge_monthly: z.number(),
  months_in_lease: z.number(),
  months_within_limit: z.number(),
  overcharge_within_limit: z.number(),
});

const FINITE_DOLLAR = z.number().min(0).max(1_000_000);

const EstimateSchema = z.object({
  mode: z.enum(['with_base_rent', 'history_only']),
  legal_rent_monthly: FINITE_DOLLAR,
  actual_rent_monthly: FINITE_DOLLAR,
  overcharge_monthly: FINITE_DOLLAR,
  overcharge_total_within_limit: z.number().min(0).max(100_000_000),
  years_analyzed: z.array(YearAnalysisSchema).max(40),
  caveats: z.array(z.string().max(500)).max(20),
});

const TenantTypeSchema = z.enum(['prime', 'sub', 'hotel', 'roommate']);
const Section8Schema = z.enum(['none', 'hud', 'nycha', 'hcv', 'hpd']);
const ToneSchema = z.enum(['neutral', 'assertive', 'conciliatory']);
const CauseSchema = z.enum([
  'mci',
  'iai',
  'rent_reduction_order',
  'missing_registrations',
  'fmra',
  'parking',
  'illegal_fees',
  'security_deposit',
  'other',
]);

const SHORT_TEXT = z.string().max(200);
const ISO_DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const RequestSchema = z.object({
  verdict: VerdictSchema,
  estimate: EstimateSchema,
  address: z.string().min(1).max(300),

  tenantName: SHORT_TEXT.optional(),
  unit: z.string().max(50).optional(),
  mailingAddress: z.string().max(300).optional(),
  mailingCity: SHORT_TEXT.optional(),
  mailingState: z.string().max(20).optional(),
  mailingZip: z.string().max(20).optional(),

  tenantPhoneHome: z.string().max(40).optional(),
  tenantPhoneDay: z.string().max(40).optional(),

  tenantType: TenantTypeSchema.optional(),
  scrieDrie: z.boolean().optional(),
  section8: Section8Schema.optional(),
  coop: z.boolean().optional(),

  moveInDate: ISO_DATE.optional(),
  initialRent: z.number().min(0).max(1_000_000).optional(),

  electricityIncluded: z.boolean().optional(),

  ownerName: z.string().max(300).optional(),
  ownerAddress: z.string().max(500).optional(),
  ownerPhone: z.string().max(40).optional(),

  causes: z.array(CauseSchema).max(9).optional(),

  securityDepositAmount: z.number().min(0).max(1_000_000).optional(),
  securityDepositPaidOn: ISO_DATE.optional(),

  raisedInCourt: z.boolean().optional(),
  courtIndexNo: z.string().max(80).optional(),

  tone: ToneSchema.optional(),
});

/**
 * Streams NDJSON. Each line is a JSON object:
 *   { "type": "fields",   "data": { ... } }       — emitted once, first
 *   { "type": "provider", "data": "openai"|... }  — which model is being used
 *   { "type": "text",     "data": "..." }         — repeated for each delta
 *   { "type": "done" }                            — final event
 *   { "type": "error",    "data": "message" }     — on failure
 */
export async function POST(request: Request): Promise<Response> {
  const provider = activeProviderName();
  if (!provider) {
    return Response.json(
      {
        error:
          'No LLM provider configured. Set OPENAI_API_KEY (preferred) or ANTHROPIC_API_KEY in .env.local.',
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input: ComplaintInput = parsed.data;
  const fields = buildFieldMap(input);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(obj)}\n`));
      };

      send({ type: 'provider', data: provider });
      send({ type: 'fields', data: fields });

      try {
        for await (const delta of streamComplaint(input, request.signal)) {
          send({ type: 'text', data: delta });
        }
        send({ type: 'done' });
      } catch (err) {
        console.error('Complaint stream failed:', err);
        if (request.signal.aborted) return;
        send({
          type: 'error',
          data: 'The drafting service failed. Please try again.',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
