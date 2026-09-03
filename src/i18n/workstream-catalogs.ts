import { evidenceAgentEnglishCatalog } from "./workstreams/evidence-agent";
import { guidedHelpEnglishCatalog } from "./workstreams/guided-help";
import { visualizationEnglishCatalog } from "./workstreams/visualization";
import { tracePackageEnglishCatalog } from "./workstreams/trace-package";

export const workstreamEnglishCatalogs: Readonly<Record<string, string>> = {
  ...evidenceAgentEnglishCatalog,
  ...visualizationEnglishCatalog,
  ...guidedHelpEnglishCatalog,
  ...tracePackageEnglishCatalog,
};
