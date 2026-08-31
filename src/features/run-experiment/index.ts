import { bridgeApi, type ApiRun, type CreateRunRequest } from "../../lib/api";

export { BridgeApiError } from "../../lib/api";
export { default as DesignSpaceInputPanel } from "./DesignSpaceInputPanel.vue";
export { default as ExperimentCapabilityPanel } from "./ExperimentCapabilityPanel.vue";
export { default as ExperimentIdentityPanel } from "./ExperimentIdentityPanel.vue";
export { default as ExperimentInputPanel } from "./ExperimentInputPanel.vue";
export { default as ExperimentSubmitCard } from "./ExperimentSubmitCard.vue";
export {
  ExperimentRequestError,
  buildExperimentRequest,
  buildExperimentRequestPreview,
  buildExperimentSurface,
  createExperimentForm,
  experimentControlGroups,
  reconcileExperimentForm,
  resolveExperimentErrorPointer,
  resetExperimentControls,
} from "./model";
export type {
  ExperimentControlDescriptor,
  ExperimentControlGroup,
  ExperimentCoverage,
  ExperimentErrorTarget,
  ExperimentFormState,
  ExperimentInputMode,
  ExperimentAvailabilityOption,
  ExperimentRequestPreview,
  ExperimentSurface,
} from "./model";

export const runExperiment = {
  getTemplate: (scenarioId: string) => bridgeApi.getTemplate(scenarioId),
  create: (payload: CreateRunRequest, idempotencyKey: string) => bridgeApi.createRun(payload, idempotencyKey),
  wait: (
    runId: string,
    options: { onStatus?: (run: ApiRun, transport: "sse" | "poll") => void; signal?: AbortSignal } = {},
  ) => bridgeApi.waitForRun(runId, options),
};
