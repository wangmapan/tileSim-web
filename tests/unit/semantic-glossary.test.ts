import { afterEach, describe, expect, it } from "vitest";
import {
  backendExplanationPresentation,
  semanticFieldPresentation,
  semanticValuePresentation,
} from "../../src/features/execution-inspector";
import { setLocale } from "../../src/i18n";

afterEach(() => setLocale("zh-CN"));

describe("semantic presentation glossary", () => {
  it("presents a known field and value while preserving the raw technical pair", () => {
    const item = semanticFieldPresentation("source_mode", "synthetic_trace");
    expect(item).toMatchObject({
      fieldLabel: "输入来源模式",
      valueLabel: "人工生成 Trace",
      knownField: true,
      knownValue: true,
      technicalText: "技术字段：source_mode = synthetic_trace",
    });
    expect(item.valueDescription).toContain("不是真实采集");
  });

  it("keeps requested and actual fidelity as separate meanings", () => {
    const requested = semanticFieldPresentation("requested_fidelity", "des");
    const actual = semanticFieldPresentation("actual_fidelity", "analytical");
    expect(requested.fieldLabel).toBe("请求的仿真精细度");
    expect(actual.fieldLabel).toBe("实际仿真精细度");
    expect(requested.valueLabel).toContain("DES");
    expect(actual.valueLabel).toContain("Analytical");
  });

  it.each([
    ["expected_absence", "按边界预期缺省", "预期不出现"],
    ["missing", "所需数据缺失", "未提供"],
    ["not_covered", "当前证据未覆盖", "未覆盖"],
    ["not_applicable", "不适用于此项", "不适用"],
  ])("does not conflate %s with another absence state", (value, label, detail) => {
    const item = semanticFieldPresentation("availability", value);
    expect(item.valueLabel).toBe(label);
    expect(item.valueDescription).toContain(detail);
    expect(item.technicalText).toContain(`availability = ${value}`);
  });

  it("fails safely for unknown fields and values without humanising them into invented meaning", () => {
    const item = semanticFieldPresentation("future_backend_state", "future_snake_case_value");
    expect(item).toMatchObject({
      fieldLabel: "未收录字段",
      valueLabel: "未识别值",
      knownField: false,
      knownValue: false,
    });
    expect(item.valueDescription).toContain("保留后端原值");
    expect(item.technicalText).toContain("future_backend_state = future_snake_case_value");
  });

  it("renders accurate English copy without exposing snake_case as the primary label", () => {
    setLocale("en-US");
    const item = semanticFieldPresentation("calibration_level", "held_out_validated");
    expect(item.fieldLabel).toBe("Calibration level");
    expect(item.valueLabel).toBe("Held-out validated");
    expect(item.valueDescription).not.toContain("held_out_validated");
    expect(item.technicalText).toBe("Technical field: calibration_level = held_out_validated");
  });

  it.each([
    ["validation_lane", "held_out_real_trace", "独立真实 Trace 留出验证路径"],
    ["evidence_tier", "held_out_metric_with_resource_convergence", "独立留出指标证据（含资源汇合）"],
    ["availability", "run_scope_only", "仅有运行级关联"],
    ["availability", "ambiguous_reference", "证据引用不唯一"],
    ["availability", "artifact_identity_missing", "产物身份信息缺失"],
    ["availability", "legacy_compatibility", "旧版兼容证据"],
    ["availability", "invalid_reference", "证据引用无效"],
    ["availability", "contract_gap", "当前契约存在缺口"],
  ])("covers existing contract value %s = %s", (field, value, label) => {
    const item = semanticFieldPresentation(field, value);
    expect(item.valueLabel).toBe(label);
    expect(item.knownValue).toBe(true);
    expect(item.technicalText).toContain(`${field} = ${value}`);
  });

  it.each([
    ["fallback", "回退展示"],
    ["count", "计数展示"],
    ["deduplicate", "去重展示"],
    ["complete", "完整"],
    ["matched", "已匹配"],
    ["queue_delay", "排队等待"],
    ["congestion_delay", "拥塞等待"],
    ["not_evaluated", "未评估"],
    ["insufficient_objectives", "目标不足"],
  ])("explains additional report value %s", (value, label) => {
    const item = semanticValuePresentation(value);
    expect(item.valueLabel).toBe(label);
    expect(item.knownValue).toBe(true);
  });

  it("maps only exact known backend explanations and labels unknown text as original", () => {
    expect(backendExplanationPresentation("Runtime DES evidence is present.")).toMatchObject({
      text: "包含推理引擎与服务运行时模块的 DES 证据。",
      mapped: true,
    });
    expect(backendExplanationPresentation("A new backend sentence.")).toEqual({
      label: "后端原始说明",
      text: "A new backend sentence.",
      raw: "A new backend sentence.",
      mapped: false,
    });
  });
});
