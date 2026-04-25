import { z } from 'zod';
import { buildFieldMap, streamComplaint, type ComplaintInput } from '@/lib/complaint';

export const runtime = 'nodejs';

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

const RequestSchema = z.object({
  verdict: VerdictSchema,
  estimate: EstimateSchema,
  address: z.string().min(1).max(300),
  tenantName: z.string().max(200).optional(),
  unit: z.string().max(50).optional(),
});

/**
 * Streams NDJSON. Each line is a JSON object:
 *   { "type": "fields", "data": { ... } }       — emitted once, first
 *   { "type": "text",   "data": "..." }         — repeated for each delta
 *   { "type": "done" }                          — final event
 *   { "type": "error",  "data": "message" }     — on failure
 */
export async function POST(request: Request): Promise<Response> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: 'ANTHROPIC_API_KEY is not configured on the server.' },
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

      send({ type: 'fields', data: fields });

      try {
        for await (const delta of streamComplaint(input, request.signal)) {
          send({ type: 'text', data: delta });
        }
        send({ type: 'done' });
      } catch (err) {
        // Log the real error server-side; return a generic message to the
        // client so we don't leak vendor request IDs or stack frames.
        console.error('Complaint stream failed:', err);
        if (request.signal.aborted) {
          // Client disconnected — no point queuing more bytes.
          return;
        }
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
