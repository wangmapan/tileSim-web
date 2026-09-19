import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasEnglishTranslation } from "../../src/i18n";
import { coreEnglishCatalog } from "../../src/i18n/english-catalog";
import { evidenceAgentEnglishCatalog } from "../../src/i18n/workstreams/evidence-agent";
import { guidedHelpEnglishCatalog } from "../../src/i18n/workstreams/guided-help";
import { visualizationEnglishCatalog } from "../../src/i18n/workstreams/visualization";
import { workflowReviewEnglishCatalog } from "../../src/i18n/workstreams/workflow-review";
import { networkReviewEnglishCatalog } from "../../src/i18n/workstreams/network-review";
import { attributionReviewEnglishCatalog } from "../../src/i18n/workstreams/attribution-review";
import { workbenchReviewEnglishCatalog } from "../../src/i18n/workstreams/workbench-review";
import { semanticGlossaryEnglishCatalog } from "../../src/i18n/workstreams/semantic-glossary";
import { reportCoverageEnglishCatalog } from "../../src/i18n/workstreams/report-coverage";
import { lightweightWorkbenchEnglishCatalog } from "../../src/i18n/workstreams/lightweight-workbench";

const modelFiles = [
  "src/features/execution-inspector/model/records.ts",
  "src/features/execution-inspector/model/visualizations.ts",
  "src/features/execution-inspector/presentation.ts",
];

const catalogs = {
  core: coreEnglishCatalog,
  evidenceAgent: evidenceAgentEnglishCatalog,
  guidedHelp: guidedHelpEnglishCatalog,
  visualization: visualizationEnglishCatalog,
  workflowReview: workflowReviewEnglishCatalog,
  networkReview: networkReviewEnglishCatalog,
  attributionReview: attributionReviewEnglishCatalog,
  workbenchReview: workbenchReviewEnglishCatalog,
  semanticGlossary: semanticGlossaryEnglishCatalog,
  reportCoverage: reportCoverageEnglishCatalog,
  lightweightWorkbench: lightweightWorkbenchEnglishCatalog,
};

function chineseStringLiterals(file) {
  const source = readFileSync(resolve(process.cwd(), file), "utf8");
  return [...source.matchAll(/"([^"\r\n]*[\u3400-\u9fff][^"\r\n]*)"/gu)].map((match) => match[1]);
}

describe("English catalog ownership", () => {
  it("keeps every translation key in exactly one catalog", () => {
    const owners = new Map();
    for (const [catalogName, catalog] of Object.entries(catalogs)) {
      for (const key of Object.keys(catalog)) {
        const current = owners.get(key) || [];
        current.push(catalogName);
        owners.set(key, current);
      }
    }

    expect([...owners].filter(([, catalogNames]) => catalogNames.length > 1)).toEqual([]);
  });
});

describe("execution model English coverage", () => {
  it.each(modelFiles)("translates every Chinese interface literal in %s", (file) => {
    const missing = [...new Set(chineseStringLiterals(file))].filter((source) => !hasEnglishTranslation(source));
    expect(missing).toEqual([]);
  });
});

describe("run-bound evidence English coverage", () => {
  const files = [
    "src/features/run-bound-evidence/model.ts",
    "src/features/run-bound-evidence/evidence-nodes.ts",
    "src/features/run-bound-evidence/evidence-references.ts",
    "src/features/run-bound-evidence/percentile-navigation.ts",
    "src/features/run-bound-evidence/week8-execution.ts",
    "src/features/run-bound-evidence/components/RunBoundEvidencePanel.vue",
    "src/features/run-bound-evidence/components/Week8StreamRecords.vue",
    "src/features/run-bound-evidence/components/RequestEvidenceAction.vue",
  ];

  it.each(files)("translates every Chinese interface literal in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const literals = [...source.matchAll(/["']([^"'\r\n]*[\u3400-\u9fff][^"'\r\n]*)["']/gu)].map((match) => match[1]);
    const missing = [...new Set(literals)].filter((value) => !hasEnglishTranslation(value));
    expect(missing).toEqual([]);
  });
});

describe("report coverage English coverage", () => {
  const files = [
    "src/features/report-coverage/availability.ts",
    "src/features/report-coverage/model/shared.ts",
    "src/features/report-coverage/model/run.ts",
    "src/features/report-coverage/model/metrics.ts",
    "src/features/report-coverage/model/validation.ts",
    "src/features/report-coverage/model/tail.ts",
    "src/features/report-coverage/model/envelope.ts",
    "src/features/report-coverage/components/CoveragePanel.vue",
    "src/features/report-coverage/components/CoverageListTable.vue",
    "src/features/report-coverage/components/ReportCoveragePanel.vue",
  ];

  it.each(files)("translates every Chinese interface literal in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const literals = [...source.matchAll(/["']([^"'\r\n]*[\u3400-\u9fff][^"'\r\n]*)["']/gu)].map((match) => match[1]);
    const missing = [...new Set(literals)].filter((value) => !hasEnglishTranslation(value));
    expect(missing).toEqual([]);
  });
});
