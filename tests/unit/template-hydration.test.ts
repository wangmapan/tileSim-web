import { describe, expect, it } from "vitest";
import { templateHydrationRequestIsCurrent } from "../../src/features/run-experiment/template-hydration";

function fixture() {
  const controller = { signal: { aborted: false } };
  const request = {
    token: 1,
    controller,
    scenarioId: "s1_des_example",
    schemaRevision: "schema-a",
    mode: "controls",
    inputToken: 4,
  };
  return {
    request,
    current: {
      mounted: true,
      token: 1,
      controller,
      scenarioId: "s1_des_example",
      schemaRevision: "schema-a",
      mode: "controls",
      inputToken: 4,
    },
  };
}

describe("template hydration fencing", () => {
  it("accepts an unchanged request identity", () => {
    const { request, current } = fixture();
    expect(templateHydrationRequestIsCurrent(request, current)).toBe(true);
  });

  it.each([
    ["user input", { inputToken: 5 }],
    ["scenario", { scenarioId: "pd_disaggregation_example" }],
    ["schema revision", { schemaRevision: "schema-b" }],
    ["mode", { mode: "json" }],
    ["unmounted", { mounted: false }],
    ["stale request token", { token: 2 }],
  ])("rejects a response after %s", (_label, change) => {
    const { request, current } = fixture();
    expect(templateHydrationRequestIsCurrent(request, { ...current, ...change })).toBe(false);
  });

  it("rejects an aborted request and a different active controller", () => {
    const { request, current } = fixture();
    request.controller.signal.aborted = true;
    expect(templateHydrationRequestIsCurrent(request, current)).toBe(false);
    request.controller.signal.aborted = false;
    expect(templateHydrationRequestIsCurrent(request, { ...current, controller: { signal: { aborted: false } } })).toBe(
      false,
    );
  });
});
