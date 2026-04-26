import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  // The /api/lookup and /api/estimate routes read data/app.db via a
  // dynamic process.cwd() path, which Vercel's `nft` file tracer can't
  // see. Without this, the DB ships in the repo but not in the deployed
  // function bundle and every request 500s with ENOENT. We also include
  // the rgb_orders.json that lib/rgb.ts imports at module load.
  outputFileTracingIncludes: {
    // List each route explicitly — the '/api/**/*' glob form is finicky
    // across Next versions. Per-route entries always work.
    '/api/lookup': ['./data/app.db'],
    '/api/estimate': ['./data/app.db'],
    '/api/complaint': ['./data/seed/rgb_orders.json'],
  },
  async redirects() {
    return [
      { source: '/about', destination: '/info', permanent: true },
    ];
  },
};

export default nextConfig;
