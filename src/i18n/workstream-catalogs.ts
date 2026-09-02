import { evidenceAgentEnglishCatalog } from "./workstreams/evidence-agent";
import { guidedHelpEnglishCatalog } from "./workstreams/guided-help";
import { visualizationEnglishCatalog } from "./workstreams/visualization";

export const workstreamEnglishCatalogs: Readonly<Record<string, string>> = {
  ...evidenceAgentEnglishCatalog,
  ...visualizationEnglishCatalog,
  ...guidedHelpEnglishCatalog,
};
