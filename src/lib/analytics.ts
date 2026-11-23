/**
 * Cloudflare Web Analytics: a script that counts page views, with no cookies
 * and no personal identifiers (see the privacy page). The token is public by
 * design: it only says which site the counts belong to.
 *
 * Erasable TypeScript only, so tests can import it too.
 */

/** Where the script is, and the token that names this site in Cloudflare. */
export const CLOUDFLARE_BEACON = {
  src: "https://static.cloudflareinsights.com/beacon.min.js",
  token: "fb537cb2ea784d57a68ee92255e40696",
};

/**
 * True only for the live site: Vercel's `VERCEL_ENV` is `production`. It is
 * off in previews, in development (`pnpm dev`) and in the tests (`pnpm build`
 * and `pnpm start` locally), where there is no `VERCEL_ENV`, so those never
 * send a page view to Cloudflare.
 */
export function analyticsEnabled(env: Record<string, string | undefined>): boolean {
  return env.VERCEL_ENV === "production";
}
