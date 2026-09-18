import type { ApiManifestResponse, ApiRun, ArtifactManifestResponse, HealthResponse } from "../../contracts/bridge-api";
import type { ReportBundle, RuntimeTraceInput } from "../../contracts/report-model";

export type RunListItem = ApiRun;

export interface ExperimentSubmissionState {
  payloadText: string;
  idempotencyKey: string;
  runId: string;
}

export interface BridgeState {
  connected: boolean;
  available: boolean;
  checking: boolean;
  synchronized: boolean;
  title: string;
  detail: string;
  identity: HealthResponse | null;
  manifest: ApiManifestResponse | null;
}

export interface HistoryState {
  runs: RunListItem[];
  loading: boolean;
  error: string;
  selected: string[];
  comparisons: Record<string, { artifacts: ReportBundle; input: { runtime_trace: RuntimeTraceInput | null } }>;
  query: string;
}

export interface ApplyBundleOptions {
  runId?: string | null;
  runName?: string;
  isDemo?: boolean;
  inputs?: import("../../contracts/report-model").RunInputs | null;
  artifactManifest?: ArtifactManifestResponse | null;
}
