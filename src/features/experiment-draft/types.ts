/**
 * Phase 1 draft-domain inputs layered on the frozen local Web contract.
 * The shared entity owns all cross-module shapes; this feature adds only pure
 * builder inputs and revision-pair helpers.
 */
import {
  PHASE1_LOCAL_CONTRACT_REVISION,
  type ContextStaleState,
  type CurrentSubsetExperimentDraft,
  type DeterministicValidationIssue,
  type DraftCapabilityState,
  type DraftDiffItem,
  type DraftField,
  type DraftFieldValue,
  type DraftValueSource,
  type Phase1CapabilityFieldProjection,
  type Phase1CapabilityProjection,
} from "../../entities/agent-orchestration";

export const CREATE_RUN_REQUEST_IDENTITY = "tilesim.bridge.create_run_request.v1" as const;
export const CAPABILITY_CATALOG_IDENTITY = "tilesim.bridge.agent_orchestration_capability_catalog.v1" as const;

export { PHASE1_LOCAL_CONTRACT_REVISION };
export type {
  ContextStaleState,
  CurrentSubsetExperimentDraft,
  DeterministicValidationIssue,
  DraftCapabilityState,
  DraftDiffItem,
  DraftField,
  DraftFieldValue,
  DraftValueSource,
  Phase1CapabilityFieldProjection,
  Phase1CapabilityProjection,
};

export interface DraftRevisionBinding {
  catalog_revision: string;
  capability_snapshot_revision: string;
  schema_set_revision: string;
  context_revision: string;
}

export interface DraftRevisionPair {
  expected: DraftRevisionBinding;
  current: DraftRevisionBinding;
}

export interface BuildDraftFieldInput {
  descriptor: Phase1CapabilityFieldProjection;
  original_value: DraftFieldValue | null;
  proposed_value: DraftFieldValue;
  value_source: DraftValueSource;
  revisions: DraftRevisionPair;
}

export interface BuildCurrentSubsetDraftInput {
  task_summary: string;
  fields: readonly DraftField[];
  unresolved?: readonly string[];
  issues?: readonly DeterministicValidationIssue[];
  revisions: DraftRevisionPair;
}
