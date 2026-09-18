import type { ReportBundle } from "../../../contracts/report-model";
import type { CoverageGroup } from "../types";
import { buildEnvelopeCoverage } from "./envelope";
import { buildMetricsCoverage } from "./metrics";
import { buildRunCoverage, buildRunVerdict } from "./run";
import { buildTailCoverage } from "./tail";
import { buildValidationCoverage } from "./validation";

export {
  buildEnvelopeCoverage,
  buildMetricsCoverage,
  buildRunCoverage,
  buildRunVerdict,
  buildTailCoverage,
  buildValidationCoverage,
};
export type { RunVerdict } from "./run";
export type { Scope, Formatter } from "./shared";

export type CoverageSection = "run" | "metrics" | "validation" | "tail" | "execution_envelope";

export function buildCoverage(bundle: ReportBundle, section: CoverageSection): CoverageGroup[] {
  switch (section) {
    case "run":
      return buildRunCoverage(bundle);
    case "metrics":
      return buildMetricsCoverage(bundle);
    case "validation":
      return buildValidationCoverage(bundle);
    case "tail":
      return buildTailCoverage(bundle);
    case "execution_envelope":
      return buildEnvelopeCoverage(bundle);
  }
}
