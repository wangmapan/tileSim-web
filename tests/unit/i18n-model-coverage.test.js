import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasEnglishTranslation } from "../../src/i18n";
import { coreEnglishCatalog } from "../../src/i18n/english-catalog";
import { evidenceAgentEnglishCatalog } from "../../src/i18n/workstreams/evidence-agent";
import { guidedHelpEnglishCatalog } from "../../src/i18n/workstreams/guided-help";
import { visualizationEnglishCatalog } from "../../src/i18n/workstreams/visualization";

const modelFiles = ["records.ts", "visualizations.ts"];

const catalogs = {
  core: coreEnglishCatalog,
  evidenceAgent: evidenceAgentEnglishCatalog,
  guidedHelp: guidedHelpEnglishCatalog,
  visualization: visualizationEnglishCatalog,
};

function chineseStringLiterals(file) {
  const source = readFileSync(resolve(process.cwd(), "src/features/execution-inspector/model", file), "utf8");
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
    "src/features/run-bound-evidence/components/RequestEvidenceAction.vue",
  ];

  it.each(files)("translates every Chinese interface literal in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const literals = [...source.matchAll(/["']([^"'\r\n]*[\u3400-\u9fff][^"'\r\n]*)["']/gu)].map((match) => match[1]);
    const missing = [...new Set(literals)].filter((value) => !hasEnglishTranslation(value));
    expect(missing).toEqual([]);
  });
});
