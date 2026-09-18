// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createLightweightAgentAdapter, createLightweightContext } from "../../src/features/lightweight-workbench";

const ids = [
  ["s0.workload.message_size_multiplier", "number", "ratio"],
  ["s1.runtime.batch_scheduler", "enum", "policy"],
  ["s1.runtime.max_batch_size", "integer", "count"],
  ["s1.runtime.kv_capacity_tokens", "integer", "tokens"],
  ["s6.fabric.scale_up_bandwidth_gbps", "number", "Gbps"],
  ["s6.fabric.scale_up_latency_us", "number", "us"],
  ["s6.fabric.scale_out_bandwidth_gbps", "number", "Gbps"],
  ["s6.fabric.scale_out_latency_us", "number", "us"],
] as const;

const capability = {
  catalog_identity: "tilesim.bridge.agent_orchestration_capability_catalog.v1" as const,
  catalog_revision: `sha256:${"a".repeat(64)}`,
  capability_snapshot_revision: `sha256:${"b".repeat(64)}`,
  schema_set_revision: `sha256:${"c".repeat(64)}`,
  target_request_identity: "tilesim.bridge.create_run_request.v1" as const,
  fields: ids.map(([field_id, value_type, canonical_unit]) => ({
    field_id,
    aliases: [field_id, field_id.split(".").at(-1)!],
    value_type,
    canonical_unit,
    accepted_units: [canonical_unit],
    request_json_pointer: `/overrides/${field_id.split(".").slice(1).join("/")}`,
    enum_values: field_id === "s1.runtime.batch_scheduler" ? ["fifo", "priority"] : [],
    minimum: value_type === "enum" ? null : "0",
    maximum: value_type === "enum" ? null : "1000000",
    integer_only: value_type === "integer",
    capability_state: "available" as const,
  })),
};

describe("shared Agent typed-draft state gate", () => {
  it("distinguishes missing clarification from generic clarification", async () => {
    const adapter = createLightweightAgentAdapter({ context: createLightweightContext("ctx:missing"), capability });
    const result = await adapter.submit("把最大 batch size 调整为");
    expect(result.status).toBe("missing");
    expect(result.missing.length).toBeGreaterThan(0);
  });

  it("fails closed for unavailable and stale page context", async () => {
    const unavailable = createLightweightContext("ctx:unavailable");
    unavailable.availability = "unavailable";
    const stale = createLightweightContext("ctx:stale");
    stale.availability = "stale";
    expect(
      (await createLightweightAgentAdapter({ context: unavailable, capability }).submit("把 batch size 调整为 8"))
        .status,
    ).toBe("unavailable");
    expect(
      (await createLightweightAgentAdapter({ context: stale, capability }).submit("把 batch size 调整为 8")).status,
    ).toBe("stale");
  });

  it("is idempotent for repeat submits without retaining the redacted prompt", async () => {
    const adapter = createLightweightAgentAdapter({ context: createLightweightContext("ctx:idempotent"), capability });
    const first = await adapter.submit("把最大 batch size 调整为 8; api_key=do-not-store");
    const second = await adapter.submit("把最大 batch size 调整为 8; api_key=do-not-store");
    expect(second).toBe(first);
    expect(JSON.stringify(first)).not.toContain("do-not-store");
  });

  it("redacts quoted and JSON-like credentials before compiler projections", async () => {
    const adapter = createLightweightAgentAdapter({ context: createLightweightContext("ctx:redaction"), capability });
    const result = await adapter.submit(
      "把最大 batch size 调整为 8; api_key = \"quoted secret value\"; token: 'token with spaces'; Bearer bearer-secret",
    );
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("quoted secret value");
    expect(serialized).not.toContain("token with spaces");
    expect(serialized).not.toContain("bearer-secret");
  });
});
