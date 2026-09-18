import type { GuideDefinition, GuideId, RoutedGuideId } from "./schema";
import { attributionGuide } from "./guides/attribution";
import { designSpaceGuide } from "./guides/design-space";
import { evidenceAgentGuide } from "./guides/evidence-agent";
import { evidenceLabGuide } from "./guides/evidence-lab";
import { executionGuide } from "./guides/execution";
import { experimentGuide } from "./guides/experiment";
import { fabricGuide } from "./guides/fabric";
import { historyGuide } from "./guides/history";
import { metricsGuide } from "./guides/metrics";
import { overviewGuide } from "./guides/overview";
import { rawEvidenceGuide } from "./guides/raw-evidence";
import { unsupportedSchemaGuide } from "./guides/unsupported-schema";
import { validationGuide } from "./guides/validation";
import {
  lightweightGuide,
  lightweightPrepareGuide,
  lightweightResultsGuide,
  lightweightRunGuide,
} from "./guides/lightweight";

export const guideRegistry = Object.freeze({
  overview: overviewGuide,
  experiment: experimentGuide,
  execution: executionGuide,
  metrics: metricsGuide,
  fabric: fabricGuide,
  attribution: attributionGuide,
  validation: validationGuide,
  design_space: designSpaceGuide,
  history: historyGuide,
  evidence_agent: evidenceAgentGuide,
  evidence_lab: evidenceLabGuide,
  lightweight: lightweightGuide,
  lightweight_prepare: lightweightPrepareGuide,
  lightweight_run: lightweightRunGuide,
  lightweight_results: lightweightResultsGuide,
  unsupported_schema: unsupportedSchemaGuide,
  raw_evidence: rawEvidenceGuide,
}) satisfies Readonly<Record<GuideId, GuideDefinition>>;

export const viewGuides = Object.freeze({
  overview: overviewGuide,
  experiment: experimentGuide,
  execution: executionGuide,
  metrics: metricsGuide,
  fabric: fabricGuide,
  attribution: attributionGuide,
  validation: validationGuide,
  design_space: designSpaceGuide,
  history: historyGuide,
  evidence_agent: evidenceAgentGuide,
  evidence_lab: evidenceLabGuide,
  lightweight: lightweightGuide,
  lightweight_prepare: lightweightPrepareGuide,
  lightweight_run: lightweightRunGuide,
  lightweight_results: lightweightResultsGuide,
}) satisfies Readonly<Record<RoutedGuideId, GuideDefinition>>;

export function guideFor(id: string | null | undefined): GuideDefinition | null {
  return id && Object.prototype.hasOwnProperty.call(guideRegistry, id)
    ? guideRegistry[id as keyof typeof guideRegistry]
    : null;
}
