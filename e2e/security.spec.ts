import { expect, test, type Page } from "@playwright/test";

/**
 * Tests for the security headers and the branded error page.
 *
 * The Content-Security-Policy is report-only, so nothing is blocked. These
 * tests load the pages that use the most (the maps, the charts, the sharing
 * pictures) and fail on any `securitypolicyviolation` the browser reports, so
 * the policy allows exactly what the site uses. The base map is replaced with a
 * tiny local style (as in map.spec.ts), so the tests do not need the network;
 * the real tile host is in the policy and is checked by hand.
 */

const PATHS_WITH_HEADERS = [
  "/",
  "/diseases/covid-19",
  "/diseases/covid-19/rate-by-local-authority/map",
  "/privacy",
  "/no-such-page",
  "/opengraph-image",
  "/boundaries/rgn-dec-2022.json",
];

test("every route has the security headers", async ({ request }) => {
  for (const path of PATHS_WITH_HEADERS) {
    const response = await request.get(path);
    const headers = response.headers();
    expect(headers["x-content-type-options"], path).toBe("nosniff");
    expect(headers["referrer-policy"], path).toBe("strict-origin-when-cross-origin");
    const permissions = headers["permissions-policy"];
    for (const feature of ["camera", "microphone", "geolocation"]) {
      expect(permissions, path).toContain(`${feature}=()`);
    }
    // Report-only: it reports and blocks nothing, and there is no enforced policy yet.
    expect(headers["content-security-policy"], path).toBeUndefined();
    expect(headers["content-security-policy-report-only"], path).toBeDefined();
  }
});

test("the policy allows what the site uses and nothing else", async ({ request }) => {
  const policy = (await request.get("/")).headers()["content-security-policy-report-only"];
  const directive = (name: string) =>
    policy
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `)) ?? "";

  expect(directive("default-src")).toBe("default-src 'self'");
  expect(directive("frame-ancestors")).toBe("frame-ancestors 'none'");
  expect(directive("object-src")).toBe("object-src 'none'");
  expect(directive("img-src")).toContain("data:");
  expect(directive("img-src")).toContain("blob:");
  expect(directive("worker-src")).toContain("blob:");
  expect(directive("connect-src")).toContain("https://tiles.openfreemap.org");
  expect(directive("connect-src")).toContain("https://cloudflareinsights.com");
  expect(directive("script-src")).toContain("https://static.cloudflareinsights.com");
  // No wildcard hosts.
  expect(policy).not.toMatch(/\s\*[\s;]|https:\s|https:;/);
});

/** Collects every CSP violation the page reports. */
async function watchViolations(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const w = window as unknown as { __violations: string[] };
    w.__violations = [];
    document.addEventListener("securitypolicyviolation", (event) => {
      w.__violations.push(`${event.violatedDirective}: ${event.blockedURI || "inline"}`);
    });
  });
  return () => page.evaluate(() => (window as unknown as { __violations: string[] }).__violations);
}

const STYLE_HEADERS = { "access-control-allow-origin": "*" };
function plainStyle(background: string) {
  return {
    version: 8,
    sources: { credit: { type: "geojson", data: { type: "FeatureCollection", features: [] } } },
    layers: [
      { id: "background", type: "background", paint: { "background-color": background } },
      { id: "credit-line", type: "line", source: "credit" },
    ],
  };
}

test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/styles/positron")) {
      return route.fulfill({ json: plainStyle("#e8eef3"), headers: STYLE_HEADERS });
    }
    if (url.endsWith("/styles/dark")) {
      return route.fulfill({ json: plainStyle("#10161c"), headers: STYLE_HEADERS });
    }
    return route.abort();
  });
});

test("the pages cause no CSP reports: maps, charts, tables, text pages and the 404", async ({ page }) => {
  const violations = await watchViolations(page);
  const visited: Array<[string, string?]> = [
    ["/"],
    ["/diseases/covid-19"],
    ["/diseases/covid-19/rate-by-local-authority/map", '[data-testid="map-canvas"][data-map-ready="true"]'],
    ["/diseases/influenza/hospital-admissions-by-state/map", '[data-testid="map-canvas"][data-map-ready="true"]'],
    ["/diseases/covid-19/rate-by-local-authority/chart"],
    ["/diseases/measles/cases-by-region/chart"],
    ["/diseases/covid-19/rate-by-local-authority/table"],
    ["/locations/united-states"],
    ["/privacy"],
    ["/sources"],
    ["/no-such-page"],
  ];
  for (const [path, ready] of visited) {
    await page.goto(path);
    if (ready) await page.waitForSelector(ready, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    expect(await violations(), path).toEqual([]);
  }
});

test("a map with the theme switched (a new base map style) causes no CSP reports", async ({ page }) => {
  const violations = await watchViolations(page);
  await page.goto("/diseases/covid-19/rate-by-local-authority/map");
  await page.waitForSelector('[data-testid="map-canvas"][data-map-ready="true"]', { timeout: 30_000 });
  await page.getByRole("button", { name: /^Switch to (light|dark) theme$/ }).click();
  await page.waitForLoadState("networkidle");
  expect(await violations()).toEqual([]);
});

test("the sharing pictures load, and the analytics script is not on the page outside production", async ({
  page,
  request,
}) => {
  for (const path of ["/opengraph-image", "/twitter-image", "/diseases/covid-19/opengraph-image"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["content-type"], path).toContain("image/png");
  }
  const requested: string[] = [];
  page.on("request", (r) => requested.push(r.url()));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(requested.filter((url) => url.includes("cloudflareinsights"))).toEqual([]);
});

test.describe("the error page", () => {
  test("shows a short message, a Try again button and the main sections, inside the header and footer", async ({
    page,
  }) => {
    await page.goto("/error-test");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page could not be shown.");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "disease.observer" }).first()).toBeVisible();
    await expect(page.getByRole("contentinfo")).toBeVisible();
    await expect(page.getByRole("main").getByRole("link")).toHaveText([
      "The home page",
      "All diseases",
      "Maps",
      "Locations",
      "Sources",
      "About",
    ]);
  });

  test("never shows what went wrong", async ({ page }) => {
    await page.goto("/error-test");
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
    // What a visitor can read (not the page's scripts).
    const text = await page.locator("body").innerText();
    expect(text).not.toContain("fails on purpose");
    expect(text).not.toMatch(/digest|stack|at \w+ \(/i);
  });

  test("Try again asks for the page again, and the links work", async ({ page }) => {
    await page.goto("/error-test");
    const again = page.getByRole("button", { name: "Try again" });
    await again.click();
    // It fails again, because the page always does: still the error page.
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page could not be shown.");
    await page.getByRole("main").getByRole("link", { name: "Maps" }).click();
    await expect(page).toHaveURL("/maps");
  });

  test("the page that triggers it is not indexed", async ({ request }) => {
    const html = await (await request.get("/error-test")).text();
    expect(html).toContain("noindex");
  });
});
