import { expect, test } from "@playwright/test";

/**
 * Tests for the 404 page: it is the site's own page, with its header and
 * footer, and offers the places to go next. An address that does not exist
 * answers with a real 404 (see `src/proxy.ts`), and the same page.
 */

const MISSING = [
  "/no-such-page",
  "/diseases/not-a-disease",
  "/diseases/covid-19/not-a-dataset",
  "/locations/nope",
];

test("an address with no page has a 404 status and the site's own not-found page", async ({ page }) => {
  for (const path of MISSING) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
    await expect(page).toHaveTitle("Page not found | Disease Observer");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("This page could not be found.");
    await expect(page.getByText("Error 404")).toBeVisible();
    // The site around it: the header with its links, and the footer.
    await expect(page.getByRole("link", { name: "disease.observer" }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveText([
      "Diseases",
      "Maps",
      "Locations",
    ]);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Sources" })).toBeVisible();
  }
});

test("offers the main sections and every disease, from the registry", async ({ page }) => {
  await page.goto("/no-such-page");

  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { level: 2 })).toHaveText(["Go to", "Or look at a disease"]);
  const sections = main.getByRole("list").first().getByRole("link");
  await expect(sections).toHaveText([
    "The home page",
    "All diseases",
    "Maps",
    "Locations",
    "Sources",
    "About",
  ]);
  await expect(sections.nth(0)).toHaveAttribute("href", "/");
  await expect(sections.nth(3)).toHaveAttribute("href", "/locations");

  const diseases = main.getByRole("list").nth(1).getByRole("link");
  await expect(diseases).toHaveText(["COVID-19", "Measles", "Influenza", "RSV"]);
  await expect(diseases.nth(2)).toHaveAttribute("href", "/diseases/influenza");
});

test("the links work", async ({ page }) => {
  await page.goto("/diseases/not-a-disease");
  await page.getByRole("link", { name: "Influenza", exact: true }).click();
  await expect(page).toHaveURL("/diseases/influenza");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Influenza");

  await page.goto("/no-such-page");
  await page.getByRole("link", { name: "The home page" }).click();
  await expect(page).toHaveURL("/");
});

test("does not scroll sideways, and its links are big enough to touch", async ({ page }) => {
  await page.goto("/no-such-page");
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
  for (const link of await page.getByRole("main").getByRole("link").all()) {
    const box = (await link.boundingBox())!;
    expect(box.height, await link.innerText()).toBeGreaterThanOrEqual(44);
  }
});
