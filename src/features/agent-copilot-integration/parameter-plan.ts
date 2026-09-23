/**
 * Decides whether a parameter plan still describes the values it is about.
 *
 * A plan is a list of assignments the page answered for: it says "this address
 * currently holds `previous`, write `next` instead". What makes it inapplicable
 * is the state of those addresses — not the page's revision token, which also
 * moves for reasons that say nothing about the values a plan addresses: a
 * health check in flight, a re-projection of an equal envelope, a kept-alive
 * page re-declaring itself, a descriptor refresh that lands on the same
 * content. Refusing on the token alone rejected a plan the user had read
 * moments earlier over a page they had not touched.
 *
 * The token is therefore only used to say *why* a plan is still good — whether
 * the page published anything at all since it was shown — while the addressed
 * values are what decide it. A plan whose addresses have moved, or whose
 * addresses the page no longer offers, is still refused: a plan names exact
 * addresses and the values it read there, so it must never be applied against a
 * page that no longer holds them.
 */
import type { AgentParameterEdit } from "../../entities/agent-command";

/** The live value of one addressable parameter, as the owning page publishes it. */
export type LiveParameterValue = {
  path: string;
  /** Serialized current value, or `null` when the knob/key is unset. */
  current: string | null;
};

/** The first addressed value that no longer matches what the plan read. */
export type MovedPlanTarget = {
  label: string;
  path: string;
  /** What the plan read, `null` when it read "unset". */
  expected: string | null;
  /** What the page holds now, `null` when the address is gone. */
  current: string | null;
  /** True when the page no longer offers this address at all. */
  missing: boolean;
};

export type ParameterPlanAssessment =
  | {
      applicable: true;
      /**
       * `revision` — the page has published nothing since the plan was shown, so
       * its addresses cannot have moved. `values` — it published something, but
       * nothing this plan addresses.
       */
      basis: "revision" | "values";
    }
  | {
      applicable: false;
      /** The address that moved, or `null` when there is nothing to apply. */
      moved: MovedPlanTarget | null;
    };

export function assessParameterPlan(input: {
  edits: readonly AgentParameterEdit[];
  live: readonly LiveParameterValue[];
  /** The revision the plan was read from, `null` once the page dropped it. */
  planRevision: string | null;
  /** The revision the page is publishing now. */
  currentRevision: string | null;
}): ParameterPlanAssessment {
  if (!input.edits.length) return { applicable: false, moved: null };
  // An empty catalogue means the page is publishing no addressable surface at
  // all (it is not ready, or it has left the parameter view). Nothing can be
  // verified against it, so the plan is refused without pretending to know
  // which address went missing.
  if (!input.live.length) return { applicable: false, moved: null };
  const live = new Map(input.live.map((entry) => [entry.path, entry.current]));
  for (const edit of input.edits) {
    if (!live.has(edit.path)) {
      // The page does not offer this address any more, so the plan cannot be
      // written at all. The page's own editors reject unknown addresses, and a
      // knob no longer in the catalogue would be written into a field the
      // descriptor no longer knows about, which is worse than refusing.
      return {
        applicable: false,
        moved: { label: edit.label, path: edit.path, expected: edit.previous, current: null, missing: true },
      };
    }
    const current = live.get(edit.path) ?? null;
    if (current !== edit.previous) {
      return {
        applicable: false,
        moved: { label: edit.label, path: edit.path, expected: edit.previous, current, missing: false },
      };
    }
  }
  const unchangedRevision = Boolean(input.planRevision) && input.planRevision === input.currentRevision;
  return { applicable: true, basis: unchangedRevision ? "revision" : "values" };
}

/** How a value the plan read is named in a user-facing sentence. */
export function describePlanValue(value: string | null): string {
  return value === null || value === "" ? "未设置" : value;
}
