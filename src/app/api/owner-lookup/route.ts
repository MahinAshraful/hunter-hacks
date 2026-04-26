import { z } from 'zod';
import { lookupOwnerByBin } from '@/lib/hpd';

export const runtime = 'nodejs';

const QuerySchema = z.object({
  bin: z.string().regex(/^\d{6,8}$/, 'BIN must be 6–8 digits'),
});

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({ bin: url.searchParams.get('bin') ?? '' });
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  try {
    const result = await lookupOwnerByBin(parsed.data.bin, request.signal);
    if (!result) {
      // Building isn't HPD-registered (small building / lapsed / new construction).
      // 200 with `null` is the easier shape for the client to handle than 404.
      return Response.json({ found: false, bin: parsed.data.bin });
    }
    return Response.json({ found: true, ...result });
  } catch (err) {
    console.error('Owner lookup failed:', err);
    return Response.json({ error: 'Lookup failed' }, { status: 502 });
  }
}
