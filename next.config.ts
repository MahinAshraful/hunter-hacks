import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['better-sqlite3'],
  async redirects() {
    return [
      { source: '/about', destination: '/info', permanent: true },
    ];
  },
};

export default nextConfig;
