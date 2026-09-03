export { buildExecutionResult } from "./model/build";
export { buildLayerVisualizations, buildStageTimeline } from "./model/visualizations";
export {
  buildAttributionVisualization,
  buildDesignSpaceVisualization,
  buildFabricCompositionVisualizations,
  buildRequestLatencyVisualization,
} from "./model/analysis-visualizations";
export {
  attributionSource,
  causeSource,
  executionStageSource,
  fabricDomainSource,
  fidelityResolutionSource,
  implementationEntrySource,
  phaseContributionSource,
  phaseRecordSource,
  requestFabricContributionSource,
  requestMetricSource,
  runtimeRequestSource,
  validationCheckSource,
} from "./model/evidence-pointers";
export { default as ExecutionVisualizationPanel } from "./components/ExecutionVisualizationPanel.vue";
export { default as LayerRecordTable } from "./components/LayerRecordTable.vue";
export { executionLayerDetail, executionLayerHeadline, executionLayerName, executionMetricLabel } from "./presentation";
export type {
  ExecutionFact,
  ExecutionLayer,
  ExecutionRecord,
  ExecutionResult,
  ExecutionStat,
  LayerId,
  LayerVisualization,
  LayerVisualizationKind,
} from "./model/types";
