/**
 * Read-only adapter for the Fabric timeline emitted by TileSim.
 *
 * The backend owns route selection and failure semantics. This module only
 * indexes the returned JSON, preserving uint64 values as unknown/string-like
 * values and never inferring a route from topology configuration.
 */

export type FabricRouteState = "connected" | "route_unavailable" | "partial" | "unavailable";

export interface FabricRouteRecord {
  request_id?: unknown;
  phase_id?: unknown;
  domain_id?: unknown;
  module_id?: unknown;
  module_kind?: unknown;
  fidelity_level?: unknown;
  start_time_ps?: unknown;
  finish_time_ps?: unknown;
  queue_delay_ps?: unknown;
  congestion_delay_ps?: unknown;
  transfers_executed?: unknown;
  end_to_end_latency_us?: unknown;
  actual_path?: unknown;
  link_endpoints?: unknown;
  execution_events?: unknown;
  resource_annotations?: unknown;
  fallback_reason?: unknown;
  [key: string]: unknown;
}

export interface FabricModuleStat {
  module_id?: unknown;
  domain_id?: unknown;
  module_kind?: unknown;
  fidelity_level?: unknown;
  transfers_executed?: unknown;
  total_bytes?: unknown;
  total_runtime_us?: unknown;
  [key: string]: unknown;
}

export interface FabricRouteEvidence {
  state: FabricRouteState;
  records: FabricRouteRecord[];
  /** Original indexes in evidence.fabric.timeline for stable evidence links. */
  recordIndexes: number[];
  moduleStats: FabricModuleStat[];
  fallbackReasons: string[];
  topologyLinkCount: number | null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function routePath(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function linkMap(value: unknown): Record<string, unknown> {
  return record(value);
}

function topologyLinkCount(value: unknown): number | null {
  const root = record(value);
  const topology = record(root.topology);
  const links = topology.links;
  return Array.isArray(links) ? links.length : null;
}

function fabricRoot(payload: unknown): Record<string, unknown> {
  const root = record(payload);
  const evidence = record(root.evidence);
  return record(evidence.fabric);
}

export function buildFabricRouteEvidence(
  payload: unknown,
  requestId?: string | null,
  topologyInput?: unknown,
): FabricRouteEvidence {
  const fabric = fabricRoot(payload);
  const allTimeline = Array.isArray(fabric.timeline)
    ? (fabric.timeline.filter((item) => item && typeof item === "object") as FabricRouteRecord[])
    : [];
  const recordIndexes = allTimeline.reduce<number[]>((indexes, item, index) => {
    if (!requestId || stringValue(item.request_id) === requestId) indexes.push(index);
    return indexes;
  }, []);
  const records = recordIndexes.map((index) => allTimeline[index]).filter(Boolean);
  const fallbackReasons = (Array.isArray(fabric.fallback_reasons) ? fabric.fallback_reasons : [])
    .filter((item): item is string => typeof item === "string")
    .filter((item, index, list) => list.indexOf(item) === index);
  // fallback_reasons is an aggregate report field. Once a request is selected,
  // only a reason attached to that request's record may change its state; a
  // different request must not make this request look failed.
  const routeUnavailable =
    records.some((item) => {
      const annotations = record(item.resource_annotations);
      return (
        stringValue(item.fallback_reason).includes("route_unavailable") ||
        stringValue(annotations.fabric_condition).includes("route_unavailable")
      );
    }) ||
    (!requestId && fallbackReasons.some((reason) => reason.includes("route_unavailable")));
  const hasConnectedRecord = records.some(
    (item) => routePath(item.actual_path).length >= 2 && Object.keys(linkMap(item.link_endpoints)).length > 0,
  );
  const hasIncompleteRecord = records.some(
    (item) => routePath(item.actual_path).length === 0 || Object.keys(linkMap(item.link_endpoints)).length === 0,
  );
  const moduleStats = (Array.isArray(fabric.module_stats) ? fabric.module_stats : [])
    .filter((item): item is FabricModuleStat => Boolean(item) && typeof item === "object")
    .filter((item) => {
      if (!requestId) return true;
      // Module stats are aggregate records and generally have no request_id.
      // Keep them when the selected request has a matching domain, without
      // claiming that aggregate counters belong to a single request.
      const domains = new Set(records.map((entry) => stringValue(entry.domain_id)).filter(Boolean));
      return !stringValue(item.domain_id) || domains.has(stringValue(item.domain_id));
    });
  const state: FabricRouteState = routeUnavailable
    ? "route_unavailable"
    : hasConnectedRecord && hasIncompleteRecord
      ? "partial"
      : hasConnectedRecord
        ? "connected"
        : records.length
          ? "partial"
          : "unavailable";
  return {
    state,
    records,
    recordIndexes,
    moduleStats,
    fallbackReasons,
    topologyLinkCount: topologyLinkCount(topologyInput),
  };
}

export function routePathText(value: unknown): string {
  const path = routePath(value)
    .map((item) => String(item))
    .filter(Boolean);
  return path.length ? path.join(" → ") : "";
}

export function linkEndpointEntries(value: unknown): Array<{ id: string; source: string; destination: string }> {
  return Object.entries(linkMap(value)).map(([id, endpoints]) => {
    const entry = record(endpoints);
    return { id, source: stringValue(entry.source), destination: stringValue(entry.destination) };
  });
}

export function executionEventCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}
