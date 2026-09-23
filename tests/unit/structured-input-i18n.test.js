import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasEnglishTranslation } from "../../src/i18n";
import { structuredInputEnglishCatalog } from "../../src/i18n/workstreams/structured-input";

/**
 * The structured-input panel is user-facing copy, so every Chinese literal it
 * renders must resolve under the English locale. These files are not part of
 * `i18n-model-coverage.test.js`, so the panel carries its own guard.
 */
const files = [
  "src/features/run-experiment/ExperimentInputPanel.vue",
  "src/features/run-experiment/RuntimePolicyForm.vue",
  "src/features/run-experiment/RequestTableForm.vue",
  "src/features/run-experiment/DeviceInventoryForm.vue",
  "src/features/run-experiment/DomainInventoryForm.vue",
  "src/features/run-experiment/TopologyGraphEditor.vue",
];

describe("structured input English coverage", () => {
  it.each(files)("translates every Chinese literal in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const literals = [...source.matchAll(/["'`]([^"'`\r\n]*[\u3400-\u9fff][^"'`\r\n]*)["'`]/gu)].map(
      (match) => match[1],
    );
    const missing = [...new Set(literals)].filter((value) => !hasEnglishTranslation(value));
    expect(missing).toEqual([]);
  });

  /**
   * Field labels are rendered through `t(policyLabel(key))` — a variable rather
   * than a literal — so the scan above cannot see them. Reading the
   * `*_LABEL_SOURCE` maps directly is what keeps e.g. "设备编号" from silently
   * staying Chinese under the English locale. These files are the ones
   * that own a label map, so a rename of the convention fails loudly here
   * instead of quietly disabling the check.
   */
  const labelMapFiles = [
    "src/features/run-experiment/RuntimePolicyForm.vue",
    "src/features/run-experiment/RequestTableForm.vue",
    "src/features/run-experiment/DeviceInventoryForm.vue",
    "src/features/run-experiment/DomainInventoryForm.vue",
    "src/features/run-experiment/TopologyGraphEditor.vue",
  ];

  it.each(labelMapFiles)("translates every label-map value in %s", (file) => {
    const source = readFileSync(resolve(process.cwd(), file), "utf8");
    const blocks = [...source.matchAll(/_LABEL_SOURCE[^=]*=\s*\{([\s\S]*?)\n\};/g)].map((match) => match[1]);
    const labels = blocks.flatMap((block) => [...block.matchAll(/:\s*"([^"\r\n]+)"/g)].map((match) => match[1]));
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.filter((value) => !hasEnglishTranslation(value))).toEqual([]);
  });

  it("keeps the panel catalog free of empty translations", () => {
    const empty = Object.entries(structuredInputEnglishCatalog)
      .filter(([, value]) => !value.trim().length)
      .map(([key]) => key);
    expect(empty).toEqual([]);
  });

  it("keeps every placeholder of the source string in its translation", () => {
    const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
    const mismatched = Object.entries(structuredInputEnglishCatalog)
      .filter(([source, translation]) => {
        return placeholders(source).join(",") !== placeholders(translation).join(",");
      })
      .map(([key]) => key);
    expect(mismatched).toEqual([]);
  });
});
