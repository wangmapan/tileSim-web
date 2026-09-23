/**
 * "Configure everything with the form" entry (R2) shared by both workbenches.
 *
 * Keeping the template-loading policy here (rather than in each view) means the
 * rule that matters — a failed template load must abort the mode switch instead
 * of leaving an empty structured document behind — is stated once and covered by
 * unit tests.
 */
import { seedEntriesFromControls, seedStructuredInput, type SeedNote } from "./structured-input";
import type { ExperimentControlDescriptor, ParameterValue } from "./types";

export type StructuredSeedResult =
  { ok: false; message: string } | { ok: true; runtimeJson: string; topologyJson: string; notes: SeedNote[] };

export async function enterStructuredInput(options: {
  runtimeJson: string;
  topologyJson: string;
  fields: readonly ExperimentControlDescriptor[];
  parameterValues: Record<string, ParameterValue>;
  /** Injected so the caller owns the transport (`runExperiment.getTemplate`). */
  loadTemplate: () => Promise<{ runtime_trace: unknown; topology: unknown }>;
}): Promise<StructuredSeedResult> {
  let runtimeJson = options.runtimeJson;
  let topologyJson = options.topologyJson;

  // A template is only fetched when there is no runtime trace yet, so an
  // in-progress document is never replaced. `topologyJson` is only filled when
  // it is empty too.
  if (!runtimeJson.trim()) {
    let template: { runtime_trace: unknown; topology: unknown };
    try {
      template = await options.loadTemplate();
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    if (template?.runtime_trace === undefined) return { ok: false, message: "模板没有返回 runtime_trace。" };
    runtimeJson = JSON.stringify(template.runtime_trace, null, 2);
    if (!topologyJson.trim() && template.topology !== undefined) {
      topologyJson = JSON.stringify(template.topology, null, 2);
    }
  }

  const seeded = seedStructuredInput({
    runtimeJson,
    topologyJson,
    entries: seedEntriesFromControls(options.fields, options.parameterValues),
  });
  return { ok: true, runtimeJson: seeded.runtimeJson, topologyJson: seeded.topologyJson, notes: seeded.notes };
}
