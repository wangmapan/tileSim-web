import type { AgentOrchestrationCapabilitySnapshotResponse } from "../../contracts/bridge-api";
import type {
  DraftCapabilityState,
  Phase1CapabilityFieldProjection,
  Phase1CapabilityProjection,
} from "../../entities/agent-orchestration";

const targetRequestIdentity = "tilesim.bridge.create_run_request.v1" as const;
const catalogIdentity = "tilesim.bridge.agent_orchestration_capability_catalog.v1" as const;

const expectedFields = {
  "s0.workload.message_size_multiplier": {
    pointer: "/overrides/workload/message_size_multiplier",
    aliases: ["消息大小倍率", "消息尺寸倍率", "通信消息倍率", "message size multiplier"],
  },
  "s1.runtime.batch_scheduler": {
    pointer: "/overrides/runtime/batch_scheduler",
    aliases: ["批调度器", "批调度策略", "batch scheduler", "scheduler"],
  },
  "s1.runtime.max_batch_size": {
    pointer: "/overrides/runtime/max_batch_size",
    aliases: ["最大批大小", "最大 batch size", "max batch size", "batch size"],
  },
  "s1.runtime.kv_capacity_tokens": {
    pointer: "/overrides/runtime/kv_capacity_tokens",
    aliases: ["KV 容量", "KV token 容量", "kv capacity", "kv capacity tokens"],
  },
  "s6.fabric.scale_up_bandwidth_gbps": {
    pointer: "/overrides/fabric/scale_up_bandwidth_gbps",
    aliases: ["纵向扩展带宽", "节点内带宽", "scale-up bandwidth", "scale up bandwidth"],
  },
  "s6.fabric.scale_up_latency_us": {
    pointer: "/overrides/fabric/scale_up_latency_us",
    aliases: ["纵向扩展时延", "节点内时延", "scale-up latency", "scale up latency"],
  },
  "s6.fabric.scale_out_bandwidth_gbps": {
    pointer: "/overrides/fabric/scale_out_bandwidth_gbps",
    aliases: ["横向扩展带宽", "节点间带宽", "scale-out bandwidth", "scale out bandwidth"],
  },
  "s6.fabric.scale_out_latency_us": {
    pointer: "/overrides/fabric/scale_out_latency_us",
    aliases: ["横向扩展时延", "节点间时延", "scale-out latency", "scale out latency"],
  },
} as const;

type ExpectedFieldId = keyof typeof expectedFields;

export class Phase1CapabilityProjectionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "Phase1CapabilityProjectionError";
  }
}

function capabilityState(
  descriptor: AgentOrchestrationCapabilitySnapshotResponse["catalog"]["parameter_descriptors"][number],
): DraftCapabilityState {
  const requiredDimensions = ["accepted", "validated", "lowered", "executed", "agent_exposed"] as const;
  if (!requiredDimensions.every((dimension) => descriptor.capability_state[dimension].state === "affirmed")) {
    return "unavailable";
  }
  return descriptor.applicability.status === "conditional" ? "conditional" : "available";
}

function fieldProjection(
  descriptor: AgentOrchestrationCapabilitySnapshotResponse["catalog"]["parameter_descriptors"][number],
): Phase1CapabilityFieldProjection {
  const expected = expectedFields[descriptor.field_id as ExpectedFieldId];
  if (!expected) throw new Phase1CapabilityProjectionError("phase1_unexpected_agent_exposed_field");
  if (descriptor.request_identity !== targetRequestIdentity || descriptor.request_json_pointer !== expected.pointer) {
    throw new Phase1CapabilityProjectionError("phase1_capability_descriptor_binding_mismatch");
  }
  const state = capabilityState(descriptor);
  if (state === "unavailable") {
    throw new Phase1CapabilityProjectionError("phase1_capability_execution_closure_missing");
  }
  return {
    field_id: descriptor.field_id,
    aliases: expected.aliases,
    value_type: descriptor.value_type,
    canonical_unit: descriptor.canonical_unit,
    accepted_units: [...descriptor.accepted_units],
    request_json_pointer: descriptor.request_json_pointer,
    enum_values: [...(descriptor.constraints.enum || [])],
    minimum: descriptor.constraints.minimum ?? null,
    maximum: descriptor.constraints.maximum ?? null,
    integer_only: descriptor.value_type === "integer",
    capability_state: state,
  };
}

export function buildPhase1CapabilityProjection(
  snapshot: AgentOrchestrationCapabilitySnapshotResponse,
): Phase1CapabilityProjection {
  if (
    snapshot.schema_identity !== "tilesim.bridge.agent_orchestration_capability_snapshot.v1" ||
    snapshot.catalog.schema_identity !== catalogIdentity ||
    snapshot.release_binding.create_run_identity !== targetRequestIdentity ||
    snapshot.catalog.catalog_revision !== snapshot.release_binding.catalog_revision ||
    snapshot.catalog.contract_package_revision !== snapshot.release_binding.contract_package_revision
  ) {
    throw new Phase1CapabilityProjectionError("phase1_capability_snapshot_binding_mismatch");
  }
  const advertised = new Set(snapshot.catalog.agent_exposed_field_ids);
  const expectedIds = Object.keys(expectedFields) as ExpectedFieldId[];
  if (
    advertised.size !== expectedIds.length ||
    expectedIds.some((fieldId) => !advertised.has(fieldId)) ||
    snapshot.catalog.parameter_descriptors.length !== expectedIds.length
  ) {
    throw new Phase1CapabilityProjectionError("phase1_agent_exposed_field_set_mismatch");
  }
  const byId = new Map(snapshot.catalog.parameter_descriptors.map((descriptor) => [descriptor.field_id, descriptor]));
  const fields = expectedIds.map((fieldId) => {
    const descriptor = byId.get(fieldId);
    if (!descriptor) throw new Phase1CapabilityProjectionError("phase1_parameter_descriptor_missing");
    return fieldProjection(descriptor);
  });
  return {
    catalog_identity: catalogIdentity,
    catalog_revision: snapshot.catalog.catalog_revision,
    capability_snapshot_revision: snapshot.snapshot_revision,
    schema_set_revision: snapshot.release_binding.schema_set_revision,
    target_request_identity: targetRequestIdentity,
    fields,
  };
}
