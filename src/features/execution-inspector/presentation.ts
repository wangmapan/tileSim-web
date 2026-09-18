import { t } from "../../i18n";
import type { ExecutionLayer, LayerId } from "./model/types";

type Copy = { label: string; description: string };

export type SemanticField =
  | "source_mode"
  | "calibration_level"
  | "allowed_claim_scope"
  | "trace_kind"
  | "requested_fidelity"
  | "actual_fidelity"
  | "resolution"
  | "effective_tier"
  | "des_status"
  | "cycle_status"
  | "evidenceState"
  | "derivation"
  | "availability"
  | "stage_kind"
  | "evidence_tier"
  | "validation_lane";

export interface SemanticPresentation {
  field: string;
  fieldLabel: string;
  fieldDescription: string;
  value: string;
  valueLabel: string;
  valueDescription: string;
  technicalText: string;
  knownField: boolean;
  knownValue: boolean;
}

export interface BackendExplanationPresentation {
  label: string;
  text: string;
  raw: string | null;
  mapped: boolean;
}

const layerCopy: Record<LayerId, { name: string; detail: string; headline: string }> = {
  S0: {
    name: "工作负载抽象与负载描述语言模块",
    detail: "说明本次实验接收了哪些请求和输入。",
    headline: "输入范围：{value}",
  },
  S1: {
    name: "推理引擎与服务运行时模块",
    detail: "说明请求如何排队、分批并进入执行。",
    headline: "{value} 条调度记录",
  },
  S2: {
    name: "执行语义建模模块",
    detail: "说明请求被拆成了哪些计算步骤。",
    headline: "模拟精度：{value}",
  },
  S3: {
    name: "KV Cache 建模模块",
    detail: "说明 KV 缓存和内存的使用情况。",
    headline: "{value} 条内存记录",
  },
  S4: {
    name: "设备性能建模模块",
    detail: "说明设备上执行了哪些计算任务。",
    headline: "{value} 个计算任务",
  },
  S5: {
    name: "集合通信语义模块",
    detail: "说明多个设备之间如何协同通信。",
    headline: "{value} 条协同记录",
  },
  S6: {
    name: "网络与硬件资源模块",
    detail: "说明网络传输、排队和拥塞情况。",
    headline: "{value} 条网络记录",
  },
};

const compatibilityModuleNames: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.entries(layerCopy).map(([id, copy]) => [id, copy.name])),
  S7: "统一仿真内核模块",
  S8: "校准验证与指标归因模块",
  S9: "校准验证与指标归因模块",
};

const metricLabels: Record<string, string> = {
  "Runtime events": "调度记录",
  "Memory events": "内存记录",
  "Device tasks": "计算任务",
  Collectives: "协同通信记录",
  "Fabric records": "网络记录",
};

const metricSemanticFields: Readonly<Record<string, SemanticField>> = {
  来源模式: "source_mode",
  "Source mode": "source_mode",
  校准级别: "calibration_level",
  "Calibration level": "calibration_level",
  允许声明: "allowed_claim_scope",
  "Allowed claims": "allowed_claim_scope",
  "Trace kind": "trace_kind",
  "请求 fidelity": "requested_fidelity",
  "Requested fidelity": "requested_fidelity",
  "实际 fidelity": "actual_fidelity",
  "Actual fidelity": "actual_fidelity",
  "Resolved fidelity": "actual_fidelity",
  解析状态: "resolution",
  "Resolution status": "resolution",
  有效层级: "effective_tier",
  "Effective tier": "effective_tier",
  "DES 状态": "des_status",
  "DES status": "des_status",
  "Cycle 状态": "cycle_status",
  "Cycle status": "cycle_status",
};

const fieldDefinitions = {
  source_mode: {
    label: "输入来源模式",
    description: "输入来源及其证据边界。",
  },
  calibration_level: {
    label: "校准级别",
    description: "",
  },
  allowed_claim_scope: {
    label: "允许声明范围",
    description: "报告允许支持的结论范围。",
  },
  trace_kind: {
    label: "Trace 语义类型",
    description: "Trace 进入仿真的语义边界。",
  },
  requested_fidelity: {
    label: "请求的仿真精细度",
    description: "",
  },
  actual_fidelity: {
    label: "实际仿真精细度",
    description: "",
  },
  resolution: {
    label: "精细度解析结果",
    description: "",
  },
  effective_tier: {
    label: "生效精细度层级",
    description: "",
  },
  des_status: { label: "DES 实现状态", description: "" },
  cycle_status: {
    label: "Cycle 实现状态",
    description: "",
  },
  evidenceState: {
    label: "当前证据状态",
    description: "",
  },
  derivation: {
    label: "字段展示方式",
    description: "前端对字段的展示方式。",
  },
  availability: {
    label: "数据可用状态",
    description: "",
  },
  stage_kind: { label: "执行阶段类型", description: "阶段记录的执行语义。" },
  evidence_tier: {
    label: "证据层级",
    description: "后端声明的证据层级。",
  },
  validation_lane: {
    label: "验证路径",
    description: "本次报告采用的验证路径。",
  },
} satisfies Record<SemanticField, Copy>;

const valueDefinitions: Readonly<Record<string, Copy>> = {
  real_trace: {
    label: "真实系统采集 Trace",
    description: "来自真实系统采集。",
  },
  synthetic_trace: {
    label: "人工生成 Trace",
    description: "由生成器产生，不是真实采集。",
  },
  compatibility_harness_trace: {
    label: "兼容测试工具 Trace",
    description: "来自兼容测试工具，不代表硬件等价。",
  },
  uncalibrated: {
    label: "未校准",
    description: "",
  },
  partially_calibrated: {
    label: "部分校准",
    description: "仅部分完成校准。",
  },
  calibrated: {
    label: "已校准",
    description: "已在声明范围内完成校准。",
  },
  held_out_validated: {
    label: "已通过独立留出验证",
    description: "已通过独立真实 Trace 验证。",
  },
  exploratory: {
    label: "探索性结论",
    description: "用于机制探索或候选筛选。",
  },
  comparative: {
    label: "对比性结论",
    description: "用于同一证据边界内对比。",
  },
  calibrated_prediction: {
    label: "校准范围内预测",
    description: "校准范围内的条件预测。",
  },
  held_out_validation: {
    label: "独立留出验证",
    description: "独立真实 Trace 留出验证。",
  },
  held_out_real_trace: {
    label: "独立真实 Trace 留出验证路径",
    description: "使用未参与校准的真实 Trace。",
  },
  held_out_metric_with_resource_convergence: {
    label: "独立留出指标证据（含资源汇合）",
    description: "独立留出指标，含资源汇合证据。",
  },
  synthetic_consistency: {
    label: "合成一致性检查",
    description: "合成输入下的一致性检查。",
  },
  synthetic_consistency_with_resource_convergence: {
    label: "合成一致性检查（含资源汇合）",
    description: "合成输入下一致性检查，含资源汇合。",
  },
  boundary_consistency: {
    label: "边界一致性检查",
    description: "声明边界内的一致性检查。",
  },
  exploratory_s6_only: {
    label: "仅网络范围的探索性结论",
    description: "仅覆盖网络与硬件资源模块的探索。",
  },
  workflow_consistency_only: {
    label: "仅工作流一致性",
    description: "仅支持工作流与契约一致性检查。",
  },
  s0_workload: { label: "工作负载输入 Trace", description: "Trace 从工作负载抽象与负载描述语言模块边界进入。" },
  s1_runtime: {
    label: "推理运行时 Trace",
    description: "从推理引擎与服务运行时模块边界进入。",
  },
  s2_execution: { label: "执行语义 Trace", description: "从执行语义建模模块边界进入。" },
  s2_kernel: { label: "Kernel 语义 Trace", description: "从执行语义建模模块的 Kernel 入口进入。" },
  s3_memory: { label: "KV Cache 与内存 Trace", description: "从 KV Cache 建模模块边界进入。" },
  s4_device: { label: "设备任务 Trace", description: "从设备性能建模模块边界进入。" },
  s5_collective: { label: "集合通信 Trace", description: "从集合通信语义模块边界进入。" },
  trace_package: {
    label: "Trace 包清单",
    description: "多文件 Trace 包清单。",
  },
  analytical: {
    label: "分析估算（Analytical）",
    description: "",
  },
  des: {
    label: "离散事件模拟（DES）",
    description: "",
  },
  cycle: {
    label: "周期级细化（Cycle）",
    description: "",
  },
  policy_default: {
    label: "使用默认精细度策略",
    description: "由后端策略决定具体精细度。",
  },
  default: {
    label: "使用默认精细度策略",
    description: "由后端策略决定具体精细度。",
  },
  covered: { label: "已覆盖", description: "" },
  reported: { label: "有报告记录", description: "" },
  declaration_only: {
    label: "仅有解析声明",
    description: "仅有边界或精细度声明。",
  },
  expected_absence: {
    label: "按边界预期缺省",
    description: "按请求边界预期不出现。",
  },
  not_covered: {
    label: "当前证据未覆盖",
    description: "当前证据路径未覆盖。",
  },
  missing: {
    label: "所需数据缺失",
    description: "报告未提供所需数据。",
  },
  unknown: { label: "状态未知", description: "" },
  complete: { label: "完整", description: "" },
  matched: { label: "已匹配", description: "" },
  pass: { label: "通过", description: "" },
  fail: { label: "失败", description: "" },
  completed: { label: "已完成", description: "" },
  running: { label: "运行中", description: "" },
  failed: { label: "失败", description: "" },
  incomplete: { label: "不完整", description: "" },
  input: { label: "输入记录", description: "" },
  queue_delay: { label: "排队等待", description: "等待队列服务。" },
  congestion_delay: { label: "拥塞等待", description: "等待拥塞消退。" },
  runtime: { label: "实际执行", description: "报告的实际执行时间。" },
  pareto_member: { label: "Pareto 成员", description: "位于 Pareto 前沿。" },
  non_dominated: { label: "未被支配", description: "没有候选方案支配该项。" },
  dominated: { label: "已被支配", description: "存在候选方案优于该项。" },
  insufficient_objectives: { label: "目标不足", description: "缺少足够比较目标。" },
  not_evaluated: { label: "未评估", description: "本次没有完成评估。" },
  fallback: { label: "回退展示", description: "使用后端允许的回退值。" },
  count: { label: "计数展示", description: "按记录数量展示。" },
  deduplicate: { label: "去重展示", description: "按稳定标识去重展示。" },
  supported: { label: "已支持", description: "当前契约支持。" },
  legacy_unversioned: { label: "旧版未带版本", description: "旧版数据未提供版本标识。" },
  invalid_schema: { label: "Schema 无效", description: "报告 Schema 校验失败。" },
  conditional: { label: "有条件可用", description: "仅在声明条件下可用。" },
  profile_missing: { label: "配置缺失", description: "缺少所需配置。" },
  calibration_missing: { label: "缺少校准", description: "缺少校准证据。" },
  held_out_validation_missing: { label: "缺少留出验证", description: "缺少独立留出验证证据。" },
  not_applicable: {
    label: "不适用于此项",
    description: "当前对象或场景不适用。",
  },
  unavailable: {
    label: "当前不可用",
    description: "当前数据或能力不可用。",
  },
  available: {
    label: "当前可用",
    description: "当前契约检查通过。",
  },
  unresolved_not_executed: {
    label: "未执行，因而未解析",
    description: "所属路径本次未执行。",
  },
  identity: { label: "原样展示", description: "直接展示后端值。" },
  display_group: {
    label: "仅展示级分组",
    description: "按稳定标识分组展示。",
  },
  display_sum: {
    label: "同单位展示级求和",
    description: "对同组同单位字段求和展示。",
  },
  unit_conversion: {
    label: "仅显示单位换算",
    description: "仅改变显示单位。",
  },
  implemented: {
    label: "已实现并有本次运行证据",
    description: "后端已实现并有本次运行证据。",
  },
  partial: { label: "部分满足", description: "仅部分满足实现或证据条件。" },
  run_scope_only: {
    label: "仅有运行级关联",
    description: "仅能关联到本次运行。",
  },
  ambiguous_reference: {
    label: "证据引用不唯一",
    description: "同一标识匹配到多个记录。",
  },
  artifact_identity_missing: {
    label: "产物身份信息缺失",
    description: "缺少可验证 Schema 身份或 SHA-256。",
  },
  legacy_compatibility: {
    label: "旧版兼容证据",
    description: "按旧版兼容契约只读展示。",
  },
  invalid_reference: {
    label: "证据引用无效",
    description: "引用未通过一致性检查。",
  },
  contract_gap: {
    label: "当前契约存在缺口",
    description: "当前契约缺少所需结构化信息。",
  },
  passed: { label: "审计通过", description: "报告声明该审计项通过。" },
  degraded: { label: "结果受限", description: "存在缺口或降级条件。" },
  partial_attribution: {
    label: "部分归因证据",
    description: "仅有部分归因链路或审计证据。",
  },
  not_requested: {
    label: "本次未请求",
    description: "本次未请求该精细度路径。",
  },
  not_required: {
    label: "该模块无需独立实现",
    description: "后端契约不要求独立求解器。",
  },
  not_implemented: {
    label: "尚未实现",
    description: "该路径尚未实现。",
  },
  planned: { label: "已规划，尚未实现", description: "该能力已规划但尚未实现。" },
  placeholder_only: { label: "仅占位接口", description: "仅有接口或占位声明。" },
  bridge_only: {
    label: "仅通过相邻模块汇合",
    description: "通过相邻模块汇合，不是独立 DES 证据。",
  },
  des_partial: { label: "部分 DES", description: "仅部分路径满足 DES 条件。" },
  analytical_to_des_bridge: {
    label: "分析模型到 DES 的桥接",
    description: "分析语义通过资源汇合进入 DES。",
  },
  runtime_event_window: { label: "运行时事件窗口", description: "统一时间轴上的运行时事件区间。" },
  resource_convergence: {
    label: "并列资源语义汇合",
    description: "并列资源语义的汇合阶段。",
  },
  fabric_realization: {
    label: "网络执行实现",
    description: "网络执行、排队与拥塞阶段。",
  },
  unsupported_schema: {
    label: "Schema 不受支持",
    description: "Schema 不在前端允许范围内。",
  },
};

const backendExplanationCopy: Readonly<Record<string, string>> = {
  "The run starts from S1.": "本次运行从推理引擎与服务运行时模块开始。",
  "Runtime DES evidence is present.": "包含推理引擎与服务运行时模块的 DES 证据。",
  "Execution lowering evidence is present.": "包含运行时到执行语义的转换证据。",
  "Memory evidence is present.": "包含 KV Cache 与内存证据。",
  "Device evidence is present.": "包含设备任务与性能证据。",
  "Collective evidence is present.": "包含集合通信证据。",
  "Fabric evidence is present.": "包含网络执行、排队或拥塞证据。",
  "Synthetic evidence cannot support held-out claims.": "合成数据仅支持一致性或探索性检查。",
  "Synthetic-trace validation cannot stand in for held-out real-trace fidelity claims.":
    "合成数据检查不能替代真实 Trace 留出验证。",
  "The run starts from an S1 canonical boundary, so S0 is intentionally absent.":
    "本次运行从推理引擎与服务运行时模块边界开始，工作负载模块按边界缺省。",
  "Runtime policy flow emits dependency-ordered DES runtime events in the hosted path.":
    "托管路径生成按依赖排序的运行时 DES 事件。",
  "Execution abstraction is lowered from runtime outputs before collective realization.":
    "运行时输出先转换为执行语义，再进入集合通信。",
  "Memory and KV semantics include dependency-ordered DES event evidence before resource convergence.":
    "KV Cache 与内存语义包含 DES 事件证据。",
  "Device-performance semantics include dependency-ordered DES task evidence before resource convergence.":
    "设备性能语义包含 DES 任务证据。",
  "Collective semantics include dependency-ordered DES phase evidence after lowering.":
    "集合通信语义包含 DES 阶段证据。",
  "Workload replay, synthetic generation, provenance, and workload-to-runtime lowering are available.":
    "支持工作负载重放、合成生成、来源记录和语义转换。",
  "No independent DES tier is required for this subsystem yet.": "该模块无需独立 DES 层级。",
  "Execution abstraction is a semantic lowering boundary, not an independent simulator tier today.":
    "执行语义建模模块当前是语义转换边界。",
  "No DES gap is counted for this semantic boundary.": "该语义边界不计 DES 缺口。",
  "Resource semantics are fully matched for fabric-bound collective phases.": "网络集合通信阶段已匹配资源语义。",
  "Resource semantics are partially matched; inspect missing memory or device evidence before making cross-layer claims.":
    "资源语义仅部分匹配。",
  "No resource convergence evidence was attached to this metrics report.": "本次指标报告没有资源汇合证据。",
  "Fixture runtime stage.": "Fixture 记录的运行时阶段。",
  "Fixture peer resource stage.": "Fixture 记录的并列资源阶段。",
  "Fixture Fabric stage.": "Fixture 记录的网络执行阶段。",
  "Request waited before its first batch.": "请求在首个批次前等待。",
  "Queue delay dominated the fixture phase.": "该阶段以排队等待为主。",
  "Fixture queue contribution.": "Fixture 报告的排队等待贡献。",
  "Runtime batching delay": "运行时批处理等待",
  "Fabric queue delay": "网络排队等待",
};

function rawValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

function valuePresentation(raw: unknown) {
  const value = rawValue(raw);
  const definition = raw === null || raw === undefined || raw === "" ? null : valueDefinitions[value];
  return {
    value,
    valueLabel:
      raw === null || raw === undefined || raw === ""
        ? t("报告未提供")
        : definition
          ? t(definition.label)
          : t("未识别值"),
    valueDescription:
      raw === null || raw === undefined || raw === ""
        ? t("报告未提供这个字段值。")
        : definition
          ? t(definition.description)
          : t("未知值，保留后端原值。"),
    knownValue: Boolean(definition),
  };
}

export function semanticFieldPresentation(field: string, raw: unknown): SemanticPresentation {
  const definition = fieldDefinitions[field as SemanticField];
  const value = valuePresentation(raw);
  return {
    field,
    fieldLabel: definition ? t(definition.label) : t("未收录字段"),
    fieldDescription: definition ? t(definition.description) : t("未知字段，保留原字段名。"),
    ...value,
    technicalText: t("技术字段：{field} = {value}", { field, value: value.value }),
    knownField: Boolean(definition),
  };
}

export function semanticValuePresentation(raw: unknown) {
  return valuePresentation(raw);
}

export function backendExplanationPresentation(raw: string | null | undefined): BackendExplanationPresentation {
  if (!raw) return { label: t("后端说明"), text: t("本次报告没有提供说明。"), raw: null, mapped: true };
  const mapped = backendExplanationCopy[raw];
  return mapped
    ? { label: t("后端说明"), text: t(mapped), raw, mapped: true }
    : { label: t("后端原始说明"), text: raw, raw, mapped: false };
}

export function executionLayerName(id: string | undefined) {
  if (!id) return t("未知环节");
  if (id === "S3/S4/S5") return t("三个并列资源模块");
  return compatibilityModuleNames[id] ? t(compatibilityModuleNames[id]) : t("未知环节");
}

export function executionLayerDetail(id: LayerId) {
  return t(layerCopy[id].detail);
}

export function executionLayerHeadline(layer: ExecutionLayer | undefined, value: string) {
  return layer ? t(layerCopy[layer.id].headline, { value }) : "—";
}

export function executionMetricLabel(label: string) {
  const semanticField = executionMetricSemanticField(label);
  if (semanticField) return semanticFieldPresentation(semanticField, undefined).fieldLabel;
  return t(metricLabels[label] || label);
}

export function executionMetricSemanticField(label: string): SemanticField | undefined {
  return metricSemanticFields[label];
}
