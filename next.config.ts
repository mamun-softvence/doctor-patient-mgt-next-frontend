import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  deprecated: {
    looseRouteMatching: true,
  },
  /* config options here */
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:5001';
    return [
      {
        source: '/api/v1/:path*',
        destination: `${apiUrl}/api/v1/:path*`,
      },
    ];
  },
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    root: path.resolve(__dirname, '..'),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
