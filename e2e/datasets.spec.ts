import { expect, test, type Page } from "@playwright/test";
import { SITE_URL } from "../src/lib/seo.ts";

/**
 * Tests for the Maps listing, the dataset pages, and the redirects from the
 * old map address. The map view itself is tested in map.spec.ts. They need
 * the test database for the sources.
 */

const COVID = "/diseases/covid-19/rate-by-local-authority";
const MEASLES = "/diseases/measles/cases-by-region";

const crumbs = (page: Page) =>
  page.getByRole("navigation", { name: "Breadcrumb" }).getByRole("listitem");

test("the Maps page lists every map, grouped by disease", async ({ page }) => {
  await page.goto("/maps");

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Maps");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["COVID-19", "Measles"]);
  const covid = page.getByRole("link", { name: "COVID-19 rate by local authority" });
  const measles = page.getByRole("link", { name: "Measles cases by region" });
  await expect(covid).toHaveAttribute("href", `${COVID}/map`);
  await expect(measles).toHaveAttribute("href", `${MEASLES}/map`);
  // Each map has its description under it.
  await expect(page.getByText("The number of confirmed cases in each UKHSA region")).toBeVisible();

  await measles.click();
  await expect(page).toHaveURL(`${MEASLES}/map`);
});

test("a dataset page describes the dataset and links to its views", async ({ page }) => {
  await page.goto(COVID);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText("COVID-19 rate by local authority");
  await expect(crumbs(page)).toHaveText([/^Diseases/, /^COVID-19/, /^Rate by local authority$/]);
  await expect(crumbs(page).nth(2).locator('[aria-current="page"]')).toBeVisible();
  await expect(page.getByText("The rate of newly reported cases in the latest 7 days").first()).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "How to read it" })).toBeVisible();
  await expect(page.getByText("for every 100,000 people who live in the local authority")).toBeVisible();

  // One card for each view that has a page: the map and the table so far.
  await expect(page.getByRole("heading", { level: 2, name: "Ways to look at it" })).toBeVisible();
  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(2);
  await expect(cards.getByRole("link")).toHaveText(["Map", "Table"]);
  await expect(cards.getByRole("link").nth(0)).toHaveAttribute("href", `${COVID}/map`);
  await expect(cards.getByRole("link").nth(1)).toHaveAttribute("href", `${COVID}/table`);

  // Only this dataset's sources.
  await expect(page.getByRole("link", { name: "UKHSA data dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Office for National Statistics/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "WHO FluNet" })).toHaveCount(0);

  await cards.getByRole("link", { name: "Map" }).click();
  await expect(page).toHaveURL(`${COVID}/map`);
});

test("the dataset and map pages have the dataset in their titles and a breadcrumb that matches the data for search engines", async ({
  page,
}) => {
  await page.goto(`${MEASLES}/map`);
  await expect(page).toHaveTitle("Measles cases by region: map | Disease Observer");
  const data = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(data.itemListElement.map((item: { name: string }) => item.name)).toEqual([
    "Diseases",
    "Measles",
    "Cases by region",
    "Map",
  ]);
  expect(data.itemListElement.at(-1).item).toBe(`${SITE_URL}${MEASLES}/map`);

  await page.goto(MEASLES);
  await expect(page).toHaveTitle("Measles cases by region | Disease Observer");
});

test("an unknown dataset or a view that is not built shows the not-found page with a 404", async ({
  page,
}) => {
  for (const path of [`${COVID.replace("rate-by-local-authority", "nope")}`, `${COVID}/chart`]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page.getByText("This page could not be found.")).toBeVisible();
  }
});

test.describe("the old map address", () => {
  const redirect = async (request: import("@playwright/test").APIRequestContext, path: string) => {
    const response = await request.get(path, { maxRedirects: 0 });
    return {
      status: response.status(),
      to: response.headers().location
        ? new URL(response.headers().location, "http://localhost:3000")
        : null,
    };
  };

  test("redirects permanently to the dataset's map page", async ({ request }) => {
    for (const [path, expected] of [
      ["/map", `${COVID}/map`],
      ["/map?d=covid-19-rate", `${COVID}/map`],
      ["/map?d=measles-cases", `${MEASLES}/map`],
      // An unknown dataset gives the default one.
      ["/map?d=not-a-dataset", `${COVID}/map`],
      ["/map?d=%E0%A4%A", `${COVID}/map`],
      // A period is dropped while the dataset offers only the latest.
      ["/map?d=measles-cases&p=ytd", `${MEASLES}/map`],
      ["/map?d=covid-19-rate&p=12w", `${COVID}/map`],
    ] as const) {
      const result = await redirect(request, path);
      expect(result.status, path).toBe(308);
      expect(result.to?.pathname, path).toBe(expected);
      // The old `d` and `p` are not carried to the new address.
      expect(result.to?.search, path).toBe("");
    }
  });

  test("is followed to a working page", async ({ request }) => {
    const response = await request.get("/map?d=measles-cases");
    expect(response.status()).toBe(200);
    expect(new URL(response.url()).pathname).toBe(`${MEASLES}/map`);
    expect(await response.text()).toContain("Measles cases by region");
  });
});
