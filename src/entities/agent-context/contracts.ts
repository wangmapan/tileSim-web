import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  type AgentContextResourceRef,
  type ContextAvailability,
  type PageContextEnvelope,
} from "../agent-orchestration";

export { PHASE1_LOCAL_CONTRACT_REVISION };
export type { AgentContextResourceRef, ContextAvailability, PageContextEnvelope };

const envelopeKeys = new Set([
  "contract_revision",
  "page_id",
  "route_name",
  "context_revision",
  "workspace_ref",
  "run_ref",
  "selected_entity",
  "resources",
  "supported_actions",
  "data_classification",
  "allowed_purposes",
  "expires_at",
  "display_label",
  "availability",
]);
const resourceKeys = new Set(["resource_type", "resource_id", "revision", "display_label", "availability"]);
const resourceTypes = new Set(["run", "experiment_form", "field", "artifact", "chart_subject"]);
const actions = new Set(["explain", "configure_current_subset", "check_capability"]);
const purposes = new Set(["explain", "draft"]);
const availabilities = new Set(["available", "unavailable", "stale"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => keys.has(key)) && Object.keys(value).length === keys.size;
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRunRef(value: unknown): value is NonNullable<PageContextEnvelope["run_ref"]> {
  return (
    isRecord(value) &&
    hasExactKeys(value, new Set(["run_id", "revision"])) &&
    typeof value.run_id === "string" &&
    typeof value.revision === "string"
  );
}

function isSelectedEntity(value: unknown): value is NonNullable<PageContextEnvelope["selected_entity"]> {
  return (
    isRecord(value) &&
    hasExactKeys(value, new Set(["entity_type", "entity_id", "revision"])) &&
    typeof value.entity_type === "string" &&
    typeof value.entity_id === "string" &&
    typeof value.revision === "string"
  );
}

function isResource(value: unknown): value is AgentContextResourceRef {
  return (
    isRecord(value) &&
    hasExactKeys(value, resourceKeys) &&
    resourceTypes.has(String(value.resource_type)) &&
    typeof value.resource_id === "string" &&
    typeof value.revision === "string" &&
    typeof value.display_label === "string" &&
    availabilities.has(String(value.availability))
  );
}

/** Unknown fields and values fail closed instead of widening the frozen shape. */
export function isPageContextEnvelope(value: unknown): value is PageContextEnvelope {
  if (!isRecord(value) || !hasExactKeys(value, envelopeKeys)) return false;
  return (
    value.contract_revision === PHASE1_LOCAL_CONTRACT_REVISION &&
    typeof value.page_id === "string" &&
    typeof value.route_name === "string" &&
    typeof value.context_revision === "string" &&
    isStringOrNull(value.workspace_ref) &&
    (value.run_ref === null || isRunRef(value.run_ref)) &&
    (value.selected_entity === null || isSelectedEntity(value.selected_entity)) &&
    Array.isArray(value.resources) &&
    value.resources.every(isResource) &&
    Array.isArray(value.supported_actions) &&
    value.supported_actions.every((action) => actions.has(String(action))) &&
    (value.data_classification === "public" || value.data_classification === "workspace_internal") &&
    Array.isArray(value.allowed_purposes) &&
    value.allowed_purposes.every((purpose) => purposes.has(String(purpose))) &&
    isStringOrNull(value.expires_at) &&
    typeof value.display_label === "string" &&
    availabilities.has(String(value.availability))
  );
}

export function clonePageContextEnvelope(value: PageContextEnvelope): PageContextEnvelope {
  return {
    ...value,
    run_ref: value.run_ref ? { ...value.run_ref } : null,
    selected_entity: value.selected_entity ? { ...value.selected_entity } : null,
    resources: value.resources.map((resource) => ({ ...resource })),
    supported_actions: [...value.supported_actions],
    allowed_purposes: [...value.allowed_purposes],
  };
}
