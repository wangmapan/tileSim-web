import type {
  AgentParameterApplyResult,
  AgentParameterEdit,
  AgentParameterJsonPreview,
  AgentParameterStructuredInputs,
} from "./types";

/**
 * The one downward channel from the shared sidebar to the page that owns the
 * experiment form.
 *
 * The sidebar must not import another feature's internals or mutate its store
 * (F9 §13), so the page registers a handler and the sidebar only ever receives
 * a receipt. Registration is single-owner: every page that owns a parameter
 * surface registers on mount and releases on unmount.
 *
 * "Last registration wins" is deliberately not enough on its own. The
 * experiment pages live inside `KeepAlive`, so a page the user has navigated
 * away from is still registered and would keep answering for a catalogue it no
 * longer publishes. A page therefore declares itself the live one at the same
 * moment it publishes its catalogue, which keeps the handler and the catalogue
 * describing the same form.
 */
export type AgentParameterHandler = (
  edits: readonly AgentParameterEdit[],
  structuredInputs?: AgentParameterStructuredInputs,
) => AgentParameterApplyResult;
export type AgentParameterPreviewHandler = (
  edits: readonly AgentParameterEdit[],
  structuredInputs?: AgentParameterStructuredInputs,
) => AgentParameterJsonPreview | null;

export interface AgentCommandRegistry {
  register(
    providerId: string,
    handler: AgentParameterHandler,
    previewHandler?: AgentParameterPreviewHandler,
  ): () => void;
  /**
   * Declares which registered page is currently on screen. An unknown id is
   * ignored, so a page cannot activate itself into a state where nothing can
   * answer while the caller still believes parameter edits are available.
   */
  activate(providerId: string): void;
  /** True while some mounted page can accept parameter edits. */
  available(): boolean;
  /** Returns a rejection receipt instead of throwing when no page can accept. */
  apply(
    edits: readonly AgentParameterEdit[],
    structuredInputs?: AgentParameterStructuredInputs,
  ): AgentParameterApplyResult;
  /** Returns the current page's validated structured JSON proposal, if any. */
  preview(
    edits: readonly AgentParameterEdit[],
    structuredInputs?: AgentParameterStructuredInputs,
  ): AgentParameterJsonPreview | null;
}

function unavailable(reason: string): AgentParameterApplyResult {
  return {
    receipts: [],
    channelMoved: false,
    note: reason,
  };
}

export function createAgentCommandRegistry(): AgentCommandRegistry {
  const handlers = new Map<string, AgentParameterHandler>();
  const previews = new Map<string, AgentParameterPreviewHandler>();
  let activeProviderId: string | null = null;

  return {
    register(providerId, handler, previewHandler) {
      if (!providerId) throw new Error("agent_parameter_provider_id_required");
      handlers.set(providerId, handler);
      if (previewHandler) previews.set(providerId, previewHandler);
      else previews.delete(providerId);
      activeProviderId = providerId;
      return () => {
        handlers.delete(providerId);
        previews.delete(providerId);
        if (activeProviderId === providerId) {
          activeProviderId = handlers.keys().next().value ?? null;
        }
      };
    },
    activate(providerId) {
      if (handlers.has(providerId)) activeProviderId = providerId;
    },
    available() {
      return activeProviderId !== null && handlers.has(activeProviderId);
    },
    apply(edits, structuredInputs) {
      const handler = activeProviderId ? handlers.get(activeProviderId) : undefined;
      if (!handler) return unavailable("当前页面没有可以写入的参数面板。");
      // A complete JSON proposal can legitimately contain no scalar edits. It
      // still needs the owning page to validate and write both documents; only
      // an actually empty proposal (no edits and no structured inputs) is a
      // no-op. This keeps direct JSON editing useful without bypassing the
      // page-owned validator.
      if (!edits.length && !structuredInputs) return unavailable("没有任何通过校验的改动可写入。");
      return handler(edits, structuredInputs);
    },
    preview(edits, structuredInputs) {
      const handler = activeProviderId ? previews.get(activeProviderId) : undefined;
      return handler ? handler(edits, structuredInputs) : null;
    },
  };
}
