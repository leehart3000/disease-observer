import { expect, test } from "@playwright/test";

/**
 * Tests for the site shell and the static pages. The sources lists need the
 * test database, which the seed fills with the three sources.
 */

const isPhone = () => test.info().project.name === "iphone-se";

const PAGES = [
  { path: "/", h1: "Maps and charts for infectious disease surveillance" },
  { path: "/diseases", h1: "Diseases" },
  { path: "/diseases/covid-19", h1: "COVID-19" },
  { path: "/diseases/measles", h1: "Measles" },
  { path: "/map", h1: "Map" },
  { path: "/sources", h1: "Sources and licences" },
  { path: "/about", h1: "About" },
];

for (const { path, h1 } of PAGES) {
  test(`${path} has one h1 and no horizontal scrolling`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(h1);
    const overflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the header links work and mark the current page", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Diseases" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );

  await nav.getByRole("link", { name: "Diseases" }).click();
  await expect(page).toHaveURL("/diseases");
  await expect(nav.getByRole("link", { name: "Diseases" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(nav.getByRole("link", { name: "Map" })).not.toHaveAttribute("aria-current", "page");

  // A page inside Diseases keeps Diseases marked.
  await page.goto("/diseases/measles");
  await expect(nav.getByRole("link", { name: "Diseases" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await nav.getByRole("link", { name: "Map" }).click();
  await expect(page).toHaveURL("/map");
  await expect(nav.getByRole("link", { name: "Map" })).toHaveAttribute("aria-current", "page");
});

test("the header links fit on a second row on a phone, with 44 px targets", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("link", { name: "disease.observer" });
  const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Map" });

  const [logoBox, linkBox] = [await logo.boundingBox(), await link.boundingBox()];
  expect(linkBox!.height).toBeGreaterThanOrEqual(44);
  if (isPhone()) {
    expect(linkBox!.y).toBeGreaterThan(logoBox!.y + logoBox!.height - 1);
  } else {
    expect(linkBox!.y).toBeLessThan(logoBox!.y + logoBox!.height);
  }
});

test("the footer links to the sources and about pages", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "Footer" });

  await footer.getByRole("link", { name: "Sources" }).click();
  await expect(page).toHaveURL("/sources");
  await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL("/about");
  await expect(page.getByText("© 2026 Disease Observer")).toBeVisible();
});

test("the footer has the copyright on the left and the links on the right on a wide screen", async ({
  page,
}) => {
  await page.goto("/about");
  const copyright = page.getByText("© 2026 Disease Observer");
  const footer = page.getByRole("navigation", { name: "Footer" });
  const links = footer.getByRole("link");

  const copyrightBox = (await copyright.boundingBox())!;
  const sources = (await links.first().boundingBox())!;
  const about = (await links.last().boundingBox())!;
  expect(sources.height).toBeGreaterThanOrEqual(44);
  expect(about.height).toBeGreaterThanOrEqual(44);
  if (isPhone()) {
    // The links wrap beneath the copyright line.
    expect(sources.y).toBeGreaterThanOrEqual(copyrightBox.y + copyrightBox.height);
  } else {
    // One line, with the copyright first and the links at the right.
    expect(sources.y).toBeLessThan(copyrightBox.y + copyrightBox.height);
    expect(sources.x).toBeGreaterThan(copyrightBox.x + copyrightBox.width);
    // The content is 1024 px wide, centred, with 24 px of padding: it ends at 1128.
    expect(about.x + about.width).toBeGreaterThan(1100);
  }
});

test("the home page and the about page say what the site covers now, from the registry", async ({
  page,
}) => {
  const line = "Currently covers COVID-19 and measles in England, from the UK Health Security Agency.";
  await page.goto("/");
  await expect(page.getByText(line)).toBeVisible();
  await expect(page.getByText("shown as soon as they are published")).toHaveCount(0);

  await page.goto("/about");
  await expect(page.getByText(line)).toBeVisible();
  await expect(page.getByText("contact a doctor or your local health service")).toBeVisible();
  await expect(page.getByText("NHS 111")).toHaveCount(0);
});

test("the home page has one card for each disease, and one for the map", async ({ page }) => {
  await page.goto("/");

  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(3);
  await expect(cards.getByRole("link")).toHaveText(["COVID-19", "Measles", "Map"]);

  await cards.getByRole("link", { name: "Measles" }).click();
  await expect(page).toHaveURL("/diseases/measles");
});

test("the diseases page lists the same diseases", async ({ page }) => {
  await page.goto("/diseases");

  await expect(page.getByRole("article").getByRole("link")).toHaveText(["COVID-19", "Measles"]);
});

test("a disease page links to its map and lists only its sources", async ({ page }) => {
  await page.goto("/diseases/measles");

  await expect(page.getByRole("link", { name: "Measles cases by region" })).toHaveAttribute(
    "href",
    "/map?d=measles-cases",
  );
  await expect(page.getByRole("link", { name: "COVID-19 rate by local authority" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "UKHSA data dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Office for National Statistics/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "WHO FluNet" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "OpenFreeMap base map" })).toHaveCount(0);

  await page.getByRole("link", { name: "Measles cases by region" }).click();
  await expect(page).toHaveURL("/map?d=measles-cases");
});

test("an unknown disease is a 404", async ({ page }) => {
  const response = await page.goto("/diseases/not-a-disease");

  expect(response?.status()).toBe(404);
});

test("the sources page lists the sources that are used and the base map credit", async ({
  page,
}) => {
  await page.goto("/sources");

  await expect(page.getByRole("link", { name: "UKHSA data dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Office for National Statistics/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "OpenFreeMap base map" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open Government Licence v3.0" }).first()).toBeVisible();
  // Not used by any dataset yet.
  await expect(page.getByRole("link", { name: "WHO FluNet" })).toHaveCount(0);
});

test("the map page has a canonical link to /map", async ({ page }) => {
  await page.goto("/map?d=measles-cases");

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://disease.observer/map",
  );
});
