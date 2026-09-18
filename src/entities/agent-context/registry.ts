import { clonePageContextEnvelope, isPageContextEnvelope, type PageContextEnvelope } from "./contracts";

export type AgentContextStaleReason =
  "none" | "context_unavailable" | "page_changed" | "route_changed" | "context_revision_changed";

export interface AgentContextAttachmentStatus {
  state: "fresh" | "stale";
  reason: AgentContextStaleReason;
  expected_revision: string;
  current_revision: string;
}

export type AgentContextRegistryListener = (context: PageContextEnvelope | null) => void;

export interface AgentContextRegistry {
  register(providerId: string, context: PageContextEnvelope): () => void;
  update(providerId: string, context: PageContextEnvelope): void;
  activate(providerId: string | null): void;
  current(): PageContextEnvelope | null;
  subscribe(listener: AgentContextRegistryListener): () => void;
  compare(attached: PageContextEnvelope | null): AgentContextAttachmentStatus;
}

function invalidContext(): never {
  throw new Error("invalid_phase1_page_context_envelope");
}

export function compareAgentContexts(
  attached: PageContextEnvelope | null,
  current: PageContextEnvelope | null,
): AgentContextAttachmentStatus {
  if (!attached || !current || current.availability !== "available") {
    return {
      state: "stale",
      reason: "context_unavailable",
      expected_revision: attached?.context_revision ?? "",
      current_revision: current?.context_revision ?? "",
    };
  }
  if (attached.page_id !== current.page_id) {
    return {
      state: "stale",
      reason: "page_changed",
      expected_revision: attached.context_revision,
      current_revision: current.context_revision,
    };
  }
  if (attached.route_name !== current.route_name) {
    return {
      state: "stale",
      reason: "route_changed",
      expected_revision: attached.context_revision,
      current_revision: current.context_revision,
    };
  }
  if (attached.context_revision !== current.context_revision || attached.availability === "stale") {
    return {
      state: "stale",
      reason: "context_revision_changed",
      expected_revision: attached.context_revision,
      current_revision: current.context_revision,
    };
  }
  return {
    state: "fresh",
    reason: "none",
    expected_revision: attached.context_revision,
    current_revision: current.context_revision,
  };
}

export function createAgentContextRegistry(): AgentContextRegistry {
  const contexts = new Map<string, PageContextEnvelope>();
  const listeners = new Set<AgentContextRegistryListener>();
  let activeProviderId: string | null = null;

  function snapshot(): PageContextEnvelope | null {
    const value = activeProviderId ? contexts.get(activeProviderId) : null;
    return value ? clonePageContextEnvelope(value) : null;
  }

  function notify(): void {
    const value = snapshot();
    for (const listener of listeners) listener(value);
  }

  function assertContext(context: PageContextEnvelope): PageContextEnvelope {
    if (!isPageContextEnvelope(context)) invalidContext();
    return clonePageContextEnvelope(context);
  }

  return {
    register(providerId, context) {
      if (!providerId || contexts.has(providerId)) throw new Error("agent_context_provider_already_registered");
      contexts.set(providerId, assertContext(context));
      if (activeProviderId === null) activeProviderId = providerId;
      notify();
      return () => {
        const wasActive = activeProviderId === providerId;
        contexts.delete(providerId);
        if (wasActive) activeProviderId = contexts.keys().next().value ?? null;
        notify();
      };
    },
    update(providerId, context) {
      if (!contexts.has(providerId)) throw new Error("agent_context_provider_not_registered");
      contexts.set(providerId, assertContext(context));
      if (activeProviderId === providerId) notify();
    },
    activate(providerId) {
      if (providerId !== null && !contexts.has(providerId)) throw new Error("agent_context_provider_not_registered");
      activeProviderId = providerId;
      notify();
    },
    current: snapshot,
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    compare(attached) {
      return compareAgentContexts(attached, snapshot());
    },
  };
}
