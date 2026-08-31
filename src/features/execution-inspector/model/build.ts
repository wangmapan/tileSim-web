import type { ReportBundle, RunInputs } from "../../../contracts/report-model";
import { evidenceState, matchingStage, matchingSubsystem, resolutionMap, sourceFor, stat } from "./aggregations";
import { collectiveRecords, deviceRecords, fabricRecords, memoryRecords, runtimeRecords } from "./records";
import { statsFor } from "./stats";
import { layerDefinitions, type ExecutionRecord, type ExecutionResult, type LayerId } from "./types";
import { buildLayerVisualizations, buildStageTimeline } from "./visualizations";
import { t } from "../../../i18n";
import type { LayerVisualization } from "./types";

function localizedVisualization(visualization: LayerVisualization): LayerVisualization {
  return {
    ...visualization,
    title: t(visualization.title),
    description: t(visualization.description),
    rationale: t(visualization.rationale),
    emptyReason: visualization.emptyReason ? t(visualization.emptyReason) : undefined,
    columns: visualization.columns.map((column) => t(column)),
    series: visualization.series.map((series) => ({ ...series, name: t(series.name) })),
  };
}

export function buildExecutionResult(
  bundle: ReportBundle,
  inputs: RunInputs = { runtime_trace: null, topology: null },
): ExecutionResult {
  const resolutions = resolutionMap(bundle);
  const stages = bundle?.execution_envelope?.stages || [];
  const rows = bundle?.metrics?.system_summary?.phase_fabric_contributions || [];
  const runSummary = bundle?.run?.summary || {};
  const implementations = new Map(
    (bundle?.run?.multi_granularity_profile?.entries || []).map((entry) => [entry.subsystem, entry]),
  );
  const checks = bundle?.validation?.checks || [];
  const attribution = bundle?.tail?.attribution_ranking || [];
  const recordsByLayer: Record<LayerId, ExecutionRecord[]> = {
    S0: [],
    S1: runtimeRecords(inputs.runtime_trace, bundle?.metrics?.request_metrics),
    S2: [],
    S3: memoryRecords(rows),
    S4: deviceRecords(rows),
    S5: collectiveRecords(rows),
    S6: fabricRecords(bundle?.metrics?.system_summary),
  };

  const layers = layerDefinitions.map((definition) => {
    const resolution = resolutions.get(definition.id) || null;
    const implementation = implementations.get(definition.id) || null;
    const stage = matchingStage(stages, definition.id) || null;
    const records = recordsByLayer[definition.id].map((record) => ({
      ...record,
      title: t(record.title),
      subtitle: record.subtitle ? t(record.subtitle) : record.subtitle,
      facts: record.facts.map((fact) => ({
        ...fact,
        label: t(fact.label),
        value: typeof fact.value === "string" ? t(fact.value) : fact.value,
      })),
    }));
    const stats = statsFor(definition.id, { bundle, inputs, rows, records, resolution, implementation }).map(
      (entry) => ({
        ...entry,
        label: t(entry.label),
        hint: t(entry.hint),
        value: typeof entry.value === "string" ? t(entry.value) : entry.value,
      }),
    );
    return {
      ...definition,
      title: t(definition.title),
      role: t(definition.role),
      resolution,
      implementation,
      stage,
      records,
      visualizations: buildLayerVisualizations(definition.id, bundle, inputs).map(localizedVisualization),
      stats,
      checks: checks.filter((check) => matchingSubsystem(check.subsystem, definition.id)),
      attribution: attribution.filter((item) => item.subsystem === definition.id),
      evidenceState: evidenceState(definition.id, resolution, records, runSummary),
      headline: stats[0] || stat("结果", "—"),
      source: sourceFor(definition.id),
      detail: stage?.detail || resolution?.detail || t("当前报告包没有提供这一子系统的详细记录。"),
    };
  });

  return {
    layers,
    stages,
    resourceConvergence: bundle?.metrics?.resource_convergence || null,
    causeChain: bundle?.tail?.cause_chain || [],
    observationWindow: bundle?.metrics?.observation_window || null,
    timeline: localizedVisualization(buildStageTimeline(stages)),
  };
}
