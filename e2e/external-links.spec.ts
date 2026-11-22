import { expect, test, type ElementHandle, type Page } from "@playwright/test";

/**
 * Every link to another website opens in a new tab, with rel="noopener
 * noreferrer", a small icon after its last word, and the hidden words
 * "(opens in a new tab)". The map's attribution box is checked in
 * map.spec.ts. These tests need the test database for the sources.
 */

const PAGES = [
  "/sources",
  "/about",
  "/diseases/covid-19",
  "/diseases/covid-19/rate-by-local-authority",
  "/diseases/measles/cases-by-region",
  "/diseases/covid-19/rate-by-local-authority/table",
  "/",
];

/** Every link on the page that goes to another website. */
async function externalLinks(page: Page) {
  const origin = new URL(page.url()).origin;
  const handles = (await page.locator("a[href]").elementHandles()) as ElementHandle<HTMLAnchorElement>[];
  const found: ElementHandle<HTMLAnchorElement>[] = [];
  for (const handle of handles) {
    const href = await handle.evaluate((a) => a.href);
    if (new URL(href).origin !== origin) found.push(handle);
  }
  return found;
}

for (const path of PAGES) {
  test(`${path}: every link to another website is an external link`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");

    for (const link of await externalLinks(page)) {
      const detail = await link.evaluate((a) => ({
        href: a.href,
        target: a.getAttribute("target"),
        rel: a.getAttribute("rel"),
        icons: a.querySelectorAll('svg[aria-hidden="true"]').length,
        text: a.textContent,
      }));
      expect(detail.target, detail.href).toBe("_blank");
      expect(detail.rel?.split(" ").sort(), detail.href).toEqual(["noopener", "noreferrer"]);
      expect(detail.icons, detail.href).toBe(1);
      expect(detail.text, detail.href).toMatch(/ \(opens in a new tab\)$/);
    }
  });
}

test("the sources page has external links, named with the new-tab words", async ({ page }) => {
  await page.goto("/sources");

  const links = await externalLinks(page);
  // Two sources and the base map, each with a name and a licence.
  expect(links.length).toBeGreaterThanOrEqual(6);
  const ukhsa = page.getByRole("link", { name: "UKHSA data dashboard (opens in a new tab)" });
  await expect(ukhsa).toHaveAttribute("href", "https://ukhsa-dashboard.data.gov.uk/");
  await expect(ukhsa).toHaveAttribute("target", "_blank");
  // The hidden words are not on screen.
  await expect(ukhsa.locator(".sr-only")).toHaveText("(opens in a new tab)");
  const hidden = await ukhsa.locator(".sr-only").boundingBox();
  expect(hidden!.width).toBeLessThanOrEqual(1);
});

test("links within the site do not open in a new tab", async ({ page }) => {
  await page.goto("/diseases/covid-19");

  const internal = page.locator('main a[href^="/"]');
  expect(await internal.count()).toBeGreaterThan(3);
  for (const link of await internal.all()) {
    await expect(link).not.toHaveAttribute("target", /.+/);
    await expect(link.locator(".external-link-icon")).toHaveCount(0);
  }
});

test("the icon stays on the same line as the last word, at any width", async ({ page }) => {
  // Narrow widths make the names wrap, so this is where an icon would be left alone on a line.
  for (const width of [320, 375, 600]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/sources");

    for (const link of await externalLinks(page)) {
      const boxes = await link.evaluate((a) => {
        const nowrap = a.querySelector("span.whitespace-nowrap")!;
        const icon = a.querySelector("svg")!;
        const word = nowrap.getBoundingClientRect();
        const mark = icon.getBoundingClientRect();
        return {
          text: a.textContent,
          // The word and the icon share a line if the icon's middle is within the word's height.
          sameLine: mark.top + mark.height / 2 >= word.top && mark.top + mark.height / 2 <= word.bottom,
          // The whole last word, with the icon, is in one box on one line.
          oneLine: word.height < 2 * parseFloat(getComputedStyle(a).lineHeight),
        };
      });
      expect(boxes.sameLine, `${boxes.text} at ${width}`).toBe(true);
      expect(boxes.oneLine, `${boxes.text} at ${width}`).toBe(true);
    }
  }
});
