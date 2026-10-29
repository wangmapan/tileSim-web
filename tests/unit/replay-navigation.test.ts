/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";
import { navItems } from "../../src/entities/navigation/model";
import { routeForView, routeViewIds, router } from "../../src/app/router";

describe("execution replay navigation", () => {
  it("exposes replay as a run-bound workspace view", () => {
    expect(routeViewIds).toContain("replay");
    expect(navItems.find((item) => item.id === "replay")).toMatchObject({
      group: "分析",
      label: "执行回放",
    });
    expect(routeForView("replay", "run-replay-1")).toEqual({
      name: "replay",
      query: { run: "run-replay-1" },
    });
  });

  it("mounts the standalone replay route", () => {
    expect(router.getRoutes().find((route) => route.name === "replay")?.path).toBe("/replay");
  });
});
