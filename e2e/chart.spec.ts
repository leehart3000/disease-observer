import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  ENGLAND_WEEKS,
  englandCovidRate,
  englandMeaslesCases,
  fixtureDates,
  LAST_YEAR_WEEKS,
  regionCovidRate,
} from "./fixtures/dates.mts";

/**
 * Tests for the weekly chart on the disease pages. They need the test
 * database, filled by e2e/fixtures/load.mts: England and the nine regions
 * have 70 weeks of COVID-19 rates (England 12.6 falling by 0.1 a week, the
 * regions 0.5 apart around it, London 1.0 above), and England has 70 weeks
 * of measles cases (80 falling by 1 a week). The chart starts on the last
 * 12 months, which is 53 of those weeks.
 */

const dates = fixtureDates();
const LAST = ENGLAND_WEEKS - 1;
/** The slider's last position in the default view (the last 12 months). */
const LAST_IN_YEAR = LAST_YEAR_WEEKS - 1;

/** "14 November 2026", as the site writes it. */
function longDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const slider = (page: Page) => page.getByRole("slider");
const readout = (page: Page) => page.getByTestId("chart-readout");
const regionGroup = (page: Page) =>
  page.getByRole("group", { name: "Pick up to three regions to highlight." });
const regionBox = (page: Page, name: string) => regionGroup(page).getByRole("checkbox", { name });
const rangeGroup = (page: Page) => page.getByRole("group", { name: "Time range" });
/** The chart's lines. Only the plot's SVG is inside the slider. */
const chartPaths = (page: Page) => slider(page).locator("path");
/** Choosing a range or a region means clicking its label: the real input is visually hidden. */
const chooseRange = (page: Page, name: string) => rangeGroup(page).getByText(name, { exact: true }).click();

/** The weekly period that ends `back` weeks before COVID-19's latest. */
const covidWeek = (back: number) => longDay(addDays(dates.covidLatest.end, -7 * back));

async function openCovid(page: Page) {
  await page.goto("/diseases/covid-19");
  await expect(page.getByTestId("line-chart")).toBeVisible();
}

test("the chart shows England and the regions, with the latest week selected", async ({ page }) => {
  await openCovid(page);

  await expect(page.getByRole("heading", { level: 2, name: "Over time" })).toBeVisible();
  await expect(regionGroup(page).getByRole("listitem").first()).toHaveText("England");
  await expect(regionGroup(page).getByRole("checkbox")).toHaveCount(9);
  // England and nine regions: ten lines.
  await expect(chartPaths(page)).toHaveCount(10);
  // The y axis starts at zero.
  await expect(page.getByTestId("line-chart").locator("svg text", { hasText: /^0$/ })).toHaveCount(1);

  await expect(readout(page)).toHaveText(
    `7 days to ${covidWeek(0)} (provisional): England 12.6 per 100,000`,
  );
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(LAST_IN_YEAR));
  await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST_IN_YEAR));
  await expect(slider(page)).toHaveAttribute(
    "aria-valuetext",
    /^7 days to .* \(provisional\): England 12\.6 per 100,000$/,
  );
  await expect(slider(page)).toHaveAccessibleName(
    /^COVID-19, cases per 100,000 \(7 days\), weekly, England and UKHSA regions, .* \d{4} to .* \d{4}\. Latest 12\.6 per 100,000 for England\./,
  );
});

test("the range is the last 12 months, with a choice of the whole series", async ({ page }) => {
  await openCovid(page);
  const last12 = rangeGroup(page).getByRole("radio", { name: "Last 12 months" });
  const since = rangeGroup(page).getByRole("radio", { name: "Since 2023" });
  await expect(last12).toBeChecked();
  await expect(since).not.toBeChecked();

  // The default view starts 52 weeks before the latest, and Home goes there.
  await slider(page).focus();
  await page.keyboard.press("Home");
  await expect(readout(page)).toContainText(covidWeek(LAST_IN_YEAR));
  await page.keyboard.press("ArrowLeft");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "0");

  await chooseRange(page, "Since 2023");
  await expect(since).toBeChecked();
  await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST));
  await slider(page).focus();
  await page.keyboard.press("Home");
  await expect(readout(page)).toContainText(
    `7 days to ${covidWeek(LAST)}: England ${englandCovidRate(LAST)} per 100,000`,
  );

  // Going back to 12 months keeps the marker on screen.
  await chooseRange(page, "Last 12 months");
  await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST_IN_YEAR));
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "0");
  await expect(readout(page)).toContainText(covidWeek(LAST_IN_YEAR));
  // The range is not in the URL yet.
  expect(new URL(page.url()).search).toBe("");
});

test("the slider moves with the keyboard", async ({ page }) => {
  await openCovid(page);
  await slider(page).focus();

  await page.keyboard.press("ArrowLeft");
  await expect(readout(page)).toHaveText(
    `7 days to ${covidWeek(1)}: England ${englandCovidRate(1)} per 100,000`,
  );
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(LAST_IN_YEAR - 1));

  await page.keyboard.press("PageDown");
  await expect(readout(page)).toContainText(covidWeek(5));
  await page.keyboard.press("PageUp");
  await expect(readout(page)).toContainText(covidWeek(1));

  await page.keyboard.press("Home");
  await expect(readout(page)).toHaveText(
    `7 days to ${covidWeek(LAST_IN_YEAR)}: England ${englandCovidRate(LAST_IN_YEAR)} per 100,000`,
  );
  await page.keyboard.press("ArrowLeft");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "0");

  await page.keyboard.press("End");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(LAST_IN_YEAR));
  await page.keyboard.press("ArrowRight");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(LAST_IN_YEAR));
});

test("pointing at the chart moves the marker to the nearest week", async ({ page }) => {
  await openCovid(page);
  // The mouse works in viewport coordinates, so the chart must be on screen.
  await slider(page).scrollIntoViewIfNeeded();
  const box = (await slider(page).boundingBox())!;

  // The left edge of the plot is the oldest week in view. The page may still
  // be hydrating, so try again until the chart answers.
  await expect(async () => {
    await page.mouse.move(box.x + 100, box.y + box.height / 2);
    await page.mouse.move(box.x + 44, box.y + box.height / 2);
    await expect(readout(page)).toContainText(covidWeek(LAST_IN_YEAR), { timeout: 500 });
  }).toPass();
  // The right edge is the latest.
  await page.mouse.move(box.x + box.width - 200, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 12, box.y + box.height / 2);
  await expect(readout(page)).toContainText(covidWeek(0));
});

test("a region is ticked to highlight it, is drawn on top of England, and is limited to three", async ({
  page,
}) => {
  await openCovid(page);
  const london = regionBox(page, "London");
  await expect(london).not.toBeChecked();

  // The box is a real checkbox, so a click on its label ticks it.
  await regionGroup(page).getByText("London", { exact: true }).click();
  await expect(london).toBeChecked();
  await expect(readout(page)).toContainText(
    `England 12.6 per 100,000, London ${regionCovidRate(6, 0)} per 100,000`,
  );
  // The highlighted region gets a colour; the other eight stay muted.
  await expect(page.getByTestId("line-chart").locator('svg path[stroke="var(--chart-1)"]')).toHaveCount(1);
  await expect(page.getByTestId("line-chart").locator('svg path[stroke="var(--muted)"]')).toHaveCount(8);
  // It is drawn after, so on top of, England's line.
  const strokes = await chartPaths(page).evaluateAll((paths) =>
    paths.map((path) => path.getAttribute("stroke")),
  );
  expect(strokes.indexOf("var(--chart-1)")).toBeGreaterThan(strokes.indexOf("var(--ink)"));
  expect(strokes.at(-1)).toBe("var(--chart-1)");

  await regionGroup(page).getByText("East Midlands", { exact: true }).click();
  await regionGroup(page).getByText("East of England", { exact: true }).click();
  await expect(regionGroup(page).getByRole("checkbox", { checked: true })).toHaveCount(3);
  await expect(regionGroup(page).getByRole("checkbox", { checked: false }).first()).toBeDisabled();
  await expect(page.getByText("Three regions are highlighted")).toBeVisible();

  await regionGroup(page).getByText("London", { exact: true }).click();
  await expect(london).not.toBeChecked();
  await expect(regionGroup(page).getByRole("checkbox", { checked: true })).toHaveCount(2);
  await expect(regionGroup(page).getByRole("checkbox", { checked: false }).first()).toBeEnabled();
});

test("the regions are in two columns on a phone, and the hint comes first", async ({ page }) => {
  await openCovid(page);
  const group = regionGroup(page);
  const items = group.getByRole("listitem");
  const [england, eastMidlands, eastOfEngland] = [
    (await items.nth(0).boundingBox())!,
    (await items.nth(1).boundingBox())!,
    (await items.nth(2).boundingBox())!,
  ];
  const legend = (await group.locator("legend").boundingBox())!;

  expect(legend.y + legend.height).toBeLessThanOrEqual(england.y + 1);
  if (test.info().project.name === "iphone-se") {
    expect(Math.abs(england.y - eastMidlands.y)).toBeLessThan(2);
    expect(eastOfEngland.y).toBeGreaterThan(england.y + 30);
  }
});

test("the data table is a disclosure with a decorative chevron", async ({ page }) => {
  await openCovid(page);
  const details = page.locator("details");
  const summary = details.locator("summary");

  await expect(details).not.toHaveAttribute("open", "");
  await expect(summary).toHaveText("View data table");
  await expect(summary.locator("svg")).toHaveAttribute("aria-hidden", "true");
  const chevron = summary.locator("svg");
  const closed = await chevron.evaluate((svg) => getComputedStyle(svg).rotate);

  await summary.click();
  await expect(details).toHaveAttribute("open", "");
  // The chevron turns a quarter turn, whatever the animation state.
  await expect
    .poll(() => chevron.evaluate((svg) => getComputedStyle(svg).rotate))
    .toBe("90deg");
  expect(closed).not.toBe("90deg");
});

test("the data table is paged like the map table: 25 rows, newest first, one live count", async ({
  page,
}) => {
  await openCovid(page);
  const details = page.locator("details");
  await details.getByText("View data table").click();
  const table = details.getByRole("table");
  const rows = table.locator("tbody tr");
  const topPages = details.getByRole("navigation", { name: "Data table pages (top)" });
  const bottomPages = details.getByRole("navigation", { name: "Data table pages (bottom)" });

  await expect(table.getByRole("columnheader")).toHaveCount(11);
  await expect(table.getByRole("columnheader").nth(0)).toHaveText("Period");
  await expect(table.getByRole("columnheader").nth(1)).toHaveText("England");
  // The table covers the same weeks as the chart.
  await expect(rows).toHaveCount(25);
  await expect(details.getByRole("status")).toHaveCount(1);
  await expect(details.getByRole("status")).toHaveText(`Showing 1 to 25 of ${LAST_YEAR_WEEKS} weeks`);
  const firstRow = rows.first();
  await expect(firstRow.getByRole("rowheader")).toContainText(`7 days to ${covidWeek(0)}`);
  await expect(firstRow.getByRole("cell").first()).toHaveText("12.6");
  await expect(rows.nth(1).getByRole("rowheader")).toContainText(covidWeek(1));

  // Page controls above and below, showing the same page.
  await expect(topPages).toContainText("Page 1 of 3");
  await expect(bottomPages).toContainText("Page 1 of 3");
  await expect(topPages.getByRole("button", { name: "Previous" })).toBeDisabled();
  await bottomPages.getByRole("button", { name: "Next" }).click();
  await expect(details.getByRole("status")).toHaveText(
    `Showing 26 to 50 of ${LAST_YEAR_WEEKS} weeks`,
  );
  await expect(topPages).toContainText("Page 2 of 3");
  await expect(rows.first().getByRole("rowheader")).toContainText(covidWeek(25));
  await topPages.getByRole("button", { name: "Next" }).click();
  await expect(rows).toHaveCount(LAST_YEAR_WEEKS - 50);

  // Rows per page: 25, 50, 100 or All.
  const size = details.getByLabel("Rows per page");
  await expect(size.locator("option")).toHaveText(["25", "50", "100", "All"]);
  await size.selectOption("50");
  await expect(rows).toHaveCount(50);
  await expect(details.getByRole("status")).toHaveText(`Showing 1 to 50 of ${LAST_YEAR_WEEKS} weeks`);
  await size.selectOption("100");
  await expect(rows).toHaveCount(LAST_YEAR_WEEKS);
  await expect(topPages).toHaveCount(0);
  await size.selectOption("all");
  await expect(rows).toHaveCount(LAST_YEAR_WEEKS);
});

test("the data table follows the chart's range", async ({ page }) => {
  await openCovid(page);
  const details = page.locator("details");
  await details.getByText("View data table").click();
  await expect(details.getByRole("status")).toHaveText(`Showing 1 to 25 of ${LAST_YEAR_WEEKS} weeks`);

  await chooseRange(page, "Since 2023");
  await expect(details.getByRole("status")).toHaveText(`Showing 1 to 25 of ${ENGLAND_WEEKS} weeks`);
  await details.getByLabel("Rows per page").selectOption("all");
  await expect(details.getByRole("table").locator("tbody tr")).toHaveCount(ENGLAND_WEEKS);
  // The oldest week is last.
  await expect(
    details.getByRole("table").locator("tbody tr").last().getByRole("rowheader"),
  ).toContainText(covidWeek(LAST));
});

test("the measles chart shows case counts", async ({ page }) => {
  await page.goto("/diseases/measles");
  await expect(page.getByTestId("line-chart")).toBeVisible();

  await expect(readout(page)).toContainText("Week of onset");
  await expect(readout(page)).toContainText(`England ${englandMeaslesCases(0)} cases`);
  await slider(page).focus();
  await page.keyboard.press("Home");
  await expect(readout(page)).toContainText(`England ${englandMeaslesCases(LAST_IN_YEAR)} cases`);
  await expect(chartPaths(page)).toHaveCount(10);
  // The 99 for a week that has not ended is not on the chart.
  await expect(page.getByTestId("line-chart")).not.toContainText("99 cases");
});

test("the chart does not make the page scroll sideways, even with the table open", async ({
  page,
}) => {
  await openCovid(page);
  await page.locator("details").getByText("View data table").click();
  await expect(page.locator("details").getByRole("table")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});

const MEASLES_CHART = "/diseases/measles/cases-by-region/chart";

test.describe("the chart page of a dataset", () => {
  test("shows the chart, with a breadcrumb and the view links, and the chart tab is current", async ({
    page,
  }) => {
    await page.goto(MEASLES_CHART);

    await expect(page).toHaveTitle("Measles cases by region: chart | Disease Observer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Measles cases by region");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem")).toHaveText([
      "Diseases›",
      "Measles›",
      "Cases by region›",
      "Chart",
    ]);
    const views = page.getByRole("navigation", { name: "Views of Cases by region" });
    await expect(views.getByRole("link")).toHaveText(["Map", "Chart", "Table"]);
    await expect(views.getByRole("link", { name: "Chart" })).toHaveAttribute("aria-current", "page");

    await expect(page.getByTestId("line-chart")).toBeVisible();
    await expect(regionGroup(page).getByRole("checkbox")).toHaveCount(9);
    await expect(readout(page)).toContainText(`England ${englandMeaslesCases(0)} cases`);
    await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST_IN_YEAR));
    await expect(page.getByRole("heading", { level: 2, name: "Sources" })).toBeVisible();
    // The canonical link has no query string.
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/cases-by-region\/chart$/);
  });

  test("?range=all opens on the whole series, and an invalid range is ignored", async ({ page }) => {
    await page.goto(`${MEASLES_CHART}?range=all`);
    await expect(rangeGroup(page).getByRole("radio", { name: "Since 2023" })).toBeChecked();
    await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST));

    for (const bad of ["?range=bogus", "?range=", "?range=12m", "?range=ALL"]) {
      await page.goto(`${MEASLES_CHART}${bad}`);
      await expect(rangeGroup(page).getByRole("radio", { name: "Last 12 months" })).toBeChecked();
      await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST_IN_YEAR));
    }
  });

  test("the range is kept in the address and survives a reload", async ({ page }) => {
    await page.goto(MEASLES_CHART);
    await expect(page.getByTestId("line-chart")).toBeVisible();

    await chooseRange(page, "Since 2023");
    await expect(page).toHaveURL(`${MEASLES_CHART}?range=all`);
    await page.reload();
    await expect(rangeGroup(page).getByRole("radio", { name: "Since 2023" })).toBeChecked();
    await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST));

    // Going back to the default leaves the parameter out.
    await chooseRange(page, "Last 12 months");
    await expect(page).toHaveURL(MEASLES_CHART);
  });

  test("the links to the other views drop the range but keep the areas", async ({ page }) => {
    await page.goto(`${MEASLES_CHART}?range=all&areas=E12000001`);
    await expect(page.getByTestId("line-chart")).toBeVisible();

    const views = page.getByRole("navigation", { name: "Views of Cases by region" });
    await expect(views.getByRole("link", { name: "Map" })).toHaveAttribute(
      "href",
      "/diseases/measles/cases-by-region/map?areas=E12000001",
    );
    await expect(views.getByRole("link", { name: "Table" })).toHaveAttribute(
      "href",
      "/diseases/measles/cases-by-region/table?areas=E12000001",
    );
  });

  test("the local authority dataset has no chart page yet", async ({ page }) => {
    await page.goto("/diseases/covid-19/rate-by-local-authority");
    await expect(page.getByRole("link", { name: /^Chart/ })).toHaveCount(0);
  });
});
