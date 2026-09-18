import type {
  AttributionItem,
  CauseItem,
  ExecutionStage,
  FidelityResolution,
  ImplementationEntry,
  ResourceConvergence,
  ValidationCheck,
} from "../../../contracts/report-model";

export type LayerId = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";

export interface LayerDefinition {
  id: LayerId;
  name: string;
  title: string;
  role: string;
}

export interface ExecutionFact {
  label: string;
  value: unknown;
  unit: string;
  sourcePath?: string;
}

export interface ExecutionStat extends ExecutionFact {
  hint: string;
}

export interface ExecutionRecord {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  sourcePath?: string;
  facts: ExecutionFact[];
}

export interface VisualizationRow {
  label: string;
  values: Array<string | number | null>;
  rawValues?: string[];
  sourcePath?: string | null;
  valueSourcePaths?: Array<string | null>;
  status?: string;
  detail?: string;
}

export interface VisualizationSeries {
  name: string;
  color?: string;
}

export type LayerVisualizationKind = "none" | "matrix" | "bar" | "stacked-bar" | "scatter" | "timeline";

export interface LayerVisualization {
  id: string;
  kind: LayerVisualizationKind;
  title: string;
  description: string;
  question: string;
  firstLook: string;
  boundary: string;
  rationale: string;
  unit: string;
  sourcePaths: string[];
  derivation: "identity" | "display_group" | "display_sum" | "unit_conversion";
  columns: string[];
  rawColumns?: string[];
  rawUnit?: string;
  series: VisualizationSeries[];
  rows: VisualizationRow[];
  emptyReason?: string;
}

export interface ExecutionLayer extends LayerDefinition {
  resolution: FidelityResolution | null;
  implementation: ImplementationEntry | null;
  stage: ExecutionStage | null;
  records: ExecutionRecord[];
  visualizations: LayerVisualization[];
  stats: ExecutionStat[];
  checks: ValidationCheck[];
  attribution: AttributionItem[];
  evidenceState: string;
  headline: ExecutionStat;
  source: string;
  detail: string;
}

export interface ExecutionResult {
  layers: ExecutionLayer[];
  stages: ExecutionStage[];
  resourceConvergence: ResourceConvergence | null;
  causeChain: CauseItem[];
  observationWindow: Record<string, unknown> | null;
  timeline: LayerVisualization;
}

export const layerDefinitions: LayerDefinition[] = [
  {
    id: "S0",
    name: "Workload",
    title: "工作负载抽象与负载描述语言模块",
    role: "本次运行的输入边界",
  },
  { id: "S1", name: "Runtime", title: "推理引擎与服务运行时模块", role: "调度、批处理与请求推进" },
  { id: "S2", name: "Execution", title: "执行语义建模模块", role: "把运行时输出转换为资源语义" },
  { id: "S3", name: "Memory / KV", title: "KV Cache 建模模块", role: "KV 分配、增长与内存延迟" },
  { id: "S4", name: "Device", title: "设备性能建模模块", role: "设备任务、profile 与执行延迟" },
  { id: "S5", name: "Collective", title: "集合通信语义模块", role: "collective 与通信 phase 语义" },
  { id: "S6", name: "Fabric", title: "网络与硬件资源模块", role: "链路排队、拥塞与执行记录" },
];
