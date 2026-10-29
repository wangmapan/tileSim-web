/** @vitest-environment jsdom */

import { describe, expect, it } from "vitest";
import { router } from "../../src/app/router";

describe("professional-only routing", () => {
  it("does not register a second workbench route family", () => {
    const routeNames = router.getRoutes().map((route) => String(route.name || ""));
    expect(routeNames).toEqual(expect.arrayContaining(["overview", "experiment", "replay"]));
    expect(routeNames).not.toContain("workbench_entry");
  });

  it("keeps replay as a first-class run-bound route", async () => {
    await router.push({ name: "replay", query: { run: "run-replay" } });
    expect(router.currentRoute.value.name).toBe("replay");
    expect(router.currentRoute.value.query.run).toBe("run-replay");
  });

  it("redirects the root to the professional overview", async () => {
    await router.push("/");
    expect(router.currentRoute.value.name).toBe("overview");
  });

  it.each(["/lightweight", "/lightweight/prepare", "/lightweight/runs/run-legacy"])(
    "redirects removed lightweight deep links to the professional overview (%s)",
    async (path) => {
      await router.push(path);
      expect(router.currentRoute.value.name).toBe("overview");
      expect(router.currentRoute.value.path).toBe("/overview");
    },
  );
});
