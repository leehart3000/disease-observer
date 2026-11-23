import { expect, test } from "@playwright/test";
import { englandCovidRate, englandMeaslesCases, fixtureDates } from "./fixtures/dates.mts";

/**
 * Tests for the headline figures and sparklines on the cards and disease
 * pages. They need the test database, filled by e2e/fixtures/load.mts:
 * England's COVID-19 rate falls by 0.1 a week from 12.6 (provisional), and
 * its measles cases fall by 1 a week from 80 (provisional). There are 70
 * weeks of each, so the sparkline holds the latest 26. COVID-19 also has a
 * row of 999 for the day before the latest, and measles a week of 99 that
 * has not ended: neither may appear.
 */

const dates = fixtureDates();

/** "14 November 2026", as the site writes it. */
function longDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

const FIRST_COVID = `${englandCovidRate(25)} per 100,000`;
const FIRST_MEASLES = `${englandMeaslesCases(25)} cases`;

for (const path of ["/", "/diseases"]) {
  test(`${path}: each disease card shows England's latest figure`, async ({ page }) => {
    await page.goto(path);

    const covid = page.getByRole("article").filter({ hasText: "COVID-19" });
    await expect(covid.getByTestId("headline").first()).toContainText("England");
    await expect(covid.getByTestId("headline").first()).toContainText("12.6 cases per 100,000");
    await expect(covid.getByTestId("headline").first()).toContainText(
      `7 days to ${longDay(dates.covidLatest.end)}`,
    );
    await expect(covid.getByTestId("headline").first()).toContainText("Provisional");

    const measles = page.getByRole("article").filter({ hasText: "Measles" });
    await expect(measles.getByTestId("headline")).toContainText(`${englandMeaslesCases(0)} cases`);
    await expect(measles.getByTestId("headline")).toContainText("Week of onset");
    await expect(measles.getByTestId("headline")).toContainText(longDay(dates.measlesComplete.end));

    // The other days' rows and the week that has not ended are not used.
    await expect(page.getByText("999")).toHaveCount(0);
    await expect(page.getByText("99 cases")).toHaveCount(0);
  });
}

test("a card's link is described by its figure, and the map card has none", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("link", { name: "COVID-19" })).toHaveAccessibleDescription(
    /England 12\.6 cases per 100,000 Provisional 7 days to/,
  );
  await expect(page.getByRole("article").filter({ hasText: "Map" }).getByTestId("headline")).toHaveCount(0);
});

test("the sparkline is decorative and has 26 weekly points with a text equivalent", async ({
  page,
}) => {
  await page.goto("/");
  const covid = page.getByRole("article").filter({ hasText: "COVID-19" });

  const sparkline = covid.getByTestId("sparkline").first();
  await expect(sparkline).toHaveAttribute("aria-hidden", "true");
  const points = await sparkline.locator("polyline").getAttribute("points");
  expect(points?.trim().split(" ")).toHaveLength(26);

  await expect(covid.getByText(`Over the last 26 weeks it went from ${FIRST_COVID} to 12.6 per 100,000.`)).toBeAttached();
  const measles = page.getByRole("article").filter({ hasText: "Measles" });
  await expect(
    measles.getByText(`Over the last 26 weeks it went from ${FIRST_MEASLES} to ${englandMeaslesCases(0)} cases.`),
  ).toBeAttached();
});

test("a disease page shows the same figure and sparkline", async ({ page }) => {
  await page.goto("/diseases/measles");

  const headline = page.getByTestId("headline");
  await expect(headline).toContainText(`${englandMeaslesCases(0)} cases`);
  await expect(headline).toContainText("Provisional");
  await expect(headline.getByTestId("sparkline")).toBeVisible();
});

for (const path of ["/", "/diseases/covid-19"]) {
  test(`${path}: COVID-19 has one headline for each place, in its own measure, with a note that they differ`, async ({
    page,
  }) => {
    await page.goto(path);
    const scope = path === "/" ? page.getByRole("article").filter({ hasText: "COVID-19" }) : page.getByRole("main");
    const headlines = scope.getByTestId("headline");
    await expect(headlines).toHaveCount(2);

    await expect(headlines.nth(0)).toContainText("England");
    await expect(headlines.nth(0)).toContainText("12.6 cases per 100,000");
    await expect(headlines.nth(0)).toContainText(`7 days to ${longDay(dates.covidLatest.end)}`);

    await expect(headlines.nth(1)).toContainText("United States");
    await expect(headlines.nth(1)).toContainText("1.5 hospital admissions per 100,000");
    await expect(headlines.nth(1)).toContainText(`7 days to ${longDay(dates.nhsnLatest.end)}`);

    await expect(scope.getByTestId("not-comparable")).toHaveText(
      "These figures measure different things, so they can’t be compared.",
    );
  });
}

test("a disease with one place has one headline and no note", async ({ page }) => {
  for (const path of ["/", "/diseases/measles", "/diseases/influenza"]) {
    await page.goto(path);
    const scope = path === "/" ? page.getByRole("article").filter({ hasText: "Measles" }) : page.getByRole("main");
    await expect(scope.getByTestId("headline")).toHaveCount(1);
    await expect(scope.getByTestId("not-comparable")).toHaveCount(0);
  }
});

test("the figures do not make the cards overflow at any width", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("headline").first()).toBeVisible();

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
