/**
 * Editor vocabulary for physical topology nodes.
 *
 * `device_type` is intentionally still an open string in the input contract.
 * The add menu is separate from display metadata and is built only from the
 * topology_node_types capability published by the connected backend.
 */
export type TopologyNodeCategory = "compute" | "host" | "network" | "storage" | "unknown";

export type TopologyNodeType = {
  value: string;
  label: string;
  prefix: string;
  category: TopologyNodeCategory;
  participant: boolean;
};

export type TopologyNodeCapability = {
  device_type: string;
  role: string;
  id_prefix: string;
  participant: boolean;
};

type CapabilitiesWithTopology =
  | {
      topology_node_types?: unknown;
    }
  | null
  | undefined;

function categoryOfRole(role: string): TopologyNodeCategory {
  if (role === "compute") return "compute";
  if (role === "host") return "host";
  if (role === "network") return "network";
  if (role === "storage") return "storage";
  return "unknown";
}

function labelOfDeviceType(deviceType: string): string {
  if (deviceType.toLowerCase() === "gpu") return "GPU";
  if (deviceType.toLowerCase() === "switch") return "交换机";
  return deviceType;
}

/**
 * Converts the connected runtime's declared node capabilities into add-menu
 * entries. Invalid, missing, or legacy capability payloads intentionally
 * produce an empty list so the UI cannot invent backend support.
 */
export function topologyNodeTypesFromCapabilities(capabilities: CapabilitiesWithTopology): readonly TopologyNodeType[] {
  if (!capabilities || !Array.isArray(capabilities.topology_node_types)) return [];
  const seen = new Set<string>();
  const result: TopologyNodeType[] = [];
  for (const item of capabilities.topology_node_types) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const candidate = item as Record<string, unknown>;
    const value = typeof candidate.device_type === "string" ? candidate.device_type.trim() : "";
    const role = typeof candidate.role === "string" ? candidate.role.trim() : "";
    const prefix = typeof candidate.id_prefix === "string" ? candidate.id_prefix.trim() : "";
    if (!value || !role || !prefix || typeof candidate.participant !== "boolean") continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      value,
      label: labelOfDeviceType(value),
      prefix,
      category: categoryOfRole(role),
      participant: candidate.participant,
    });
  }
  return result;
}

/** Known display metadata for existing/custom topology strings. */
const TOPOLOGY_NODE_DISPLAY_TYPES: readonly TopologyNodeType[] = [
  { value: "CPU", label: "CPU 主机", prefix: "host", category: "host", participant: false },
  { value: "GPU", label: "GPU", prefix: "gpu", category: "compute", participant: true },
  { value: "NIC", label: "网卡", prefix: "nic", category: "network", participant: false },
  { value: "Router", label: "路由器", prefix: "rtr", category: "network", participant: false },
  { value: "Bridge", label: "网络桥", prefix: "br", category: "network", participant: false },
  { value: "Storage", label: "存储", prefix: "storage", category: "storage", participant: false },
  { value: "Switch", label: "交换机", prefix: "sw", category: "network", participant: false },
];

const byValue = new Map(TOPOLOGY_NODE_DISPLAY_TYPES.map((entry) => [entry.value.toLowerCase(), entry]));

export function topologyNodeType(value: unknown, availableTypes?: readonly TopologyNodeType[]): TopologyNodeType {
  const raw = typeof value === "string" ? value.trim() : "";
  const published = availableTypes?.find((entry) => entry.value.toLowerCase() === raw.toLowerCase());
  if (published) return published;
  if (availableTypes !== undefined) {
    return {
      value: raw || "Unknown",
      label: raw || "未知节点",
      prefix: "node",
      category: "unknown",
      participant: false,
    };
  }
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

export function topologyNodeCategory(
  value: unknown,
  availableTypes?: readonly TopologyNodeType[],
): TopologyNodeCategory {
  return topologyNodeType(value, availableTypes).category;
}

export function topologyNodeLabel(value: unknown, availableTypes?: readonly TopologyNodeType[]): string {
  return topologyNodeType(value, availableTypes).label;
}

export function isTopologyParticipant(value: unknown, availableTypes?: readonly TopologyNodeType[]): boolean {
  return topologyNodeType(value, availableTypes).participant;
}
