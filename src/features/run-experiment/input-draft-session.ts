/** Tab-local, schema-bound editor recovery. No run, credential or Provider data. */
const key = "tilesim.experiment.input-draft.v2";
const maxLength = 2_200_000;

export type ExperimentInputDraft = {
  mode: "controls" | "json";
  runtimeJson: string;
  topologyJson: string;
};

export function readExperimentInputDraft(revision: string): ExperimentInputDraft | null {
  if (!revision || typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw || raw.length > maxLength) return null;
    const stored = JSON.parse(raw) as ExperimentInputDraft & { revision: string };
    if (
      stored.revision !== revision ||
      !["controls", "json"].includes(stored.mode) ||
      typeof stored.runtimeJson !== "string" ||
      typeof stored.topologyJson !== "string"
    )
      return null;
    return {
      mode: stored.mode,
      runtimeJson: stored.runtimeJson,
      topologyJson: stored.topologyJson,
    };
  } catch {
    return null;
  }
}

export function saveExperimentInputDraft(revision: string, draft: ExperimentInputDraft): void {
  if (!revision || typeof sessionStorage === "undefined") return;
  try {
    const raw = JSON.stringify({ revision, ...draft });
    if (raw.length <= maxLength) sessionStorage.setItem(key, raw);
  } catch {
    // Storage may be disabled or full; editing remains in memory, never bypasses validation.
  }
}
