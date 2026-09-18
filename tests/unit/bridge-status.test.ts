import { describe, expect, it } from "vitest";
import { buildBridgeStatusPresentation } from "../../src/features/bridge-status";

describe("Bridge status presentation", () => {
  it("summarizes a synchronized executable backend", () => {
    expect(
      buildBridgeStatusPresentation(
        {
          versions_match: true,
          execution_ready: true,
          source_revision: "1234567890",
          build_revision: "abcdef0123",
          deployment_ref: "week8-local",
        },
        false,
      ),
    ).toEqual({
      available: true,
      synchronized: true,
      title: "独立后端已同步",
      detail: "week8-local · 源码 1234567 / CLI abcdef0",
    });
  });

  it("keeps legacy APIs read-only even when execution flags are present", () => {
    expect(
      buildBridgeStatusPresentation(
        { versions_match: true, execution_ready: true, source_revision: "unknown", build_revision: "unknown" },
        true,
      ),
    ).toEqual({
      available: false,
      synchronized: false,
      title: "Bridge 兼容只读模式",
      detail: "API 尚未版本化 · 历史报告可读 · 源码 未知 / CLI 未知",
    });
  });

  it("distinguishes a CLI version mismatch from general unavailability", () => {
    expect(
      buildBridgeStatusPresentation(
        { versions_match: false, execution_ready: false, cli_available: true, backend_branch: "main" },
        false,
      ).title,
    ).toBe("后端版本不一致");
    expect(
      buildBridgeStatusPresentation(
        { versions_match: true, execution_ready: false, cli_available: false, backend_branch: "main" },
        false,
      ).title,
    ).toBe("执行后端不可用");
  });
});
