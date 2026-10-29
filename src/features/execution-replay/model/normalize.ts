import { isLosslessInteger, losslessIntegerToBigInt } from "../../../contracts/lossless-json";
import { buildReplayCoverage, payloadAvailability, payloadValue } from "./coverage";
import type {
  ReplayAvailability,
  ReplayArtifactPayload,
  ReplayCollectiveModel,
  ReplayCollectiveStep,
  ReplayDocument,
  ReplayFabricEvent,
  ReplayEvent,
  ReplayNormalizeInput,
  ReplayRoute,
  ReplayRouteState,
  ReplayStage,
  ReplayTopology,
} from "./types";

const eventLabels: Record<string, string> = {
  arrival: "到达",
  admit: "准入",
  batch_issue: "批次发出",
  decode_step: "解码步骤",
  kv_handoff: "KV 交接",
  swap_ready: "交换就绪",
  kv_swap_ready: "交换就绪",
  kv_handoff_ready: "KV 交接就绪",
  memory_backpressure: "内存背压",
  memory_backpressure_active: "内存背压",
  fabric_backpressure: "通信背压",
  fabric_backpressure_active: "通信背压",
  backpressure: "背压",
  kv_grow: "KV 增长",
  kv_growth: "KV 增长",
  complete: "完成",
  reject: "拒绝",
};

const fabricEventLabels: Record<string, string> = {
  route_selected: "选择路由",
  enqueue: "入队",
  credit_wait: "等待信用额度",
  dequeue: "出队",
  service_start: "服务开始",
  service_complete: "服务完成",
  packet_loss: "丢包",
  retransmission: "重传",
  credit_return: "返还 credit",
  transfer_complete: "传输完成",
};

const stageKindLabels: Record<string, string> = {
  request: "请求处理",
  request_arrival: "请求到达",
  arrival: "请求到达",
  ingress: "请求进入",
  admit: "请求准入",
  admission: "请求准入",
  batch_issue: "批处理调度",
  batching: "批处理调度",
  batch_scheduler: "批处理调度",
  scheduling: "运行时调度",
  runtime: "运行时调度",
  runtime_scheduler: "运行时调度",
  serving: "服务执行",
  prefill: "预填充计算",
  decode: "解码生成",
  decode_step: "解码生成",
  kv: "KV 缓存处理",
  kv_cache: "KV 缓存处理",
  kv_handoff: "KV 缓存交接",
  memory: "内存访问",
  memory_access: "内存访问",
  memory_backpressure: "内存背压",
  device: "设备计算",
  device_compute: "设备计算",
  collective: "集合通信",
  allreduce: "AllReduce 集合通信",
  all_reduce: "AllReduce 集合通信",
  allgather: "AllGather 集合通信",
  all_gather: "AllGather 集合通信",
  communication: "互联通信",
  fabric: "互联通信",
  fabric_transfer: "互联传输",
  network: "网络传输",
  network_transfer: "网络传输",
  completion: "执行完成",
  complete: "执行完成",
  output: "结果输出",
  result: "结果输出",
};

const collectivePhaseLabels: Record<string, string> = {
  allreduce: "AllReduce（全归约）",
  all_reduce: "AllReduce（全归约）",
  allgather: "AllGather（全收集）",
  all_gather: "AllGather（全收集）",
  reduce_scatter: "Reduce-Scatter（归约分发）",
  reducescatter: "Reduce-Scatter（归约分发）",
  broadcast: "Broadcast（广播）",
  alltoall: "AllToAll（全交换）",
  all_to_all: "AllToAll（全交换）",
};

const subsystemLabels: Record<string, string> = {
  S0: "工作负载输入",
  S1: "推理运行时",
  S2: "执行语义",
  S3: "KV / 内存资源",
  S4: "设备计算",
  S5: "集合通信",
  "S3/S4/S5": "并列资源环节",
  S6: "网络与硬件",
  S7: "统一执行宿主",
  S8: "校准与验证",
  S9: "指标归因",
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length ? value : undefined;
}

function integerString(value: unknown): string | null {
  if (!isLosslessInteger(value)) return null;
  const normalized = String(value);
  return normalized.startsWith("-") ? null : normalized;
}

function arrayValue(value: unknown, key: string): unknown[] {
  const candidate = record(value)[key];
  return Array.isArray(candidate) ? candidate : [];
}

function objectEntries(value: unknown): Array<[string, Record<string, unknown>]> {
  return Object.entries(record(value)).flatMap(([id, item]) => {
    const entry = record(item);
    return Object.keys(entry).length ? [[id, entry]] : [];
  });
}

function unwrapPayload(
  payload: ReplayArtifactPayload | unknown | null | undefined,
  fallbackArtifactId = "runtime-events",
): {
  value: unknown;
  availability: ReplayAvailability;
  artifactId: string;
  schemaIdentity?: string;
} {
  return {
    value: payloadValue(payload),
    availability: payloadAvailability(payload),
    artifactId:
      payload && typeof payload === "object" && "artifactId" in payload
        ? String((payload as ReplayArtifactPayload).artifactId)
        : fallbackArtifactId,
    schemaIdentity:
      payload && typeof payload === "object" && "schemaIdentity" in payload
        ? String((payload as ReplayArtifactPayload).schemaIdentity)
        : undefined,
  };
}

function runBinding(payload: unknown, runId: string | null): ReplayAvailability | null {
  if (!runId || payload == null) return null;
  const root = record(payload);
  if (!Object.keys(root).length) return "unsupported_schema";
  const payloadRunId = stringValue(root.run_id);
  return payloadRunId === runId ? null : "unsupported_schema";
}

function normalizeStageToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function stageKindLabel(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/[\u3400-\u9fff]/.test(value)) return value;
  const token = normalizeStageToken(value);
  if (stageKindLabels[token]) return stageKindLabels[token];
  const matched = Object.entries(stageKindLabels).find(([key]) => token.includes(key));
  return matched?.[1];
}

function collectivePhaseLabel(value: unknown): string | undefined {
  const raw = stringValue(value);
  if (!raw) return undefined;
  if (/[\u3400-\u9fff]/.test(raw)) return raw;
  const token = normalizeStageToken(raw);
  return collectivePhaseLabels[token] || raw;
}

export function executionSubsystemLabel(value: string | undefined): string {
  return (value && subsystemLabels[value]) || "未报告";
}

function stageLabel(stage: Record<string, unknown>): string {
  const title = stringValue(stage.title);
  const stageKind = stringValue(stage.stage_kind);
  const functionName = stringValue(stage.function_name) || stringValue(stage.function);
  const phase = stringValue(stage.phase);
  const subsystemLabel = executionSubsystemLabel(stringValue(stage.subsystem));
  return (
    stageKindLabel(title) ||
    stageKindLabel(stageKind) ||
    stageKindLabel(functionName) ||
    stageKindLabel(phase) ||
    stageKindLabel(stringValue(stage.stage_id)) ||
    (subsystemLabel !== "未报告" ? subsystemLabel : undefined) ||
    "执行阶段"
  );
}

function normalizeStage(stage: unknown, index: number): ReplayStage {
  if (!stage || typeof stage !== "object" || Array.isArray(stage)) {
    return {
      stageId: `stage-${index}`,
      label: "执行阶段",
      sourcePath: `execution-envelope:/stages/${index}`,
      sourceArtifact: "execution-envelope",
      availability: "unsupported_schema",
    };
  }
  const raw = record(stage);
  const start = integerString(raw.start_time_ps);
  const end = integerString(raw.end_time_ps);
  const point = start || end;
  const availability: ReplayAvailability =
    start && end && losslessIntegerToBigInt(end) >= losslessIntegerToBigInt(start)
      ? "available"
      : point
        ? "partial"
        : "missing";
  return {
    stageId: stringValue(raw.stage_id) || `stage-${index}`,
    label: stageLabel(raw),
    subsystem: stringValue(raw.subsystem),
    timing: availability === "available" ? { startPs: start!, endPs: end! } : undefined,
    pointPs: availability === "partial" ? point || undefined : undefined,
    sourcePath: `execution-envelope:/stages/${index}`,
    sourceArtifact: "execution-envelope",
    availability,
    detail: stringValue(raw.detail),
  };
}

function normalizeTopology(input: unknown, runId: string | null): ReplayTopology {
  const value = payloadValue(input);
  const sourceArtifact =
    input && typeof input === "object" && "artifactId" in input
      ? String((input as ReplayArtifactPayload).artifactId)
      : "input-topology";
  const schemaIdentity =
    input && typeof input === "object" && "schemaIdentity" in input
      ? String((input as ReplayArtifactPayload).schemaIdentity)
      : undefined;
  const sourcePath = `${sourceArtifact}:/topology`;
  const availability = payloadAvailability(input);
  if (availability !== "available") return { availability, nodes: [], links: [], sourcePath, sourceArtifact };
  const root = record(value);
  if (
    runBinding(root, runId) ||
    root.schema_version !== "tilesim.s6_topology_input.v1" ||
    (schemaIdentity !== undefined && schemaIdentity !== "tilesim.s6_topology_input.v1")
  ) {
    return { availability: "unsupported_schema", nodes: [], links: [], sourcePath, sourceArtifact };
  }
  const topology = record(root.topology);
  if (!Array.isArray(topology.devices))
    return { availability: "unsupported_schema", nodes: [], links: [], sourcePath, sourceArtifact };
  const nodes = arrayValue(topology, "devices").flatMap((item, index) => {
    const device = record(item);
    const id = stringValue(device.device_id);
    return id
      ? [
          {
            id,
            label: stringValue(device.name) || id,
            deviceType: stringValue(device.device_type),
            sourcePath: `${sourceArtifact}:/topology/devices/${index}`,
          },
        ]
      : [];
  });
  const malformedDeviceCount = arrayValue(topology, "devices").length - nodes.length;
  const duplicateNodeIds = nodes.length !== new Set(nodes.map((node) => node.id)).size;
  if (!nodes.length) return { availability: "partial", nodes: [], links: [], sourcePath, sourceArtifact };
  const uniqueNodes = nodes.filter((node, index) => nodes.findIndex((candidate) => candidate.id === node.id) === index);
  const links = arrayValue(topology, "links").flatMap((item, index) => {
    const link = record(item);
    const id = stringValue(link.link_id);
    const source = stringValue(link.src_device) || stringValue(link.source);
    const destination = stringValue(link.dst_device) || stringValue(link.destination);
    return id && source && destination
      ? [
          {
            id,
            source,
            destination,
            domainId: stringValue(link.domain_id),
            sourcePath: `${sourceArtifact}:/topology/links/${index}`,
          },
        ]
      : [];
  });
  const malformedLinkCount = arrayValue(topology, "links").length - links.length;
  const duplicateLinkIds = links.length !== new Set(links.map((link) => link.id)).size;
  const uniqueLinks = links.filter((link, index) => links.findIndex((candidate) => candidate.id === link.id) === index);
  const nodeIds = new Set(uniqueNodes.map((node) => node.id));
  const validLinks = uniqueLinks.filter((link) => nodeIds.has(link.source) && nodeIds.has(link.destination));
  return {
    availability:
      malformedDeviceCount ||
      duplicateNodeIds ||
      malformedLinkCount ||
      duplicateLinkIds ||
      validLinks.length !== uniqueLinks.length
        ? "partial"
        : "available",
    nodes: uniqueNodes,
    links: validLinks,
    sourcePath,
    sourceArtifact,
  };
}

function routeFallback(value: Record<string, unknown>): boolean {
  const annotations = record(value.resource_annotations);
  return (
    (stringValue(value.fallback_reason) || "").includes("route_unavailable") ||
    (stringValue(annotations.fabric_condition) || "").includes("route_unavailable")
  );
}

function routePath(value: unknown): string[] {
  // A malformed path must never be compacted into a shorter, apparently valid
  // hop sequence. For example, ["gpu-0", 7, "gpu-1"] must not become a
  // fabricated direct gpu-0 → gpu-1 path. The caller records the malformed
  // boundary and keeps the route visible as partial without path highlighting.
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0)
    ? [...(value as string[])]
    : [];
}

function linkEndpoints(value: unknown): Array<{ id: string; source: string; destination: string }> {
  return objectEntries(value).flatMap(([id, endpoint]) => {
    const source = stringValue(endpoint.source) || stringValue(endpoint.src_device);
    const destination = stringValue(endpoint.destination) || stringValue(endpoint.dst_device);
    return source && destination ? [{ id, source, destination }] : [];
  });
}

function linkEndpointData(value: unknown): {
  endpoints: Array<{ id: string; source: string; destination: string }>;
  malformedCount: number;
} {
  const raw = record(value);
  const entries = Object.entries(raw);
  const endpoints = linkEndpoints(value);
  return { endpoints, malformedCount: entries.length - endpoints.length };
}

function fabricEventTiming(value: Record<string, unknown>): ReplayEvent["timing"] | null {
  const at = integerString(value.time_ps ?? value.event_time_ps ?? value.at_time_ps);
  if (at) return { type: "instant", atPs: at };
  const start = integerString(value.start_time_ps);
  const end = integerString(value.finish_time_ps ?? value.end_time_ps);
  return start && end && losslessIntegerToBigInt(end) >= losslessIntegerToBigInt(start)
    ? { type: "interval", startPs: start, endPs: end }
    : null;
}

function routeTopologyState(
  actualPath: string[],
  linkIds: string[],
  endpoints: Array<{ id: string; source: string; destination: string }>,
  topology: ReplayTopology,
): ReplayRouteState | null {
  if (topology.availability === "unsupported_schema")
    return actualPath.length || linkIds.length || endpoints.length ? "topology_identity_mismatch" : null;
  if (topology.availability !== "available" && topology.availability !== "partial") return null;
  const nodeIds = new Set(topology.nodes.map((node) => node.id));
  const topologyLinks = new Map(topology.links.map((link) => [link.id, link]));
  if (actualPath.some((id) => !nodeIds.has(id))) return "topology_identity_mismatch";
  const topologyIsPartial = topology.availability === "partial";
  if (!topology.links.length) return topologyIsPartial || endpoints.length ? "partial" : null;
  for (const endpoint of endpoints) {
    const suffix = endpoint.id.match(/^(.*)::(forward|reverse)$/);
    const baseId = suffix?.[1] || endpoint.id;
    const exactTopologyLink = topologyLinks.get(endpoint.id);
    const topologyLink = exactTopologyLink || topologyLinks.get(baseId);
    const reverse = !exactTopologyLink && suffix?.[2] === "reverse";
    const source = reverse ? endpoint.destination : endpoint.source;
    const destination = reverse ? endpoint.source : endpoint.destination;
    if (!topologyLink) {
      if (!topologyIsPartial) return "topology_identity_mismatch";
      continue;
    }
    // Fabric records the directed traversal that actually occurred, while the
    // topology artifact describes a physical link once.  A reverse traversal
    // therefore legitimately swaps the two endpoints without changing the
    // physical link identity.  Validate the reported link identity and accept
    // either orientation; do not walk topology to invent a route.
    const sameDirection = topologyLink.source === source && topologyLink.destination === destination;
    const reverseDirection = topologyLink.source === destination && topologyLink.destination === source;
    if (!sameDirection && !reverseDirection) return "topology_identity_mismatch";
  }
  if (topologyIsPartial) return "partial";
  return linkIds.some((id) => {
    const suffix = id.match(/^(.*)::(forward|reverse)$/);
    return !topologyLinks.has(id) && !topologyLinks.has(suffix?.[1] || id);
  })
    ? "topology_identity_mismatch"
    : null;
}

export function normalizeTopologyInput(input: unknown, runId: string | null): ReplayTopology {
  return normalizeTopology(input, runId);
}

export function normalizeFabricRoutes(
  payload: ReplayArtifactPayload | unknown | null | undefined,
  runId: string | null,
  topology: ReplayTopology = normalizeTopology(null, runId),
): { routes: ReplayRoute[]; events: ReplayFabricEvent[]; availability: ReplayAvailability; state: ReplayRouteState } {
  const {
    value,
    availability: sourceAvailability,
    artifactId,
    schemaIdentity,
  } = unwrapPayload(payload, "request-attribution");
  const mismatch = runBinding(value, runId);
  if (mismatch) return { routes: [], events: [], availability: mismatch, state: "route_unavailable" };
  if (sourceAvailability !== "available") {
    return {
      routes: [],
      events: [],
      availability: sourceAvailability,
      state: sourceAvailability === "unsupported_schema" ? "route_unavailable" : "no_path",
    };
  }
  const root = record(value);
  const isRequestAttribution =
    root.schema_version === "tilesim.request_attribution.v1" &&
    (schemaIdentity === undefined || schemaIdentity === "tilesim.request_attribution.v1");
  const isExecutionReplay =
    root.schema_version === "tilesim.execution_replay.v1" &&
    artifactId === "execution-replay" &&
    (schemaIdentity === undefined || schemaIdentity === "tilesim.execution_replay.v1");
  if (!isRequestAttribution && !isExecutionReplay)
    return { routes: [], events: [], availability: "unsupported_schema", state: "route_unavailable" };

  // The canonical execution-replay artifact is the backend's single source
  // for both Fabric hop evidence and collective steps.  Keep the accepted
  // locations deliberately narrow: these are published artifact fields, not
  // a topology walk or a fallback derived from aggregate metrics.
  const fabricCandidates = isExecutionReplay
    ? [
        { value: record(root.fabric).timeline, sourcePath: "/fabric/timeline" },
        { value: record(record(root.evidence).fabric).timeline, sourcePath: "/evidence/fabric/timeline" },
        { value: root.fabric_timeline, sourcePath: "/fabric_timeline" },
      ]
    : [{ value: record(record(root.evidence).fabric).timeline, sourcePath: "/evidence/fabric/timeline" }];
  const fabricCandidate = fabricCandidates.find(({ value: candidate }) => Array.isArray(candidate));
  if (!fabricCandidate) {
    return {
      routes: [],
      events: [],
      availability: isExecutionReplay ? "missing" : "unsupported_schema",
      state: "no_path",
    };
  }
  const records = fabricCandidate.value as unknown[];
  const fabricRoot = isExecutionReplay ? record(root.fabric) : record(record(root.evidence).fabric);
  const fallbackReasons = Array.isArray(fabricRoot.fallback_reasons)
    ? fabricRoot.fallback_reasons.filter((reason): reason is string => typeof reason === "string")
    : [];
  const routes: ReplayRoute[] = [];
  const events: ReplayFabricEvent[] = [];
  const seenRouteIds = new Set<string>();
  const usedRouteIds = new Set<string>();
  const seenFabricEventIds = new Set<string>();
  const usedFabricEventIds = new Set<string>();
  records.forEach((item, index) => {
    const malformedRecord =
      !item || typeof item !== "object" || Array.isArray(item) || Object.keys(record(item)).length === 0;
    const raw = record(item);
    const rawActualPath = raw.actual_path;
    const malformedActualPath =
      (rawActualPath !== undefined && !Array.isArray(rawActualPath)) ||
      (Array.isArray(rawActualPath) && rawActualPath.some((node) => typeof node !== "string" || !node.length));
    // Do not compress a malformed path into a shorter, apparently valid path:
    // filtering `['gpu-0', 7, 'gpu-1']` to `['gpu-0', 'gpu-1']` would visually
    // invent a direct hop that the backend never reported.
    const actualPath = malformedActualPath ? [] : routePath(rawActualPath);
    const rawEndpointValue = raw.link_endpoints;
    const endpointData = linkEndpointData(rawEndpointValue);
    const endpoints = endpointData.endpoints;
    const malformedEndpoints =
      (rawEndpointValue !== undefined &&
        (rawEndpointValue === null || typeof rawEndpointValue !== "object" || Array.isArray(rawEndpointValue))) ||
      endpointData.malformedCount > 0;
    const rawExecutionEvents = raw.execution_events;
    const malformedExecutionEvents = rawExecutionEvents !== undefined && !Array.isArray(rawExecutionEvents);
    const linkIds = actualPath.slice(0, -1).flatMap((source, hop) => {
      const destination = actualPath[hop + 1];
      const matches = endpoints.filter((endpoint) => {
        if (endpoint.source === source && endpoint.destination === destination) return true;
        const reverse = endpoint.id.match(/^(.*)::reverse$/);
        return Boolean(reverse && endpoint.source === destination && endpoint.destination === source);
      });
      // An actual_path contains node IDs, not a link ID.  When parallel links
      // share the same endpoints, choosing the first map entry would invent a
      // specific physical link that the backend did not identify.  Leave the
      // hop unresolved so the route is rendered as partial instead.
      return matches.length === 1 ? [matches[0].id] : [];
    });
    const completePath =
      actualPath.length >= 2 &&
      new Set(actualPath).size === actualPath.length &&
      actualPath.length - 1 === linkIds.length &&
      endpoints.length > 0;
    const topologyState = routeTopologyState(actualPath, linkIds, endpoints, topology);
    let state: ReplayRouteState = routeFallback(raw)
      ? "route_unavailable"
      : topologyState || (actualPath.length === 0 ? "no_path" : completePath ? "available" : "partial");
    const start = integerString(raw.start_time_ps);
    const end = integerString(raw.finish_time_ps ?? raw.end_time_ps);
    const hasRouteTimingFields =
      raw.start_time_ps !== undefined || raw.finish_time_ps !== undefined || raw.end_time_ps !== undefined;
    const timing =
      start && end && losslessIntegerToBigInt(end) >= losslessIntegerToBigInt(start)
        ? { startPs: start, endPs: end }
        : undefined;
    const routeIdBase = stringValue(raw.route_id) || `${stringValue(raw.request_id) || "route"}-${index}`;
    const duplicateRoute = seenRouteIds.has(routeIdBase);
    let routeId = routeIdBase;
    let routeSuffix = index;
    while (usedRouteIds.has(routeId)) routeId = `${routeIdBase}#${routeSuffix++}`;
    const routeIdCollision = routeId !== routeIdBase;
    seenRouteIds.add(routeIdBase);
    usedRouteIds.add(routeId);
    const sourcePath = `${artifactId}:${fabricCandidate.sourcePath}/${index}`;
    let invalidFabricEventCount = 0;
    let duplicateFabricEventCount = 0;
    const routeEvents = (Array.isArray(rawExecutionEvents) ? rawExecutionEvents : []).flatMap((item, eventIndex) => {
      const event = record(item);
      const eventTiming = fabricEventTiming(event);
      if (!eventTiming) {
        invalidFabricEventCount += 1;
        return [];
      }
      const eventIdBase = stringValue(event.event_id) || `${routeId}-event-${eventIndex}`;
      const duplicateEvent = seenFabricEventIds.has(eventIdBase);
      if (duplicateEvent) duplicateFabricEventCount += 1;
      let eventId = eventIdBase;
      let eventSuffix = `${index}-${eventIndex}`;
      while (usedFabricEventIds.has(eventId)) {
        eventId = `${eventIdBase}#${eventSuffix}`;
        eventSuffix = `${eventSuffix}-1`;
      }
      seenFabricEventIds.add(eventIdBase);
      usedFabricEventIds.add(eventId);
      const fabricEvent: ReplayFabricEvent = {
        eventId,
        routeId,
        linkId: stringValue(event.link_id),
        kind: stringValue(event.kind) || "unknown",
        label: fabricEventLabels[stringValue(event.kind) || ""] || "通信事件",
        timing: eventTiming,
        sourcePath: `${sourcePath}/execution_events/${eventIndex}`,
        sourceArtifact: artifactId,
        availability: "available",
      };
      events.push(fabricEvent);
      return [fabricEvent];
    });
    if (
      (invalidFabricEventCount ||
        duplicateFabricEventCount ||
        malformedActualPath ||
        malformedEndpoints ||
        malformedExecutionEvents ||
        malformedRecord ||
        duplicateRoute ||
        routeIdCollision ||
        (hasRouteTimingFields && !timing)) &&
      state !== "route_unavailable" &&
      state !== "topology_identity_mismatch"
    )
      state = "partial";
    routes.push({
      routeId,
      requestId: stringValue(raw.request_id),
      phaseId: stringValue(raw.phase_id),
      actualPath,
      linkIds,
      timing,
      sourcePath,
      sourceArtifact: artifactId,
      availability:
        state === "topology_identity_mismatch"
          ? "unsupported_schema"
          : state === "available" || state === "no_path"
            ? "available"
            : "partial",
      state,
      hasInterval: Boolean(timing),
      events: routeEvents,
    });
  });
  const state: ReplayRouteState =
    routes.find((route) => route.state === "topology_identity_mismatch")?.state ||
    routes.find((route) => route.state === "route_unavailable")?.state ||
    (fallbackReasons.some((reason) => reason.includes("route_unavailable")) ? "route_unavailable" : null) ||
    routes.find((route) => route.state === "partial")?.state ||
    routes.find((route) => route.state === "available")?.state ||
    "no_path";
  const availability: ReplayAvailability = routes.some((route) => route.state === "available")
    ? routes.some((route) => route.state !== "available")
      ? "partial"
      : "available"
    : routes.length || fallbackReasons.length
      ? "partial"
      : "available";
  return { routes, events, availability, state };
}

function collectiveStepRows(root: Record<string, unknown>): { rows: unknown[]; sourcePath: string } | null {
  const evidence = record(root.evidence);
  const collectiveEvidence = record(evidence.collective);
  const collectiveRoot = record(root.collective);
  const candidates: Array<{ value: unknown; sourcePath: string }> = [
    { value: evidence.collective_steps, sourcePath: "/evidence/collective_steps" },
    { value: root.collective_steps, sourcePath: "/collective_steps" },
    { value: collectiveEvidence.steps, sourcePath: "/evidence/collective/steps" },
    { value: collectiveRoot.steps, sourcePath: "/collective/steps" },
  ];
  const candidate = candidates.find(({ value }) => Array.isArray(value));
  return candidate ? { rows: candidate.value as unknown[], sourcePath: candidate.sourcePath } : null;
}

export function normalizeCollectiveSteps(
  payload: ReplayArtifactPayload | unknown | null | undefined,
  runId: string | null,
): ReplayCollectiveModel {
  const { value, availability, artifactId, schemaIdentity } = unwrapPayload(payload, "request-attribution");
  const sourcePath = `${artifactId}:/evidence/collective_steps`;
  const empty = (state: ReplayAvailability, reason: string): ReplayCollectiveModel => ({
    availability: state,
    supported: false,
    steps: [],
    sourcePath,
    sourceArtifact: artifactId,
    reason,
  });
  const mismatch = runBinding(value, runId);
  if (mismatch) return empty(mismatch, "collective step 的 run identity 不一致。");
  if (availability !== "available") {
    return empty(
      availability,
      availability === "unsupported_schema"
        ? "collective step artifact schema 不支持。"
        : availability === "expected_absence"
          ? "后端明确声明当前运行没有 collective step artifact。"
          : "collective round/chunk 未报告。",
    );
  }
  if (artifactId !== "execution-replay" || schemaIdentity !== "tilesim.execution_replay.v1") {
    return empty("not_covered", "当前后端未发布 tilesim.execution_replay.v1 canonical artifact。");
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("artifactId" in payload) ||
    !("sha256" in payload) ||
    typeof (payload as { sha256?: unknown }).sha256 !== "string" ||
    !(payload as { sha256: string }).sha256
  ) {
    return empty("not_covered", "collective step artifact 未通过 manifest/SHA 校验。");
  }
  const collectiveRoot = record(value);
  if (collectiveRoot.schema_version !== "tilesim.execution_replay.v1")
    return empty("unsupported_schema", "collective step artifact 的 schema_version 不受支持。");
  const rows = collectiveStepRows(collectiveRoot);
  if (!rows) return empty("not_covered", "已验证 artifact 未发布 canonical collective round/chunk 字段。");
  const normalized: ReplayCollectiveStep[] = [];
  let invalidCount = 0;
  let duplicateCount = 0;
  const seenStepIds = new Set<string>();
  const usedStepIds = new Set<string>();
  rows.rows.forEach((item, index) => {
    const raw = record(item);
    const stepId = stringValue(raw.step_id);
    const collectiveId = stringValue(raw.collective_id);
    const phaseId = stringValue(raw.phase_id);
    const phaseLabel = collectivePhaseLabel(raw.phase);
    const round = integerString(raw.round);
    const chunk = integerString(raw.chunk);
    const startPs = integerString(raw.start_time_ps);
    const endPs = integerString(raw.finish_time_ps ?? raw.end_time_ps);
    const sourceDevice = stringValue(raw.source_device) || stringValue(raw.source);
    const destinationDevice = stringValue(raw.destination_device) || stringValue(raw.destination);
    const bytes = integerString(raw.bytes);
    // `null` is a meaningful canonical value: the backend reported the step
    // but did not report dependencies. Only fall back to the legacy alias
    // when the canonical field is absent.
    const dependencyValue = raw.dependencies !== undefined ? raw.dependencies : raw.dependency_step_ids;
    const dependencies =
      dependencyValue === undefined
        ? null
        : dependencyValue === null
          ? null
          : Array.isArray(dependencyValue) && dependencyValue.every((dependency) => typeof dependency === "string")
            ? dependencyValue
            : undefined;
    const complete =
      Boolean(
        stepId && collectiveId && phaseId && round !== null && chunk !== null && startPs !== null && endPs !== null,
      ) &&
      Boolean(sourceDevice && destinationDevice && bytes !== null && dependencies !== undefined) &&
      BigInt(endPs!) >= BigInt(startPs!);
    if (!complete) {
      invalidCount += 1;
      return;
    }
    const stepIdBase = stepId!;
    const duplicate = seenStepIds.has(stepIdBase);
    if (duplicate) duplicateCount += 1;
    let normalizedStepId = stepIdBase;
    let stepSuffix = index;
    while (usedStepIds.has(normalizedStepId)) normalizedStepId = `${stepIdBase}#${stepSuffix++}`;
    seenStepIds.add(stepIdBase);
    usedStepIds.add(normalizedStepId);
    normalized.push({
      stepId: normalizedStepId,
      collectiveId: collectiveId!,
      phaseId: phaseId!,
      phaseLabel,
      round: round!,
      chunk: chunk!,
      timing: { startPs: startPs!, endPs: endPs! },
      sourceDevice: sourceDevice!,
      destinationDevice: destinationDevice!,
      bytes: bytes!,
      dependencies: dependencies as string[] | null,
      sourcePath: `${artifactId}:${rows.sourcePath}/${index}`,
      sourceArtifact: artifactId,
      availability: "available",
    });
  });
  if (invalidCount && !normalized.length)
    return empty("unsupported_schema", "collective step 字段不完整，未生成虚拟步骤。");
  return {
    availability: invalidCount || duplicateCount ? "partial" : "available",
    supported: true,
    steps: normalized,
    sourcePath: `${artifactId}:${rows.sourcePath}`,
    sourceArtifact: artifactId,
    reason:
      invalidCount || duplicateCount
        ? `${invalidCount ? "部分 collective step 字段不完整，已过滤未完整记录。" : ""}${
            invalidCount && duplicateCount ? " " : ""
          }${duplicateCount ? "发现重复 step_id，已降级为部分报告并保留唯一显示 ID。" : ""}`
        : "后端已报告 canonical collective step。",
  };
}

function eventTiming(raw: Record<string, unknown>): ReplayEvent["timing"] | null {
  const at = integerString(raw.event_time_ps ?? raw.at_time_ps ?? raw.time_ps);
  if (at) return { type: "instant", atPs: at };
  const start = integerString(raw.start_time_ps);
  const end = integerString(raw.finish_time_ps ?? raw.end_time_ps);
  return start && end && losslessIntegerToBigInt(end) >= losslessIntegerToBigInt(start)
    ? { type: "interval", startPs: start, endPs: end }
    : null;
}

export function eventTime(event: ReplayEvent): string {
  return event.timing.type === "instant" ? event.timing.atPs : event.timing.startPs;
}

export function normalizeRuntimeEvents(
  payload: ReplayArtifactPayload | unknown | null | undefined,
  runId: string | null,
): { events: ReplayEvent[]; availability: ReplayAvailability; reasons?: string[] } {
  const { value, availability: sourceAvailability, artifactId, schemaIdentity } = unwrapPayload(payload);
  const mismatch = runBinding(value, runId);
  if (mismatch) return { events: [], availability: mismatch };
  if (sourceAvailability !== "available") return { events: [], availability: sourceAvailability };
  const root = record(value);
  if (
    root.schema_version !== "tilesim.s1_runtime_event_trace.v1" ||
    (schemaIdentity !== undefined && schemaIdentity !== "tilesim.s1_runtime_event_trace.v1")
  )
    return { events: [], availability: "unsupported_schema" };
  if (!Array.isArray(root.events)) return { events: [], availability: "unsupported_schema" };
  const records = arrayValue(root, "events");
  if (!records.length) return { events: [], availability: "available" };
  let invalidCount = 0;
  let duplicateCount = 0;
  let sequenceIssue = false;
  let nonMonotonicTime = false;
  let previousTime: string | null = null;
  let previousSequence: bigint | null = null;
  const seenEventIds = new Set<string>();
  const usedEventIds = new Set<string>();
  const events = records.flatMap((item, index): ReplayEvent[] => {
    const raw = record(item);
    const timing = eventTiming(raw);
    if (!timing) {
      invalidCount += 1;
      return [];
    }
    const timingStart = timing.type === "instant" ? timing.atPs : timing.startPs;
    if (previousTime !== null && BigInt(timingStart) < BigInt(previousTime)) nonMonotonicTime = true;
    previousTime = timingStart;
    const normalizedSequence = integerString(raw.sequence);
    if (raw.sequence !== undefined) {
      if (normalizedSequence === null) sequenceIssue = true;
      else {
        const sequence = BigInt(normalizedSequence);
        if (previousSequence !== null && sequence !== previousSequence + 1n) sequenceIssue = true;
        previousSequence = sequence;
      }
    }
    const kind = stringValue(raw.kind) || "unknown";
    const requestId = stringValue(raw.request_id);
    const batchId = stringValue(raw.batch_id);
    const reportedEventId = stringValue(raw.event_id);
    const eventIdBase = reportedEventId || `${kind}-${index}`;
    const duplicate = seenEventIds.has(eventIdBase);
    if (duplicate) {
      duplicateCount += 1;
    }
    let eventId = eventIdBase;
    let eventSuffix = index;
    while (usedEventIds.has(eventId)) eventId = `${eventIdBase}#${eventSuffix++}`;
    seenEventIds.add(eventIdBase);
    usedEventIds.add(eventId);
    return [
      {
        eventId,
        sequence: normalizedSequence || String(index),
        sourceIndex: index,
        kind,
        label: eventLabels[kind] || "运行期事件",
        timing,
        requestId,
        batchId,
        state: stringValue(raw.state),
        sourcePath: `${artifactId}:/events/${index}`,
        sourceArtifact: artifactId,
        sourceSchema: schemaIdentity || stringValue(root.schema_version),
        availability: "available",
        detail: stringValue(raw.detail),
      },
    ];
  });
  return {
    events,
    availability:
      invalidCount || duplicateCount || sequenceIssue || nonMonotonicTime
        ? events.length
          ? "partial"
          : "unsupported_schema"
        : "available",
    reasons: [
      sequenceIssue ? "运行期 event sequence 存在间隔或非整数，已保留原始序列。" : "",
      nonMonotonicTime ? "运行期事件时间非单调；时间轴按模拟时间展示，不把排序视为后端原始顺序。" : "",
    ].filter(Boolean),
  };
}

function rangeBounds(values: Array<string | null>): { start: string | null; end: string | null } {
  const valid = values.filter((value): value is string => Boolean(value));
  if (!valid.length) return { start: null, end: null };
  return valid.reduce(
    (bounds, value) => {
      const numeric = BigInt(value);
      if (!bounds.start || numeric < BigInt(bounds.start)) bounds.start = value;
      if (!bounds.end || numeric > BigInt(bounds.end)) bounds.end = value;
      return bounds;
    },
    { start: null as string | null, end: null as string | null },
  );
}

export function sortReplayEvents(events: ReplayEvent[]): ReplayEvent[] {
  return events.slice().sort((left, right) => {
    const time = BigInt(eventTime(left)) - BigInt(eventTime(right));
    if (time !== 0n) return time < 0n ? -1 : 1;
    const leftSequence = /^\d+$/.test(left.sequence) ? BigInt(left.sequence) : null;
    const rightSequence = /^\d+$/.test(right.sequence) ? BigInt(right.sequence) : null;
    if (leftSequence !== null && rightSequence !== null && leftSequence !== rightSequence)
      return leftSequence < rightSequence ? -1 : 1;
    return left.sourceIndex - right.sourceIndex;
  });
}

export function normalizeReplayDocument(input: ReplayNormalizeInput): ReplayDocument {
  const envelope = record(input.envelope);
  const rawStages = Array.isArray(envelope.stages) ? envelope.stages : [];
  const seenStageIds = new Set<string>();
  const usedStageIds = new Set<string>();
  const stages = rawStages.map((stage, index) => {
    const normalized = normalizeStage(stage, index);
    const baseId = normalized.stageId;
    const duplicate = seenStageIds.has(baseId);
    let stageId = baseId;
    let suffix = index;
    while (usedStageIds.has(stageId)) stageId = `${baseId}#${suffix++}`;
    seenStageIds.add(baseId);
    usedStageIds.add(stageId);
    return duplicate || stageId !== baseId
      ? {
          ...normalized,
          stageId,
          availability: normalized.availability === "available" ? "partial" : normalized.availability,
        }
      : normalized;
  });
  const runtime = normalizeRuntimeEvents(input.runtimeEvents, input.runId);
  const topologyDocument = normalizeTopology(input.topology, input.runId);
  const fabric = normalizeFabricRoutes(input.fabricRoutes, input.runId, topologyDocument);
  // Collective round/chunk records have a separate canonical source.  Never
  // pass Fabric attribution through this branch: an absent replay artifact is
  // a coverage state, not permission to reinterpret route records as steps.
  const collective = normalizeCollectiveSteps(input.collectiveSteps, input.runId);
  const envelopeRunMismatch = input.envelope == null ? null : runBinding(envelope, input.runId);
  const envelopeSchemaMismatch =
    input.envelope != null && envelope.schema_version !== "tilesim.s7_execution_envelope.v1";
  const envelopeIssue: ReplayAvailability | null =
    envelopeRunMismatch || (envelopeSchemaMismatch ? "unsupported_schema" : null);
  const boundStages = envelopeIssue ? [] : stages;
  const stageAvailability =
    envelopeIssue ||
    (boundStages.length
      ? boundStages.some((stage) => stage.availability === "unsupported_schema")
        ? boundStages.some((stage) => stage.availability !== "unsupported_schema")
          ? "partial"
          : "unsupported_schema"
        : boundStages.some((stage) => stage.availability === "partial" || stage.availability === "missing")
          ? "partial"
          : "available"
      : "missing");
  const requests = unwrapPayload(input.runtimeRequests);
  const requestAvailability = requests.availability;
  const requestMismatch = runBinding(requests.value, input.runId);
  const metrics = record(input.metrics);
  const phaseFabric = Array.isArray(record(metrics.system_summary).phase_fabric_contributions)
    ? "available"
    : input.metrics
      ? "not_covered"
      : "missing";
  const topology = topologyDocument.availability;
  const fabricRoutes = fabric.availability;
  const provenance = envelopeIssue ? {} : record(envelope.trace_provenance);
  const traceProvenance = {
    sourceMode: stringValue(provenance.source_mode) || null,
    calibrationLevel: stringValue(provenance.calibration_level) || null,
    allowedClaimScope: stringValue(provenance.allowed_claim_scope) || null,
  };
  const rawEnvelopeStart = envelopeIssue ? null : integerString(envelope.start_time_ps);
  const rawEnvelopeEnd = envelopeIssue ? null : integerString(envelope.end_time_ps);
  const envelopeRangeValid =
    rawEnvelopeStart !== null && rawEnvelopeEnd !== null && BigInt(rawEnvelopeEnd) >= BigInt(rawEnvelopeStart);
  const envelopeStart = envelopeRangeValid ? rawEnvelopeStart : null;
  const envelopeEnd = envelopeRangeValid ? rawEnvelopeEnd : null;
  const bounds = rangeBounds([
    envelopeStart,
    envelopeEnd,
    ...boundStages.flatMap((stage) => [stage.timing?.startPs || stage.pointPs || null, stage.timing?.endPs || null]),
    ...runtime.events.flatMap((event) =>
      event.timing.type === "interval" ? [event.timing.startPs, event.timing.endPs] : [event.timing.atPs],
    ),
    ...fabric.routes.flatMap((route) => [route.timing?.startPs || null, route.timing?.endPs || null]),
    ...fabric.events.flatMap((event) =>
      event.timing.type === "interval" ? [event.timing.startPs, event.timing.endPs] : [event.timing.atPs],
    ),
    ...collective.steps.flatMap((step) => [step.timing.startPs, step.timing.endPs]),
  ]);
  const hasValidRange =
    (envelopeStart !== null && envelopeEnd !== null && BigInt(envelopeEnd) > BigInt(envelopeStart)) ||
    boundStages.some((stage) => Boolean(stage.timing) && BigInt(stage.timing!.endPs) > BigInt(stage.timing!.startPs)) ||
    runtime.events.some(
      (event) => event.timing.type === "interval" && BigInt(event.timing.endPs) > BigInt(event.timing.startPs),
    ) ||
    fabric.routes.some(
      (route) => Boolean(route.timing) && BigInt(route.timing!.endPs) > BigInt(route.timing!.startPs),
    ) ||
    fabric.events.some(
      (event) => event.timing.type === "interval" && BigInt(event.timing.endPs) > BigInt(event.timing.startPs),
    ) ||
    collective.steps.some((step) => BigInt(step.timing.endPs) > BigInt(step.timing.startPs));
  const coverage = buildReplayCoverage({
    stages: stageAvailability,
    runtimeEvents: runtime.availability,
    requestSummaries: requestMismatch || requestAvailability,
    phaseFabric,
    fabricRoutes,
    topology,
    collectiveSteps: collective.availability,
    hasStageRecords: boundStages.length > 0,
    hasEventRecords:
      runtime.events.length > 0 || fabric.routes.length > 0 || fabric.events.length > 0 || collective.steps.length > 0,
  });
  coverage.reasons.push(...(runtime.reasons || []));
  if (fabric.state === "route_unavailable") coverage.reasons.push("后端未找到可用路由，路径回放已受控降级。");
  else if (fabric.state === "no_path") coverage.reasons.push("后端未提供实际路径；没有从拓扑配置推断连线。");
  else if (fabric.state === "topology_identity_mismatch")
    coverage.reasons.push("Fabric 路径与当前 topology artifact 身份不一致。");
  else if (fabric.routes.some((route) => route.state === "partial"))
    coverage.reasons.push("路径细节未完整报告，未补造缺失 hop。");
  if (
    topologyDocument.availability === "available" &&
    topologyDocument.links.length === 0 &&
    fabric.routes.some((route) => route.linkIds.length)
  )
    coverage.reasons.push("topology artifact 未报告链路端点；保留后端 actual_path，但不高亮未验证连线。");
  if (topologyDocument.availability === "unsupported_schema")
    coverage.reasons.push("topology artifact 身份或 schema 不一致，无法安全联动路径。");
  if (rawEnvelopeStart !== null && rawEnvelopeEnd !== null && !envelopeRangeValid)
    coverage.reasons.push("执行 envelope 的全局时间区间无效，已忽略该区间并保留可验证事件时间。");
  coverage.reasons = [...new Set(coverage.reasons)];
  return {
    runId: input.runId,
    backendIdentity: input.backendIdentity || "unknown",
    schemaSetRevision: input.schemaSetRevision || "unknown",
    artifactSha256: input.artifactSha256 || null,
    startPs: bounds.start,
    endPs: bounds.end,
    hasValidRange,
    stages: boundStages,
    events: sortReplayEvents(runtime.events),
    topology: topologyDocument,
    routes: fabric.routes,
    fabricEvents: fabric.events,
    fabricRouteState: fabric.state,
    collective,
    traceProvenance,
    coverage,
  };
}

export function relativePercent(value: string, start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const span = BigInt(end) - BigInt(start);
  if (span <= 0n) return null;
  const offset = BigInt(value) - BigInt(start);
  const scaled = offset < 0n ? 0n : offset > span ? 10000n : (offset * 10000n) / span;
  return Number(scaled) / 100;
}

export function validateReplayBinding(input: {
  runId: string;
  expectedSha256?: string | null;
  artifact?: { run_id?: string; sha256?: string; artifact_id?: string } | null;
  payload?: unknown;
}): { ok: boolean; reason?: "run_mismatch" | "sha_mismatch" | "artifact_mismatch" } {
  if (input.expectedSha256) {
    if (!input.artifact?.sha256 || input.artifact.sha256 !== input.expectedSha256)
      return { ok: false, reason: "sha_mismatch" };
  }
  if (input.artifact) {
    if (!input.artifact.artifact_id || !input.artifact.sha256 || !input.artifact.run_id)
      return { ok: false, reason: "artifact_mismatch" };
    if (input.artifact.run_id !== input.runId) return { ok: false, reason: "run_mismatch" };
  }
  const payloadRun = stringValue(record(input.payload).run_id);
  if (payloadRun && payloadRun !== input.runId) return { ok: false, reason: "run_mismatch" };
  return { ok: true };
}
