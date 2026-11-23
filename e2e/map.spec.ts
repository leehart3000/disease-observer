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
const topPages = (page: Page) => page.getByRole("navigation", { name: "Table pages (top)" });
const bottomPages = (page: Page) => page.getByRole("navigation", { name: "Table pages (bottom)" });

/** The map page of each dataset, by the dataset's label. */
const MAP_PATHS: Record<string, { path: string; id: string }> = {
  "COVID-19 rate by local authority": {
    path: "/diseases/covid-19/rate-by-local-authority/map",
    id: "covid-19-rate",
  },
  "Measles cases by region": {
    path: "/diseases/measles/cases-by-region/map",
    id: "measles-cases",
  },
};

/** Opens a map page (COVID-19 by default) and waits until the map has drawn it. */
async function openMap(page: Page, path = MAP_PATHS["COVID-19 rate by local authority"].path) {
  await page.goto(path);
  await expect(mapCanvas(page)).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
}

/**
 * Goes to a dataset's map page and waits for the map to draw it. Each dataset
 * has its own page, so this is a new page load, not a change in place.
 */
async function chooseLayer(page: Page, label: string) {
  const { path, id } = MAP_PATHS[label];
  await page.goto(path);
  await expect(mapCanvas(page)).toHaveAttribute("data-dataset", id, { timeout: 30_000 });
  await expect(mapCanvas(page)).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
}

/**
 * A point on the map: the middle, which is inside England and so inside
 * one of the regions, or the sea off the west coast, which is inside no area.
 */
async function pointOnMap(page: Page, where: "middle" | "sea") {
  // The mouse and touch work in viewport coordinates, and on a phone the
  // map can be below the fold (under the period choice), so bring it on screen.
  await page.locator(".maplibregl-canvas").scrollIntoViewIfNeeded();
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

test("the map's attribution links are external links", async ({ page }) => {
  await openMap(page);

  const links = page.locator(".maplibregl-ctrl-attrib a");
  await expect(links).toHaveCount(3);
  for (const link of await links.all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await expect(link.locator('svg[aria-hidden="true"]')).toHaveCount(1);
    await expect(link.locator(".sr-only")).toHaveText("(opens in a new tab)");
  }
  await expect(page.getByRole("link", { name: "OpenFreeMap (opens in a new tab)" })).toBeVisible();

  // They are decorated again if MapLibre rewrites the box, as it does when the theme changes.
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(mapCanvas(page)).toHaveAttribute("data-base-style", "dark", { timeout: 15_000 });
  for (const link of await page.locator(".maplibregl-ctrl-attrib a").all()) {
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  }
});

test("the table says that choosing an area pins it, and each name has a map pin", async ({ page }) => {
  await openMap(page);

  const instruction = page.getByTestId("table-instruction");
  await expect(instruction).toHaveText("Select an area to pin it on the map.");
  // It is above the table, and below the result count.
  const [text, tableBox, count] = [
    (await instruction.boundingBox())!,
    (await table(page).boundingBox())!,
    (await page.getByText(/^Showing 1 to 25/).boundingBox())!,
  ];
  expect(text.y + text.height).toBeLessThanOrEqual(tableBox.y);
  expect(text.y).toBeGreaterThan(count.y);

  // Each area's name is a button with a decorative pin, still named by what it does.
  const button = page.getByRole("button", { name: "Pin Hartlepool on the map" });
  await expect(button).toContainText("Hartlepool");
  await expect(button.locator('svg[aria-hidden="true"]')).toHaveCount(1);
  expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // Hovering gives more than an underline: a background and the brand colour.
  const before = await button.evaluate((el) => {
    const style = getComputedStyle(el);
    return { background: style.backgroundColor, color: style.color };
  });
  if (!isPhone()) {
    await button.hover();
    await expect
      .poll(() =>
        button.evaluate((el) => {
          const style = getComputedStyle(el);
          return { background: style.backgroundColor, color: style.color };
        }),
      )
      .not.toEqual(before);
  }

  // Pinned, the pin is filled.
  await button.click();
  const pinned = page.getByRole("button", { name: "Unpin Hartlepool from the map" });
  await expect(pinned.locator("svg")).toHaveAttribute("fill", "currentColor");
});

test("choosing anywhere on a row pins its area, and choosing the name pins it once", async ({
  page,
}) => {
  await openMap(page);
  const row = rows(page).filter({ hasText: "Hartlepool" }).first();
  const unpin = page.getByRole("button", { name: "Unpin Hartlepool from the map" });
  await row.scrollIntoViewIfNeeded();

  // The row looks and acts clickable.
  await expect(row).toHaveCSS("cursor", "pointer");

  // A value cell pins the area.
  await row.locator("td").first().click();
  await expect(unpin).toBeVisible();
  await expect(readout(page)).toContainText("Hartlepool");

  // Choosing it again unpins.
  await row.locator("td").first().click();
  await expect(page.getByRole("button", { name: "Pin Hartlepool on the map" })).toBeVisible();

  // The name button pins once: the row's own handler ignores clicks inside buttons.
  await page.getByRole("button", { name: "Pin Hartlepool on the map" }).click();
  await expect(unpin).toBeVisible();
  await page.getByRole("button", { name: "Unpin Hartlepool from the map" }).click();
  await expect(page.getByRole("button", { name: "Pin Hartlepool on the map" })).toBeVisible();
});

test("the area name button fills the name cell, so every row lines up", async ({ page }) => {
  await openMap(page);
  const first = rows(page).first();
  const cell = first.getByRole("rowheader");
  const button = first.getByRole("button", { name: /^Pin / });
  const cellBox = (await cell.boundingBox())!;
  const buttonBox = (await button.boundingBox())!;
  expect(cellBox.x + cellBox.width - (buttonBox.x + buttonBox.width)).toBeLessThanOrEqual(16);
});

test("each dataset has its own map page, with no dataset picker", async ({ page }) => {
  await openMap(page);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("COVID-19 rate by local authority");
  await expect(page.getByRole("list", { name: /COVID-19 cases per 100,000/ })).toBeVisible();
  await expect(table(page).locator("caption")).toContainText("COVID-19");
  // Choosing another dataset is now a link to its page, not a picker on this one.
  await expect(page.getByLabel("Dataset")).toHaveCount(0);
  await expect(page.getByRole("combobox", { name: "Dataset" })).toHaveCount(0);
  await expect(page.getByRole("radio")).toHaveCount(0);

  await openMap(page, MAP_PATHS["Measles cases by region"].path);
  await expect(mapCanvas(page)).toHaveAttribute("data-dataset", "measles-cases");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Measles cases by region");
  await expect(table(page).locator("caption")).toContainText("Measles");
  await expect(table(page).locator("caption")).toContainText("Week of onset");
  await expect(page.getByRole("list", { name: /Measles cases/ })).toBeVisible();
});

test("the old map address opens the dataset's map page", async ({ page }) => {
  await page.goto("/map?d=measles-cases");
  await expect(page).toHaveURL("/diseases/measles/cases-by-region/map");
  await expect(mapCanvas(page)).toHaveAttribute("data-dataset", "measles-cases", { timeout: 30_000 });
  await expect(mapCanvas(page)).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });

  // An unknown dataset gives the default one, and a period that is not offered is dropped.
  await page.goto("/map?d=not-a-dataset&p=12w");
  await expect(page).toHaveURL("/diseases/covid-19/rate-by-local-authority/map");
  await expect(mapCanvas(page)).toHaveAttribute("data-dataset", "covid-19-rate", { timeout: 30_000 });
});

test("a pinned area is kept in the address, without a new page load", async ({ page }) => {
  await openMap(page);
  await page.evaluate(() => {
    (window as unknown as { stillHere: boolean }).stillHere = true;
  });
  const samePage = () =>
    page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere === true);

  await page.getByRole("button", { name: "Pin Hartlepool on the map" }).click();
  await expect(page).toHaveURL(/\/map\?areas=E06000001$/);
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");

  // Pinning another area replaces the pin, and the address follows.
  await page.getByRole("button", { name: "Pin Middlesbrough on the map" }).click();
  await expect(page).toHaveURL(/\/map\?areas=E06000002$/);

  // Unpinning takes it out of the address.
  await page.getByRole("button", { name: "Unpin Middlesbrough from the map" }).click();
  await expect(page).toHaveURL(/\/map$/);
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
  expect(await samePage()).toBe(true);

  // Escape unpins too.
  await page.getByRole("button", { name: "Pin Hartlepool on the map" }).click();
  await expect(page).toHaveURL(/\?areas=E06000001$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/map$/);
  expect(await samePage()).toBe(true);
});

test("a pinned area in the address is pinned on load, and unknown codes are ignored", async ({
  page,
}) => {
  await openMap(page, `${MAP_PATHS["COVID-19 rate by local authority"].path}?areas=E06000001`);
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");
  await expect(readout(page)).toContainText("Hartlepool");
  await expect(readout(page)).toContainText("Pinned");
  await expect(page.getByRole("button", { name: "Unpin Hartlepool from the map" })).toBeVisible();

  // A code that is not shaped like an area code, or is not in this dataset,
  // is skipped; the first one that is in the data is pinned.
  await openMap(
    page,
    `${MAP_PATHS["COVID-19 rate by local authority"].path}?areas=not-a-code,E99999999,E06000002`,
  );
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000002");
  await expect(readout(page)).toContainText("Middlesbrough");

  // An area of another dataset (a region on the local authority map) pins nothing.
  await openMap(page, `${MAP_PATHS["COVID-19 rate by local authority"].path}?areas=E45000001`);
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
  await expect(readout(page)).toHaveAttribute("data-empty", "true");
});

test("the map page has a breadcrumb back to the dataset, the disease and the list of diseases", async ({
  page,
}) => {
  await openMap(page);
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem");

  // Earlier steps are followed by a separator that is hidden from screen readers.
  await expect(crumbs).toHaveText([/^Diseases/, /^COVID-19/, /^Rate by local authority/, /^Map$/]);
  await expect(crumbs.nth(3).locator('[aria-current="page"]')).toHaveText("Map");
  await crumbs.nth(2).getByRole("link").click();
  await expect(page).toHaveURL("/diseases/covid-19/rate-by-local-authority");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("COVID-19 rate by local authority");
});

test("the server sends the chosen dataset in the HTML", async ({ request }) => {
  const html = await (await request.get(MAP_PATHS["Measles cases by region"].path)).text();

  expect(html).toContain("Week of onset");
  expect(html).toContain("Cases (week)");
  expect(html.match(/<tr[ >]/g)).toHaveLength(10); // 9 regions and the heading row
  // Only the chosen dataset's values are sent.
  expect(html).not.toContain("Cases per 100,000 (7 days)");
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

test("the table controls are in order, with one live result count", async ({ page }) => {
  await openMap(page);

  // Search box, rows per page, result count, page controls, table, page controls.
  const inOrder = await page.evaluate(() => {
    const section = document.querySelector("#values-table");
    const parts = [
      section?.querySelector('input[type="search"]'),
      section?.querySelector("select"),
      section?.querySelector('[role="status"]'),
      section?.querySelector('nav[aria-label="Table pages (top)"]'),
      section?.querySelector("table"),
      section?.querySelector('nav[aria-label="Table pages (bottom)"]'),
    ];
    if (parts.some((part) => !part)) return "a part is missing";
    return parts.every(
      (part, i) =>
        i === 0 || Boolean(parts[i - 1]!.compareDocumentPosition(part!) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
  });
  expect(inOrder).toBe(true);
  await expect(page.getByLabel("Search table by area name")).toBeVisible();

  // The result count is the only live region, so it is announced once.
  const live = page.locator('#values-table [role="status"], #values-table [aria-live]');
  await expect(live).toHaveCount(1);
  await expect(live).toHaveText("Showing 1 to 25 of 30");
  await expect(page.getByText("Showing 1 to 25 of 30")).toHaveCount(1);
});

test("the table is paged, with a choice of page size", async ({ page }) => {
  await openMap(page);

  await expect(page.getByText("Showing 1 to 25 of 30")).toBeVisible();
  await expect(rows(page)).toHaveCount(25);
  await expect(topPages(page).getByRole("button", { name: "Previous" })).toBeDisabled();
  await expect(bottomPages(page).getByRole("button", { name: "Previous" })).toBeDisabled();

  // The two sets of page controls stay in step, whichever is used.
  await topPages(page).getByRole("button", { name: "Next" }).click();
  await expect(page.getByText("Showing 26 to 30 of 30")).toBeVisible();
  await expect(rows(page)).toHaveCount(5);
  await expect(topPages(page).getByText("Page 2 of 2")).toBeVisible();
  await expect(bottomPages(page).getByText("Page 2 of 2")).toBeVisible();
  await expect(topPages(page).getByRole("button", { name: "Next" })).toBeDisabled();
  await expect(bottomPages(page).getByRole("button", { name: "Next" })).toBeDisabled();

  await bottomPages(page).getByRole("button", { name: "Previous" }).click();
  await expect(page.getByText("Showing 1 to 25 of 30")).toBeVisible();
  await expect(topPages(page).getByText("Page 1 of 2")).toBeVisible();
  await expect(bottomPages(page).getByText("Page 1 of 2")).toBeVisible();

  const size = page.getByLabel("Rows per page");
  await expect(size.locator("option")).toHaveText(["25", "50", "100", "All"]);
  await size.selectOption("50");
  await expect(page.getByText("Showing 1 to 30 of 30")).toBeVisible();
  await expect(rows(page)).toHaveCount(30);
  await expect(topPages(page)).toHaveCount(0);
  await expect(bottomPages(page)).toHaveCount(0);

  await size.selectOption("all");
  await expect(rows(page)).toHaveCount(30);
  await size.selectOption("25");
  await expect(page.getByText("Showing 1 to 25 of 30")).toBeVisible();
});

test("the table can be searched by area name", async ({ page }) => {
  await openMap(page);

  const search = page.getByLabel("Search table by area name");
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
  const html = await (
    await request.get(MAP_PATHS["COVID-19 rate by local authority"].path)
  ).text();

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
  await expect(topPages(page)).toHaveCount(0);
  await expect(bottomPages(page)).toHaveCount(0);
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
  await expect(readout(page)).toContainText("Pinned. To unpin: click or tap it again, or press Escape.");
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

  const pin = page.getByRole("button", { name: "Pin Hartlepool on the map" });
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await pin.focus();
  await page.keyboard.press("Enter");

  // The row is highlighted and tagged, and its button now offers to unpin.
  const unpin = page.getByRole("button", { name: "Unpin Hartlepool from the map" });
  await expect(unpin).toHaveAttribute("aria-pressed", "true");
  const row = rows(page).filter({ hasText: "Hartlepool" });
  await expect(row.getByText("Pinned", { exact: true })).toBeVisible();
  await expect(row).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(rows(page).filter({ hasText: "Middlesbrough" })).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  // There is no separate "Pinned on the map" line.
  await expect(page.getByText("Pinned on the map")).toHaveCount(0);
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");
  await expect(readout(page)).toContainText("Hartlepool");
  await expect(readout(page)).toContainText("Provisional");
  await expect(readout(page)).toContainText("Pinned. To unpin: click or tap it again, or press Escape.");

  // Pressing it again unpins it.
  await page.keyboard.press("Enter");
  await expect(pin).toHaveAttribute("aria-pressed", "false");
  await expect(row.getByText("Pinned", { exact: true })).toHaveCount(0);
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);

  // Escape unpins it too.
  await page.keyboard.press("Enter");
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");
  await page.keyboard.press("Escape");
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
  await expect(row.getByText("Pinned", { exact: true })).toHaveCount(0);
});

test("a table button's name includes the area name, even with a comma", async ({ page }) => {
  await openMap(page);

  const pin = page.getByRole("button", { name: "Pin Herefordshire, County of on the map" });
  await expect(pin).toBeVisible();
  await expect(pin).toContainText("Herefordshire, County of");
});

test("a pin does not carry over to another dataset's map", async ({ page }) => {
  await openMap(page);

  await page.getByRole("button", { name: "Pin Hartlepool on the map" }).click();
  await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");
  await chooseLayer(page, "Measles cases by region");
  await expect(mapCanvas(page)).not.toHaveAttribute("data-highlight", /.+/);
});

test("the map has a labelled fullscreen button that expands the map, key and readout", async ({ page }) => {
  await openMap(page);
  await page.getByRole("button", { name: "Pin Hartlepool on the map" }).click();

  const enter = page.getByRole("button", { name: "Enter fullscreen" });
  await expect(enter).toBeVisible();
  await enter.click();

  // The wrapper that holds the map, the key and the readout goes full screen.
  const frame = page.locator(".map-frame");
  await expect(frame).toHaveAttribute("data-mode", "native");
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement?.classList.contains("map-frame")))
    .toBe(true);
  expect(
    await page.evaluate(() => {
      const full = document.fullscreenElement;
      return Boolean(full?.querySelector('[data-testid="area-readout"]') && full.querySelector(".map-legend"));
    }),
  ).toBe(true);
  await expect(readout(page)).toBeVisible();

  const exit = page.getByRole("button", { name: "Exit fullscreen" });
  await exit.click();
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true);
  await expect(frame).toHaveAttribute("data-expanded", "false");
  await expect(page.getByRole("button", { name: "Enter fullscreen" })).toBeFocused();
});

test.describe("without the Fullscreen API (as on iPhone Safari)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false, configurable: true });
      delete (Element.prototype as { requestFullscreen?: unknown }).requestFullscreen;
    });
  });

  test("a CSS expanded mode fills the screen with the map, key and readout", async ({ page }) => {
    await openMap(page);
    await page.getByRole("button", { name: "Pin Hartlepool on the map" }).click();
    await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");

    const frame = page.locator(".map-frame");
    const canvas = page.locator(".maplibregl-canvas");
    const before = await canvas.boundingBox();
    const viewport = page.viewportSize()!;

    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(frame).toHaveAttribute("data-mode", "css");
    await expect(frame).toHaveAttribute("data-expanded", "true");

    // It is fixed, fills the viewport and sits above the page.
    await expect(frame).toHaveCSS("position", "fixed");
    const box = await frame.boundingBox();
    expect(box).toMatchObject({ x: 0, y: 0, width: viewport.width });
    expect(box!.height).toBeGreaterThanOrEqual(viewport.height - 1);
    const topmost = await page.evaluate(
      ([x, y]) => document.elementFromPoint(x, y)?.closest(".map-frame") !== null,
      [40, 30],
    );
    expect(topmost).toBe(true);

    // The page behind cannot scroll, and cannot take keyboard focus.
    await expect(page.locator("html")).toHaveCSS("overflow", "hidden");
    await expect(page.locator("body > header")).toHaveAttribute("inert", "");
    await expect(page.locator("#values-table")).toHaveAttribute("inert", "");

    // The map has grown to fill the frame, and the key and readout are laid over it.
    await expect.poll(async () => (await canvas.boundingBox())!.width).toBeGreaterThan(before!.width);
    const map = (await canvas.boundingBox())!;
    for (const part of [page.locator(".map-legend"), readout(page)]) {
      await expect(part).toBeVisible();
      const inner = (await part.boundingBox())!;
      expect(inner.x).toBeGreaterThanOrEqual(map.x);
      expect(inner.y).toBeGreaterThanOrEqual(map.y);
      expect(inner.x + inner.width).toBeLessThanOrEqual(map.x + map.width);
      expect(inner.y + inner.height).toBeLessThanOrEqual(map.y + map.height);
    }
    await expect(readout(page)).toContainText("Hartlepool");

    // Escape leaves the mode, keeps the pin and puts focus back on the button.
    await expect(page.getByRole("button", { name: "Exit fullscreen" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(frame).toHaveAttribute("data-expanded", "false");
    await expect(frame).not.toHaveAttribute("data-mode", /.+/);
    await expect(page.getByRole("button", { name: "Enter fullscreen" })).toBeFocused();
    await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden");
    await expect(page.locator("body > header")).not.toHaveAttribute("inert", "");
    await expect(mapCanvas(page)).toHaveAttribute("data-highlight", "E06000001");
    await expect.poll(async () => (await canvas.boundingBox())!.width).toBeCloseTo(before!.width, -1);
  });

  test("the same button leaves the CSS mode, and focus returns to it", async ({ page }) => {
    await openMap(page);
    const frame = page.locator(".map-frame");

    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(frame).toHaveAttribute("data-mode", "css");
    await page.getByRole("button", { name: "Exit fullscreen" }).click();
    await expect(frame).toHaveAttribute("data-expanded", "false");
    await expect(page.getByRole("button", { name: "Enter fullscreen" })).toBeFocused();

    // It can be entered again.
    await page.keyboard.press("Enter");
    await expect(frame).toHaveAttribute("data-mode", "css");
  });
});

/** Removes the Fullscreen API before the page loads, as on iPhone Safari. */
async function withoutFullscreenApi(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false, configurable: true });
    delete (Element.prototype as { requestFullscreen?: unknown }).requestFullscreen;
  });
}

const showLegend = (page: Page) => page.getByRole("button", { name: "Show legend" });
const hideLegend = (page: Page) => page.getByRole("button", { name: "Hide legend" });

test("the legend can be collapsed to a slim bar and expanded again", async ({ page }) => {
  await openMap(page);

  // Expanded by default outside full screen, on every screen size.
  await expect(hideLegend(page)).toHaveAttribute("aria-expanded", "true");
  const listId = await hideLegend(page).getAttribute("aria-controls");
  expect(listId).toBeTruthy();
  const list = page.locator(`[id="${listId}"]`);
  await expect(list).toBeVisible();
  await expect(list.getByRole("listitem").first()).toContainText(/Under \d/);

  // Collapsed: a colour strip with the lowest and highest values only.
  await hideLegend(page).click();
  await expect(showLegend(page)).toHaveAttribute("aria-expanded", "false");
  await expect(showLegend(page)).toHaveAttribute("aria-controls", listId!);
  await expect(list).toBeHidden();
  const bar = page.getByRole("group", { name: "Legend, lowest value 1, highest value 410.5" });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText("1");
  await expect(bar).toContainText("410.5");
  await expect(bar).not.toContainText("Under");

  await showLegend(page).click();
  await expect(hideLegend(page)).toHaveAttribute("aria-expanded", "true");
  await expect(list).toBeVisible();
});

test("native full screen: the legend starts collapsed on a narrow screen only", async ({ page }) => {
  await openMap(page);
  await expect(hideLegend(page)).toBeVisible();

  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".map-frame")).toHaveAttribute("data-mode", "native");
  if (isPhone()) {
    await expect(showLegend(page)).toBeVisible();
  } else {
    await expect(hideLegend(page)).toBeVisible();
  }
  await page.getByRole("button", { name: "Exit fullscreen" }).click();
  // Leaving full screen puts the default back: expanded outside it.
  await expect(hideLegend(page)).toBeVisible();
});

test.describe("full screen without the Fullscreen API (CSS mode)", () => {
  test.beforeEach(async ({ page }) => {
    await withoutFullscreenApi(page);
  });

  test("the legend starts collapsed on a narrow screen and expanded on a wide one", async ({ page }) => {
    await openMap(page);
    await expect(hideLegend(page)).toBeVisible();

    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(page.locator(".map-frame")).toHaveAttribute("data-mode", "css");
    if (isPhone()) {
      await expect(showLegend(page)).toBeVisible();
      await expect(page.getByRole("group", { name: /^Legend, lowest value/ })).toBeVisible();
    } else {
      await expect(hideLegend(page)).toBeVisible();
      await expect(page.getByRole("list", { name: /COVID-19 cases per 100,000/ })).toBeVisible();
    }
  });

  test("the visitor's choice is kept, in and out of full screen", async ({ page }) => {
    await openMap(page);
    const frame = page.locator(".map-frame");

    // Collapse it on the page. Full screen keeps it collapsed (even on a wide
    // screen, where the default is expanded), and so does leaving it.
    await hideLegend(page).click();
    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(frame).toHaveAttribute("data-mode", "css");
    await expect(showLegend(page)).toBeVisible();
    await page.getByRole("button", { name: "Exit fullscreen" }).click();
    await expect(frame).toHaveAttribute("data-expanded", "false");
    await expect(showLegend(page)).toBeVisible();

    // Expand it in full screen. It stays expanded (even on a narrow screen,
    // where the default is collapsed), and after leaving and entering again.
    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await showLegend(page).click();
    await expect(hideLegend(page)).toBeVisible();
    await page.getByRole("button", { name: "Exit fullscreen" }).click();
    await expect(hideLegend(page)).toBeVisible();
    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(frame).toHaveAttribute("data-mode", "css");
    await expect(hideLegend(page)).toBeVisible();

    // Nothing is stored in the browser.
    expect(await page.evaluate(() => localStorage.length + sessionStorage.length)).toBe(0);
  });

  test("the map fills the screen edge to edge", async ({ page }) => {
    await openMap(page);
    const viewport = page.viewportSize()!;
    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(page.locator(".map-frame")).toHaveAttribute("data-mode", "css");

    const frame = page.locator(".map-frame");
    const region = page.locator(".map-region");
    await expect(frame).toHaveCSS("padding", "0px");
    await expect(region).toHaveCSS("border-top-width", "0px");
    await expect(region).toHaveCSS("border-bottom-left-radius", "0px");
    await expect(region).toHaveCSS("box-shadow", "none");
    await expect
      .poll(async () => (await region.boundingBox())!.height)
      .toBeGreaterThanOrEqual(viewport.height - 1);
    expect(await region.boundingBox()).toMatchObject({ x: 0, y: 0, width: viewport.width });
    const canvas = (await page.locator(".maplibregl-canvas").boundingBox())!;
    expect(canvas).toMatchObject({ x: 0, y: 0, width: viewport.width });
  });

  test("an expanded legend covers at most about a quarter of a narrow map", async ({ page }) => {
    test.skip(!isPhone(), "This is about the 375 px layout.");
    await openMap(page);
    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await showLegend(page).click();
    await expect(hideLegend(page)).toBeVisible();

    const map = (await page.locator(".map-region").boundingBox())!;
    const legend = (await page.locator(".map-legend").boundingBox())!;
    expect((legend.width * legend.height) / (map.width * map.height)).toBeLessThanOrEqual(0.25);
    // It is inside the map, and every item can be read.
    expect(legend.x).toBeGreaterThanOrEqual(map.x);
    expect(legend.y + legend.height).toBeLessThanOrEqual(map.y + map.height);
    await expect(page.getByRole("list", { name: /COVID-19 cases per 100,000/ }).getByRole("listitem")).toHaveCount(7);
  });

  test("on a narrow screen the readout is compact and keeps clear of the pinned area", async ({ page }) => {
    test.skip(!isPhone(), "This is about the 375 px layout.");
    await openMap(page);
    await chooseLayer(page, "Measles cases by region");
    const frame = page.locator(".map-frame");

    // North East is at the top of the map, where the readout usually sits.
    await page.getByRole("button", { name: "Pin North East on the map" }).click();
    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(frame).toHaveAttribute("data-mode", "css");
    await expect(frame).toHaveAttribute("data-readout", "bottom");
    let map = (await page.locator(".map-region").boundingBox())!;
    const readoutBox = (await readout(page).boundingBox())!;
    expect(readoutBox.y).toBeGreaterThan(map.y + map.height / 2);
    expect((readoutBox.width * readoutBox.height) / (map.width * map.height)).toBeLessThanOrEqual(0.12);
    // It does not overlap the key.
    const legendBox = (await page.locator(".map-legend").boundingBox())!;
    expect(readoutBox.y + readoutBox.height).toBeLessThanOrEqual(legendBox.y + 1);
    await page.getByRole("button", { name: "Exit fullscreen" }).click();

    // London is in the south, so the readout stays at the top.
    await page.getByRole("button", { name: "Unpin North East from the map" }).click();
    await page.getByRole("button", { name: "Pin London on the map" }).click();
    await page.getByRole("button", { name: "Enter fullscreen" }).click();
    await expect(frame).toHaveAttribute("data-readout", "top");
    map = (await page.locator(".map-region").boundingBox())!;
    expect((await readout(page).boundingBox())!.y).toBeLessThan(map.y + map.height / 3);
  });
});

test("native full screen also fills the screen edge to edge", async ({ page }) => {
  await openMap(page);
  const viewport = page.viewportSize()!;
  await page.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(page.locator(".map-frame")).toHaveAttribute("data-mode", "native");

  await expect(page.locator(".map-frame")).toHaveCSS("padding", "0px");
  await expect(page.locator(".map-region")).toHaveCSS("border-top-width", "0px");
  await expect(page.locator(".map-region")).toHaveCSS("border-bottom-left-radius", "0px");
  const region = page.locator(".map-region");
  await expect.poll(async () => (await region.boundingBox())!.width).toBe(viewport.width);
  expect(await region.boundingBox()).toMatchObject({ x: 0, y: 0 });
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
  await expect(page.getByRole("article").getByRole("link", { name: "Maps" })).toBeVisible();
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
