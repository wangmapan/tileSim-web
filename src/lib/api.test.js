import { afterEach, describe, expect, it, vi } from "vitest";
import { bridgeApi } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("capability discovery API", () => {
  it("uses the fixed same-origin capabilities endpoint on the development surface", async () => {
    vi.stubGlobal("window", { location: { port: "4173" } });
    const payload = {
      schema_version: "tilesim.runtime_capabilities.v1",
      default_gpu_participation_mode: "gpu_free",
      cycle_scope: "S6_hotspot_refinement_only",
      dependencies: {},
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => "application/json; charset=utf-8" },
      json: async () => payload,
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(bridgeApi.capabilities()).resolves.toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith("/api/capabilities", { cache: "no-store" });
  });
});
