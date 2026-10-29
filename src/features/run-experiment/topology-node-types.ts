/**
 * Editor vocabulary for physical topology nodes.
 *
 * `device_type` is intentionally still an open string in the contract. These
 * presets only make the common topology roles discoverable; they do not claim
 * that every role is an executable participant in the simulator.
 */
export type TopologyNodeCategory = "compute" | "host" | "network" | "storage" | "unknown";

export type TopologyNodeType = {
  value: string;
  label: string;
  prefix: string;
  category: TopologyNodeCategory;
  participant: boolean;
};

export const TOPOLOGY_NODE_TYPES: readonly TopologyNodeType[] = [
  { value: "GPU", label: "GPU", prefix: "gpu", category: "compute", participant: true },
  { value: "CPU", label: "CPU 主机", prefix: "host", category: "host", participant: false },
  { value: "NIC", label: "网卡", prefix: "nic", category: "network", participant: false },
  { value: "Switch", label: "交换机", prefix: "sw", category: "network", participant: false },
  { value: "Router", label: "路由器", prefix: "rtr", category: "network", participant: false },
  { value: "Bridge", label: "网络桥", prefix: "br", category: "network", participant: false },
  { value: "Storage", label: "存储", prefix: "storage", category: "storage", participant: false },
];

const byValue = new Map(TOPOLOGY_NODE_TYPES.map((entry) => [entry.value.toLowerCase(), entry]));

export function topologyNodeType(value: unknown): TopologyNodeType {
  const raw = typeof value === "string" ? value.trim() : "";
  return (
    byValue.get(raw.toLowerCase()) || {
      value: raw || "Unknown",
      label: raw || "未知节点",
      prefix: "node",
      category: "unknown",
      participant: false,
    }
  );
}

export function topologyNodeCategory(value: unknown): TopologyNodeCategory {
  return topologyNodeType(value).category;
}

export function topologyNodeLabel(value: unknown): string {
  return topologyNodeType(value).label;
}

export function isTopologyParticipant(value: unknown): boolean {
  return topologyNodeType(value).participant;
}
