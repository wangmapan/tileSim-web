import { computed, onBeforeUnmount, ref, watch, type MaybeRefOrGetter, toValue } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  approveAgentOptimizationCandidate,
  createAgentOptimizationSession,
  getAgentOptimizationEvents,
  getAgentOptimizationSession,
  listAgentOptimizationSessions,
  mutateAgentOptimizationSession,
  observeAgentOptimizationEvents,
  type AgentOptimizationBinding,
} from "../../lib/api/agent-optimization";
import {
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  type AgentHarnessOptimizationCreateRequest,
} from "../../lib/api/agent-harness";

export function useAgentOptimizationSessionsQuery(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({
    queryKey: ["agent-harness", "optimization-sessions", AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION],
    queryFn: listAgentOptimizationSessions,
    enabled: computed(() => Boolean(toValue(enabled))),
    staleTime: 0,
    retry: false,
    refetchInterval: 2_000,
  });
}

export function useAgentOptimizationSessionQuery(
  sessionId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentOptimizationBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(sessionId) || "");
  const expected = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => [
      "agent-harness",
      "optimization-session",
      id.value,
      AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
      expected.value,
    ]),
    queryFn: () => getAgentOptimizationSession(id.value, expected.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
    refetchInterval: 1_500,
  });
}

export function useCreateAgentOptimizationSessionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AgentHarnessOptimizationCreateRequest) => createAgentOptimizationSession(request),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "optimization-sessions"] });
      queryClient.setQueryData(
        [
          "agent-harness",
          "optimization-session",
          detail.session.session_id,
          AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
          null,
        ],
        detail,
      );
    },
  });
}

export function useApproveAgentOptimizationCandidateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { sessionId: string; candidateId: string }) =>
      approveAgentOptimizationCandidate(variables.sessionId, variables.candidateId),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "optimization-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "optimization-session", detail.session.session_id] });
    },
  });
}

export function useAgentOptimizationActionMutation(action: "pause" | "resume" | "cancel" | "retry") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { sessionId: string; recoveryAcknowledged?: boolean }) =>
      mutateAgentOptimizationSession(variables.sessionId, action, variables.recoveryAcknowledged === true),
    onSuccess: (detail) => {
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "optimization-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "optimization-session", detail.session.session_id] });
    },
  });
}

export function useAgentOptimizationEventsQuery(
  sessionId: MaybeRefOrGetter<string | null | undefined>,
  lastEventId: MaybeRefOrGetter<number> = 0,
) {
  const id = computed(() => toValue(sessionId) || "");
  const after = computed(() => String(toValue(lastEventId)));
  return useQuery({
    queryKey: computed(() => ["agent-harness", "optimization-events", id.value, after.value]),
    queryFn: () => getAgentOptimizationEvents(id.value, after.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
  });
}

/** Advisory durable-event replay; the session query remains the source-of-truth polling fallback. */
export function useAgentOptimizationEventStream(sessionId: MaybeRefOrGetter<string | null | undefined>) {
  const id = computed(() => toValue(sessionId) || "");
  const lastSequence = ref(0);
  const active = ref(false);
  let controller: AbortController | null = null;
  let streamToken = 0;
  const start = async (value: string, token: number) => {
    const localController = new AbortController();
    controller = localController;
    active.value = true;
    try {
      await observeAgentOptimizationEvents(value, {
        lastEventSequence: lastSequence.value,
        signal: localController.signal,
        onEvent: (event) => {
          if (token !== streamToken) return;
          const sequence = event.sequence;
          if (typeof sequence === "number" && sequence === lastSequence.value + 1) lastSequence.value = sequence;
        },
      });
    } catch {
      // The paired TanStack Query keeps polling after any SSE disconnect or gap.
    } finally {
      if (token === streamToken) active.value = false;
    }
  };
  watch(
    id,
    (value) => {
      streamToken += 1;
      controller?.abort();
      controller = null;
      lastSequence.value = 0;
      active.value = false;
      if (value) void start(value, streamToken);
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    streamToken += 1;
    controller?.abort();
  });
  return { active, lastSequence };
}
