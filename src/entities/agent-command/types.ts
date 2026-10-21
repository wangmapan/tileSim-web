/**
 * Local contracts for the assistant's parameter-edit prototype.
 *
 * These are Web-side types only, exactly like the phase-1 copilot contracts:
 * they are never serialized into a create-run request and never persisted. They
 * exist so the sidebar can describe an edit and the owning page can answer with
 * a per-item receipt instead of the sidebar reaching into a feature's store.
 */

/** Which write target an edit belongs to; the owning page decides how to write it. */
export type AgentParameterTarget = "form" | "control" | "runtime_trace" | "topology";

/** One resolved, validated edit — never an unresolved user string. */
export type AgentParameterEdit = {
  path: string;
  label: string;
  target: AgentParameterTarget;
  /** Set for knob (`control`) edits so the page can write `parameterValues`. */
  fieldId: string | null;
  previous: string | null;
  next: string;
  value: string | number | boolean;
  /** A future array element exists only after this collection-size edit in the same plan. */
  dependsOn?: "topology/devices" | "runtime_trace/requests";
};

export type AgentParameterReceipt = {
  path: string;
  label: string;
  previous: string | null;
  next: string;
  status: "applied" | "rejected";
  reason: string;
};

/** A complete synthetic-input proposal, kept as JSON text until the owning page validates it. */
export type AgentParameterStructuredInputs = {
  runtimeJson: string;
  topologyJson: string;
};

/**
 * A bounded-in-memory preview of the structured documents a plan will write.
 * It is a UI proposal only: the owning page still re-runs the same catalog,
 * reference and document validation when the user confirms the plan.
 */
export type AgentParameterJsonPreview = {
  /** Partial scalar overrides when the current page has not opened structured input. */
  overridesJson?: string;
  runtimeJson: string;
  topologyJson: string;
};

export type AgentParameterApplyResult = {
  receipts: readonly AgentParameterReceipt[];
  /**
   * True when the page had to move the submission to the `custom_inputs`
   * channel for these edits to take effect at all.
   */
  channelMoved: boolean;
  /** Short, user-facing summary of what happened. */
  note: string;
};
