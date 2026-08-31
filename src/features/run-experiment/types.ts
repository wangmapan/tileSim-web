import type { CreateRunRequest } from "../../contracts/bridge-api";

export type UnknownRecord = Record<string, unknown>;
export type CanonicalSubsystem = "S0" | "S1" | "S2" | "S3" | "S4" | "S5" | "S6";
export type ContractStatus = "supported" | "legacy_compatibility" | "contract_error";
export type ParameterValue = string | number | boolean | null | undefined;

export type ExperimentInputMode = "controls" | "json";

export interface ExperimentFormState {
  scenario_id: string;
  fidelity_policy: string;
  gpu_participation_mode: string;
  run_name: string;
  parameterValues: Record<string, ParameterValue>;
}

export interface ExperimentOption {
  value: string;
  label: string;
}

export interface ExperimentAvailabilityOption {
  value: string;
  available: boolean;
  reason: string | null;
  detail?: string;
  claimScope?: string;
  calibrationRequirement?: string;
}

export interface ExperimentCoverage {
  subsystem: CanonicalSubsystem;
  status: "exposed" | "not_exposed" | "unsupported";
  reason: string | null;
  parameterFieldIds: string[];
}

export interface ExperimentSurface {
  schemaId: string;
  descriptorId: string;
  descriptorRevision: string;
  schemaSetRevision: string;
  scenarios: ExperimentOption[];
  fidelityPolicies: string[];
  fidelityOptions: ExperimentAvailabilityOption[];
  gpuParticipationModes: string[];
  inputModes: ExperimentInputMode[];
  designSpaceModes: string[];
  sourceModeOptions: ExperimentAvailabilityOption[];
  defaultFidelityPolicy: string;
  defaultGpuParticipationMode: string;
  resolvedFidelitySource: string;
  contractStatus: ContractStatus;
  contractGaps: string[];
  contractError: string;
  controlGroups: ExperimentControlGroup[];
  coverage: ExperimentCoverage[];
  canSubmit: boolean;
}

export interface ExperimentControlDescriptor {
  fieldId: string;
  label: string;
  kind: "number" | "select";
  requestJsonPointer: string;
  valueType: "integer" | "number" | "boolean" | "string" | "enum";
  options: readonly string[];
  minimum?: number;
  maximum?: number;
  minimumInclusive: boolean;
  maximumInclusive: boolean;
  step?: number;
  integer: boolean;
  unit: string;
  required: boolean;
  explicitDefaultAvailable: boolean;
  defaultValue?: ParameterValue;
  available: boolean;
  unavailableReason: string | null;
  applicableInputModes: readonly ExperimentInputMode[];
  applicableScenarios: readonly string[];
  contractStatus: "backend_descriptor" | "frontend_compatibility";
}

export interface ExperimentControlGroup {
  groupId: string;
  subsystem: "S0" | "S1" | "S6";
  title: string;
  detail: string;
  displayOrder: number;
  fields: readonly ExperimentControlDescriptor[];
}

export interface BuildExperimentRequestOptions {
  form: ExperimentFormState;
  mode: ExperimentInputMode;
  surface: ExperimentSurface;
  runtimeJson: string;
  topologyJson: string;
  designSpaceJson: string;
}

export interface ExperimentRequestPreview {
  request: CreateRunRequest | null;
  text: string;
  error: ExperimentRequestError | null;
}

export interface ExperimentErrorTarget {
  fieldPath: string;
  controlPointer: string;
  fieldId: string | null;
}

export class ExperimentRequestError extends Error {
  constructor(
    message: string,
    readonly fieldPath: string,
  ) {
    super(message);
    this.name = "ExperimentRequestError";
  }
}
