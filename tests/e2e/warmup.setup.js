import { expect, test as setup } from "@playwright/test";

setup("warm the offline overview and experiment entry routes", async ({ page }) => {
  setup.setTimeout(90000);
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
  for (const route of ["overview", "experiment"]) {
    await page.goto(`/${route}`, { waitUntil: "domcontentloaded" });
    // Cold Vite transforms can finish after DOMContentLoaded on a large local
    // workspace; wait for the actual shell mount before dependent projects run.
    await expect(page.locator("h1")).toBeVisible({ timeout: 15000 });
  }
});
