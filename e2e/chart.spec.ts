import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  englandCovidRate,
  englandMeaslesCases,
  fixtureDates,
  regionCovidRate,
} from "./fixtures/dates.mts";

/**
 * Tests for the weekly chart on the disease pages. They need the test
 * database, filled by e2e/fixtures/load.mts: England and the nine regions
 * have 30 weeks of COVID-19 rates (England 12.6 falling by 0.3 a week, the
 * regions 0.5 apart around it, London 1.0 above), and England has 30 weeks
 * of measles cases (40 falling by 1 a week).
 */

const dates = fixtureDates();
const WEEKS = 30;

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
const legend = (page: Page) => page.getByRole("list", { name: "Places on the chart" });
const regionButton = (page: Page, name: string) => legend(page).getByRole("button", { name });

/** The weekly period that ends `back` weeks before COVID-19's latest. */
const covidWeek = (back: number) => longDay(addDays(dates.covidLatest.end, -7 * back));

async function openCovid(page: Page) {
  await page.goto("/diseases/covid-19");
  await expect(page.getByTestId("line-chart")).toBeVisible();
}

test("the chart shows England and the regions, with the latest week selected", async ({ page }) => {
  await openCovid(page);

  await expect(page.getByRole("heading", { level: 2, name: "Over time" })).toBeVisible();
  await expect(legend(page).getByRole("listitem").first()).toHaveText("England");
  await expect(legend(page).getByRole("button")).toHaveCount(9);
  // England and nine regions: ten lines.
  await expect(page.getByTestId("line-chart").locator("svg path")).toHaveCount(10);

  await expect(readout(page)).toHaveText(
    `7 days to ${covidWeek(0)} (provisional): England 12.6 per 100,000`,
  );
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(WEEKS - 1));
  await expect(slider(page)).toHaveAttribute("aria-valuemax", String(WEEKS - 1));
  await expect(slider(page)).toHaveAttribute(
    "aria-valuetext",
    /^7 days to .* \(provisional\): England 12\.6 per 100,000$/,
  );
  await expect(slider(page)).toHaveAccessibleName(
    /^COVID-19, cases per 100,000 \(7 days\), weekly, England and UKHSA regions, .* \d{4} to .* \d{4}\. Latest 12\.6 per 100,000 for England\./,
  );
});

test("the slider moves with the keyboard", async ({ page }) => {
  await openCovid(page);
  await slider(page).focus();

  await page.keyboard.press("ArrowLeft");
  await expect(readout(page)).toHaveText(
    `7 days to ${covidWeek(1)}: England ${englandCovidRate(1)} per 100,000`,
  );
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(WEEKS - 2));

  await page.keyboard.press("PageDown");
  await expect(readout(page)).toContainText(covidWeek(5));
  await page.keyboard.press("PageUp");
  await expect(readout(page)).toContainText(covidWeek(1));

  await page.keyboard.press("Home");
  await expect(readout(page)).toHaveText(
    `7 days to ${covidWeek(WEEKS - 1)}: England ${englandCovidRate(WEEKS - 1)} per 100,000`,
  );
  await page.keyboard.press("ArrowLeft");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", "0");

  await page.keyboard.press("End");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(WEEKS - 1));
  await page.keyboard.press("ArrowRight");
  await expect(slider(page)).toHaveAttribute("aria-valuenow", String(WEEKS - 1));
});

test("pointing at the chart moves the marker to the nearest week", async ({ page }) => {
  await openCovid(page);
  // The mouse works in viewport coordinates, so the chart must be on screen.
  await slider(page).scrollIntoViewIfNeeded();
  const box = (await slider(page).boundingBox())!;

  // The left edge of the plot is the oldest week. The page may still be
  // hydrating, so try again until the chart answers.
  await expect(async () => {
    await page.mouse.move(box.x + 100, box.y + box.height / 2);
    await page.mouse.move(box.x + 44, box.y + box.height / 2);
    await expect(readout(page)).toContainText(covidWeek(WEEKS - 1), { timeout: 500 });
  }).toPass();
  // The right edge is the latest.
  await page.mouse.move(box.x + box.width - 200, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width - 12, box.y + box.height / 2);
  await expect(readout(page)).toContainText(covidWeek(0));
});

test("a region can be highlighted, shows in the readout, and is limited to three", async ({
  page,
}) => {
  await openCovid(page);
  const london = regionButton(page, "London");

  await london.click();
  await expect(london).toHaveAttribute("aria-pressed", "true");
  await expect(readout(page)).toContainText(
    `England 12.6 per 100,000, London ${regionCovidRate(6, 0)} per 100,000`,
  );
  // The highlighted region gets a colour; the other eight stay muted.
  await expect(page.getByTestId("line-chart").locator('svg path[stroke="var(--chart-1)"]')).toHaveCount(1);
  await expect(page.getByTestId("line-chart").locator('svg path[stroke="var(--muted)"]')).toHaveCount(8);

  const buttons = legend(page).getByRole("button");
  await buttons.nth(0).click();
  await buttons.nth(1).click();
  await expect(legend(page).getByRole("button", { pressed: true })).toHaveCount(3);
  await expect(legend(page).getByRole("button", { pressed: false }).first()).toBeDisabled();
  await expect(page.getByText("Three regions are highlighted")).toBeVisible();

  await london.click();
  await expect(london).toHaveAttribute("aria-pressed", "false");
  await expect(legend(page).getByRole("button", { pressed: true })).toHaveCount(2);
  await expect(legend(page).getByRole("button", { pressed: false }).first()).toBeEnabled();
});

test("the table has the latest 26 weeks, England and every region, and can show all", async ({
  page,
}) => {
  await openCovid(page);
  const details = page.locator("details");
  await expect(details).not.toHaveAttribute("open", "");

  await details.getByText("View as a table").click();
  const table = details.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveCount(11);
  await expect(table.getByRole("columnheader").nth(0)).toHaveText("Period");
  await expect(table.getByRole("columnheader").nth(1)).toHaveText("England");
  await expect(table.locator("tbody tr")).toHaveCount(26);
  // Latest week first, with England's value.
  const firstRow = table.locator("tbody tr").first();
  await expect(firstRow.getByRole("rowheader")).toContainText(`7 days to ${covidWeek(0)}`);
  await expect(firstRow.getByRole("cell").first()).toHaveText("12.6");

  await details.getByRole("button", { name: `Show all ${WEEKS} weeks` }).click();
  await expect(table.locator("tbody tr")).toHaveCount(WEEKS);
  await expect(details.getByRole("button", { name: /Show all/ })).toHaveCount(0);
});

test("the measles chart shows case counts", async ({ page }) => {
  await page.goto("/diseases/measles");
  await expect(page.getByTestId("line-chart")).toBeVisible();

  await expect(readout(page)).toContainText("Week of onset");
  await expect(readout(page)).toContainText(`England ${englandMeaslesCases(0)} cases`);
  await slider(page).focus();
  await page.keyboard.press("Home");
  await expect(readout(page)).toContainText(`England ${englandMeaslesCases(WEEKS - 1)} cases`);
  await expect(page.getByTestId("line-chart").locator("svg path")).toHaveCount(10);
  // The 99 for a week that has not ended is not on the chart.
  await expect(page.getByTestId("line-chart")).not.toContainText("99 cases");
});

test("the chart does not make the page scroll sideways, even with the table open", async ({
  page,
}) => {
  await openCovid(page);
  await page.locator("details").getByText("View as a table").click();
  await expect(page.locator("details").getByRole("table")).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
