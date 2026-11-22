import { expect, test } from "@playwright/test";
import { DATASETS, DISEASES, getDatasetBySlug } from "../src/lib/datasets/registry.ts";
import { datasetHref, diseaseHref, sitePaths, viewHref } from "../src/lib/datasets/routes.ts";
import { isKnownDiseasePath, safeDecode } from "../src/lib/routing.ts";
import { absoluteUrl, SITE_URL } from "../src/lib/seo.ts";

/**
 * Tests for the page addresses, the sitemap, robots.txt, canonical links and
 * breadcrumbs. The first group checks the registry's address helpers directly,
 * with no browser.
 */

test.describe("address helpers", () => {
  test("dataset slugs are URL-safe and unique within a disease", () => {
    for (const dataset of DATASETS) {
      expect(dataset.slug, dataset.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(getDatasetBySlug(dataset.diseaseSlug, dataset.slug)?.id).toBe(dataset.id);
    }
    const keys = DATASETS.map((dataset) => `${dataset.diseaseSlug}/${dataset.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(getDatasetBySlug("covid-19", "cases-by-region")).toBeUndefined();
  });

  test("disease, dataset and view addresses are built from the registry", () => {
    expect(diseaseHref("covid-19")).toBe("/diseases/covid-19");
    const covid = getDatasetBySlug("covid-19", "rate-by-local-authority")!;
    expect(datasetHref(covid)).toBe("/diseases/covid-19/rate-by-local-authority");
    expect(viewHref(covid, "map")).toBe("/diseases/covid-19/rate-by-local-authority/map");
    expect(viewHref(covid, "chart")).toBe("/diseases/covid-19/rate-by-local-authority/chart");
    expect(viewHref(covid, "table")).toBe("/diseases/covid-19/rate-by-local-authority/table");
  });

  test("the sitemap paths cover the registry's diseases and have no repeats", () => {
    const paths = sitePaths();
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toEqual(
      expect.arrayContaining(["/", "/diseases", "/map", "/sources", "/about"]),
    );
    for (const disease of DISEASES) expect(paths).toContain(`/diseases/${disease.slug}`);
  });

  test("a path is a known disease only if the registry has it, and bad encoding is safe", () => {
    expect(isKnownDiseasePath("/diseases/covid-19")).toBe(true);
    expect(isKnownDiseasePath("/diseases/not-a-disease")).toBe(false);
    expect(isKnownDiseasePath("/diseases/%E0%A4%A")).toBe(false);
    expect(isKnownDiseasePath("/diseases/covid-19%20")).toBe(false);
    expect(safeDecode("%E0%A4%A")).toBe("%E0%A4%A");
    expect(safeDecode("covid%2D19")).toBe("covid-19");
  });
});

test("sitemap.xml lists every page from the registry, as absolute addresses", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("xml");

  const locations = [...(await response.text()).matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  expect(locations).toEqual(sitePaths().map(absoluteUrl));
  expect(locations).toContain(`${SITE_URL}/diseases/measles`);
  // Query strings are never in the sitemap.
  expect(locations.filter((location) => location.includes("?"))).toEqual([]);
});

test("robots.txt allows crawling and names the sitemap", async ({ request }) => {
  const response = await request.get("/robots.txt");
  expect(response.status()).toBe(200);
  const text = await response.text();

  expect(text).toMatch(/User-Agent: \*/i);
  expect(text).toMatch(/Allow: \//i);
  expect(text).toMatch(/Disallow: \/api\//i);
  expect(text).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
});

test.describe("canonical links", () => {
  const pages = [
    "/",
    "/diseases",
    "/about",
    "/sources",
    "/map",
    ...DISEASES.map((disease) => `/diseases/${disease.slug}`),
  ];

  for (const path of pages) {
    test(`${path} has a canonical link to its own address`, async ({ request }) => {
      const html = await (await request.get(path)).text();
      const links = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
      // Next.js writes the home page's address without the closing slash.
      expect(links).toEqual([path === "/" ? SITE_URL : absoluteUrl(path)]);
    });
  }

  test("a query string does not change the canonical link", async ({ request }) => {
    for (const path of ["/map?d=measles-cases&p=12w", "/diseases/covid-19?range=all"]) {
      const html = await (await request.get(path)).text();
      const links = [...html.matchAll(/<link rel="canonical" href="([^"]*)"/g)].map((m) => m[1]);
      expect(links, path).toEqual([absoluteUrl(path.split("?")[0])]);
    }
  });
});

test.describe("breadcrumbs", () => {
  for (const disease of DISEASES) {
    test(`${disease.name}: a trail of two steps, with the current page last`, async ({ page }) => {
      await page.goto(diseaseHref(disease.slug));
      const nav = page.getByRole("navigation", { name: "Breadcrumb" });
      const items = nav.getByRole("listitem");

      await expect(nav.getByRole("list")).toHaveCount(1);
      await expect(items).toHaveCount(2);
      // Earlier steps are links; the current page is plain text marked as current.
      await expect(items.nth(0).getByRole("link", { name: "Diseases" })).toHaveAttribute(
        "href",
        "/diseases",
      );
      await expect(items.nth(1).getByRole("link")).toHaveCount(0);
      await expect(items.nth(1)).toHaveText(disease.name);
      await expect(items.nth(1).locator('[aria-current="page"]')).toHaveText(disease.name);
      await expect(nav.locator('[aria-current="page"]')).toHaveCount(1);
      // The separator is hidden from screen readers, so the list reads as two items.
      await expect(nav.locator('[aria-hidden="true"]')).toHaveText(["›"]);
    });

    test(`${disease.name}: the structured data matches the visible trail`, async ({ page }) => {
      await page.goto(diseaseHref(disease.slug));
      const scripts = page.locator('script[type="application/ld+json"]');
      await expect(scripts).toHaveCount(1);

      const data = JSON.parse((await scripts.textContent())!);
      expect(data["@type"]).toBe("BreadcrumbList");
      expect(data.itemListElement).toEqual([
        { "@type": "ListItem", position: 1, name: "Diseases", item: `${SITE_URL}/diseases` },
        {
          "@type": "ListItem",
          position: 2,
          name: disease.name,
          item: `${SITE_URL}${diseaseHref(disease.slug)}`,
        },
      ]);
    });
  }

  test("pages with no trail of two or more steps have no breadcrumb", async ({ request }) => {
    for (const path of ["/", "/diseases", "/about", "/sources", "/map"]) {
      const html = await (await request.get(path)).text();
      expect(html, path).not.toContain('aria-label="Breadcrumb"');
      expect(html, path).not.toContain("BreadcrumbList");
    }
  });

  test("the breadcrumb link is a 44 px target and the page does not scroll sideways", async ({
    page,
  }) => {
    await page.goto("/diseases/covid-19");
    const link = page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("link");
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);

    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
