import { expect, test } from "@playwright/test";
import { DATASETS } from "../src/lib/datasets/registry.ts";
import { locationHref, placeViewHref, sitePaths } from "../src/lib/datasets/routes.ts";
import {
  allLocations,
  datasetsForLocation,
  diseasesForLocation,
  getLocation,
  placePhrase,
} from "../src/lib/locations.ts";
import { decideRoute } from "../src/lib/routing.ts";
import { SITE_URL } from "../src/lib/seo.ts";

/**
 * Tests for the Locations section: the places the registry's datasets cover,
 * the list at /locations, a page for each place with every disease that has
 * data for it, the header link, and the addresses. The pages need the test
 * database, filled by e2e/fixtures/load.mts: England's COVID-19 rate is 12.6
 * per 100,000 (provisional) and its latest complete week of measles has 80
 * cases; the United States' influenza rate is 3.5, RSV 0.5 and COVID-19 1.5
 * per 100,000 in the latest week.
 */

const COVID = "/diseases/covid-19/rate-by-local-authority";
const MEASLES = "/diseases/measles/cases-by-region";
const INFLUENZA = "/diseases/influenza/hospital-admissions-by-state";
const RSV = "/diseases/rsv/hospital-admissions-by-state";
const COVID_US = "/diseases/covid-19/hospital-admissions-by-state";

const isPhone = () => test.info().project.name === "iphone-se";
const crumbs = (page: import("@playwright/test").Page) =>
  page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem");

test.describe("the places", () => {
  test("are England and the United States, by name, and each dataset names places that exist", () => {
    expect(allLocations().map((place) => place.slug)).toEqual(["england", "united-states"]);
    expect(allLocations().map((place) => place.name)).toEqual(["England", "United States"]);

    for (const dataset of DATASETS) {
      expect(dataset.locations.length, dataset.id).toBeGreaterThan(0);
      for (const slug of dataset.locations) expect(getLocation(slug), `${dataset.id}: ${slug}`).toBeDefined();
      // A dataset is for its own place, at least.
      expect(dataset.locations, dataset.id).toContain(dataset.place.slug);
    }
  });

  test("a country that no dataset covers is not a place yet, and neither is an unknown one", () => {
    for (const slug of ["germany", "france", "united-kingdom", "nope", ""]) {
      expect(getLocation(slug), slug).toBeUndefined();
    }
  });

  test("each has its datasets, and its diseases in the registry's order", () => {
    expect(datasetsForLocation("england").map((dataset) => dataset.id)).toEqual([
      "covid-19-rate",
      "measles-cases",
    ]);
    expect(datasetsForLocation("united-states").map((dataset) => dataset.id)).toEqual([
      "influenza-hospital-admissions",
      "rsv-hospital-admissions",
      "covid-19-hospital-admissions-us",
    ]);
    expect(diseasesForLocation("england").map(({ disease }) => disease.slug)).toEqual(["covid-19", "measles"]);
    expect(diseasesForLocation("united-states").map(({ disease }) => disease.slug)).toEqual([
      "covid-19",
      "influenza",
      "rsv",
    ]);
    expect(placePhrase("united-states")).toBe("the United States");
    expect(placePhrase("england")).toBe("England");
  });

  test("their addresses are in the sitemap", () => {
    const paths = sitePaths();
    expect(paths).toContain("/locations");
    expect(paths).toContain(locationHref("england"));
    expect(paths).toContain("/locations/united-states");
    expect(new Set(paths).size).toBe(paths.length);
  });
});

test.describe("the links to a dataset's views from a place", () => {
  const nhsn = DATASETS.find((dataset) => dataset.id === "influenza-hospital-admissions")!;

  test("are the plain views for the dataset's whole place", () => {
    expect(placeViewHref(nhsn, "map", nhsn.place)).toBe(`${INFLUENZA}/map`);
    expect(placeViewHref(nhsn, "chart", { code: "USA", scheme: "iso3166-1-alpha3" })).toBe(`${INFLUENZA}/chart`);
  });

  test("carry the area for a place that is one of the dataset's areas", () => {
    // A state of the dataset: pinned on the map and the table, chosen on the chart.
    expect(placeViewHref(nhsn, "map", { code: "US-AL", scheme: "iso3166-2" })).toBe(`${INFLUENZA}/map?areas=US-AL`);
    expect(placeViewHref(nhsn, "table", { code: "US-AL", scheme: "iso3166-2" })).toBe(`${INFLUENZA}/table?areas=US-AL`);
  });

  test("do not carry a code of another scheme, which the dataset could not read", () => {
    expect(placeViewHref(nhsn, "map", { code: "FRA", scheme: "iso3166-1-alpha3" })).toBe(`${INFLUENZA}/map`);
  });
});

test.describe("the addresses", () => {
  const carryOn = { action: "continue" };
  const notFound = { action: "not-found" };
  const decide = (path: string) => decideRoute(path, new URLSearchParams());

  test("a place with data continues, and anything else under /locations is a 404", () => {
    expect(decide("/locations/england")).toEqual(carryOn);
    expect(decide("/locations/united-states")).toEqual(carryOn);
    // A real country with no data, an unknown place, an extra part, and bad encoding.
    expect(decide("/locations/germany")).toEqual(notFound);
    expect(decide("/locations/nope")).toEqual(notFound);
    expect(decide("/locations/england/extra")).toEqual(notFound);
    expect(decide("/locations/%E0%A4%A")).toEqual(notFound);
    expect(decide("/locations/England")).toEqual(notFound);
    // The list itself is not checked.
    expect(decide("/locations")).toEqual(carryOn);
  });

  test("an unknown place is a real 404, and a known one is checked by the proxy", async ({ request }) => {
    for (const path of ["/locations/germany", "/locations/nope", "/locations/england/extra"]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(404);
    }
    const found = await request.get("/locations/england");
    expect(found.status()).toBe(200);
    expect(found.headers()["x-disease-checked"]).toBe("1");
    // The list is not one of the proxy's addresses.
    const list = await request.get("/locations");
    expect(list.status()).toBe(200);
    expect(list.headers()["x-disease-checked"]).toBeUndefined();
  });

  test("the sitemap lists the places", async ({ request }) => {
    const text = await (await request.get("/sitemap.xml")).text();
    for (const path of ["/locations", "/locations/england", "/locations/united-states"]) {
      expect(text).toContain(`<loc>${SITE_URL}${path}</loc>`);
    }
  });
});

test.describe("the header and the home page", () => {
  test("have a Locations link, which is marked on the Locations pages", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link")).toHaveText(["Diseases", "Maps", "Locations"]);
    await expect(nav.getByRole("link", { name: "Locations" })).toHaveAttribute("href", "/locations");
    await expect(nav.getByRole("link", { name: "Locations" })).not.toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Locations" }).click();
    await expect(page).toHaveURL("/locations");
    await expect(nav.getByRole("link", { name: "Locations" })).toHaveAttribute("aria-current", "page");

    // A page inside Locations marks it too.
    await page.goto("/locations/england");
    await expect(nav.getByRole("link", { name: "Locations" })).toHaveAttribute("aria-current", "page");
  });

  test("the three links fit in the header, with no sideways scroll, on a phone", async ({ page }) => {
    await page.goto("/");
    const links = page.getByRole("navigation", { name: "Main" }).getByRole("link");
    const boxes = await links.evaluateAll((elements) =>
      elements.map((element) => {
        const { left, right } = element.getBoundingClientRect();
        return { left, right };
      }),
    );
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    for (const { left, right } of boxes) {
      expect(left).toBeGreaterThanOrEqual(0);
      expect(right).toBeLessThanOrEqual(width);
    }
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
    if (isPhone()) expect(width).toBeLessThanOrEqual(375);
  });

  test("the home page has a Locations card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("article").getByRole("link", { name: "Locations" })).toHaveAttribute(
      "href",
      "/locations",
    );
  });
});

test.describe("the Locations page", () => {
  test("lists England and the United States, with the diseases for each and no breadcrumb", async ({ page }) => {
    await page.goto("/locations");

    await expect(page).toHaveTitle("Locations | Disease Observer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Locations");
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/locations$/);
    // A single step has no breadcrumb.
    await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);

    const cards = page.getByRole("article");
    await expect(cards.getByRole("link")).toHaveText(["England", "United States"]);
    await expect(cards.getByRole("link", { name: "England" })).toHaveAttribute("href", "/locations/england");
    await expect(cards.getByRole("link", { name: "United States" })).toHaveAttribute(
      "href",
      "/locations/united-states",
    );
    await expect(page.getByText("Figures for COVID-19 and measles.")).toBeVisible();
    await expect(page.getByText("Figures for COVID-19, influenza and RSV.")).toBeVisible();

    await cards.getByRole("link", { name: "England" }).click();
    await expect(page).toHaveURL("/locations/england");
  });
});

test.describe("a place's page", () => {
  test("England has COVID-19 and measles, with their figures and links to their views", async ({ page }) => {
    await page.goto("/locations/england");

    await expect(page).toHaveTitle("England | Disease Observer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("England");
    await expect(crumbs(page)).toHaveText(["Locations›", "England"]);
    await expect(crumbs(page).first().getByRole("link")).toHaveAttribute("href", "/locations");
    await expect(crumbs(page).last().locator('[aria-current="page"]')).toHaveText("England");

    // One section for each disease, its name a link to its page.
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["COVID-19", "Measles"]);
    await expect(page.getByRole("heading", { level: 2 }).first().getByRole("link")).toHaveAttribute(
      "href",
      "/diseases/covid-19",
    );
    await expect(page.getByRole("heading", { level: 3 })).toHaveText([
      "COVID-19 rate by local authority, England",
      "Measles cases by region, England",
    ]);
    await expect(page.getByRole("link", { name: "COVID-19 rate by local authority, England", exact: true })).toHaveAttribute(
      "href",
      COVID,
    );

    // The figures stream in: England's latest value, its period and the provisional tag.
    const covid = page.locator("#figure-covid-19-rate");
    await expect(covid).toContainText("12.6 cases per 100,000");
    await expect(covid).toContainText(/7 days to \d+ \w+ \d{4}/);
    await expect(covid).toContainText("Provisional");
    // The place is the page's, so the figure does not repeat it.
    await expect(covid).not.toContainText("England");
    const measles = page.locator("#figure-measles-cases");
    await expect(measles).toContainText("80 cases");
    await expect(measles).toContainText(/Week of onset/);

    // The views of each dataset, for the whole place: no area in the address.
    for (const [label, base] of [
      ["COVID-19 rate by local authority, England", COVID],
      ["Measles cases by region, England", MEASLES],
    ]) {
      const views = page.getByRole("list", { name: `Views of ${label}` });
      await expect(views.getByRole("link")).toHaveText(["Map", "Chart", "Table"]);
      await expect(views.getByRole("link", { name: `Map: ${label}` })).toHaveAttribute("href", `${base}/map`);
      await expect(views.getByRole("link", { name: `Chart: ${label}` })).toHaveAttribute("href", `${base}/chart`);
      await expect(views.getByRole("link", { name: `Table: ${label}` })).toHaveAttribute("href", `${base}/table`);
    }
    // Nothing about the United States.
    await expect(page.getByText("Influenza")).toHaveCount(0);
  });

  test("the United States has influenza, RSV and COVID-19, with the national figures", async ({ page }) => {
    await page.goto("/locations/united-states");

    await expect(page).toHaveTitle("United States | Disease Observer");
    await expect(crumbs(page)).toHaveText(["Locations›", "United States"]);
    await expect(page.getByText("Every disease the site has figures for in the United States")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(["COVID-19", "Influenza", "RSV"]);
    await expect(page.getByRole("heading", { level: 3 })).toHaveText([
      "COVID-19 hospital admissions by state, United States",
      "Influenza hospital admissions by state, United States",
      "RSV hospital admissions by state, United States",
    ]);

    await expect(page.locator("#figure-influenza-hospital-admissions")).toContainText(
      "3.5 hospital admissions per 100,000",
    );
    await expect(page.locator("#figure-influenza-hospital-admissions")).toContainText("Provisional");
    await expect(page.locator("#figure-rsv-hospital-admissions")).toContainText("0.5 hospital admissions per 100,000");
    await expect(page.locator("#figure-covid-19-hospital-admissions-us")).toContainText(
      "1.5 hospital admissions per 100,000",
    );
    await expect(page.locator("#figure-covid-19-hospital-admissions-us")).toContainText(/7 days to \d+ \w+ \d{4}/);

    await expect(
      page.getByRole("link", { name: "Chart: Influenza hospital admissions by state, United States" }),
    ).toHaveAttribute("href", `${INFLUENZA}/chart`);
    await expect(page.getByRole("link", { name: "Map: RSV hospital admissions by state, United States" })).toHaveAttribute(
      "href",
      `${RSV}/map`,
    );
    await expect(
      page.getByRole("link", { name: "Table: COVID-19 hospital admissions by state, United States" }),
    ).toHaveAttribute("href", `${COVID_US}/table`);
    // England's datasets are not here.
    await expect(page.getByText("Rate by local authority, England")).toHaveCount(0);
  });

  test("the links go to the dataset's views", async ({ page }) => {
    await page.goto("/locations/united-states");
    await page.getByRole("link", { name: "Table: Influenza hospital admissions by state, United States" }).click();
    await expect(page).toHaveURL(`${INFLUENZA}/table`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Influenza hospital admissions by state, United States");

    await page.goBack();
    await page.getByRole("link", { name: "Influenza hospital admissions by state, United States", exact: true }).click();
    await expect(page).toHaveURL(INFLUENZA);
  });

  test("do not scroll sideways, whatever the width", async ({ page }) => {
    for (const path of ["/locations", "/locations/england", "/locations/united-states"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      const overflow = await page.evaluate(() => {
        const root = document.documentElement;
        return root.scrollWidth - root.clientWidth;
      });
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });

  test("the headings and links are in the page's HTML, before any figure arrives", async ({ page }) => {
    // The figures come from the database, and stream in; the links and headings are from the
    // registry, so a slow or missing database leaves the rest of the page intact.
    const response = await page.request.get("/locations/england");
    const html = await response.text();
    expect(html).toContain("COVID-19 rate by local authority, England");
    expect(html).toContain(`href="${COVID}/map"`);
  });
});
