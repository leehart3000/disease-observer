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
  { path: "/maps", h1: "Maps" },
  { path: "/diseases/covid-19/rate-by-local-authority", h1: "COVID-19 rate by local authority" },
  { path: "/diseases/covid-19/rate-by-local-authority/map", h1: "COVID-19 rate by local authority" },
  { path: "/diseases/covid-19/rate-by-local-authority/table", h1: "COVID-19 rate by local authority" },
  { path: "/diseases/measles/cases-by-region/table", h1: "Measles cases by region" },
  { path: "/diseases/measles/cases-by-region", h1: "Measles cases by region" },
  { path: "/diseases/measles/cases-by-region/map", h1: "Measles cases by region" },
  { path: "/sources", h1: "Sources and licences" },
  { path: "/about", h1: "About" },
  { path: "/privacy", h1: "Privacy" },
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
  await expect(nav.getByRole("link", { name: "Maps" })).not.toHaveAttribute("aria-current", "page");

  // A page inside Diseases keeps Diseases marked, including a dataset's map page.
  await page.goto("/diseases/measles");
  await expect(nav.getByRole("link", { name: "Diseases" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await page.goto("/diseases/measles/cases-by-region");
  await expect(nav.getByRole("link", { name: "Diseases" })).toHaveAttribute(
    "aria-current",
    "page",
  );

  await nav.getByRole("link", { name: "Maps" }).click();
  await expect(page).toHaveURL("/maps");
  await expect(nav.getByRole("link", { name: "Maps" })).toHaveAttribute("aria-current", "page");
  await expect(nav.getByRole("link", { name: "Diseases" })).not.toHaveAttribute(
    "aria-current",
    "page",
  );
});

test("the header links fit on a second row on a phone, with 44 px targets", async ({ page }) => {
  await page.goto("/");
  const logo = page.getByRole("link", { name: "disease.observer" });
  const link = page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Maps" });

  const [logoBox, linkBox] = [await logo.boundingBox(), await link.boundingBox()];
  expect(linkBox!.height).toBeGreaterThanOrEqual(44);
  if (isPhone()) {
    expect(linkBox!.y).toBeGreaterThan(logoBox!.y + logoBox!.height - 1);
  } else {
    expect(linkBox!.y).toBeLessThan(logoBox!.y + logoBox!.height);
  }
});

test("the footer links to the sources, about and privacy pages", async ({ page }) => {
  await page.goto("/");
  const footer = page.getByRole("navigation", { name: "Footer" });

  await footer.getByRole("link", { name: "Sources" }).click();
  await expect(page).toHaveURL("/sources");
  await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "About" }).click();
  await expect(page).toHaveURL("/about");
  await page.getByRole("navigation", { name: "Footer" }).getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL("/privacy");
  await expect(page.getByText("© 2026 Disease Observer")).toBeVisible();
});

test("the privacy page says what is collected, with links to the two policies", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page).toHaveTitle(/^Privacy/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", /\/privacy$/);
  const main = page.getByRole("main");
  await expect(main).toContainText("no cookies");
  await expect(main).toContainText("Cloudflare Web Analytics");
  await expect(main).toContainText("stored only in your own browser");
  await expect(main).toContainText("forwarded to the site owner");
  await expect(main).toContainText("The site is run by Lee Hart.");
  await expect(main.getByRole("link", { name: /Cloudflare’s privacy policy/ })).toHaveAttribute(
    "href",
    "https://www.cloudflare.com/privacypolicy/",
  );
  await expect(main.getByRole("link", { name: /Vercel’s privacy policy/ })).toHaveAttribute(
    "href",
    "https://vercel.com/legal/privacy-policy",
  );
  await expect(main.getByRole("link", { name: "privacy@disease.observer" })).toHaveAttribute(
    "href",
    "mailto:privacy@disease.observer",
  );
});

test("the wordmark's text is disease.observer once, with no doubled i", async ({ page }) => {
  await page.goto("/");
  const text = (await page.getByRole("banner").evaluate((header) => header.textContent)) ?? "";
  expect(text.split("disease.observer")).toHaveLength(2);
  expect(text).not.toContain("diisease");
  // The red dot is drawn by CSS, so the page's own text has no extra "i".
  expect((await page.locator("body").evaluate((body) => body.textContent)) ?? "").not.toContain("diisease");
});

test("the footer links are in the order Sources, Privacy, About", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("navigation", { name: "Footer" }).getByRole("link")).toHaveText([
    "Sources",
    "Privacy",
    "About",
  ]);
});

test("the home page has the diseases under one heading and Maps and Locations under Explore", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 2 })).toHaveText(["Diseases", "Explore"]);
  const diseases = page.getByRole("heading", { level: 2, name: "Diseases" }).locator("xpath=following-sibling::div[1]");
  await expect(diseases.getByRole("article")).toHaveCount(4);
  const explore = page.getByRole("heading", { level: 2, name: "Explore" }).locator("xpath=following-sibling::div[1]");
  await expect(explore.getByRole("article").getByRole("link")).toHaveText(["Maps", "Locations"]);
  await expect(page.getByText("public figures")).toHaveCount(0);
  await expect(page.getByText("published data")).toBeVisible();
});

test("disease cards describe the disease, not one dataset", async ({ page }) => {
  await page.goto("/");
  const covid = page.getByRole("article").filter({ hasText: "COVID-19" });
  await expect(covid).toContainText("SARS-CoV-2");
  await expect(covid).not.toContainText("local authority");
  await expect(covid).not.toContainText("local authorities");
});

test("no analytics script is loaded outside production", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  expect(requested.filter((url) => url.includes("cloudflareinsights"))).toEqual([]);
  await expect(page.locator("script[data-cf-beacon]")).toHaveCount(0);
});

test("a disease page shows only the disease's own description under its heading", async ({
  page,
}) => {
  for (const slug of ["covid-19", "measles", "influenza", "rsv"]) {
    await page.goto(`/diseases/${slug}`);
    const main = page.getByRole("main");
    await expect(main.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(main).not.toContainText("The map shows");
  }
  // The dataset's description is in the Datasets section, not under the heading.
  await page.goto("/diseases/rsv");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading.locator("xpath=following-sibling::*[1]")).toContainText("Respiratory syncytial virus (RSV)");
  await expect(heading.locator("xpath=following-sibling::*[1]")).not.toContainText("hospital admissions");
  await expect(
    page.getByRole("heading", { level: 2, name: "Datasets" }).locator("xpath=..").getByText("hospital admissions of patients"),
  ).toBeVisible();
});

test("a dataset page and its map page explain what the map shows", async ({ page }) => {
  for (const path of [
    "/diseases/influenza/hospital-admissions-by-state",
    "/diseases/influenza/hospital-admissions-by-state/map",
  ]) {
    await page.goto(path);
    await expect(page.getByTestId("map-explanation")).toContainText("The map shows");
  }
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
  const items = [
    "England: COVID-19 and measles, from the UK Health Security Agency",
    "United States: influenza, RSV and COVID-19, from the CDC National Healthcare Safety Network (NHSN)",
  ];
  await page.goto("/");
  await expect(page.getByTestId("coverage")).toContainText("Disease Observer currently covers:");
  await expect(page.getByTestId("coverage").getByRole("listitem")).toHaveText(items);
  await expect(page.getByText("Currently covers", { exact: true })).toHaveCount(0);
  await expect(page.getByText("shown as soon as they are published")).toHaveCount(0);

  await page.goto("/about");
  await expect(page.getByTestId("coverage").getByRole("listitem")).toHaveText(items);
  await expect(page.getByText("contact a doctor or your local health service")).toBeVisible();
  await expect(page.getByText("NHS 111")).toHaveCount(0);
});

test("the home page has one card for each disease, and one for the map", async ({ page }) => {
  await page.goto("/");

  const cards = page.getByRole("article");
  await expect(cards).toHaveCount(6);
  await expect(cards.getByRole("link")).toHaveText(["COVID-19", "Measles", "Influenza", "RSV", "Maps", "Locations"]);
  await expect(cards.getByRole("link", { name: "Maps" })).toHaveAttribute("href", "/maps");

  await cards.getByRole("link", { name: "Measles" }).click();
  await expect(page).toHaveURL("/diseases/measles");
});

test("the diseases page lists the same diseases", async ({ page }) => {
  await page.goto("/diseases");

  await expect(page.getByRole("article").getByRole("link")).toHaveText(["COVID-19", "Measles", "Influenza", "RSV"]);
});

test("a disease page lists its datasets, with a link to each view, and only its sources", async ({
  page,
}) => {
  await page.goto("/diseases/measles");

  await expect(page.getByRole("heading", { level: 2, name: "Datasets" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Cases by region", exact: true })).toHaveAttribute(
    "href",
    "/diseases/measles/cases-by-region",
  );
  await expect(page.getByRole("link", { name: "Map: Cases by region" })).toHaveAttribute(
    "href",
    "/diseases/measles/cases-by-region/map",
  );
  // Only the views that have a page are linked.
  await expect(page.getByRole("link", { name: "Table: Cases by region" })).toHaveAttribute(
    "href",
    "/diseases/measles/cases-by-region/table",
  );
  await expect(page.getByRole("link", { name: "Chart: Cases by region" })).toHaveAttribute(
    "href",
    "/diseases/measles/cases-by-region/chart",
  );
  await expect(page.getByRole("link", { name: /Rate by local authority/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "UKHSA data dashboard" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Office for National Statistics/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "WHO FluNet" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "OpenFreeMap base map" })).toHaveCount(0);

  await page.getByRole("link", { name: "Map: Cases by region" }).click();
  await expect(page).toHaveURL("/diseases/measles/cases-by-region/map");
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

test("the address check runs only for disease, dataset and map-view pages", async ({ request }) => {
  // Known pages go through the check, which marks the response.
  for (const path of [
    "/diseases/covid-19",
    "/diseases/covid-19/rate-by-local-authority",
    "/diseases/covid-19/rate-by-local-authority/map",
    "/diseases/covid-19/rate-by-local-authority/table",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["x-disease-checked"], path).toBe("1");
  }

  // Other pages, assets and images do not.
  for (const path of ["/", "/diseases", "/maps", "/about", "/sources", "/icon.svg", "/boundaries/rgn-dec-2022.json"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
    expect(response.headers()["x-disease-checked"], path).toBeUndefined();
  }
});

test("an unknown or malformed disease, dataset or view address is a 404, not an error", async ({
  request,
}) => {
  for (const path of [
    "/diseases/not-a-disease",
    "/diseases/%E0%A4%A",
    "/diseases/covid-19%20",
    "/diseases/covid-19/not-a-dataset",
    "/diseases/covid-19/cases-by-region",
    "/diseases/covid-19/%E0%A4%A",
    "/diseases/covid-19/rate-by-local-authority/graph",
    "/diseases/covid-19/rate-by-local-authority/bogus",
    "/diseases/covid-19/rate-by-local-authority/map/extra",
  ]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
});
