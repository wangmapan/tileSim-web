import { describe, expect, it } from "vitest";
import { UNPUBLISHED_CONTEXT_REVISION, createPageContextRevisionKeeper } from "../../src/entities/agent-context";
import appSource from "../../src/App.vue?raw";
import experimentViewSource from "../../src/views/ExperimentView.vue?raw";
import lightweightPrepareSource from "../../src/views/LightweightPrepareView.vue?raw";

const PREFIX = "context:lightweight_prepare:no-run:schema-unavailable:backend-unavailable";

function contentOf(values: Record<string, string>): unknown {
  return { context_revision: UNPUBLISHED_CONTEXT_REVISION, current_values: values };
}

describe("page context revision keeper", () => {
  it("keeps the revision while the published content is unchanged", () => {
    const revise = createPageContextRevisionKeeper();

    const first = revise(PREFIX, contentOf({ max_batch_size: "8" }));
    // The publisher ran again because a watched input was touched, not because the
    // page changed: a plan read just before this must stay applicable.
    const second = revise(PREFIX, contentOf({ max_batch_size: "8" }));

    expect(first.changed).toBe(true);
    expect(first.revision).toBe(`${PREFIX}:1`);
    expect(second.changed).toBe(false);
    expect(second.revision).toBe(first.revision);
  });

  it("mints a new revision once the content moves", () => {
    const revise = createPageContextRevisionKeeper();

    const first = revise(PREFIX, contentOf({ max_batch_size: "8" }));
    const second = revise(PREFIX, contentOf({ max_batch_size: "16" }));

    expect(second.changed).toBe(true);
    expect(second.revision).toBe(`${PREFIX}:2`);
    expect(second.revision).not.toBe(first.revision);
  });

  it("mints a new revision when the page identity behind the prefix moves", () => {
    const revise = createPageContextRevisionKeeper();

    const first = revise(PREFIX, contentOf({ max_batch_size: "8" }));
    const second = revise(
      "context:lightweight_prepare:run-1:schema-unavailable:backend-unavailable",
      contentOf({ max_batch_size: "8" }),
    );

    expect(second.changed).toBe(true);
    expect(second.revision.startsWith("context:lightweight_prepare:run-1:")).toBe(true);
    expect(second.revision).not.toBe(first.revision);
  });

  it("reports a change again after the content returns to an earlier reading", () => {
    const revise = createPageContextRevisionKeeper();

    revise(PREFIX, contentOf({ max_batch_size: "8" }));
    const changed = revise(PREFIX, contentOf({ max_batch_size: "16" }));
    const restored = revise(PREFIX, contentOf({ max_batch_size: "8" }));

    // Only the immediately previous publication is compared, so going back to an
    // earlier reading is a change like any other — never a silent no-op.
    expect(changed.changed).toBe(true);
    expect(restored.changed).toBe(true);
    expect(restored.revision).toBe(`${PREFIX}:3`);
  });

  it("keeps separate pages on separate sequences", () => {
    const first = createPageContextRevisionKeeper();
    const second = createPageContextRevisionKeeper();

    first(PREFIX, contentOf({ max_batch_size: "8" }));
    const other = second(PREFIX, contentOf({ max_batch_size: "8" }));

    expect(other.revision).toBe(`${PREFIX}:1`);
  });
});

describe("every publisher holds its revision steady", () => {
  // Regression guard: a counter that moves on every publication is exactly what
  // refused a plan over a page that had not changed, so no publisher may go back to
  // minting a revision unconditionally.
  it.each([
    ["the lightweight prepare page", lightweightPrepareSource, "lightweight_prepare"],
    ["the experiment page", experimentViewSource, "experiment"],
  ])("%s keeps its revision through the keeper", (_label, source, scope: string) => {
    expect(source).toContain("createPageContextRevisionKeeper");
    expect(source).toContain("UNPUBLISHED_CONTEXT_REVISION");
    expect(source).not.toContain("agentContextSequence += 1");
    expect(source).toContain(`context:${scope}:`);
  });

  it.each([
    ["the lightweight prepare page", lightweightPrepareSource],
    ["the experiment page", experimentViewSource],
  ])("%s still declares its context when the revision did not move", (_label, source) => {
    // Holding the revision steady and staying silent are two different things.
    // Skipping the publication left the shell's parameter-free projection
    // standing as the live context — the panel then answered about the page
    // instead of its parameters, and a plan read against the form was refused.
    expect(source).not.toContain("if (!changed) return;");
    expect(source).not.toContain("{ revision, changed }");
  });

  it("keeps the shell's own projection steady too", () => {
    expect(appSource).toContain("createPageContextRevisionKeeper");
    expect(appSource).not.toContain("appContextSequence += 1");
  });

  it("forwards a page's publication unless that exact context already stands", () => {
    expect(appSource).toContain("current?.page_id === publication.context.page_id");
    expect(appSource).toContain("current.context_revision === publication.context.context_revision");
  });
});
