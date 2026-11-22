import { expect, test, type Page } from "@playwright/test";

/**
 * Tests for the Table view and the strip of links between a dataset's
 * views. They need the test database, filled by e2e/fixtures/load.mts: COVID-19
 * rates for 30 local authorities (North East Lincolnshire the highest at
 * 410.5, three provisional) and measles cases for the 9 regions.
 */

const COVID = "/diseases/covid-19/rate-by-local-authority";
const MEASLES = "/diseases/measles/cases-by-region";

// The map the tests sometimes open does not need the real base map: if its
// style can't be loaded, it draws our areas on a plain background.
test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
});

const isPhone = () => test.info().project.name === "iphone-se";
const table = (page: Page) => page.getByRole("table");
const rows = (page: Page) => table(page).locator("tbody tr");
const views = (page: Page, name = "Rate by local authority") =>
  page.getByRole("navigation", { name: `Views of ${name}` });

test("the table page has a breadcrumb, the table and the sources", async ({ page }) => {
  await page.goto(`${COVID}/table`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("COVID-19 rate by local authority");
  await expect(page).toHaveTitle("COVID-19 rate by local authority: table | Disease Observer");
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem");
  await expect(crumbs).toHaveText([/^Diseases/, /^COVID-19/, /^Rate by local authority/, /^Table$/]);
  await expect(crumbs.nth(3).locator('[aria-current="page"]')).toHaveText("Table");

  await expect(table(page).locator("caption")).toContainText("COVID-19 cases per 100,000 people");
  await expect(table(page).locator("caption")).toContainText(/7 days to \d+ \w+ \d{4}/);
  // The Map column is left out on a phone, where the link goes under the area's name.
  await expect(table(page).getByRole("columnheader")).toHaveText(
    isPhone()
      ? [/^Area/, /^Cases per 100,000 \(7 days\)/]
      : [/^Area/, /^Cases per 100,000 \(7 days\)/, "Map"],
  );
  await expect(rows(page)).toHaveCount(25);
  await expect(page.getByText("Showing 1 to 25 of 30")).toBeVisible();
  await expect(page.getByText("Provisional figures may still change.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Sources" })).toContainText("UKHSA data dashboard");
  // The highest rate is first.
  await expect(rows(page).first()).toContainText("North East Lincolnshire");
});

test("the table page has no map and loads none of the map's code", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto(`${COVID}/table`);
  await expect(rows(page)).toHaveCount(25);
  await page.waitForLoadState("networkidle");

  expect(requested.filter((url) => url.includes("tiles.openfreemap.org") || url.includes("/maplibre/"))).toEqual([]);
  await expect(page.locator(".maplibregl-canvas")).toHaveCount(0);
  const hasMapStyles = await page.evaluate(() =>
    [...document.styleSheets].some((sheet) =>
      [...sheet.cssRules].some((rule) => rule.cssText.includes(".maplibregl-")),
    ),
  );
  expect(hasMapStyles).toBe(false);
});

test("the server sends the first page of the table in the HTML", async ({ request }) => {
  const html = await (await request.get(`${COVID}/table`)).text();

  // 25 rows and the heading row.
  expect(html.match(/<tr[ >]/g)).toHaveLength(26);
  expect(html).toContain("North East Lincolnshire");
  expect(html).toContain("Showing 1 to 25 of 30");
  expect(html).toContain("View on map");
});

test("the table can be searched, sorted and paged", async ({ page }) => {
  await page.goto(`${COVID}/table`);
  await expect(rows(page)).toHaveCount(25);

  await page.getByLabel("Search table by area name").fill("hartle");
  await expect(rows(page)).toHaveCount(1);
  await expect(rows(page).first()).toContainText("Hartlepool");
  await expect(page.getByText("Showing 1 to 1 of 1 matching “hartle”")).toBeVisible();
  await page.getByLabel("Search table by area name").fill("");

  // Sorted by area name, A to Z.
  await page.getByRole("button", { name: /^Area/ }).click();
  await expect(table(page).getByRole("columnheader", { name: /^Area/ })).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await expect(rows(page).first()).toContainText("Bath and North East Somerset");

  // Paged: 25 rows, then the other 5.
  await expect(page.getByRole("navigation", { name: "Table pages (top)" })).toContainText("Page 1 of 2");
  await page.getByRole("navigation", { name: "Table pages (bottom)" }).getByRole("button", { name: "Next" }).click();
  await expect(rows(page)).toHaveCount(5);
  await expect(page.getByText("Showing 26 to 30 of 30")).toBeVisible();
});

test("a row links to the area on the map, and there is no pin button", async ({ page }) => {
  await page.goto(`${COVID}/table`);

  // No pinning here, and no instruction about it.
  await expect(page.getByRole("button", { name: /^Pin / })).toHaveCount(0);
  await expect(page.getByText("Select an area to pin it on the map.")).toHaveCount(0);

  const link = page.getByRole("link", { name: "View Hartlepool on the map" });
  await page.getByLabel("Search table by area name").fill("Hartlepool");
  await expect(link).toHaveText("View on map");
  await expect(link).toHaveAttribute("href", `${COVID}/map?areas=E06000001`);
  // The icon is decoration.
  await expect(link.locator("svg")).toHaveAttribute("aria-hidden", "true");

  await link.click();
  await expect(page).toHaveURL(`${COVID}/map?areas=E06000001`);
  await expect(page.getByTestId("area-readout")).toContainText("Hartlepool");
  await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-highlight", "E06000001", {
    timeout: 30_000,
  });
});

test("the table fits the screen: on a phone the link is under the name, with no sideways scroll", async ({
  page,
}) => {
  await page.goto(`${COVID}/table`);
  const first = rows(page).first();
  const link = first.getByRole("link", { name: /^View .+ on the map$/ });
  await expect(link).toBeVisible();
  expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);

  // The table never needs to scroll inside its box, on either screen.
  const overflow = await table(page).evaluate((el) => {
    const box = el.parentElement!;
    return box.scrollWidth - box.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);

  if (isPhone()) {
    const name = (await first.getByRole("rowheader").boundingBox())!;
    const box = (await link.boundingBox())!;
    expect(box.y).toBeGreaterThan(name.y);
    expect(box.x + box.width).toBeLessThanOrEqual(name.x + name.width);
  } else {
    // A column of its own, to the right of the figure.
    const figure = (await first.getByRole("cell").first().boundingBox())!;
    expect((await link.boundingBox())!.x).toBeGreaterThan(figure.x + figure.width);
  }
});

test("areas in the address are highlighted, and unknown ones are ignored", async ({ page }) => {
  await page.goto(`${COVID}/table?areas=E06000001,not-a-code,E45000001,E06000002`);

  // Hartlepool and Middlesbrough are local authorities in the data (both
  // have high rates, so they are on the first page); the region and the bad
  // code are not.
  const selected = table(page).locator('tbody tr[data-selected="true"]');
  await expect(selected).toHaveCount(2);
  await expect(selected.first()).toContainText("Selected");
  await expect(selected.filter({ hasText: "Hartlepool" })).toHaveCount(1);
  await expect(selected.filter({ hasText: "Middlesbrough" })).toHaveCount(1);
});

test("the measles table has nine regions on one page", async ({ page }) => {
  await page.goto(`${MEASLES}/table`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Measles cases by region");
  await expect(rows(page)).toHaveCount(9);
  await expect(page.getByText("Showing 1 to 9 of 9")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Table pages (top)" })).toHaveCount(0);
  await expect(table(page).getByRole("columnheader")).toHaveText(
    isPhone() ? [/^Area/, /^Cases \(week\)/] : [/^Area/, /^Cases \(week\)/, "Map"],
  );
  await expect(table(page).locator("caption")).toContainText("Week of onset");
  await expect(page.getByRole("link", { name: /^View .+ on the map$/ }).first()).toHaveAttribute(
    "href",
    /^\/diseases\/measles\/cases-by-region\/map\?areas=E45/,
  );
});

test.describe("the views of a dataset", () => {
  test("the table and map pages link to each other, marking the current one", async ({ page }) => {
    await page.goto(`${COVID}/table`);
    const nav = views(page);
    await expect(nav.getByRole("link")).toHaveText(["Map", "Table"]);
    await expect(nav.getByRole("link", { name: "Table" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Map" })).not.toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Map" })).toHaveAttribute("href", `${COVID}/map`);
    expect((await nav.getByRole("link").first().boundingBox())!.height).toBeGreaterThanOrEqual(44);

    await nav.getByRole("link", { name: "Map" }).click();
    await expect(page).toHaveURL(`${COVID}/map`);
    const mapNav = views(page);
    await expect(mapNav.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
    await mapNav.getByRole("link", { name: "Table" }).click();
    await expect(page).toHaveURL(`${COVID}/table`);
  });

  test("the chosen areas are kept when moving between views", async ({ page }) => {
    // From an address with areas, to the other view.
    await page.goto(`${COVID}/table?areas=E06000001`);
    await expect(views(page).getByRole("link", { name: "Map" })).toHaveAttribute(
      "href",
      `${COVID}/map?areas=E06000001`,
    );
    await views(page).getByRole("link", { name: "Map" }).click();
    await expect(page).toHaveURL(`${COVID}/map?areas=E06000001`);
    await expect(page.getByTestId("area-readout")).toContainText("Hartlepool");

    // Anything that is not an area code is not carried along.
    await page.goto(`${COVID}/table?areas=<script>,E06000002`);
    await expect(views(page).getByRole("link", { name: "Map" })).toHaveAttribute(
      "href",
      `${COVID}/map?areas=E06000002`,
    );
  });

  test("a pin made on the map is carried to the table, without a page load", async ({ page }) => {
    await page.goto(`${COVID}/map`);
    await page.getByRole("button", { name: "Pin Hartlepool on the map" }).click();
    await expect(page).toHaveURL(`${COVID}/map?areas=E06000001`);

    const tableLink = views(page).getByRole("link", { name: "Table" });
    await expect(tableLink).toHaveAttribute("href", `${COVID}/table?areas=E06000001`);
    await tableLink.click();
    await expect(page).toHaveURL(`${COVID}/table?areas=E06000001`);
    // Next.js keeps the page you came from, hidden, so look only at what is on screen.
    await expect(page.getByRole("combobox", { name: "Rows per page" })).toHaveCount(1);
    await expect(table(page).locator('tbody tr[data-selected="true"]')).toHaveCount(1);

    // Unpinning on the map takes it out of the tab link.
    await views(page).getByRole("link", { name: "Map" }).click();
    await page.getByRole("button", { name: "Unpin Hartlepool from the map" }).click();
    await expect(views(page).getByRole("link", { name: "Table" })).toHaveAttribute(
      "href",
      `${COVID}/table`,
    );
  });

  test("the strip is shown on both pages of each dataset and has no horizontal scrolling", async ({
    page,
  }) => {
    for (const path of [`${COVID}/table`, `${MEASLES}/table`]) {
      await page.goto(path);
      await expect(page.getByRole("navigation", { name: /^Views of / })).toBeVisible();
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
