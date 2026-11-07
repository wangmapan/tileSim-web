import type { TopologyDevice, TopologyDomain } from "./topology-graph";

/**
 * A compute-group display projection. The legacy function/type name is kept
 * for compatibility, but this is not a backend entity: the backend accepts
 * only devices, domains and links. `group_id` is the ownership key for the
 * display; communication-domain endpoint sets never create another owner.
 */
export type TopologySuperNode = {
  id: string;
  label: string;
  devices: TopologyDevice[];
};

export function topologySuperNodes(
  devices: readonly TopologyDevice[],
  domains: readonly TopologyDomain[],
): TopologySuperNode[] {
  const scaleUpMemberIds = new Set(
    domains.filter((domain) => domain.domain_type === "scale_up").flatMap((domain) => domain.member_devices),
  );
  // `group_id` is the only ownership key. A domain is an endpoint scope and
  // may overlap another domain, so it must never create a second owner box.
  // Devices without group_id follow the backend's default participant group.
  const candidates = devices.filter(
    (device) => Boolean(device.group_id?.trim()) || scaleUpMemberIds.has(device.device_id),
  );
  const grouped = new Map<string, TopologyDevice[]>();
  for (const device of candidates) {
    const key = device.group_id?.trim() || "__default__";
    const members = grouped.get(key) || [];
    members.push(device);
    grouped.set(key, members);
  }
  return [...grouped.entries()].map(([key, members]) => ({
    id: key === "__default__" ? "__default__" : `group::${key}`,
    label: key === "__default__" ? "默认计算组" : key,
    devices: members,
  }));
}

export function superNodeForDevice(
  deviceId: string,
  superNodes: readonly TopologySuperNode[],
): TopologySuperNode | undefined {
  return superNodes.find((node) => node.devices.some((device) => device.device_id === deviceId));
}

export type TopologyConnectionDecision =
  { allowed: true; domain: TopologyDomain; kind: "scale_up" | "scale_out" } | { allowed: false; reason: string };

/**
 * Resolve a user gesture to a backend domain without guessing a domain from
 * array order. Connections inside one visual group are scale_up; connections
 * between two known groups are scale_out. Ambiguous endpoints fail closed.
 */
export function decideTopologyConnection(
  source: string,
  target: string,
  devices: readonly TopologyDevice[],
  domains: readonly TopologyDomain[],
): TopologyConnectionDecision {
  if (source === target) return { allowed: false, reason: "不允许连接设备自身。" };
  const sourceDevice = devices.find((device) => device.device_id === source);
  const targetDevice = devices.find((device) => device.device_id === target);
  if (!sourceDevice || !targetDevice) return { allowed: false, reason: "连接端点必须是已声明设备。" };
  const superNodes = topologySuperNodes(devices, domains);
  const sourceGroup = superNodeForDevice(source, superNodes);
  const targetGroup = superNodeForDevice(target, superNodes);
  // Existing group_id values are a display hint used by shipped scenarios.
  // When they disagree, an explicitly declared scale_out domain wins even if
  // a legacy scale_up domain happens to contain every endpoint.
  if (sourceDevice.group_id && targetDevice.group_id && sourceDevice.group_id !== targetDevice.group_id) {
    const domain = domains.find(
      (candidate) =>
        candidate.domain_type === "scale_out" &&
        candidate.member_devices.includes(source) &&
        candidate.member_devices.includes(target),
    );
    if (domain) return { allowed: true, domain, kind: "scale_out" };
  }
  if (sourceGroup && targetGroup && sourceGroup.id === targetGroup.id) {
    const domain = domains.find(
      (candidate) =>
        candidate.domain_type === "scale_up" &&
        candidate.member_devices.includes(source) &&
        candidate.member_devices.includes(target),
    );
    return domain
      ? { allowed: true, domain, kind: "scale_up" }
      : { allowed: false, reason: "这个计算组还没有覆盖两个端点的组内通信域。" };
  }
  if (sourceGroup && targetGroup && sourceGroup.id !== targetGroup.id) {
    const domain = domains.find(
      (candidate) =>
        candidate.domain_type === "scale_out" &&
        candidate.member_devices.includes(source) &&
        candidate.member_devices.includes(target),
    );
    return domain
      ? { allowed: true, domain, kind: "scale_out" }
      : { allowed: false, reason: "两个计算节点组之间还没有共同的跨机网络域。" };
  }
  return {
    allowed: false,
    reason: "请先把设备加入计算节点组，再连接节点组之间的跨机网络。",
  };
}
