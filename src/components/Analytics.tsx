import Script from "next/script";
import { analyticsEnabled, CLOUDFLARE_BEACON } from "@/lib/analytics";

/**
 * The Cloudflare Web Analytics script, loaded after the page is interactive,
 * and only on the live site (see `analyticsEnabled`). `VERCEL_ENV` is read when
 * the site is built, which is for one deployment, so a preview build never
 * has the script and neither does a local build.
 */
export function Analytics() {
  if (!analyticsEnabled(process.env)) return null;
  return (
    <Script
      src={CLOUDFLARE_BEACON.src}
      strategy="afterInteractive"
      defer
      data-cf-beacon={JSON.stringify({ token: CLOUDFLARE_BEACON.token })}
    />
  );
}
