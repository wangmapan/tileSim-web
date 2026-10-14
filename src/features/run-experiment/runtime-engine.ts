import type { JsonObject } from "./structured-input";

// This is deliberately narrower than the backend registry. It is the tested,
// dependency-free scheduling subset of the three published semantic profiles.
export const RUN_ENGINE_PROFILES = {
  vllm: { version: "vllm.0.6.semantic.v1", features: ["continuous_batching"] },
  sglang: { version: "sglang.0.4.semantic.v1", features: ["continuous_batching", "prefix_aware_scheduling"] },
  tensorrt_llm: {
    version: "tensorrt_llm.0.12.semantic.v1",
    features: ["inflight_batching", "paged_kv_cache", "capacity_aware_scheduling"],
  },
} as const;

export type RunEngine = keyof typeof RUN_ENGINE_PROFILES;
export type RunEngineMode = "generic" | "dynamic" | "replay";

export function engineModeOf(document: JsonObject): RunEngineMode {
  if (!document.engine_type || document.engine_type === "legacy_generic") return "generic";
  const requests = Array.isArray(document.requests) ? document.requests : [];
  return requests.some((row) => row && typeof row === "object" && (row as JsonObject).phase === "request")
    ? "dynamic"
    : "replay";
}

/** Mirrors the backend's hosted dynamic-request constraints before submission. */
export function dynamicEngineIssue(
  document: JsonObject,
  topology?: JsonObject,
): { path: string; message: string } | null {
  const root = "/custom_inputs/runtime_trace";
  const engine = document.engine_type;
  if (!(typeof engine === "string" && engine in RUN_ENGINE_PROFILES)) {
    return { path: `${root}/engine_type`, message: "动态请求需要已发布的版本化引擎。" };
  }
  const profile = RUN_ENGINE_PROFILES[engine as RunEngine];
  if (document.engine_semantic_version !== profile.version)
    return { path: `${root}/engine_semantic_version`, message: "引擎画像版本不匹配。" };
  const features = document.requested_features;
  if (!Array.isArray(features)) return { path: `${root}/requested_features`, message: "请选择引擎特性集合。" };
  const allowed: readonly string[] = profile.features;
  for (const [index, feature] of features.entries()) {
    if (typeof feature !== "string" || !allowed.includes(feature) || features.indexOf(feature) !== index)
      return { path: `${root}/requested_features/${index}`, message: "引擎特性不属于画像或重复。" };
  }
  const policy = document.policy as JsonObject | undefined;
  for (const key of ["kv_capacity_tokens", "max_active_requests", "max_batch_size"]) {
    if (!policy || typeof policy[key] !== "number" || (policy[key] as number) <= 0)
      return { path: `${root}/policy/${key}`, message: `动态请求需要正数 ${key}。` };
  }
  if (!Array.isArray(document.requests) || !document.requests.length)
    return { path: `${root}/requests`, message: "动态请求至少需要一条。" };
  for (const [index, value] of document.requests.entries()) {
    const path = `${root}/requests/${index}`;
    const row = value as JsonObject;
    if (!row || typeof row !== "object" || row.phase !== "request")
      return { path: `${path}/phase`, message: "动态请求不得混入 prefill/decode 回放记录。" };
    for (const key of ["prompt_tokens", "decode_tokens", "kv_tokens", "tp_degree"]) {
      if (
        typeof row[key] !== "number" ||
        !Number.isSafeInteger(row[key]) ||
        (row[key] as number) < (key === "decode_tokens" ? 0 : 1)
      )
        return { path: `${path}/${key}`, message: `动态请求 ${key} 无效。` };
    }
    if ((row.kv_tokens as number) < (row.prompt_tokens as number) + (row.decode_tokens as number))
      return { path: `${path}/kv_tokens`, message: "KV 预留须覆盖 prompt + decode。" };
    if (
      !Array.isArray(row.participants) ||
      row.participants.length !== row.tp_degree ||
      row.participants.some((id) => typeof id !== "string" || !id) ||
      new Set(row.participants).size !== row.participants.length
    )
      return { path: `${path}/participants`, message: "参与设备须不重复，且数目与 TP 一致。" };
    if (topology) {
      const devices = (topology.topology as JsonObject | undefined)?.devices;
      const ids = new Set(Array.isArray(devices) ? devices.map((device) => (device as JsonObject).device_id) : []);
      if (row.participants.some((id) => !ids.has(id)))
        return { path: `${path}/participants`, message: "参与设备须引用拓扑中的设备。" };
    }
  }
  return null;
}
