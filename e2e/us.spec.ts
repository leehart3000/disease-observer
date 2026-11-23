import { expect, test, type Page } from "@playwright/test";
import {
  addDays,
  ENGLAND_WEEKS,
  fixtureDates,
  isMissingNhsnWeek,
  LAST_YEAR_WEEKS,
  NHSN_STATES,
  nhsnRate,
} from "./fixtures/dates.mts";

/**
 * Tests for the US hospital admission datasets (influenza, RSV and COVID-19,
 * by state): their pages, the state map, chart and table, the national
 * figures, the boundaries notice and the things to know. They need the test
 * database, filled by e2e/fixtures/load.mts: the nation and eight states
 * (Alabama, Alaska, California, the District of Columbia, Florida, New York,
 * Texas and Washington) for the three diseases, 70 weeks each. The influenza
 * rate of the nation is 3.5 in the latest week, and of the states 7, 10.5,
 * 14, 17.5, 21, 24.5, 28 and 31.5 in that order (Washington the highest). The
 * District of Columbia has no influenza row for the week 5 weeks back.
 */

const dates = fixtureDates();
const INFLUENZA = "/diseases/influenza/hospital-admissions-by-state";
const RSV = "/diseases/rsv/hospital-admissions-by-state";
const COVID_US = "/diseases/covid-19/hospital-admissions-by-state";
const LAST = ENGLAND_WEEKS - 1;
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

/** The period of the week `back` weeks before the latest, as the site writes it. */
const weekText = (back: number) => `7 days to ${longDay(addDays(dates.nhsnLatest.end, -7 * back))}`;

// The map does not need the real base map: if its style can't be loaded, it
// draws our areas on a plain background.
test.beforeEach(async ({ page }) => {
  await page.route("https://tiles.openfreemap.org/**", (route) => route.abort());
});

const table = (page: Page) => page.getByRole("table");
const rows = (page: Page) => table(page).locator("tbody tr");
const slider = (page: Page) => page.getByRole("slider");
const readout = (page: Page) => page.getByTestId("chart-readout");
const chartPaths = (page: Page) => slider(page).locator("path");
const finder = (page: Page) => page.getByLabel("Find a state");
const chips = (page: Page) =>
  page.getByRole("list", { name: "Chosen states" }).getByRole("listitem").filter({ hasText: "Remove" });

test.describe("the dataset pages", () => {
  test("explain the data, with the things to know, the views and the credit", async ({ page }) => {
    await page.goto(INFLUENZA);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Influenza hospital admissions by state, United States");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem")).toHaveText([
      "Diseases›",
      "Influenza›",
      "Admissions by state, United States",
    ]);
    await expect(page.getByText("for every 100,000 people who live in the state")).toBeVisible();

    // The things to know: the reporting changes, coverage and the provisional week.
    await expect(page.getByRole("heading", { level: 2, name: "Things to know" })).toBeVisible();
    const caveats = page.getByTestId("caveats").getByRole("listitem");
    await expect(caveats).toHaveCount(4);
    await expect(caveats.first()).toContainText("required until 30 April 2024, voluntary from 1 May to 31 October 2024");
    await expect(caveats.nth(1)).toContainText("a state’s rate covers only the hospitals that reported");
    await expect(caveats.nth(2)).toContainText("We mark the latest week as provisional");

    const cards = page.getByRole("article");
    await expect(cards.getByRole("link")).toHaveText(["Map", "Chart", "Table"]);

    // The credit: the source's own name, its licence and Natural Earth. CDC is named nowhere else.
    await expect(page.getByRole("heading", { level: 2, name: "Sources" })).toBeVisible();
    await expect(page.getByRole("link", { name: /^CDC National Healthcare Safety Network/ })).toHaveAttribute(
      "href",
      "https://data.cdc.gov/d/ua7e-t2fy",
    );
    await expect(page.getByRole("link", { name: /^Public Domain U\.S\. Government/ })).toHaveAttribute(
      "href",
      "https://www.usa.gov/government-works",
    );
    await expect(page.getByText("Made with Natural Earth.")).toBeVisible();
    // The name is in the credit only: not in the heading, the descriptions or the cards.
    await expect(page.getByRole("heading", { level: 1 })).not.toContainText("CDC");
    await expect(page.getByText("The rate is as published")).not.toContainText("CDC");
    expect((await cards.allTextContents()).join(" ")).not.toContain("CDC");
  });

  test("RSV has one more thing to know: it was reported voluntarily until November 2024", async ({ page }) => {
    await page.goto(RSV);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("RSV hospital admissions by state, United States");
    const caveats = page.getByTestId("caveats").getByRole("listitem");
    await expect(caveats).toHaveCount(5);
    await expect(caveats.last()).toContainText("RSV was reported voluntarily until 1 November 2024");
  });

  test("the map, chart and table pages link to the things to know", async ({ page }) => {
    for (const view of ["map", "chart", "table"]) {
      await page.goto(`${INFLUENZA}/${view}`);
      const link = page.getByRole("link", { name: "Read the things to know" });
      await expect(link).toHaveAttribute("href", `${INFLUENZA}#things-to-know`);
    }
    // A dataset with no caveats has no such line.
    await page.goto("/diseases/measles/cases-by-region/map");
    await expect(page.getByRole("link", { name: "Read the things to know" })).toHaveCount(0);
  });
});

test.describe("the state table", () => {
  test("lists the states that have figures, the highest first, with the week and the provisional tag", async ({
    page,
  }) => {
    await page.goto(`${INFLUENZA}/table`);

    await expect(page).toHaveTitle("Influenza hospital admissions by state, United States: table | Disease Observer");
    await expect(table(page).locator("caption")).toContainText("Influenza hospital admissions per 100,000 people by state, United States");
    await expect(table(page).locator("caption")).toContainText(weekText(0));
    await expect(rows(page)).toHaveCount(NHSN_STATES.length);
    await expect(page.getByText("Showing 1 to 8 of 8")).toBeVisible();
    // Washington is the highest (31.5), Alabama the lowest (7), and two decimal places are allowed.
    await expect(rows(page).first()).toContainText("Washington");
    await expect(rows(page).first()).toContainText("31.5");
    await expect(rows(page).last()).toContainText("Alabama");
    await expect(rows(page).last()).toContainText("7");
    await expect(page.getByText("Provisional figures may still change.")).toBeVisible();
    await expect(page.getByRole("region", { name: "Sources" })).toContainText("CDC National Healthcare Safety Network (NHSN)");
  });

  test("each row links to the state on the map and in the chart", async ({ page }) => {
    await page.goto(`${INFLUENZA}/table`);
    await page.getByLabel("Search table by area name").fill("Washington");
    await expect(page.getByRole("link", { name: "View on map: Washington" })).toHaveAttribute(
      "href",
      `${INFLUENZA}/map?areas=US-WA`,
    );
    await expect(page.getByRole("link", { name: "Chart Washington" })).toHaveAttribute(
      "href",
      `${INFLUENZA}/chart?areas=US-WA`,
    );
  });

  test("shows each disease's own figures", async ({ page }) => {
    // RSV is a fifth of influenza's national rate in the fixtures: Washington 4.5, Alabama 1.
    await page.goto(`${RSV}/table`);
    await expect(rows(page).first()).toContainText("Washington");
    await expect(rows(page).first()).toContainText("4.5");
    await page.goto(`${COVID_US}/table`);
    await expect(rows(page).first()).toContainText("13.5");
    await expect(rows(page).last()).toContainText("Alabama");
  });
});

test.describe("the state map", () => {
  test("draws the states from Natural Earth's boundaries and shows the boundaries notice", async ({ page }) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await page.goto(`${INFLUENZA}/map`);

    const canvas = page.getByTestId("map-canvas");
    await expect(canvas).toHaveAttribute("data-dataset", "influenza-hospital-admissions", { timeout: 30_000 });
    await expect(canvas).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
    expect(requested.some((url) => url.endsWith("/boundaries/us-states-50m.json"))).toBe(true);
    expect(requested.some((url) => url.includes("lad-dec-2022") || url.includes("rgn-dec-2022"))).toBe(false);

    await expect(page.getByRole("region", { name: /^Map: Influenza hospital admissions per 100,000 people by state, United States/ })).toBeVisible();
    // The notice is under the map.
    const notice = page.getByTestId("boundary-notice");
    await expect(notice).toBeVisible();
    await expect(notice).toHaveText(
      "Boundaries and names are from Natural Earth, a public-domain dataset, and are drawn for display only. They do not imply any view on the status of a country or territory, or on where its borders lie.",
    );
    // The key has the two-decimal labels the rates need.
    await expect(page.getByText(/^Under \d/).first()).toBeVisible();
  });

  test("an England map has no such notice", async ({ page }) => {
    await page.goto("/diseases/covid-19/rate-by-local-authority/map");
    await expect(page.getByTestId("map-canvas")).toBeVisible();
    await expect(page.getByTestId("boundary-notice")).toHaveCount(0);
  });

  test("a state in the address is pinned, with its figure, the week and a link to its chart", async ({ page }) => {
    await page.goto(`${INFLUENZA}/map?areas=US-WA`);
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });

    const readout = page.getByTestId("area-readout");
    await expect(readout).toContainText("Washington");
    await expect(readout).toContainText("31.5 per 100,000");
    await expect(readout).toContainText(weekText(0));
    await expect(readout).toContainText("Provisional");
    const link = readout.getByRole("link", { name: /^Chart this area/ });
    await expect(link).toHaveAccessibleName("Chart this area: Washington");
    await expect(link).toHaveAttribute("href", `${INFLUENZA}/chart?areas=US-WA`);
  });

  test("a state with no figure says so, and a code that is not a state is ignored", async ({ page }) => {
    await page.goto(`${INFLUENZA}/map?areas=USA,US-ZZ,US-WA`);
    // `USA` is the nation, not a state on the map, and US-ZZ is not a state: the first real one is pinned.
    await expect(page.getByTestId("area-readout")).toContainText("Washington", { timeout: 30_000 });
  });

  test("pinning from the table sets the address", async ({ page }) => {
    await page.goto(`${INFLUENZA}/map`);
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
    await page.getByLabel("Search table by area name").fill("Texas");
    await page.getByRole("button", { name: "Pin Texas on the map" }).click();
    await expect(page).toHaveURL(`${INFLUENZA}/map?areas=US-TX`);
    await expect(page.getByTestId("area-readout")).toContainText("28 per 100,000");
  });
});

/** Where the map is looking, from the canvas's `data-map-center` ("lng,lat" to one decimal place). */
async function mapCentre(page: Page): Promise<{ lng: number; lat: number }> {
  const text = (await page.getByTestId("map-canvas").getAttribute("data-map-center")) ?? "0,0";
  const [lng, lat] = text.split(",").map(Number);
  return { lng, lat };
}

test.describe("the buttons that move the US map", () => {
  test("take it to Alaska and Hawaii and back, say where it went, and are keyboard buttons", async ({
    page,
  }) => {
    await page.goto(`${INFLUENZA}/map`);
    const canvas = page.getByTestId("map-canvas");
    await expect(canvas).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });

    const group = page.getByRole("group", { name: "Move the map" });
    await expect(group.getByRole("button")).toHaveText(["Show Alaska", "Show Hawaii", "Show contiguous states"]);
    // The map opens on the contiguous states.
    await expect.poll(async () => (await mapCentre(page)).lng).toBeGreaterThan(-110);
    const opening = await mapCentre(page);
    // On a tall phone screen the map is held within its limits, which moves the centre north a little.
    expect(opening.lat).toBeGreaterThan(30);
    expect(opening.lat).toBeLessThan(50);

    // A keyboard press does it, as a click does.
    await group.getByRole("button", { name: "Show Alaska" }).focus();
    await page.keyboard.press("Enter");
    await expect(group.getByRole("status")).toHaveText("Showing Alaska.");
    await expect.poll(async () => (await mapCentre(page)).lat, { timeout: 10_000 }).toBeGreaterThan(55);
    expect((await mapCentre(page)).lng).toBeLessThan(-135);

    await group.getByRole("button", { name: "Show Hawaii" }).click();
    await expect(group.getByRole("status")).toHaveText("Showing Hawaii.");
    await expect.poll(async () => (await mapCentre(page)).lat, { timeout: 10_000 }).toBeLessThan(25);
    const hawaii = await mapCentre(page);
    expect(hawaii.lng).toBeLessThan(-150);
    expect(hawaii.lng).toBeGreaterThan(-165);

    await group.getByRole("button", { name: "Show contiguous states" }).click();
    await expect(group.getByRole("status")).toHaveText("Showing contiguous states.");
    // The same view as the map opened on.
    await expect
      .poll(async () => Math.abs((await mapCentre(page)).lat - opening.lat), { timeout: 10_000 })
      .toBeLessThan(1);
    expect(Math.abs((await mapCentre(page)).lng - opening.lng)).toBeLessThan(1);
  });

  test("can be asked again after the map has been moved by hand", async ({ page }) => {
    await page.goto(`${INFLUENZA}/map`);
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
    const group = page.getByRole("group", { name: "Move the map" });
    const opening = await mapCentre(page);
    await group.getByRole("button", { name: "Show Alaska" }).click();
    await expect.poll(async () => (await mapCentre(page)).lat, { timeout: 10_000 }).toBeGreaterThan(55);
    await group.getByRole("button", { name: "Show contiguous states" }).click();
    await expect
      .poll(async () => Math.abs((await mapCentre(page)).lat - opening.lat), { timeout: 10_000 })
      .toBeLessThan(1);
    // Alaska again, the same request as before: it still goes.
    await group.getByRole("button", { name: "Show Alaska" }).click();
    await expect.poll(async () => (await mapCentre(page)).lat, { timeout: 10_000 }).toBeGreaterThan(55);
  });

  test("are on the US maps and no others", async ({ page }) => {
    for (const path of [RSV, COVID_US]) {
      await page.goto(`${path}/map`);
      await expect(page.getByRole("button", { name: "Show Alaska" })).toBeVisible();
    }
    await page.goto("/diseases/covid-19/rate-by-local-authority/map");
    await expect(page.getByTestId("map-canvas")).toBeVisible();
    await expect(page.getByRole("group", { name: "Move the map" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^Show / })).toHaveCount(0);
  });
});

test.describe("the key on a US map", () => {
  test("is under the map, not over its south-west, while England's is over the map as before", async ({ page }) => {
    const box = async (selector: string) => (await page.locator(selector).first().boundingBox())!;
    await page.goto(`${INFLUENZA}/map`);
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
    const mapUs = await box(".map-region");
    const legendUs = await box(".map-legend");
    // Under the map's bottom edge, on a phone and on a wide screen.
    expect(legendUs.y).toBeGreaterThanOrEqual(mapUs.y + mapUs.height - 1);

    await page.goto("/diseases/covid-19/rate-by-local-authority/map");
    await expect(page.getByTestId("map-canvas")).toHaveAttribute("data-map-ready", "true", { timeout: 30_000 });
    const mapEngland = await box(".map-region");
    const legendEngland = await box(".map-legend");
    if (test.info().project.name === "desktop") {
      // England's key is over the map's bottom-left corner on a wide screen.
      expect(legendEngland.y).toBeLessThan(mapEngland.y + mapEngland.height);
      expect(legendEngland.x).toBeLessThan(mapEngland.x + 40);
    } else {
      expect(legendEngland.y).toBeGreaterThanOrEqual(mapEngland.y + mapEngland.height - 1);
    }
  });
});

test.describe("the state chart", () => {
  test("draws the United States on its own, with the picker listing the states without region headings", async ({
    page,
  }) => {
    await page.goto(`${INFLUENZA}/chart`);
    await expect(page.getByTestId("line-chart")).toBeVisible();
    await expect(finder(page)).toBeVisible();

    await expect(page).toHaveTitle("Influenza hospital admissions by state, United States: chart | Disease Observer");
    await expect(
      page.getByRole("heading", { level: 2, name: "Compare with United States: choose up to 3 states." }),
    ).toBeVisible();
    await expect(chartPaths(page)).toHaveCount(1);
    await expect(readout(page)).toHaveText(`${weekText(0)} (provisional): United States 3.5 per 100,000`);
    await expect(slider(page)).toHaveAccessibleName(/weekly, United States, .* Latest 3\.5 per 100,000 for United States\./);

    // Eight states, no parent headings (they all have the same one), and the count says so.
    await expect(page.getByText("8 states.")).toBeVisible();
    const list = page.getByRole("group", { name: "States", exact: true });
    await expect(list.getByRole("button")).toHaveText([
      "Add Alabama",
      "Add Alaska",
      "Add California",
      "Add District of Columbia",
      "Add Florida",
      "Add New York",
      "Add Texas",
      "Add Washington",
    ]);
    await expect(list.getByRole("heading")).toHaveCount(0);
  });

  test("adds a state on top of the national line, in the address, and takes it off again", async ({ page }) => {
    await page.goto(`${INFLUENZA}/chart`);
    await expect(finder(page)).toBeVisible();

    await finder(page).fill("wash");
    await expect(page.getByText("1 match.")).toBeVisible();
    await page.getByRole("button", { name: "Add Washington" }).click();
    await expect(page).toHaveURL(`${INFLUENZA}/chart?areas=US-WA`);
    await expect(chips(page)).toHaveText([/^Washington/]);
    await expect(chartPaths(page)).toHaveCount(2);
    await expect(readout(page)).toHaveText(
      `${weekText(0)} (provisional): United States 3.5 per 100,000, Washington 31.5 per 100,000`,
    );
    await expect(slider(page)).toHaveAccessibleName(/weekly, United States and Washington, /);

    await page.getByRole("button", { name: "Remove Washington" }).click();
    await expect(page).toHaveURL(`${INFLUENZA}/chart`);
    await expect(chartPaths(page)).toHaveCount(1);
  });

  test("a state in the address is drawn, and anything else in it is dropped", async ({ page }) => {
    await page.goto(`${INFLUENZA}/chart?areas=US-AL,USA,US-ZZ,US-AL,US-TX`);
    await expect(chips(page)).toHaveText([/^Alabama/, /^Texas/]);
    await expect(chartPaths(page)).toHaveCount(3);
  });

  test("shows a week a state has no figure for as no figure", async ({ page }) => {
    // The District of Columbia is index 3; its influenza row for 5 weeks back is missing.
    expect(isMissingNhsnWeek("influenza", 3, 5)).toBe(true);
    await page.goto(`${INFLUENZA}/chart?areas=US-DC&range=all`);
    await expect(chips(page)).toHaveCount(1);
    await slider(page).focus();
    await page.keyboard.press("End");
    await page.keyboard.press("PageDown");
    await page.keyboard.press("ArrowLeft");
    await expect(readout(page)).toHaveText(
      `${weekText(5)}: United States ${nhsnRate("influenza", null, 5)} per 100,000, District of Columbia no figure`,
    );
    // The week before has a value.
    await page.keyboard.press("ArrowLeft");
    await expect(readout(page)).toContainText(`District of Columbia ${nhsnRate("influenza", 3, 6)} per 100,000`);
    await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST));
  });

  test("the range is the last 12 months to start with", async ({ page }) => {
    await page.goto(`${INFLUENZA}/chart`);
    await expect(slider(page)).toHaveAttribute("aria-valuemax", String(LAST_IN_YEAR));
  });
});

test.describe("the disease pages", () => {
  test("influenza has the national figure, its chart of the country on its own, and its dataset", async ({ page }) => {
    await page.goto("/diseases/influenza");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Influenza");
    await expect(page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem")).toHaveText([
      "Diseases›",
      "Influenza",
    ]);

    // The headline is the national figure, as England's is for COVID-19.
    const headline = page.getByRole("heading", { level: 2, name: "Latest figure" }).locator("..");
    await expect(headline).toContainText("3.5 per 100,000");
    await expect(headline).toContainText("United States");
    await expect(headline).toContainText("Provisional");

    // The chart is the country alone: no list of areas to tick.
    await expect(page.getByTestId("line-chart")).toBeVisible();
    await expect(chartPaths(page)).toHaveCount(1);
    await expect(page.getByRole("group", { name: /^Pick up to three/ })).toHaveCount(0);
    await expect(slider(page)).toHaveAccessibleName(/weekly, United States, .* Latest 3\.5 per 100,000 for United States\./);

    await expect(page.getByRole("link", { name: "Admissions by state, United States", exact: true })).toHaveAttribute("href", INFLUENZA);
    await expect(page.getByRole("link", { name: "Chart: Admissions by state, United States" })).toHaveAttribute(
      "href",
      `${INFLUENZA}/chart`,
    );
  });

  test("RSV has its own national figure", async ({ page }) => {
    await page.goto("/diseases/rsv");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("RSV");
    await expect(page.getByRole("heading", { level: 2, name: "Latest figure" }).locator("..")).toContainText("0.5 per 100,000");
  });

  test("COVID-19 lists its England dataset and its US one, and keeps England's headline", async ({ page }) => {
    await page.goto("/diseases/covid-19");
    await expect(page.getByRole("link", { name: "Rate by local authority, England", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Admissions by state, United States", exact: true })).toHaveAttribute("href", COVID_US);
    await expect(page.getByRole("heading", { level: 2, name: "Latest figure" }).locator("..")).toContainText("England");
  });
});

test.describe("the site around them", () => {
  test("the coverage line, the diseases list and the sources include the new data", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("coverage").getByRole("listitem")).toHaveText([
      "England: COVID-19 and measles, from the UK Health Security Agency",
      "United States: influenza, RSV and COVID-19, from the CDC National Healthcare Safety Network (NHSN)",
    ]);

    await page.goto("/diseases");
    await expect(page.getByRole("article").getByRole("link")).toHaveText(["COVID-19", "Measles", "Influenza", "RSV"]);

    await page.goto("/sources");
    await expect(page.getByRole("link", { name: /^CDC National Healthcare Safety Network/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Natural Earth" })).toBeVisible();
    await expect(page.getByRole("link", { name: "WHO FluNet" })).toHaveCount(0);
  });

  test("the maps list has the three US maps", async ({ page }) => {
    await page.goto("/maps");
    for (const [name, path] of [
      ["Influenza hospital admissions by state, United States", INFLUENZA],
      ["RSV hospital admissions by state, United States", RSV],
      ["COVID-19 hospital admissions by state, United States", COVID_US],
    ]) {
      await expect(page.getByRole("link", { name })).toHaveAttribute("href", `${path}/map`);
    }
  });
});
