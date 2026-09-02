import { describe, expect, it } from "vitest";
import { guideRegistry, type GuideDefinition, routedGuideIds, viewGuides } from "../../src/features/guided-help";
import { hasEnglishTranslation } from "../../src/i18n";

const sourceModules = import.meta.glob("../../src/**/*.{ts,vue}", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

const allGuides = Object.values(guideRegistry) as GuideDefinition[];

function copyFor(guide: GuideDefinition) {
  return [
    guide.title,
    guide.description,
    guide.takeaway,
    guide.next.label,
    guide.advanced.title,
    guide.advanced.body,
    ...guide.steps.flatMap((step) => [step.title, step.body]),
    ...guide.terms.flatMap((term) => [term.term, term.definition]),
  ];
}

describe("guided help catalog", () => {
  it("covers routed and embedded modules with three to five semantic steps", () => {
    expect(Object.keys(viewGuides)).toEqual([...routedGuideIds]);
    expect(Object.keys(guideRegistry)).toEqual([...routedGuideIds, "unsupported_schema", "raw_evidence"]);
    for (const guide of allGuides) {
      expect(guide.takeaway.trim()).not.toBe("");
      expect(guide.steps.length).toBeGreaterThanOrEqual(3);
      expect(guide.steps.length).toBeLessThanOrEqual(5);
      expect(new Set(guide.steps.map((step) => step.id)).size).toBe(guide.steps.length);
      for (const step of guide.steps) expect(step.anchor).toMatch(new RegExp(`^${guide.id}-[a-z0-9-]+$`));
      expect(guide.terms.length).toBeGreaterThan(0);
      expect(guide.advanced.body).toMatch(/Schema|identity|SHA-256|Pointer|契约|原始/);
    }
  });

  it("keeps architecture and evidence boundaries explicit", () => {
    expect(copyFor(guideRegistry.execution).join(" ")).toContain("S3/S4/S5");
    expect(copyFor(guideRegistry.execution).join(" ")).toContain("S7");
    expect(copyFor(guideRegistry.attribution).join(" ")).toContain("S7/S8/S9");
    expect(copyFor(guideRegistry.validation).join(" ")).toContain("synthetic consistency");
    expect(copyFor(guideRegistry.validation).join(" ")).toContain("held-out validation");
    expect(copyFor(guideRegistry.experiment).join(" ")).toContain("requested fidelity");
    expect(copyFor(guideRegistry.experiment).join(" ")).toContain("resolved fidelity");
    expect(copyFor(guideRegistry.raw_evidence).join(" ")).toContain("uint64");
    expect(copyFor(guideRegistry.evidence_agent).join(" ")).toContain("需用户确认");
  });

  it("has English copy for every guide definition", () => {
    const missing = [...new Set(allGuides.flatMap(copyFor).filter((value) => !hasEnglishTranslation(value)))];
    expect(missing).toEqual([]);
  });

  it("binds every step to a stable semantic DOM anchor", () => {
    const source = Object.values(sourceModules).join("\n");
    const missing = allGuides
      .flatMap((guide) => guide.steps)
      .map((step) => step.anchor)
      .filter((anchor) => !source.includes(`data-help-anchor="${anchor}"`));
    expect(missing).toEqual([]);
  });
});
