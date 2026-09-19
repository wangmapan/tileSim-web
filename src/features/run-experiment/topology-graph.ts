export type TopologyDevice = { device_id: string; device_type?: string; group_id?: string };
export type TopologyLink = {
  src_device: string;
  dst_device: string;
  domain_id: string;
  bandwidth_gbps?: number;
  latency_us?: number;
};
export type TopologyDomain = {
  domain_id: string;
  domain_type: "scale_up" | "scale_out";
  member_devices: string[];
  module_binding: string;
  default_fidelity?: "analytical" | "des";
  failure_policy?: "fallback" | "fail_closed";
};
export type TopologyDocument = {
  topology_name?: string;
  routing_policies?: Record<string, string | number | boolean>;
  transport_policies?: Record<string, string | number | boolean>;
  calibration_profiles?: Record<string, string | number | boolean>;
  devices: TopologyDevice[];
  links?: TopologyLink[];
  module_bindings: Array<Record<string, unknown>>;
  domains: TopologyDomain[];
  [key: string]: unknown;
};

const MAX_DEVICES = 1_024;
const MAX_MODULE_BINDINGS = 64;
const MAX_DOMAINS = 64;
const MAX_LINKS = 100_000;
const MAX_WORKLOAD_REQUESTS = 100_000;
const MAX_MEMBERS = 1_024;
const MAX_PARTICIPANTS = 1_024;
const MAX_EXACT_JSON_INTEGER = 9_007_199_254_740_991;

const allowedRoot = new Set([
  "topology_name",
  "routing_policies",
  "transport_policies",
  "calibration_profiles",
  "devices",
  "links",
  "module_bindings",
  "domains",
]);
const allowedEnvelope = new Set(["scenario_name", "provenance", "topology", "workload"]);
const allowedProvenance = new Set(["source_mode", "calibration_level", "allowed_claim_scope"]);
const allowedWorkload = new Set(["requests"]);
const allowedDevice = new Set(["device_id", "device_type", "group_id"]);
const allowedLink = new Set(["src_device", "dst_device", "domain_id", "bandwidth_gbps", "latency_us"]);
const allowedDomain = new Set([
  "domain_id",
  "domain_type",
  "member_devices",
  "module_binding",
  "default_fidelity",
  "failure_policy",
]);
const allowedModule = new Set(["module_name", "module_version", "module_kind", "config_profile", "override_params"]);
const allowedOverride = new Set(["bandwidth_gbps", "latency_us", "queue_factor", "oversubscription_factor"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function assertKeys(value: Record<string, unknown>, allowed: Set<string>, path: string) {
  for (const key of Object.keys(value)) if (!allowed.has(key)) throw new Error(`${path}/${key}: 不支持的字段`);
}
function requiredString(value: unknown, path: string, maxLength = 512) {
  if (typeof value !== "string" || !value.length) throw new Error(`${path}: 必须是非空字符串`);
  if (value.length > maxLength) throw new Error(`${path}: 长度不能超过 ${maxLength}`);
  return value;
}
function optionalString(value: unknown, path: string, maxLength = 512, minLength = 0) {
  if (value === undefined) return;
  if (typeof value !== "string") throw new Error(`${path}: 必须是字符串`);
  if (value.length < minLength) throw new Error(`${path}: 长度不能少于 ${minLength}`);
  if (value.length > maxLength) throw new Error(`${path}: 长度不能超过 ${maxLength}`);
}
function optionalNumber(
  value: unknown,
  path: string,
  minimum = 0,
  maximum = Number.POSITIVE_INFINITY,
  integer = false,
) {
  if (value === undefined) return;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < minimum ||
    value > maximum ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(`${path}: 数值超出契约范围`);
  }
}
function scalarMap(value: unknown, path: string) {
  if (!isRecord(value)) throw new Error(`${path}: 必须是标量映射对象`);
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string" && typeof item !== "boolean" && (typeof item !== "number" || !Number.isFinite(item))) {
      throw new Error(`${path}/${key}: 必须是字符串、数字或布尔值`);
    }
  }
}
function validateProvenance(value: unknown, path: string) {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error(`${path}: 必须是对象`);
  assertKeys(value, allowedProvenance, path);
  requiredString(value.source_mode, `${path}/source_mode`);
  requiredString(value.calibration_level, `${path}/calibration_level`);
  requiredString(value.allowed_claim_scope, `${path}/allowed_claim_scope`);
  if (value.source_mode !== "synthetic_trace") throw new Error(`${path}/source_mode: 不支持的值`);
  if (
    value.calibration_level !== undefined &&
    !(["uncalibrated", "partially_calibrated"] as unknown[]).includes(value.calibration_level)
  ) {
    throw new Error(`${path}/calibration_level: 不支持的值`);
  }
  if (
    value.allowed_claim_scope !== undefined &&
    !(
      [
        "exploratory",
        "exploratory_s6_only",
        "synthetic_consistency",
        "synthetic_consistency_only",
        "workflow_consistency_only",
      ] as unknown[]
    ).includes(value.allowed_claim_scope)
  ) {
    throw new Error(`${path}/allowed_claim_scope: 不支持的值`);
  }
}
function validateWorkload(value: unknown, path: string) {
  if (value === undefined) return;
  if (!isRecord(value)) throw new Error(`${path}: 必须是对象`);
  assertKeys(value, allowedWorkload, path);
  if (!Array.isArray(value.requests)) throw new Error(`${path}/requests: 必须是数组`);
  if (value.requests.length > MAX_WORKLOAD_REQUESTS)
    throw new Error(`${path}/requests: 条目不能超过 ${MAX_WORKLOAD_REQUESTS}`);
  const allowedRequest = new Set([
    "request_id",
    "batch_id",
    "phase",
    "collective_type",
    "message_size_bytes",
    "message_size_mb",
    "tp_degree",
    "participants",
    "release_time_ps",
    "memory_latency_ps",
    "device_latency_ps",
  ]);
  value.requests.forEach((entry: unknown, index: number) => {
    const itemPath = `${path}/requests/${index}`;
    if (!isRecord(entry)) throw new Error(`${itemPath}: 必须是对象`);
    assertKeys(entry, allowedRequest, itemPath);
    requiredString(entry.request_id, `${itemPath}/request_id`, 256);
    optionalString(entry.batch_id, `${itemPath}/batch_id`, 256);
    optionalString(entry.collective_type, `${itemPath}/collective_type`, 160);
    if (entry.phase !== undefined && entry.phase !== "prefill" && entry.phase !== "decode")
      throw new Error(`${itemPath}/phase: 不支持的值`);
    optionalNumber(entry.message_size_bytes, `${itemPath}/message_size_bytes`, 0, MAX_EXACT_JSON_INTEGER, true);
    optionalNumber(entry.message_size_mb, `${itemPath}/message_size_mb`, 0, MAX_EXACT_JSON_INTEGER);
    optionalNumber(entry.tp_degree, `${itemPath}/tp_degree`, 1, 1_024, true);
    optionalNumber(entry.release_time_ps, `${itemPath}/release_time_ps`, 0, MAX_EXACT_JSON_INTEGER, true);
    optionalNumber(entry.memory_latency_ps, `${itemPath}/memory_latency_ps`, 0, MAX_EXACT_JSON_INTEGER, true);
    optionalNumber(entry.device_latency_ps, `${itemPath}/device_latency_ps`, 0, MAX_EXACT_JSON_INTEGER, true);
    if (entry.participants !== undefined) {
      if (!Array.isArray(entry.participants) || entry.participants.length > MAX_PARTICIPANTS)
        throw new Error(`${itemPath}/participants: 必须是有界字符串数组`);
      entry.participants.forEach((participant, participantIndex) =>
        requiredString(participant, `${itemPath}/participants/${participantIndex}`),
      );
    }
  });
}

/** Strictly validates the topology object used by custom_inputs.topology. */
export function parseTopologyDocument(text: string): {
  document: TopologyDocument | null;
  envelope: Record<string, unknown> | null;
  error: string;
} {
  if (!text.trim()) return { document: null, envelope: null, error: "" };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { document: null, envelope: null, error: "JSON 格式无效，图形编辑已暂停" };
  }
  if (!isRecord(value)) return { document: null, envelope: null, error: "拓扑必须是 JSON 对象" };
  try {
    // The graph edits the exact object submitted under custom_inputs.topology.
    // Requiring the canonical envelope here prevents a visually valid but
    // ultimately un-submittable bare topology document from being presented as
    // ready to run.
    assertKeys(value, allowedEnvelope, "拓扑请求");
    if (!Object.prototype.hasOwnProperty.call(value, "topology")) throw new Error("拓扑请求/topology: 必须存在");
    if (!isRecord(value.topology)) throw new Error("拓扑请求/topology: 必须是对象");
    // The request schema makes these optional fields non-empty when present.
    // Keep the graph's readiness signal aligned with the submit-time Ajv
    // validator instead of allowing an empty label to look valid here.
    optionalString(value.scenario_name, "拓扑请求/scenario_name", 256, 1);
    validateProvenance(value.provenance, "拓扑请求/provenance");
    validateWorkload(value.workload, "拓扑请求/workload");
    const envelope: Record<string, unknown> = value;
    const topology: Record<string, unknown> = value.topology;
    assertKeys(topology, allowedRoot, "拓扑");
    if (
      !Array.isArray(topology.devices) ||
      !Array.isArray(topology.module_bindings) ||
      !Array.isArray(topology.domains)
    ) {
      throw new Error("拓扑必须包含 devices、module_bindings 和 domains 数组");
    }
    if (topology.devices.length > MAX_DEVICES) throw new Error(`/devices: 条目不能超过 ${MAX_DEVICES}`);
    if (topology.module_bindings.length > MAX_MODULE_BINDINGS)
      throw new Error(`/module_bindings: 条目不能超过 ${MAX_MODULE_BINDINGS}`);
    if (topology.domains.length > MAX_DOMAINS) throw new Error(`/domains: 条目不能超过 ${MAX_DOMAINS}`);
    if (topology.links !== undefined && !Array.isArray(topology.links)) throw new Error(`/links: 必须是数组`);
    if (Array.isArray(topology.links) && topology.links.length > MAX_LINKS)
      throw new Error(`/links: 条目不能超过 ${MAX_LINKS}`);
    optionalString(topology.topology_name, "/topology/topology_name", 256, 1);
    for (const mapName of ["routing_policies", "transport_policies", "calibration_profiles"])
      if (topology[mapName] !== undefined) scalarMap(topology[mapName], `/topology/${mapName}`);
    const devices = (topology.devices as unknown[]).map((entry: unknown, index: number) => {
      if (!isRecord(entry)) throw new Error(`/devices/${index}: 必须是对象`);
      assertKeys(entry, allowedDevice, `/devices/${index}`);
      return {
        device_id: requiredString(entry.device_id, `/devices/${index}/device_id`, 256),
        ...(entry.device_type === undefined
          ? {}
          : {
              device_type:
                (optionalString(entry.device_type, `/devices/${index}/device_type`, 160), entry.device_type as string),
            }),
        ...(entry.group_id === undefined
          ? {}
          : {
              group_id: (optionalString(entry.group_id, `/devices/${index}/group_id`, 256), entry.group_id as string),
            }),
      };
    });
    const ids = new Set<string>();
    for (const device of devices)
      if (ids.has(device.device_id)) throw new Error(`/devices: 重复设备 ${device.device_id}`);
      else ids.add(device.device_id);
    const moduleBindings = (topology.module_bindings as unknown[]).map((entry: unknown, index: number) => {
      if (!isRecord(entry)) throw new Error(`/module_bindings/${index}: 必须是对象`);
      assertKeys(entry, allowedModule, `/module_bindings/${index}`);
      requiredString(entry.module_name, `/module_bindings/${index}/module_name`, 256);
      optionalString(entry.module_version, `/module_bindings/${index}/module_version`, 80);
      optionalString(entry.config_profile, `/module_bindings/${index}/config_profile`, 160);
      if (entry.module_kind !== "scale_up" && entry.module_kind !== "scale_out")
        throw new Error(`/module_bindings/${index}/module_kind: 不支持的值`);
      if (entry.override_params !== undefined) {
        if (!isRecord(entry.override_params)) throw new Error(`/module_bindings/${index}/override_params: 必须是对象`);
        assertKeys(entry.override_params, allowedOverride, `/module_bindings/${index}/override_params`);
        optionalNumber(
          entry.override_params.bandwidth_gbps,
          `/module_bindings/${index}/override_params/bandwidth_gbps`,
          0.000001,
          100_000,
        );
        optionalNumber(
          entry.override_params.latency_us,
          `/module_bindings/${index}/override_params/latency_us`,
          0,
          1_000_000,
        );
        optionalNumber(
          entry.override_params.queue_factor,
          `/module_bindings/${index}/override_params/queue_factor`,
          0,
          1_000_000,
        );
        optionalNumber(
          entry.override_params.oversubscription_factor,
          `/module_bindings/${index}/override_params/oversubscription_factor`,
          1,
          1_000_000,
        );
      }
      return entry;
    });
    const domains = (topology.domains as unknown[]).map((entry: unknown, index: number) => {
      if (!isRecord(entry)) throw new Error(`/domains/${index}: 必须是对象`);
      assertKeys(entry, allowedDomain, `/domains/${index}`);
      if (!Array.isArray(entry.member_devices)) throw new Error(`/domains/${index}/member_devices: 必须是数组`);
      if (entry.member_devices.length > MAX_MEMBERS)
        throw new Error(`/domains/${index}/member_devices: 条目不能超过 ${MAX_MEMBERS}`);
      const domain = {
        domain_id: requiredString(entry.domain_id, `/domains/${index}/domain_id`, 256),
        domain_type: entry.domain_type,
        member_devices: entry.member_devices.map((id, memberIndex) =>
          requiredString(id, `/domains/${index}/member_devices/${memberIndex}`),
        ),
        module_binding: requiredString(entry.module_binding, `/domains/${index}/module_binding`, 256),
        ...(entry.default_fidelity === undefined ? {} : { default_fidelity: entry.default_fidelity }),
        ...(entry.failure_policy === undefined ? {} : { failure_policy: entry.failure_policy }),
      } as TopologyDomain;
      if (domain.domain_type !== "scale_up" && domain.domain_type !== "scale_out")
        throw new Error(`/domains/${index}/domain_type: 不支持的值`);
      const missingMember = domain.member_devices.find((deviceId) => !ids.has(deviceId));
      if (missingMember) {
        throw new Error(`/domains/${index}/member_devices: 设备 ${missingMember} 不存在`);
      }
      if (domain.default_fidelity !== undefined && !["analytical", "des"].includes(domain.default_fidelity))
        throw new Error(`/domains/${index}/default_fidelity: 不支持的值`);
      if (domain.failure_policy !== undefined && !["fallback", "fail_closed"].includes(domain.failure_policy))
        throw new Error(`/domains/${index}/failure_policy: 不支持的值`);
      return domain;
    });
    const domainIds = new Set<string>();
    for (const domain of domains)
      if (domainIds.has(domain.domain_id)) throw new Error(`/domains: 重复 domain ${domain.domain_id}`);
      else domainIds.add(domain.domain_id);
    const links = ((topology.links === undefined ? [] : topology.links) as unknown[]).map(
      (entry: unknown, index: number) => {
        if (!isRecord(entry)) throw new Error(`/links/${index}: 必须是对象`);
        assertKeys(entry, allowedLink, `/links/${index}`);
        const link = {
          src_device: requiredString(entry.src_device, `/links/${index}/src_device`, 256),
          dst_device: requiredString(entry.dst_device, `/links/${index}/dst_device`, 256),
          domain_id: requiredString(entry.domain_id, `/links/${index}/domain_id`, 256),
          ...(entry.bandwidth_gbps === undefined ? {} : { bandwidth_gbps: entry.bandwidth_gbps }),
          ...(entry.latency_us === undefined ? {} : { latency_us: entry.latency_us }),
        } as TopologyLink;
        optionalNumber(link.bandwidth_gbps, `/links/${index}/bandwidth_gbps`, 0, 100_000);
        optionalNumber(link.latency_us, `/links/${index}/latency_us`, 0, 1_000_000);
        if (!ids.has(link.src_device) || !ids.has(link.dst_device)) throw new Error(`/links/${index}: 端点设备不存在`);
        if (!domainIds.has(link.domain_id)) throw new Error(`/links/${index}/domain_id: domain 不存在`);
        if (link.src_device === link.dst_device) throw new Error(`/links/${index}: 不允许自连接`);
        return link;
      },
    );
    return {
      document: {
        ...topology,
        devices,
        domains,
        module_bindings: moduleBindings,
        ...(topology.links === undefined ? {} : { links }),
      },
      envelope,
      error: "",
    } as const;
  } catch (error) {
    return { document: null, envelope: null, error: error instanceof Error ? error.message : String(error) };
  }
}

export function topologyJson(document: TopologyDocument): string {
  return JSON.stringify(document, null, 2);
}
