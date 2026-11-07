import { expect, test as setup } from "@playwright/test";

setup("warm the offline overview and experiment entry routes", async ({ page }) => {
  setup.setTimeout(90000);
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/, (route) => route.abort("connectionrefused"));
  for (const route of ["overview", "experiment"]) {
    await page.goto(`/${route}`, { waitUntil: "commit" });
    // Cold Vite transforms can finish after the response commits. The app
    // publishes this readiness marker only after its shell and page context
    // are mounted, so dependent projects do not race the lazy assistant.
    await expect(page.locator('.app-shell[data-app-ready="true"]')).toBeVisible({ timeout: 30000 });
  }
});
