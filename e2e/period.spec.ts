import { expect, test, type Page } from "@playwright/test";
import { fixtureDates, measlesPeriodTotal } from "./fixtures/dates.mts";

/**
 * Tests for the choice of period on the map and table pages: the latest
 * week, the last 12 weeks added up, or the year to date added up. They need
 * the test database, filled by e2e/fixtures/load.mts. Measles has 70 weeks
 * for each of its 9 regions, which cross a year boundary, and the first
 * region (E45000009) has no row for one week (3 weeks before the latest).
 * The expected totals come from `measlesPeriodTotal`, which adds up the
 * same rows, so the tests do not go stale as the date moves.
 */

const MEASLES = "/diseases/measles/cases-by-region";
const COVID = "/diseases/covid-19/rate-by-local-authority";
const dates = fixtureDates();
/** The region with the missing week. */
const GAP_CODE = "E45000009";
const GAP_INDEX = 0;
const PERIODS = ["latest", "12w", "ytd"] as const;
const HEADINGS = { latest: "Cases (week)", "12w": "Cases (12 weeks)", ytd: "Cases (year to date)" };

test.beforeEach(async ({ page }) => {
  // The map does not need the real base map: without it, it draws our areas on a plain background.
  await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
});

const table = (page: Page) => page.getByRole("table");
const rows = (page: Page) => table(page).locator("tbody tr");
const group = (page: Page) => page.getByRole("group", { name: "Period" });
const radio = (page: Page, name: string) => group(page).getByRole("radio", { name });
/** Clicking the label is how a visitor chooses: the real radio is visually hidden. */
const choose = (page: Page, name: string) => group(page).getByText(name, { exact: true }).click();

/** The numbers in the table's value column, sorted. */
async function tableValues(page: Page): Promise<number[]> {
  const values = await rows(page).evaluateAll((trs) =>
    trs.map((tr) =>
      Number(
        [...tr.querySelector("td")!.childNodes]
          .filter((node) => node.nodeType === Node.TEXT_NODE)
          .map((node) => node.textContent)
          .join("")
          .trim(),
      ),
    ),
  );
  return values.sort((a, b) => a - b);
}

/** What the nine regions should total in a period, sorted. */
function expectedValues(period: (typeof PERIODS)[number]): number[] {
  return Array.from({ length: 9 }, (_, i) => measlesPeriodTotal(i, period, dates).value).sort(
    (a, b) => a - b,
  );
}

test("the period is chosen with a radio group, for a dataset that can be added up", async ({
  page,
}) => {
  await page.goto(`${MEASLES}/table`);

  await expect(group(page)).toBeVisible();
  await expect(group(page).getByRole("radio")).toHaveCount(3);
  await expect(group(page).locator("label")).toHaveText(["Latest week", "Last 12 weeks", "Year to date"]);
  await expect(radio(page, "Latest week")).toBeChecked();
  await expect(radio(page, "Last 12 weeks")).not.toBeChecked();
  // The groups' buttons are 44 px tall.
  expect((await group(page).locator("label").first().boundingBox())!.height).toBeGreaterThanOrEqual(44);

  await page.goto(`${MEASLES}/map`);
  await expect(group(page).getByRole("radio")).toHaveCount(3);
});

test("a rate has no choice of period, and says why", async ({ page }) => {
  for (const view of ["map", "table"]) {
    await page.goto(`${COVID}/${view}`);
    await expect(
      page.getByText("COVID-19 rates are shown for the latest 7 days only, because rates can’t be added together."),
    ).toBeVisible();
    await expect(group(page)).toHaveCount(0);
  }
  // A period it does not offer, or one that does not exist, is ignored.
  await page.goto(`${COVID}/table?p=12w`);
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(table(page).locator("caption")).toContainText(/7 days to \d+ \w+ \d{4}/);
});

for (const period of PERIODS) {
  test(`the table's totals for "${period}" match the fixture rows`, async ({ page }) => {
    await page.goto(period === "latest" ? `${MEASLES}/table` : `${MEASLES}/table?p=${period}`);
    await expect(rows(page)).toHaveCount(9);

    await expect(table(page).getByRole("columnheader", { name: /^Cases/ })).toHaveText(
      new RegExp(`^${HEADINGS[period].replace(/[()]/g, "\\$&")}`),
    );
    expect(await tableValues(page)).toEqual(expectedValues(period));
    await expect(radio(page, { latest: "Latest week", "12w": "Last 12 weeks", ytd: "Year to date" }[period])).toBeChecked();

    // The caption says what was added up.
    const total = measlesPeriodTotal(GAP_INDEX, period, dates);
    const caption = table(page).locator("caption");
    if (period === "latest") await expect(caption).toContainText("Week of onset");
    else await expect(caption).toContainText("Total for weeks of onset");
    const longDay = (day: string) =>
      new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
    await expect(caption).toContainText(longDay(total.end));
    // The start is the first day of the first week.
    const start = new Date(`${total.start}T00:00:00Z`);
    await expect(caption).toContainText(`${start.getUTCDate()} `);
  });
}

test("a total is provisional if any week in it is, and an area with a week missing says so", async ({
  page,
}) => {
  const provisional = (path: string) => page.goto(path).then(() => table(page).getByText("Provisional", { exact: true }));

  // Only the latest week has provisional values (2 regions), so it is in every period.
  for (const p of ["", "?p=12w", "?p=ytd"]) {
    await expect(await provisional(`${MEASLES}/table${p}`)).toHaveCount(2);
  }

  // The first region has no row for one week: its total is of one week fewer, and it says so.
  await page.goto(`${MEASLES}/table`);
  await expect(page.getByText(/weeks reported/)).toHaveCount(0);

  for (const period of ["12w", "ytd"] as const) {
    await page.goto(`${MEASLES}/table?p=${period}`);
    const { weeks, expected } = measlesPeriodTotal(GAP_INDEX, period, dates);
    expect(weeks).toBe(expected - 1);
    const note = table(page).getByText(/weeks reported/);
    await expect(note).toHaveCount(1);
    await expect(note).toHaveText(`${weeks} of ${expected} weeks reported`);
  }
});

test("the map shows the chosen period's totals, with its caption and coverage in the readout", async ({
  page,
}) => {
  await page.goto(`${MEASLES}/map?p=12w&areas=${GAP_CODE}`);
  await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-map-ready", "true", {
    timeout: 30_000,
  });
  const total = measlesPeriodTotal(GAP_INDEX, "12w", dates);

  const readout = page.getByTestId("area-readout");
  await expect(readout).toContainText(`${total.value} case`);
  await expect(readout).toContainText("Total for weeks of onset");
  await expect(readout).toContainText(`${total.weeks} of ${total.expected} weeks reported`);
  await expect(radio(page, "Last 12 weeks")).toBeChecked();
  expect(await tableValues(page)).toEqual(expectedValues("12w"));
});

test("choosing a period changes the address and the page, keeping the pin, without a page load", async ({
  page,
}) => {
  await page.goto(`${MEASLES}/map?areas=${GAP_CODE}`);
  await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-map-ready", "true", {
    timeout: 30_000,
  });
  await page.evaluate(() => {
    (window as unknown as { stillHere: boolean }).stillHere = true;
  });
  const latestLegend = await page.getByRole("list", { name: /Measles cases/ }).innerText();
  expect(await tableValues(page)).toEqual(expectedValues("latest"));

  await choose(page, "Last 12 weeks");
  await expect(page).toHaveURL(new RegExp(`\\?areas=${GAP_CODE}&p=12w$`));
  await expect(radio(page, "Last 12 weeks")).toBeChecked();
  await expect(table(page).locator("caption")).toContainText("Total for weeks of onset");
  expect(await tableValues(page)).toEqual(expectedValues("12w"));
  // The key follows the new totals, and the pin is kept.
  await expect(page.getByRole("list", { name: /Measles cases/ })).not.toHaveText(latestLegend);
  await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-highlight", GAP_CODE);
  await expect(page.getByTestId("area-readout")).toContainText("Total for weeks of onset");

  await choose(page, "Year to date");
  await expect(page).toHaveURL(new RegExp(`\\?areas=${GAP_CODE}&p=ytd$`));
  expect(await tableValues(page)).toEqual(expectedValues("ytd"));

  // The latest period is the default, so it leaves `p` out.
  await choose(page, "Latest week");
  await expect(page).toHaveURL(new RegExp(`\\?areas=${GAP_CODE}$`));
  await expect(table(page).locator("caption")).toContainText("Week of onset");
  expect(await tableValues(page)).toEqual(expectedValues("latest"));
  expect(
    await page.evaluate(() => (window as unknown as { stillHere?: boolean }).stillHere),
  ).toBe(true);
});

test("an unknown period is ignored, and a period in the address is chosen on load", async ({
  page,
}) => {
  await page.goto(`${MEASLES}/table?p=bogus`);
  await expect(radio(page, "Latest week")).toBeChecked();
  await expect(table(page).locator("caption")).toContainText("Week of onset");

  await page.goto(`${MEASLES}/table?p=ytd`);
  await expect(radio(page, "Year to date")).toBeChecked();
  await expect(table(page).getByRole("columnheader", { name: /^Cases/ })).toContainText("year to date");
});

test("the server sends the chosen period's totals in the HTML", async ({ request }) => {
  const html = await (await request.get(`${MEASLES}/table?p=12w`)).text();

  expect(html).toContain("Total for weeks of onset");
  expect(html).toContain("Cases (12 weeks)");
  expect(html).toContain("11 of 12 weeks reported");
  // The heading in the table is the chosen period's (the page's data also lists the others).
  expect(html).toMatch(/<th[^>]*aria-sort[^>]*>.*Cases \(12 weeks\)/);
});

test("the links between views keep the period, and the chart will not", async ({ page }) => {
  await page.goto(`${MEASLES}/table?areas=${GAP_CODE}&p=12w`);
  const views = page.getByRole("navigation", { name: "Views of Cases by region, England" });
  await expect(views.getByRole("link", { name: "Map" })).toHaveAttribute(
    "href",
    `${MEASLES}/map?areas=${GAP_CODE}&p=12w`,
  );

  // A row's link to the map carries the period and the area.
  await expect(
    page.getByRole("link", { name: /^View on map: .+/ }).first(),
  ).toHaveAttribute("href", /\/map\?p=12w&areas=E45/);

  // Choosing on the map is carried to the table.
  await views.getByRole("link", { name: "Map" }).click();
  await expect(page).toHaveURL(`${MEASLES}/map?areas=${GAP_CODE}&p=12w`);
  await expect(radio(page, "Last 12 weeks")).toBeChecked();
  await choose(page, "Year to date");
  await expect(page).toHaveURL(`${MEASLES}/map?areas=${GAP_CODE}&p=ytd`);
  await expect(
    page.getByRole("navigation", { name: "Views of Cases by region, England" }).getByRole("link", { name: "Table" }),
  ).toHaveAttribute("href", `${MEASLES}/table?areas=${GAP_CODE}&p=ytd`);
});

test("the period picker has no horizontal scrolling and stacks on a phone", async ({ page }) => {
  await page.goto(`${MEASLES}/table`);
  const labels = group(page).locator("label");
  const [first, second] = [(await labels.nth(0).boundingBox())!, (await labels.nth(1).boundingBox())!];
  if (test.info().project.name === "iphone-se") expect(second.y).toBeGreaterThan(first.y);
  else expect(Math.abs(second.y - first.y)).toBeLessThan(2);

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
