import { topologyNodeCategory } from "./topology-node-types";
import type { TopologyDevice, TopologyDomain, TopologyLink } from "./topology-graph";

export type LayoutPosition = { x: number; y: number };

/** Deterministic, dependency-free graph layout for the topology editor. */
const CANVAS_WIDTH = 760;
const MIN_X = 82;
const MAX_X = CANVAS_WIDTH - MIN_X;
const NODE_HEIGHT = 72;
const ROW_GAP = 106;
const COMPONENT_GAP = 92;
const DISCONNECTED_GAP = 76;
const MAX_COLUMNS = 4;

function isBackbone(device: TopologyDevice): boolean {
  const category = topologyNodeCategory(device.device_type);
  return category === "network" && /switch|router|bridge/i.test(device.device_type || "");
}

function byId(left: TopologyDevice, right: TopologyDevice): number {
  return left.device_id.localeCompare(right.device_id, undefined, { numeric: true });
}

function connectedComponents(devices: TopologyDevice[], links: TopologyLink[]): TopologyDevice[][] {
  const byDevice = new Map(devices.map((device) => [device.device_id, device]));
  const adjacency = new Map<string, Set<string>>();
  devices.forEach((device) => adjacency.set(device.device_id, new Set()));
  links.forEach((link) => {
    if (!byDevice.has(link.src_device) || !byDevice.has(link.dst_device)) return;
    adjacency.get(link.src_device)?.add(link.dst_device);
    adjacency.get(link.dst_device)?.add(link.src_device);
  });
  const visited = new Set<string>();
  const components: TopologyDevice[][] = [];
  [...devices].sort(byId).forEach((start) => {
    if (visited.has(start.device_id)) return;
    const queue = [start.device_id];
    const component: TopologyDevice[] = [];
    visited.add(start.device_id);
    while (queue.length) {
      const id = queue.shift() as string;
      const device = byDevice.get(id);
      if (device) component.push(device);
      [...(adjacency.get(id) || [])].sort().forEach((next) => {
        if (visited.has(next)) return;
        visited.add(next);
        queue.push(next);
      });
    }
    components.push(component.sort(byId));
  });
  return components.sort((left, right) => {
    const leftConnected = left.length > 1;
    const rightConnected = right.length > 1;
    if (leftConnected !== rightConnected) return leftConnected ? -1 : 1;
    if (left.length !== right.length) return right.length - left.length;
    return byId(left[0], right[0]);
  });
}

function makeAdjacency(devices: TopologyDevice[], links: TopologyLink[]) {
  const ids = new Set(devices.map((device) => device.device_id));
  const adjacency = new Map<string, Set<string>>();
  devices.forEach((device) => adjacency.set(device.device_id, new Set()));
  links.forEach((link) => {
    if (!ids.has(link.src_device) || !ids.has(link.dst_device)) return;
    adjacency.get(link.src_device)?.add(link.dst_device);
    adjacency.get(link.dst_device)?.add(link.src_device);
  });
  return adjacency;
}

function edgeCountFor(device: TopologyDevice, links: TopologyLink[], ids: Set<string>) {
  return links.reduce(
    (count, link) =>
      count +
      (ids.has(link.src_device) &&
      ids.has(link.dst_device) &&
      (link.src_device === device.device_id || link.dst_device === device.device_id)
        ? 1
        : 0),
    0,
  );
}

function columnsFor(size: number, compact: boolean): number {
  if (size <= 1) return 1;
  if (compact && size === 2) return 1;
  if (compact && size <= 4) return 2;
  return Math.min(MAX_COLUMNS, Math.max(2, Math.ceil(Math.sqrt(size))));
}

function xFor(index: number, count: number): number {
  if (count <= 1) return CANVAS_WIDTH / 2;
  const gap = Math.min(184, (MAX_X - MIN_X) / Math.max(1, count - 1));
  const width = gap * (count - 1);
  return Math.max(MIN_X, Math.min(MAX_X, (CANVAS_WIDTH - width) / 2 + index * gap));
}

function orderLayer(
  items: TopologyDevice[],
  previous: TopologyDevice[],
  adjacency: Map<string, Set<string>>,
  links: TopologyLink[],
): TopologyDevice[] {
  if (!previous.length) {
    const ids = new Set(items.map((device) => device.device_id));
    return [...items].sort(
      (left, right) => edgeCountFor(right, links, ids) - edgeCountFor(left, links, ids) || byId(left, right),
    );
  }
  const previousIndex = new Map(previous.map((device, index) => [device.device_id, index]));
  const score = (device: TopologyDevice) => {
    const neighbors = [...(adjacency.get(device.device_id) || [])]
      .map((id) => previousIndex.get(id))
      .filter((index): index is number => index !== undefined);
    return neighbors.length
      ? neighbors.reduce((sum, value) => sum + value, 0) / neighbors.length
      : Number.MAX_SAFE_INTEGER;
  };
  return [...items].sort((left, right) => score(left) - score(right) || byId(left, right));
}

function rowsFromLayers(
  component: TopologyDevice[],
  links: TopologyLink[],
  adjacency: Map<string, Set<string>>,
): TopologyDevice[][] {
  const backbone = component.filter(isBackbone).sort(byId);
  const network = component.filter(
    (device) => topologyNodeCategory(device.device_type) === "network" && !isBackbone(device),
  );
  const endpoints = component.filter((device) => !backbone.includes(device) && !network.includes(device));
  if (backbone.length || network.length) {
    const first = orderLayer(backbone, [], adjacency, links);
    const second = orderLayer(network, first.length ? first : [], adjacency, links);
    const third = orderLayer(endpoints, second.length ? second : first, adjacency, links);
    return [first, second, third].filter((row) => row.length > 0);
  }
  // Keep peer fabrics stable by device id. In particular, a cross-domain
  // edge such as gpu0↔gpu2 then naturally spans the two grid rows instead of
  // collapsing both endpoints onto one horizontal line.
  const ordered = [...component].sort(byId);
  const columns = columnsFor(ordered.length, true);
  const rows: TopologyDevice[][] = [];
  for (let index = 0; index < ordered.length; index += columns) rows.push(ordered.slice(index, index + columns));
  return rows;
}

function placeRows(result: Record<string, LayoutPosition>, rows: TopologyDevice[][], startY: number) {
  rows.forEach((row, rowIndex) => {
    const y = startY + rowIndex * (NODE_HEIGHT + ROW_GAP);
    row.forEach((device, index) => {
      result[device.device_id] = { x: xFor(index, row.length), y };
    });
  });
  return Math.max(1, rows.length) * NODE_HEIGHT + Math.max(0, rows.length - 1) * ROW_GAP;
}

/**
 * Connected components receive separate vertical bands. Network fabric is
 * placed above adapters/endpoints; peer-only GPU fabrics become a 2×2 grid;
 * isolated devices are collected in a final unconnected band.
 */
export function layoutTopology(
  devices: readonly TopologyDevice[],
  links: readonly TopologyLink[],
  domains: readonly TopologyDomain[] = [],
): Record<string, LayoutPosition> {
  void domains;
  const result: Record<string, LayoutPosition> = {};
  const allDevices = [...devices];
  const allLinks = [...links];
  const components = connectedComponents(allDevices, allLinks);
  // Leave a quiet top rail for edge labels. The previous 76px start put the
  // first row directly under the toolbar and forced labels into card text.
  let y = 170;
  const disconnected: TopologyDevice[] = [];
  components.forEach((component) => {
    const adjacency = makeAdjacency(component, allLinks);
    const connected = component.some((device) => (adjacency.get(device.device_id)?.size || 0) > 0);
    if (!connected) {
      disconnected.push(...component);
      return;
    }
    const height = placeRows(result, rowsFromLayers(component, allLinks, adjacency), y);
    y += height + COMPONENT_GAP;
  });
  if (disconnected.length) {
    const rows: TopologyDevice[][] = [];
    const ordered = [...disconnected].sort(byId);
    for (let index = 0; index < ordered.length; index += MAX_COLUMNS)
      rows.push(ordered.slice(index, index + MAX_COLUMNS));
    const lastPlacedY = Math.max(...Object.values(result).map((position) => position.y), 0);
    // Park isolated devices immediately after the last real graph row. Using
    // the accumulated component height here used to leave a visually empty
    // band and pushed a lone host far below a small GPU graph.
    const disconnectedY = Object.keys(result).length ? lastPlacedY + NODE_HEIGHT + DISCONNECTED_GAP : 170;
    placeRows(result, rows, disconnectedY);
  }
  return result;
}
