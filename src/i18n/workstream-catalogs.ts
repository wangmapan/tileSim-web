import { evidenceAgentEnglishCatalog } from "./workstreams/evidence-agent";
import { guidedHelpEnglishCatalog } from "./workstreams/guided-help";
import { visualizationEnglishCatalog } from "./workstreams/visualization";
import { tracePackageEnglishCatalog } from "./workstreams/trace-package";
import { workflowReviewEnglishCatalog } from "./workstreams/workflow-review";
import { networkReviewEnglishCatalog } from "./workstreams/network-review";
import { attributionReviewEnglishCatalog } from "./workstreams/attribution-review";
import { workbenchReviewEnglishCatalog } from "./workstreams/workbench-review";
import { shellReviewEnglishCatalog } from "./workstreams/shell-review";

import { themeColorEnglishCatalog } from "./workstreams/theme-color";

export const workstreamEnglishCatalogs: Readonly<Record<string, string>> = {
  ...evidenceAgentEnglishCatalog,
  ...visualizationEnglishCatalog,
  ...guidedHelpEnglishCatalog,
  ...tracePackageEnglishCatalog,
  ...workflowReviewEnglishCatalog,
  ...networkReviewEnglishCatalog,
  ...attributionReviewEnglishCatalog,
  ...workbenchReviewEnglishCatalog,
  ...shellReviewEnglishCatalog,
  ...themeColorEnglishCatalog,
};
