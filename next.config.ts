import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/**
 * The Content-Security-Policy, in report-only mode: the browser reports what
 * it would block (in its console and as `securitypolicyviolation` events) but
 * blocks nothing. It allows exactly what the site uses:
 *
 * - `'self'` for the site's own scripts, styles, fonts, pictures and MapLibre's
 *   worker file.
 * - `'unsafe-inline'` for scripts, because the pages are prerendered and
 *   Next.js puts its own inline scripts in them (the page data, and the theme
 *   script). A nonce would force every page to be rendered on each request, and
 *   a hash for each inline script cannot be worked out at build time.
 * - `'unsafe-inline'` for styles, because MapLibre and React set `style`
 *   attributes.
 * - `tiles.openfreemap.org` for the base map's style, tiles, sprites and fonts.
 * - `static.cloudflareinsights.com` for the analytics script and
 *   `cloudflareinsights.com` for where it sends the page view (production only).
 * - `blob:` for MapLibre's worker and the pictures it makes, and `data:` for
 *   small inline pictures.
 * - `frame-ancestors 'none'`: no other site may put this one in a frame.
 *
 * The development server also needs `'unsafe-eval'` and a WebSocket for hot
 * reloading.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://tiles.openfreemap.org",
  "font-src 'self' data:",
  `connect-src 'self' https://tiles.openfreemap.org https://cloudflareinsights.com https://static.cloudflareinsights.com${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/** The browser features that the site never uses, turned off. */
const permissionsPolicy = [
  "accelerometer",
  "autoplay",
  "bluetooth",
  "camera",
  "display-capture",
  "geolocation",
  "gyroscope",
  "hid",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "serial",
  "usb",
]
  .map((feature) => `${feature}=()`)
  .join(", ");

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
        // Security headers for every route.
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: permissionsPolicy },
          { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
        ],
      },
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
