export type PageId = "overview" | "service" | "deployment" | "model" | "diagnostics" | "logs";

export type StatusTone = "positive" | "warning" | "danger" | "neutral";

export type OperationPhase =
  | "idle"
  | "checking_environment"
  | "starting"
  | "validating"
  | "fetching"
  | "building_backend"
  | "testing_backend"
  | "testing_web"
  | "building_web"
  | "publishing_release"
  | "restarting"
  | "succeeded"
  | "failed"
  | "blocked";

export interface LauncherSnapshot {
  service: {
    state: "ready" | "stopped" | "degraded" | "unavailable";
    label: string;
    guidance: string;
  };
  deployment: {
    manifestPresent: boolean;
    identity: string | null;
    mode: string | null;
    sourceRevision: string | null;
    buildRevision: string | null;
    webRevision: string | null;
    schemaRevision: string | null;
    ctestStatus: string | null;
    webTestStatus: string | null;
  };
  model: {
    configured: boolean;
    baseUrl: string;
    model: string;
    timeoutMs: number;
    protectedKeyPresent: boolean;
  };
  environment: EnvironmentCheck[];
  paths: {
    webRoot: string;
    backendRepository: string;
    backendDeployment: string;
  };
  launcherVersion: string;
}

export interface EnvironmentCheck {
  id: string;
  label: string;
  status: "ready" | "warning" | "missing";
  summary: string;
  detail?: string;
}

export type OperationRequest =
  | { kind: "start"; wslDistro: string }
  | {
      kind: "deploy";
      backendRepository: string;
      backendDeployment: string;
      wslDistro: string;
    }
  | { kind: "repair_wsl"; wslDistro: string }
  | {
      kind: "save_model";
      baseUrl: string;
      model: string;
      timeoutMs: number;
      apiKey: string | null;
      keepExistingKey: boolean;
    };

export interface OperationEvent {
  operationId: string;
  sequence: number;
  phase: OperationPhase;
  message: string;
  elapsedMs: number;
  logLine?: string;
  error?: {
    category: string;
    action: string;
    technicalDetail: string;
  };
}

export interface OperationState {
  operationId: string | null;
  sequence: number;
  phase: OperationPhase;
  message: string;
  elapsedMs: number;
  error: OperationEvent["error"] | null;
}

export interface LauncherBridge {
  getSnapshot(): Promise<LauncherSnapshot>;
  runOperation(request: OperationRequest): Promise<{ operationId: string }>;
  onOperationEvent(handler: (event: OperationEvent) => void): Promise<() => void>;
  openWorkbench(): Promise<void>;
  pickBackendDirectory(current: string): Promise<string | null>;
}
