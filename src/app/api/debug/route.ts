import { debugDbBundle } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * Production diagnostic endpoint — returns the file-bundling state of the
 * deployed function. Used to verify that data/app.db ships correctly to
 * Vercel after a build. Safe to leave deployed; reveals only filesystem
 * paths under the function's working directory.
 */
export function GET(): Response {
  return Response.json(debugDbBundle());
}
