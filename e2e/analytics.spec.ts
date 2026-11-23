import { expect, test } from "@playwright/test";
import { analyticsEnabled, CLOUDFLARE_BEACON } from "../src/lib/analytics.ts";

/** The analytics beacon is only for the production deployment. No browser needed. */
test.describe("analyticsEnabled", () => {
  test("is true only when VERCEL_ENV is production", () => {
    expect(analyticsEnabled({ VERCEL_ENV: "production" })).toBe(true);
    expect(analyticsEnabled({ VERCEL_ENV: "preview" })).toBe(false);
    expect(analyticsEnabled({ VERCEL_ENV: "development" })).toBe(false);
    expect(analyticsEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(analyticsEnabled({})).toBe(false);
  });

  test("points at Cloudflare's beacon", () => {
    expect(CLOUDFLARE_BEACON.src).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(CLOUDFLARE_BEACON.token).toMatch(/^[0-9a-f]{32}$/);
  });
});
