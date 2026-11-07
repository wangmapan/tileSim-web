import type { ReplayAvailability, ReplayDocument, ReplayEvent, ReplayStage } from "./types";

export type ReplayLayerKey =
  | "operator"
  | "kernel"
  | "wave"
  | "fragment"
  | "buffer"
  | "execution"
  | "request"
  | "scheduling"
  | "kv"
  | "device"
  | "collective"
  | "fabric"
  | "topology"
  | "output";

export type ReplayLayerVisibility = Record<
  Exclude<ReplayLayerKey, "operator" | "kernel" | "wave" | "fragment" | "buffer">,
  boolean
> &
  Partial<Record<"operator" | "kernel" | "wave" | "fragment" | "buffer", boolean>>;

export interface ReplayLayerDefinition {
  key: ReplayLayerKey;
  label: string;
  description: string;
  source: string;
  availability: ReplayAvailability;
  count: number;
  defaultVisible: boolean;
}

const operatorLayers = new Set<ReplayLayerKey>(["operator", "kernel", "wave", "fragment", "buffer"]);

const definitions: Array<Pick<ReplayLayerDefinition, "key" | "label" | "description" | "source">> = [
  {
    key: "operator",
    label: "算子调用",
    description: "仅显示后端独立报告的算子调用区间",
    source: "request attribution",
  },
  { key: "kernel", label: "Kernel launch", description: "已报告的声明模型启动区间", source: "request attribution" },
  {
    key: "wave",
    label: "Kernel wave",
    description: "未独立报告波次区间时保持 not_covered",
    source: "request attribution",
  },
  { key: "fragment", label: "执行片段", description: "已报告的资源操作和执行片段", source: "request attribution" },
  {
    key: "buffer",
    label: "缓冲生命周期",
    description: "源码 acquire / release 资源操作",
    source: "request attribution",
  },
  { key: "execution", label: "执行阶段", description: "运行阶段与阶段时间区间", source: "execution envelope" },
  {
    key: "request",
    label: "请求指标",
    description: "已报告请求到达至完成区间及指标",
    source: "request attribution metrics",
  },
  { key: "scheduling", label: "调度", description: "准入、批处理与调度事件", source: "runtime event artifact" },
  { key: "kv", label: "KV / 内存", description: "KV 缓存或内存资源事件", source: "runtime event artifact" },
  { key: "device", label: "设备执行", description: "设备计算阶段", source: "execution envelope" },
  { key: "collective", label: "集合通信", description: "集合通信 round / chunk", source: "collective artifact" },
  { key: "fabric", label: "Fabric 路径", description: "已报告的路径与链路事件", source: "execution replay artifact" },
  { key: "topology", label: "拓扑底图", description: "已验证的设备与链路上下文", source: "topology artifact" },
  { key: "output", label: "输出流", description: "token 或输出流事件", source: "output artifact" },
];

const schedulingKinds = new Set(["arrival", "admit", "batch_issue", "scheduling", "batching"]);
const kvKinds = new Set([
  "kv_handoff",
  "kv_handoff_ready",
  "kv_swap_ready",
  "kv_grow",
  "kv_growth",
  "memory_backpressure",
]);

function stageIsDevice(stage: ReplayStage): boolean {
  return stage.subsystem === "S4" || /设备计算|device/i.test(stage.label);
}

function eventMatches(event: ReplayEvent, layer: ReplayLayerKey): boolean {
  const kind = event.kind.trim().toLowerCase();
  if (layer === "scheduling") return schedulingKinds.has(kind) || kind.includes("schedul");
  if (layer === "kv") return kvKinds.has(kind) || kind.startsWith("kv_") || kind.includes("memory");
  return false;
}

export function replayLayerCount(document: ReplayDocument, layer: ReplayLayerKey): number {
  if (operatorLayers.has(layer)) return document.events.filter((e) => e.kind === `operator_${layer}`).length;
  switch (layer) {
    case "execution":
      return document.stages.length;
    case "request":
      return document.events.filter((event) => event.kind === "request_metric").length;
    case "scheduling":
    case "kv":
      return document.events.filter((event) => eventMatches(event, layer)).length;
    case "device":
      return document.stages.filter(stageIsDevice).length;
    case "collective":
      return document.collective.steps.length;
    case "fabric":
      return document.routes.length + document.fabricEvents.length;
    case "topology":
      return document.topology.nodes.length + document.topology.links.length;
    case "output":
      return 0;
    default:
      return 0;
  }
}

export function replayLayerAvailability(document: ReplayDocument, layer: ReplayLayerKey): ReplayAvailability {
  if (operatorLayers.has(layer)) return replayLayerCount(document, layer) ? "available" : "not_covered";
  switch (layer) {
    case "execution":
      return document.stages.length ? "available" : document.coverage.stages;
    case "request":
      return replayLayerCount(document, layer) ? "available" : "not_covered";
    case "scheduling":
    case "kv":
      return replayLayerCount(document, layer) ? "available" : "not_covered";
    case "device":
      return replayLayerCount(document, layer) ? "available" : "not_covered";
    case "collective":
      return document.collective.availability;
    case "fabric":
      return document.coverage.fabricRoutes;
    case "topology":
      return document.topology.availability;
    case "output":
      return "not_covered";
    default:
      return "not_covered";
  }
}

export function replayLayerDefinitions(document: ReplayDocument): ReplayLayerDefinition[] {
  return definitions.map((definition) => {
    const availability = replayLayerAvailability(document, definition.key);
    const count = replayLayerCount(document, definition.key);
    const defaultVisible = [
      "kernel",
      "fragment",
      "buffer",
      "execution",
      "device",
      "fabric",
      "topology",
      "collective",
    ].includes(definition.key);
    return { ...definition, availability, count, defaultVisible };
  });
}

export function defaultReplayLayerVisibility(document: ReplayDocument): ReplayLayerVisibility {
  return Object.fromEntries(
    replayLayerDefinitions(document).map((definition) => [
      definition.key,
      definition.defaultVisible && (definition.count > 0 || definition.availability === "available"),
    ]),
  ) as ReplayLayerVisibility;
}

export function isReplayLayerVisible(
  visibility: Partial<ReplayLayerVisibility> | undefined,
  key: ReplayLayerKey,
): boolean {
  return visibility?.[key] ?? true;
}

export function replayStageLayer(stage: ReplayStage): "execution" | "device" {
  return stageIsDevice(stage) ? "device" : "execution";
}

export function replayEventLayer(event: ReplayEvent): ReplayLayerKey | null {
  if (event.kind === "request_metric") return "request";
  if (event.kind.startsWith("operator_") && operatorLayers.has(event.kind.slice(9) as ReplayLayerKey))
    return event.kind.slice(9) as ReplayLayerKey;
  if (eventMatches(event, "scheduling")) return "scheduling";
  if (eventMatches(event, "kv")) return "kv";
  return null;
}
