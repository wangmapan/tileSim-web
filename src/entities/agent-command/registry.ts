import type { AgentParameterApplyResult, AgentParameterEdit } from "./types";

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
export type AgentParameterHandler = (edits: readonly AgentParameterEdit[]) => AgentParameterApplyResult;

export interface AgentCommandRegistry {
  register(providerId: string, handler: AgentParameterHandler): () => void;
  /**
   * Declares which registered page is currently on screen. An unknown id is
   * ignored, so a page cannot activate itself into a state where nothing can
   * answer while the caller still believes parameter edits are available.
   */
  activate(providerId: string): void;
  /** True while some mounted page can accept parameter edits. */
  available(): boolean;
  /** Returns a rejection receipt instead of throwing when no page can accept. */
  apply(edits: readonly AgentParameterEdit[]): AgentParameterApplyResult;
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
  let activeProviderId: string | null = null;

  return {
    register(providerId, handler) {
      if (!providerId) throw new Error("agent_parameter_provider_id_required");
      handlers.set(providerId, handler);
      activeProviderId = providerId;
      return () => {
        handlers.delete(providerId);
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
    apply(edits) {
      const handler = activeProviderId ? handlers.get(activeProviderId) : undefined;
      if (!handler) return unavailable("当前页面没有可以写入的参数面板。");
      if (!edits.length) return unavailable("没有任何通过校验的改动可写入。");
      return handler(edits);
    },
  };
}
