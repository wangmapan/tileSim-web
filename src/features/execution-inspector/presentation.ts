import { t } from "../../i18n";
import type { ExecutionLayer, LayerId } from "./model/types";

const layerCopy: Record<LayerId, { name: string; detail: string; headline: string }> = {
  S0: {
    name: "输入与请求",
    detail: "说明本次实验接收了哪些请求和输入。",
    headline: "输入范围：{value}",
  },
  S1: {
    name: "调度与运行",
    detail: "说明请求如何排队、分批并进入执行。",
    headline: "{value} 条调度记录",
  },
  S2: {
    name: "计算步骤",
    detail: "说明请求被拆成了哪些计算步骤。",
    headline: "模拟精度：{value}",
  },
  S3: {
    name: "内存与 KV",
    detail: "说明 KV 缓存和内存的使用情况。",
    headline: "{value} 条内存记录",
  },
  S4: {
    name: "设备计算",
    detail: "说明设备上执行了哪些计算任务。",
    headline: "{value} 个计算任务",
  },
  S5: {
    name: "多设备协同",
    detail: "说明多个设备之间如何协同通信。",
    headline: "{value} 条协同记录",
  },
  S6: {
    name: "网络与通信",
    detail: "说明网络传输、排队和拥塞情况。",
    headline: "{value} 条网络记录",
  },
};

const metricLabels: Record<string, string> = {
  "Runtime events": "调度记录",
  "Memory events": "内存记录",
  "Device tasks": "计算任务",
  Collectives: "协同通信记录",
  "Fabric records": "网络记录",
};

export function executionLayerName(id: string | undefined) {
  return id && id in layerCopy ? t(layerCopy[id as LayerId].name) : t("未知环节");
}

export function executionLayerDetail(id: LayerId) {
  return t(layerCopy[id].detail);
}

export function executionLayerHeadline(layer: ExecutionLayer | undefined, value: string) {
  return layer ? t(layerCopy[layer.id].headline, { value }) : "—";
}

export function executionMetricLabel(label: string) {
  return t(metricLabels[label] || label);
}
