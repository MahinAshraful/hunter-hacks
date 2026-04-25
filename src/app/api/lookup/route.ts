import { z } from 'zod';
import { verdict } from '@/lib/stabilization';
import { getDb } from '@/lib/db';
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
  const result = verdict(bbl);

  try {
    const db = getDb();
    db.insert(lookups)
      .values({ bbl, wasStabilized: result.status === 'likely_stabilized' ? 1 : 0 })
      .run();
  } catch (err) {
    console.error('Failed to insert lookup row:', err);
  }

  return Response.json(result);
}
