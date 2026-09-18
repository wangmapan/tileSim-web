import type { ReportBundle, RunInputs } from "../../contracts/report-model";
import type { ArtifactManifestResponse } from "../../lib/api";
import { buildEvidenceNodes } from "./evidence-nodes";
import { percentileNavigations, requestOptions } from "./percentile-navigation";
import type { BuildContext, RunBoundEvidenceChain } from "./types";
import { buildWeek8ExecutionSummary } from "./week8-execution";

export function buildRunBoundEvidenceChain({
  runId,
  requestId,
  bundle,
  inputs,
  artifactManifest,
}: {
  runId: string | null;
  requestId: string | null;
  bundle: ReportBundle;
  inputs: RunInputs;
  artifactManifest: ArtifactManifestResponse | null;
}): RunBoundEvidenceChain {
  const options = requestOptions(bundle, inputs);
  const percentileSubjects = percentileNavigations(bundle, artifactManifest);
  const statuses = artifactManifest?.artifacts.map((entry) => entry.contract_status) || [];
  const contractState = artifactManifest?.rejected_artifacts.some((entry) => entry.reason === "unsupported_schema")
    ? "unsupported_schema"
    : statuses.includes("legacy_compatibility")
      ? "compatibility_unversioned"
      : "versioned";
  const gaps: string[] = [];
  if (!bundle.metrics?.percentile_subjects?.length)
    gaps.push("metrics 未提供 percentile_subjects；前端不会通过 latency 排序推断 P99 request。");
  const week8Execution = buildWeek8ExecutionSummary(runId, bundle, artifactManifest);
  if (!runId || !requestId)
    return {
      runId,
      requestId,
      contractState,
      requestOptions: options,
      percentileSubjects,
      nodes: [],
      week8Execution,
      gaps,
    };
  const context: BuildContext = { runId, requestId, bundle, inputs, manifest: artifactManifest, gaps };
  const nodes = buildEvidenceNodes(context);
  return { runId, requestId, contractState, requestOptions: options, percentileSubjects, nodes, week8Execution, gaps };
}
