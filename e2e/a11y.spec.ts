import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { sitePaths } from "../src/lib/datasets/routes.ts";

/**
 * Accessibility checks with axe-core on every page in the sitemap
 * (`sitePaths()`), and on the 404 page. A page fails if axe reports an issue
 * that is serious or critical, against the WCAG 2.0, 2.1 and 2.2 A and AA
 * rules. Each page is checked in the light theme and, for a representative
 * few, in the dark one (the colours differ). They run at both sizes.
 *
 * They need the test database, because the pages are checked with their
 * figures loaded: each test waits until the page has finished loading before
 * it runs axe. axe cannot read the colours of a map's canvas, so it does not
 * judge the text drawn on it (those are reported as "incomplete", not as
 * failures); the base map's own controls are MapLibre's.
 */

const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

// The map does not need the real base map: if its style can't be loaded, it
// draws our areas on a plain background.
test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
});

/** Waits until a page has loaded the data that streams into it, so axe sees the real page. */
async function settle(page: Page, path: string) {
  await page.goto(path);
  if (path.endsWith("/map")) {
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
  } else if (path.endsWith("/chart")) {
    await expect(page.getByTestId("line-chart")).toBeVisible();
    await expect(page.getByRole("slider")).toBeVisible();
  } else if (path.endsWith("/table")) {
    await expect(page.getByRole("table")).toBeVisible();
  } else if (path.startsWith("/locations/")) {
    await expect(page.getByTestId("headline").first()).toBeVisible();
  } else if (/^\/diseases\/[^/]+$/.test(path)) {
    await expect(page.getByTestId("headline")).toBeVisible();
    await expect(page.getByTestId("line-chart")).toBeVisible();
  } else if (path === "/" || path === "/diseases") {
    await expect(page.getByTestId("headline").first()).toBeVisible();
  }
  await page.waitForLoadState("networkidle");
}

/** Runs axe and fails, listing each serious or critical issue and where it is. */
async function expectNoSeriousIssues(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const serious = results.violations.filter(
    (violation) => violation.impact === "serious" || violation.impact === "critical",
  );
  const report = serious
    .map(
      (violation) =>
        `${violation.impact}: ${violation.id} (${violation.help})\n` +
        violation.nodes
          .slice(0, 5)
          .map((node) => `    ${node.target.join(" ")}\n      ${node.html.slice(0, 140)}`)
          .join("\n"),
    )
    .join("\n");
  expect(serious, `${label} has accessibility issues:\n${report}`).toEqual([]);
}

const PATHS = [...sitePaths(), "/no-such-page"];

test.describe("every page, in the light theme", () => {
  test.use({ colorScheme: "light" });
  for (const path of PATHS) {
    test(`${path} has no serious accessibility issues`, async ({ page }) => {
      test.setTimeout(90_000);
      await settle(page, path);
      await expectNoSeriousIssues(page, path);
    });
  }
});

/** One of each kind of page, for the dark theme. */
const DARK_PATHS = [
  "/",
  "/diseases/influenza",
  "/diseases/influenza/hospital-admissions-by-state",
  "/diseases/influenza/hospital-admissions-by-state/map",
  "/diseases/influenza/hospital-admissions-by-state/chart",
  "/diseases/influenza/hospital-admissions-by-state/table",
  "/diseases/covid-19/rate-by-local-authority/map",
  "/locations/united-states",
  "/maps",
  "/sources",
  "/no-such-page",
];

test.describe("a page of each kind, in the dark theme", () => {
  test.use({ colorScheme: "dark" });
  for (const path of DARK_PATHS) {
    test(`${path} has no serious accessibility issues`, async ({ page }) => {
      test.setTimeout(90_000);
      await settle(page, path);
      await expectNoSeriousIssues(page, `${path} (dark)`);
    });
  }
});

test.describe("states of a page that the load alone does not show", () => {
  test("the area picker with its list open, and a state pinned on the map", async ({ page }) => {
    test.setTimeout(90_000);
    await settle(page, "/diseases/covid-19/rate-by-local-authority/chart?areas=E06000001");
    await expect(page.getByLabel("Find a local authority")).toBeVisible();
    await page.getByLabel("Find a local authority").fill("ha");
    await expectNoSeriousIssues(page, "the chart with a search");

    await settle(page, "/diseases/influenza/hospital-admissions-by-state/map?areas=US-WA");
    await expect(page.getByTestId("area-readout")).toContainText("Washington");
    await expectNoSeriousIssues(page, "the US map with a pinned state");
  });

  test("a table with its search, and the page controls", async ({ page }) => {
    await settle(page, "/diseases/covid-19/rate-by-local-authority/table");
    await page.getByLabel("Search table by area name").fill("ham");
    await expectNoSeriousIssues(page, "the table with a search");
  });
});
