import { expect, test, type Page } from "@playwright/test";

/**
 * Tests for the map page. They need the test database, filled with the
 * fixtures in e2e/fixtures/load.mts: COVID-19 rates for 12 local
 * authorities (3 provisional), and measles cases for the 9 regions.
 *
 * OpenFreeMap is replaced with a tiny local style, so the tests do not
 * depend on the network. The real base maps are checked by hand.
 */

const STYLE_HEADERS = { "access-control-allow-origin": "*" };

/** A base style with only a background, in a colour that tells the themes apart. */
function plainStyle(background: string) {
  return {
    version: 8,
    sources: {},
    layers: [{ id: "background", type: "background", paint: { "background-color": background } }],
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

const mapCanvas = (page: Page) => page.getByTestId("map-canvas");

/** Opens the map page and waits until the map has drawn the current layer. */
async function openMap(page: Page) {
  await page.goto("/map");
  await expect(mapCanvas(page)).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
}

/** Picks a layer with the toggle and waits for the map to draw it. */
async function chooseLayer(page: Page, label: string) {
  await page.locator("label", { hasText: label }).click();
  await expect(mapCanvas(page)).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
}

/**
 * Hovers (on a computer) or taps (on a phone) the middle of the map, which
 * is inside England and so inside one of the regions.
 */
async function pointAtMiddleOfMap(page: Page) {
  const box = await page.locator(".maplibregl-canvas").boundingBox();
  if (!box) throw new Error("The map canvas has no size");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  if (test.info().project.name === "iphone-se") {
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.move(x - 3, y - 3);
    await page.mouse.move(x, y);
  }
}

test("the map renders", async ({ page }) => {
  await openMap(page);

  const canvas = page.locator(".maplibregl-canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box?.width).toBeGreaterThan(200);
  expect(box?.height).toBeGreaterThan(200);
  await expect(page.getByRole("region", { name: /^Map: COVID-19 cases per 100,000/ })).toBeVisible();
});

test("the legend and the table show values", async ({ page }) => {
  await openMap(page);

  const legend = page.getByRole("list", { name: /COVID-19 cases per 100,000/ });
  await expect(legend.getByRole("listitem").first()).toContainText(/Under \d/);
  await expect(legend.getByRole("listitem").last()).toHaveText("No data");

  const table = page.getByRole("table");
  await expect(table.locator("caption")).toContainText("COVID-19");
  await expect(table.locator("caption")).toContainText(/7 days to \d+ \w+ \d{4}/);
  await expect(table.locator("caption")).toContainText("Some values are provisional");
  await expect(table.locator("tbody tr")).toHaveCount(12);
  await expect(table.getByRole("cell", { name: "Provisional", exact: true })).toHaveCount(3);
  // The default order is highest first, and it uses the latest week (410.5), not the older one (5).
  await expect(table.locator("tbody tr").first()).toContainText("North East Lincolnshire");
  await expect(table.locator("tbody tr").first()).toContainText("410.5");
  await expect(
    page.getByText("295 areas on the map have no figure for this period."),
  ).toBeVisible();
});

test("the table can be sorted", async ({ page }) => {
  await openMap(page);

  const table = page.getByRole("table");
  await table.getByRole("button", { name: "Area" }).click();
  await expect(table.getByRole("columnheader", { name: "Area" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(table.locator("tbody tr").first()).toContainText("Blackburn with Darwen");
  await table.getByRole("button", { name: "Area" }).click();
  await expect(table.getByRole("columnheader", { name: "Area" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await expect(table.locator("tbody tr").first()).toContainText("Warrington");
});

test("the measles layer shows the latest complete week", async ({ page }) => {
  await openMap(page);
  await chooseLayer(page, "Measles cases by region");

  const table = page.getByRole("table");
  await expect(table.locator("caption")).toContainText("Measles");
  await expect(table.locator("caption")).toContainText("Week of onset");
  await expect(table.locator("tbody tr")).toHaveCount(9);
  await expect(table.getByRole("cell", { name: "Provisional", exact: true })).toHaveCount(2);
  // The week that has not finished (99 cases in every region) is left out.
  await expect(table.getByRole("cell", { name: "99", exact: true })).toHaveCount(0);
  await expect(table.locator("tbody tr").first()).toContainText("8");
  await expect(page.getByRole("list", { name: /Measles cases/ }).getByRole("listitem").first()).toHaveText("0");
});

test("pointing at or tapping an area shows its figure", async ({ page }) => {
  await openMap(page);
  await chooseLayer(page, "Measles cases by region");
  await pointAtMiddleOfMap(page);

  const readout = page.getByTestId("area-readout");
  await expect(readout).toContainText(/\d+ cases?/);
  await expect(readout).toContainText(/Week of onset \d+ (to|\w+ to) \d+ \w+ \d{4}/);
});

test("the theme switch changes the base map without reloading", async ({ page }) => {
  await openMap(page);
  await chooseLayer(page, "Measles cases by region");
  await expect(mapCanvas(page)).toHaveAttribute("data-base-style", "positron");
  await page.evaluate(() => {
    (window as unknown as { stillHere: boolean }).stillHere = true;
  });

  const darkStyleRequest = page.waitForRequest("https://tiles.openfreemap.org/styles/dark");
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await darkStyleRequest;
  await expect(mapCanvas(page)).toHaveAttribute("data-base-style", "dark", { timeout: 15_000 });
  await expect(mapCanvas(page)).toHaveAttribute("data-map-ready", "true");

  // The same page is still there, and our areas are still drawn on the new base map.
  expect(await page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere)).toBe(true);
  await pointAtMiddleOfMap(page);
  await expect(page.getByTestId("area-readout")).toContainText(/\d+ cases?/);

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(mapCanvas(page)).toHaveAttribute("data-base-style", "positron", { timeout: 15_000 });
});

test("the map page has no horizontal scrolling", async ({ page }) => {
  const overflow = () =>
    page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });

  await openMap(page);
  expect(await overflow()).toBeLessThanOrEqual(0);

  await chooseLayer(page, "Measles cases by region");
  expect(await overflow()).toBeLessThanOrEqual(0);
});

test("the home page does not load the map", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto("/");
  await expect(page.getByRole("link", { name: "View the map" })).toBeVisible();
  await page.waitForLoadState("networkidle");

  expect(requested.filter((url) => url.includes("tiles.openfreemap.org"))).toEqual([]);
  const hasMapStyles = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) =>
      [...sheet.cssRules].some((rule) => rule.cssText.includes(".maplibregl-")),
    ),
  );
  expect(hasMapStyles).toBe(false);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
});
