import { expect, test, type Page } from "@playwright/test";

/**
 * Tests for the map page. They need the test database, filled with the
 * fixtures in e2e/fixtures/load.mts: COVID-19 rates for 30 local
 * authorities (3 provisional, and North East Lincolnshire the highest at
 * 410.5), and measles cases for the 9 regions (2 provisional).
 *
 * OpenFreeMap is replaced with a tiny local style, so the tests do not
 * depend on the network. The real base maps are checked by hand.
 */

const STYLE_HEADERS = { "access-control-allow-origin": "*" };

/**
 * A base style with only a background, in a colour that tells the themes
 * apart. It has one empty source with OpenFreeMap's credit, so the map
 * shows an attribution box, as it does with the real styles.
 */
function plainStyle(background: string) {
  return {
    version: 8,
    sources: {
      credit: {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        attribution:
          '<a href="https://openfreemap.org">OpenFreeMap</a> <a href="https://www.openmaptiles.org/">&copy; OpenMapTiles</a> Data from <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      },
    },
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

const isPhone = () => test.info().project.name === "iphone-se";
const mapCanvas = (page: Page) => page.getByTestId("map-canvas");
const readout = (page: Page) => page.getByTestId("area-readout");
const table = (page: Page) => page.getByRole("table");
const rows = (page: Page) => table(page).locator("tbody tr");

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
 * A point on the map: the middle, which is inside England and so inside
 * one of the regions, or the sea off the west coast, which is inside no area.
 */
async function pointOnMap(page: Page, where: "middle" | "sea") {
  const box = await page.locator(".maplibregl-canvas").boundingBox();
  if (!box) throw new Error("The map canvas has no size");
  return where === "middle"
    ? { x: box.x + box.width / 2, y: box.y + box.height / 2 }
    : { x: box.x + 30, y: box.y + box.height / 2 };
}

/** Clicks (on a computer) or taps (on a phone) a point on the map. */
async function chooseOnMap(page: Page, where: "middle" | "sea") {
  const { x, y } = await pointOnMap(page, where);
  if (isPhone()) {
    // Two quick taps would be a double-tap, which zooms the map.
    await page.waitForTimeout(700);
    await page.touchscreen.tap(x, y);
  } else {
    await page.mouse.click(x, y);
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

  await expect(table(page).locator("caption")).toContainText("COVID-19");
  await expect(table(page).locator("caption")).toContainText(/7 days to \d+ \w+ \d{4}/);
  // The headings come from the dataset, and there is no status column.
  await expect(table(page).getByRole("columnheader")).toHaveText([/^Area/, /^Cases per 100,000 \(7 days\)/]);
  await expect(table(page).getByRole("columnheader", { name: "Status" })).toHaveCount(0);

  // The default order is highest first, and it uses the latest week (410.5), not the older one (5).
  await expect(rows(page)).toHaveCount(25);
  await expect(rows(page).first()).toContainText("North East Lincolnshire");
  await expect(rows(page).first()).toContainText("410.5");
  await expect(page.getByText("277 areas on the map have no figure for this period.")).toBeVisible();
});

test("provisional values are tagged, with one note above the table", async ({ page }) => {
  await openMap(page);

  await expect(page.getByText("Provisional figures may still change.")).toBeVisible();
  const tags = table(page).getByText("Provisional", { exact: true });
  await expect(tags).toHaveCount(3);
  // The tag sits in the value cell, next to the number.
  const hartlepool = rows(page).filter({ hasText: "Hartlepool" });
  await expect(hartlepool.locator("td")).toContainText("Provisional");
  await expect(hartlepool.locator("td")).toContainText("20");
  await expect(rows(page).filter({ hasText: "North East Lincolnshire" }).locator("td")).not.toContainText(
    "Provisional",
  );
});

test("the table can be sorted", async ({ page }) => {
  await openMap(page);

  await table(page).getByRole("button", { name: "Area" }).click();
  await expect(table(page).getByRole("columnheader", { name: "Area" })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(rows(page).first()).toContainText("Bath and North East Somerset");
  await table(page).getByRole("button", { name: "Area" }).click();
  await expect(table(page).getByRole("columnheader", { name: "Area" })).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  await expect(rows(page).first()).toContainText("York");
});

test("the table is paged, with a choice of page size", async ({ page }) => {
  await openMap(page);

  await expect(page.getByText("Showing 1 to 25 of 30")).toBeVisible();
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByRole("button", { name: "Previous" })).toBeDisabled();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 26 to 30 of 30")).toBeVisible();
  await expect(rows(page)).toHaveCount(5);
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();

  const size = page.getByLabel("Rows per page");
  await expect(size.locator("option")).toHaveText(["25", "50", "100", "All"]);
  await size.selectOption("50");
  await expect(page.getByText("Showing 1 to 30 of 30")).toBeVisible();
  await expect(rows(page)).toHaveCount(30);
  await expect(page.getByRole("navigation", { name: "Table pages" })).toHaveCount(0);

  await size.selectOption("all");
  await expect(rows(page)).toHaveCount(30);
  await size.selectOption("25");
  await expect(page.getByText("Showing 1 to 25 of 30")).toBeVisible();
});

test("the table can be searched by area name", async ({ page }) => {
  await openMap(page);

  const search = page.getByLabel("Search by area name");
  await search.fill("hart");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Hartlepool");
  await expect(page.getByText(/Showing 1 to 1 of 1 matching/)).toBeVisible();

  await search.fill("zzz");
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByText("No areas match “zzz”.")).toBeVisible();

  await search.fill("");
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByText("Showing 1 to 25 of 30")).toBeVisible();
});

test("the server sends the first page of the table in the HTML", async ({ request }) => {
  // The table is rendered on the server, not built by the browser. (React
  // streams it into a hidden element that a script reveals, so a browser
  // with JavaScript turned off does not display it.)
  const html = await (await request.get("/map")).text();

  // 25 rows and the heading row.
  expect(html.match(/<tr[ >]/g)).toHaveLength(26);
  expect(html).toContain("North East Lincolnshire");
  expect(html).toContain("Showing 1 to 25 of 30");
  expect(html).toContain("Provisional figures may still change.");
});

test("the measles layer shows the latest complete week", async ({ page }) => {
  await openMap(page);
  await chooseLayer(page, "Measles cases by region");

  await expect(table(page).locator("caption")).toContainText("Measles");
  await expect(table(page).locator("caption")).toContainText("Week of onset");
  await expect(table(page).getByRole("columnheader")).toHaveText([/^Area/, /^Cases \(week\)/]);
  await expect(rows(page)).toHaveCount(9);
  await expect(page.getByText("Showing 1 to 9 of 9")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Table pages" })).toHaveCount(0);
  await expect(table(page).getByText("Provisional", { exact: true })).toHaveCount(2);
  await expect(page.getByText("Provisional figures may still change.")).toBeVisible();
  // The week that has not finished (99 cases in every region) is left out.
  await expect(table(page).getByText("99", { exact: true })).toHaveCount(0);
  await expect(rows(page).first()).toContainText("8");
  await expect(page.getByRole("list", { name: /Measles cases/ }).getByRole("listitem").first()).toHaveText("0");
});

test("only the sources for the selected dataset are shown", async ({ page }) => {
  await openMap(page);

  const sources = page.getByRole("region", { name: "Sources" });
  for (const layer of ["COVID-19 rate by local authority", "Measles cases by region"]) {
    await chooseLayer(page, layer);
    await expect(sources).toContainText("UKHSA data dashboard");
    await expect(sources).toContainText("Open Government Licence v3.0");
    await expect(sources).toContainText("Office for National Statistics");
    await expect(sources).toContainText("Crown copyright and database right 2022");
    // Not every source, and not the base map (its credit is in the map).
    await expect(sources).not.toContainText("FluNet");
    await expect(sources).not.toContainText("OpenFreeMap");
  }
});

test("pointing at an area previews it, and clicking or tapping pins it", async ({ page }) => {
  await openMap(page);
  await chooseLayer(page, "Measles cases by region");

  if (!isPhone()) {
    // Pointing previews the area. Moving away clears the preview.
    const middle = await pointOnMap(page, "middle");
    await page.mouse.move(middle.x - 3, middle.y - 3);
    await page.mouse.move(middle.x, middle.y);
    await expect(readout(page)).toContainText(/\d+ cases?/);
    await expect(readout(page)).not.toContainText("Pinned");
    await expect(mapCanvas(page)).toHaveAttribute("data-highlight", /^E45/);
    const sea = await pointOnMap(page, "sea");
    await page.mouse.move(sea.x, sea.y);
    await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
  }

  // A click or tap pins the area.
  await chooseOnMap(page, "middle");
  await expect(readout(page)).toContainText(/\d+ cases?/);
  await expect(readout(page)).toContainText(/Week of onset/);
  await expect(readout(page)).toContainText("Pinned");
  const pinnedCode = await mapCanvas(page).getAttribute("data-highlight");
  expect(pinnedCode).toMatch(/^E45/);

  if (!isPhone()) {
    // The readout stays when the pointer moves away.
    const sea = await pointOnMap(page, "sea");
    await page.mouse.move(sea.x, sea.y);
    await expect(readout(page)).toContainText("Pinned");
    await expect(mapCanvas(page)).toHaveAttribute("data-highlight", pinnedCode!);
  }

  // Choosing the pinned area again unpins it. (On a computer the pointer is
  // still over the area, so it is still previewed until the pointer moves.)
  await chooseOnMap(page, "middle");
  await expect(readout(page)).not.toContainText("Pinned");
  if (!isPhone()) {
    await expect(mapCanvas(page)).toHaveAttribute("data-highlight", pinnedCode!);
    const sea = await pointOnMap(page, "sea");
    await page.mouse.move(sea.x, sea.y);
  }
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);

  // Clicking empty map unpins it.
  await chooseOnMap(page, "middle");
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", /^E45/);
  await chooseOnMap(page, "sea");
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);

  // So does the Escape key.
  await chooseOnMap(page, "middle");
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", /^E45/);
  await page.keyboard.press("Escape");
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
});

test("an area can be pinned from the table with the keyboard", async ({ page }) => {
  await openMap(page);

  const pin = page.getByRole("button", { name: "Hartlepool (pin on the map)" });
  await pin.focus();
  await page.keyboard.press("Enter");
  await expect(pin).toHaveAttribute("aria-pressed", "true");
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");
  await expect(readout(page)).toContainText("Hartlepool");
  await expect(readout(page)).toContainText("Provisional");
  await expect(page.getByText("Pinned on the map: Hartlepool.")).toBeVisible();

  // Pressing it again unpins it.
  await page.keyboard.press("Enter");
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);

  // Escape unpins it too, and so does the Unpin button.
  await page.keyboard.press("Enter");
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");
  await page.keyboard.press("Escape");
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Unpin" }).click();
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
});

test("a pinned area is cleared when the layer changes", async ({ page }) => {
  await openMap(page);

  await page.getByRole("button", { name: "Hartlepool (pin on the map)" }).click();
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");
  await chooseLayer(page, "Measles cases by region");
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
});

test("the map has a labelled fullscreen button", async ({ page }) => {
  await openMap(page);

  const enter = page.getByRole("button", { name: "Enter fullscreen" });
  await expect(enter).toBeVisible();
  await enter.click();
  // The key and readout go full screen with the map.
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("map-frame")))
    .toBe(true);
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
});

test("the attribution is visible and readable in both themes", async ({ page }) => {
  await openMap(page);

  const attribution = page.locator(".maplibregl-ctrl-attrib");
  await expect(attribution).toBeVisible();
  await expect(attribution).not.toHaveClass(/maplibregl-compact/);
  await expect(attribution).toContainText("OpenFreeMap");
  await expect(attribution).toContainText("OpenStreetMap");

  /** The text colour of the box and its links, and the page's own text colour. */
  const colours = () =>
    page.evaluate(() => {
      const box = document.querySelector(".maplibregl-ctrl-attrib") as HTMLElement;
      const link = box.querySelector("a") as HTMLElement;
      return {
        box: getComputedStyle(box).color,
        link: getComputedStyle(link).color,
        page: getComputedStyle(document.body).color,
        background: getComputedStyle(document.body).backgroundColor,
      };
    });
  const lightness = (colour: string) => {
    const [r, g, b] = (colour.match(/\d+(\.\d+)?/g) ?? []).map(Number);
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  };

  // In both themes the box uses our text colour, which contrasts with the page colour.
  for (const theme of ["light", "dark"] as const) {
    if (theme === "dark") {
      await page.getByRole("button", { name: "Switch to dark theme" }).click();
      await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    }
    const found = await colours();
    expect(found.box).toBe(found.page);
    expect(found.link).toBe(found.page);
    expect(Math.abs(lightness(found.page) - lightness(found.background))).toBeGreaterThan(0.5);
  }
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
  await chooseOnMap(page, "middle");
  await expect(readout(page)).toContainText(/\d+ cases?/);

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

  await page.getByLabel("Rows per page").selectOption("all");
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
