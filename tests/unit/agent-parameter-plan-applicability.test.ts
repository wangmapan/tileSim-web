import { describe, expect, it } from "vitest";
import { assessParameterPlan, describePlanValue } from "../../src/features/agent-copilot-integration";
import appSource from "../../src/App.vue?raw";
import sessionSource from "../../src/features/agent-copilot-integration/copilot-session.ts?raw";
import type { AgentParameterEdit } from "../../src/entities/agent-command";

/**
 * A plan says "this address holds `previous`, write `next`". Whether it can still
 * be written is therefore a question about those addresses, which is what these
 * cases pin down.
 *
 * The regression they exist for: the guard used to compare only the page's
 * revision token, and `markAgentBlocksStale` cleared the token on any
 * republication. A page that republished its envelope for a reason unrelated to
 * the plan — a bridge health check, a re-projection of equal content — therefore
 * made the plan permanently unapplicable, and the user saw「页面上下文已变化」
 * every time they pressed the button.
 */

const moved: AgentParameterEdit = {
  path: "runtime_trace/policy/max_active_requests",
  label: "max_active_requests",
  target: "runtime_trace",
  fieldId: null,
  previous: "4",
  next: "8",
  value: 8,
};

const knob: AgentParameterEdit = {
  path: "overrides/runtime/kv_capacity_tokens",
  label: "KV 容量",
  target: "control",
  fieldId: "s1.runtime.kv_capacity_tokens",
  previous: null,
  next: "4096",
  value: 4096,
};

const edits = [moved, knob] as const;

function live(overrides: Record<string, string | null> = {}) {
  const values = new Map<string, string | null>([
    [moved.path, "4"],
    [knob.path, null],
  ]);
  Object.entries(overrides).forEach(([path, value]) => values.set(path, value));
  return [...values].map(([path, current]) => ({ path, current }));
}

describe("parameter plan applicability", () => {
  it("applies a plan the page has not published over", () => {
    const assessment = assessParameterPlan({
      edits,
      live: live(),
      planRevision: "context:lightweight_prepare:1",
      currentRevision: "context:lightweight_prepare:1",
    });

    expect(assessment).toEqual({ applicable: true, basis: "revision" });
  });

  it("applies a plan whose addresses are intact after an unrelated republication", () => {
    // The reported symptom, without the defect: the page minted a new revision
    // because something it watches was touched, and none of it was a value this
    // plan names.
    const assessment = assessParameterPlan({
      edits,
      live: live(),
      planRevision: "context:lightweight_prepare:1",
      currentRevision: "context:lightweight_prepare:5",
    });

    expect(assessment).toEqual({ applicable: true, basis: "values" });
  });

  it("applies a plan the page dropped the revision of", () => {
    // A revision is an optimised early answer, never the authority: a plan read
    // against a page that has since published its envelope again is still good
    // when every address holds what the plan read.
    const assessment = assessParameterPlan({
      edits,
      live: live(),
      planRevision: null,
      currentRevision: "context:lightweight_prepare:5",
    });

    expect(assessment).toEqual({ applicable: true, basis: "values" });
  });

  it("refuses a plan whose addressed value has moved, and names it", () => {
    const assessment = assessParameterPlan({
      edits,
      live: live({ [moved.path]: "32" }),
      planRevision: "context:lightweight_prepare:1",
      currentRevision: "context:lightweight_prepare:2",
    });

    expect(assessment.applicable).toBe(false);
    expect(assessment.applicable === false && assessment.moved).toEqual({
      label: "max_active_requests",
      path: moved.path,
      expected: "4",
      current: "32",
      missing: false,
    });
  });

  it("refuses a moved value even when the revision still matches", () => {
    // Defence in depth: the token matching means the page published nothing, so
    // this combination should be unreachable — but a value that no longer holds
    // what the plan read must never be written over, whatever the token says.
    const assessment = assessParameterPlan({
      edits,
      live: live({ [knob.path]: "2048" }),
      planRevision: "context:lightweight_prepare:1",
      currentRevision: "context:lightweight_prepare:1",
    });

    expect(assessment.applicable).toBe(false);
    expect(assessment.applicable === false && assessment.moved?.label).toBe("KV 容量");
  });

  it("refuses a plan whose address the page no longer offers", () => {
    // A page that switched its input mode, or lost descriptor fields, offers a
    // smaller surface: writing to an address it no longer lists would either be
    // rejected by its own editors or land on a field the descriptor has dropped.
    const assessment = assessParameterPlan({
      edits,
      live: live().filter((entry) => entry.path !== knob.path),
      planRevision: "context:lightweight_prepare:1",
      currentRevision: "context:lightweight_prepare:2",
    });

    expect(assessment.applicable).toBe(false);
    expect(assessment.applicable === false && assessment.moved).toEqual({
      label: "KV 容量",
      path: knob.path,
      expected: null,
      current: null,
      missing: true,
    });
  });

  it("accepts only future leaves covered by a still-current growth edit", () => {
    const growth: AgentParameterEdit = {
      path: "topology/devices",
      label: "显卡数量",
      target: "topology",
      fieldId: null,
      previous: "4",
      next: "16",
      value: 16,
    };
    const future: AgentParameterEdit = {
      path: "topology/devices[15]/group_id",
      label: "group_id",
      target: "topology",
      fieldId: null,
      previous: null,
      next: "node3",
      value: "node3",
      dependsOn: "topology/devices",
    };
    const assess = (changes: readonly AgentParameterEdit[], count = "4") =>
      assessParameterPlan({
        edits: changes,
        live: [{ path: "topology/devices", current: count }],
        planRevision: "old",
        currentRevision: "new",
      });
    expect(assess([future, growth])).toEqual({ applicable: true, basis: "values" });
    expect(assess([future, growth], "8").applicable).toBe(false);
    expect(assess([future]).applicable).toBe(false);
    expect(assess([{ ...future, path: "topology/devices[16]/group_id" }, growth]).applicable).toBe(false);
    expect(assess([{ ...future, dependsOn: "runtime_trace/requests" }, growth]).applicable).toBe(false);
  });

  it("refuses an empty plan instead of reporting a write it cannot make", () => {
    const assessment = assessParameterPlan({
      edits: [],
      live: live(),
      planRevision: "context:lightweight_prepare:1",
      currentRevision: "context:lightweight_prepare:1",
    });

    expect(assessment).toEqual({ applicable: false, moved: null });
  });

  it("refuses without naming an address when the page offers no surface at all", () => {
    // A page that is not ready (or has left the parameter view) publishes an
    // empty catalogue: there is nothing to verify against, so say so generically
    // rather than claim the plan's addresses disappeared.
    const assessment = assessParameterPlan({
      edits,
      live: [],
      planRevision: "context:lightweight_prepare:1",
      currentRevision: "context:lightweight_prepare:2",
    });

    expect(assessment).toEqual({ applicable: false, moved: null });
  });

  it("names an unset value in words rather than as an empty string", () => {
    expect(describePlanValue(null)).toBe("未设置");
    expect(describePlanValue("")).toBe("未设置");
    expect(describePlanValue("4096")).toBe("4096");
  });
});

describe("the apply step is wired to the addressed values", () => {
  it("asks the assessment rather than comparing the revision itself", () => {
    expect(appSource).toContain("assessParameterPlan({");
    // The exact comparison that used to be the whole guard.
    expect(appSource).not.toContain("if (!block.plan_revision || block.plan_revision !== currentRevision)");
  });

  it("keeps a plan's revision when the page republishes", () => {
    expect(sessionSource).not.toContain('block_type === "parameter_edits") return { ...block, plan_revision: null }');
  });
});
