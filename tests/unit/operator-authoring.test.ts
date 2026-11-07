import { describe, expect, it } from "vitest";
import fixture from "../fixtures/operator-execution.json";
import {
  parseExecution,
  patchExecution,
  validateExecution,
  exactDisplay,
  type Document,
} from "../../src/features/kernel-authoring";
import { partitionPreview } from "../../src/features/execution-partition-editor";
import { normalizeOperatorEvidence } from "../../src/features/execution-inspector";
const example = (mode: string) => structuredClone((fixture.examples as Document)[mode]);
describe("operator authoring contracts", () => {
  it.each(["kernel_strategy", "tilelang_source", "execution_partition"])("builds %s formal input", (mode) =>
    expect(validateExecution(example(mode))).toEqual([]),
  );
  it("patches escaped kernel selector without modifying the original", () => {
    const original = example("kernel_strategy");
    const next = patchExecution(original, "/kernel_execution/operations/prefill~1norm_qkv/view", "aggregate");
    expect(next.kernel_execution.operations["prefill/norm_qkv"].view).toBe("aggregate");
    expect(original.kernel_execution.operations["prefill/norm_qkv"].view).toBe("expanded");
  });
  it("rejects duplicate selectors in advanced JSON", () =>
    expect(() => parseExecution('{"operations":{"prefill/norm_qkv":{},"prefill/norm_qkv":{}}}')).toThrow(/duplicate/));
  it("reports dtype and hardware resource paths", () => {
    const value = example("kernel_strategy");
    const strategy = value.kernel_execution.operations["prefill/norm_qkv"].strategy;
    strategy.dtype = "bf16";
    strategy.threads = 1023;
    strategy.shared_bytes = 1000000;
    expect(validateExecution(value).map((i) => i.path)).toEqual(
      expect.arrayContaining([
        "/execution_input/kernel_execution/operations/prefill~1norm_qkv/strategy/dtype",
        "/execution_input/kernel_execution/operations/prefill~1norm_qkv/strategy/threads",
        "/execution_input/kernel_execution/operations/prefill~1norm_qkv/strategy/shared_bytes",
      ]),
    );
  });
  it("detects shape, dtype and instance overlap", () => {
    const value = example("tilelang_source");
    value.tilelang_kernels.push(structuredClone(value.tilelang_kernels[0]));
    expect(validateExecution(value).some((i) => i.message.includes("重叠"))).toBe(true);
    value.tilelang_kernels[0].source.arguments.block_M = 3;
    value.tilelang_kernels[0].source.arguments.dtype = "bfloat16";
    expect(
      validateExecution(value)
        .map((i) => i.message)
        .join(" "),
    ).toMatch(/形状/);
    expect(validateExecution(value).some((i) => i.path.endsWith("/dtype"))).toBe(true);
  });
  it("rejects unsupported output admission and source combinations", () => {
    const value = example("tilelang_source");
    value.tilelang_kernels[0].output_buffer_slots = 1;
    expect(validateExecution(value).some((i) => i.path.endsWith("output_buffer_slots"))).toBe(true);
    value.kernel_execution = example("kernel_strategy").kernel_execution;
    expect(validateExecution(value).length).toBeGreaterThan(0);
  });
  it("keeps 64 bit counters exact and missing distinct from zero", () => {
    const parsed = parseExecution('{"bytes":9007199254740993,"time_ps":18446744073709551615}');
    expect(exactDisplay(parsed.bytes)).toBe("9007199254740993");
    expect(exactDisplay(parsed.time_ps)).toBe("18446744073709551615");
    expect(exactDisplay(0)).toBe("0");
    expect(exactDisplay(undefined)).toBe("missing");
  });
  it("checks partition dependencies, identities and participants", () => {
    const p = example("execution_partition").execution_partition_program;
    expect(partitionPreview(p, ["gpu0"]).issues).toEqual([]);
    p.windows[0].partition.slices[0].dependency_partition_ids = ["absent"];
    expect(partitionPreview(p, ["gpu0"]).issues.some((i) => i.message.includes("缺失依赖"))).toBe(true);
    p.windows[0].partition.slices[0].dependency_partition_ids = ["compute"];
    expect(partitionPreview(p, ["gpu0"]).issues.some((i) => i.message.includes("环"))).toBe(true);
  });
  it("checks window coverage and rejects invalid counters without crashing preview", () => {
    const p = example("execution_partition").execution_partition_program;
    p.windows[0].partition.slices[0].token_offsets = [0, 4];
    expect(partitionPreview(p, ["gpu0"]).issues.some((i) => i.message.includes("未覆盖"))).toBe(true);
    p.windows[0].token_end = "invalid";
    expect(partitionPreview(p, ["gpu0"]).issues[0].message).toContain("精确整数");
  });
  it("normalizes only reported fragments and preserves source pointers", () => {
    const rows = normalizeOperatorEvidence({
      evidence: {
        resource_operations: [
          {
            operation_id: "op",
            fragment_id: "fragment",
            state: "completed",
            start_time_ps: "9007199254740993",
            completion_time_ps: "9007199254740994",
            attributes: { kernel_view: "expanded", source_kernel_sha256: "actual-source" },
          },
        ],
      },
    });
    expect(rows[0].startPs).toBe("9007199254740993");
    expect(rows[0].pointer).toBe("/evidence/resource_operations/0");
    expect(normalizeOperatorEvidence({})).toEqual([]);
  });
});
