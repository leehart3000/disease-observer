import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // `pnpm smoke:standalone` builds with NEXT_STANDALONE=1. The standalone output
  // holds only the files that Next.js's file tracing found, which is what a
  // serverless host (Vercel) has at run time, so a file that is read from disk but
  // not traced is missing there, as it would be in production. The normal build is
  // unchanged.
  output: process.env.NEXT_STANDALONE === "1" ? "standalone" : undefined,
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [
      {
        // Built by `pnpm boundaries:web`. The boundary year is in the file
        // name, so a new vintage gets a new URL.
        source: "/boundaries/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // MapLibre's worker, copied by `pnpm maplibre:worker`. The page
        // asks for it with the library version in the query string.
        source: "/maplibre/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=604800, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
