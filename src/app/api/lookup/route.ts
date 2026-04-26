import { z } from 'zod';
import { verdict } from '@/lib/stabilization';
import { debugDbBundle, getDb } from '@/lib/db';
import { lookups } from '@/lib/schema';

const RequestSchema = z.object({
  bbl: z.string().min(1, 'bbl is required'),
  address: z.string().min(1, 'address is required'),
});

export async function POST(request: Request): Promise<Response> {
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

  const { bbl } = parsed.data;

  let result;
  try {
    result = verdict(bbl);
  } catch (err) {
    const debug = debugDbBundle();
    console.error('verdict() failed:', {
      bbl,
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      debug,
    });
    return Response.json(
      {
        error: 'Lookup failed',
        message: err instanceof Error ? err.message : String(err),
        debug,
      },
      { status: 500 },
    );
  }

  let lookupId: number | undefined;
  try {
    const db = getDb();
    const inserted = db
      .insert(lookups)
      .values({ bbl, wasStabilized: result.status === 'likely_stabilized' ? 1 : 0 })
      .returning({ id: lookups.id })
      .get();
    lookupId = inserted?.id;
  } catch (err) {
    // Read-only FS on Vercel rejects writes — expected, not an error
    if (process.env.VERCEL !== '1') {
      console.error('Failed to insert lookup row:', err);
    }
  }

  return Response.json({ ...result, lookupId });
}
