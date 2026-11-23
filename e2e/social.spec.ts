import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * Tests for the pictures and text shown when a page is shared (Open Graph
 * and Twitter cards). The images are made when the site is built, from the
 * registry, so these need no database.
 */

const INFLUENZA = "/diseases/influenza";
const DATASET = "/diseases/influenza/hospital-admissions-by-state";

/** The content of a `<meta>` tag by its `property` or `name`, or `undefined`. */
async function meta(page: Page, key: string): Promise<string | undefined> {
  const tag = page.locator(`meta[property="${key}"], meta[name="${key}"]`).first();
  return (await tag.count()) === 0 ? undefined : ((await tag.getAttribute("content")) ?? undefined);
}

/** The width and height written in a PNG's header (the IHDR chunk). */
function pngSize(bytes: Buffer): { width: number; height: number } {
  // 8 bytes of signature, 4 of length, 4 of "IHDR", then width and height as 32-bit numbers.
  expect(bytes.subarray(1, 4).toString("latin1")).toBe("PNG");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

/** Fetches the image a card tag points to and checks that it is a 1200 by 630 PNG. */
async function expectCardImage(request: APIRequestContext, url: string) {
  // The tag has the production address; the test server is local.
  const response = await request.get(new URL(url).pathname + new URL(url).search);
  expect(response.status(), url).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  const bytes = await response.body();
  expect(bytes.length, "a real picture, not an empty one").toBeGreaterThan(10_000);
  expect(pngSize(bytes)).toEqual({ width: 1200, height: 630 });
}

test.describe("the card text and pictures", () => {
  test("the home page has the site's title, a large Twitter card and a picture", async ({ page, request }) => {
    await page.goto("/");
    expect(await meta(page, "og:title")).toBe("Disease Observer");
    expect(await meta(page, "og:site_name")).toBe("Disease Observer");
    expect(await meta(page, "og:type")).toBe("website");
    expect(await meta(page, "og:locale")).toBe("en_GB");
    expect(await meta(page, "twitter:card")).toBe("summary_large_image");
    expect(await meta(page, "twitter:title")).toBe("Disease Observer");
    expect(await meta(page, "og:image:width")).toBe("1200");
    expect(await meta(page, "og:image:height")).toBe("630");
    expect(await meta(page, "og:image:alt")).toContain("Disease Observer");

    await expectCardImage(request, (await meta(page, "og:image"))!);
    await expectCardImage(request, (await meta(page, "twitter:image"))!);
  });

  test("a disease page has its own title, description and picture", async ({ page, request }) => {
    await page.goto(INFLUENZA);
    expect(await meta(page, "og:title")).toBe("Influenza | Disease Observer");
    expect(await meta(page, "og:description")).toContain("contagious respiratory illness");
    expect(await meta(page, "og:url")).toBe("https://disease.observer/diseases/influenza");
    expect(await meta(page, "twitter:card")).toBe("summary_large_image");
    expect(await meta(page, "twitter:title")).toBe("Influenza | Disease Observer");
    expect(await meta(page, "twitter:description")).toBe(await meta(page, "og:description"));

    const og = (await meta(page, "og:image"))!;
    expect(og).toContain("/diseases/influenza/opengraph-image");
    await expectCardImage(request, og);
    const twitter = (await meta(page, "twitter:image"))!;
    expect(twitter).toContain("/diseases/influenza/twitter-image");
    await expectCardImage(request, twitter);
  });

  test("a dataset page has its own, and so do its map, chart and table pages", async ({ page, request }) => {
    await page.goto(DATASET);
    expect(await meta(page, "og:title")).toBe("Influenza hospital admissions by state, United States | Disease Observer");
    expect(await meta(page, "og:image")).toContain(`${DATASET}/opengraph-image`);
    await expectCardImage(request, (await meta(page, "og:image"))!);

    // The views have no card of their own: they share their dataset's picture.
    for (const view of ["map", "chart", "table"]) {
      await page.goto(`${DATASET}/${view}`);
      expect(await meta(page, "og:image"), view).toContain(`${DATASET}/opengraph-image`);
      expect(await meta(page, "twitter:card"), view).toBe("summary_large_image");
    }
  });

  test("every disease and dataset has its pictures", async ({ request }) => {
    for (const path of [
      "/diseases/covid-19",
      "/diseases/measles",
      "/diseases/influenza",
      "/diseases/rsv",
      "/diseases/covid-19/rate-by-local-authority",
      "/diseases/measles/cases-by-region",
      "/diseases/rsv/hospital-admissions-by-state",
      "/diseases/covid-19/hospital-admissions-by-state",
    ]) {
      for (const kind of ["opengraph-image", "twitter-image"]) {
        const response = await request.get(`${path}/${kind}`);
        expect(response.status(), `${path}/${kind}`).toBe(200);
        expect(response.headers()["content-type"]).toBe("image/png");
      }
    }
    for (const kind of ["opengraph-image", "twitter-image"]) {
      expect((await request.get(`/${kind}`)).status(), kind).toBe(200);
    }
  });

  test("a page with no card of its own shows the site's", async ({ page }) => {
    await page.goto("/about");
    expect(await meta(page, "twitter:card")).toBe("summary_large_image");
    expect(await meta(page, "og:image")).toContain("/opengraph-image");
  });
});
