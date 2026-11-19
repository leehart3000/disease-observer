import { expect, test } from "@playwright/test";

test("home page shows the wordmark and the heading", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("img", { name: "disease.observer" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Maps and charts for infectious disease surveillance",
  );
});

test("theme toggle switches theme and the choice survives a reload", async ({
  page,
}) => {
  const html = page.locator("html");
  await page.goto("/");

  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.getByRole("button", { name: "Switch to light theme" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
});

test("home page has no horizontal scrolling", async ({ page }) => {
  await page.goto("/");

  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth - root.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(0);
});
