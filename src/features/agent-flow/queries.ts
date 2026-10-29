import { computed, onBeforeUnmount, ref, watch, type MaybeRefOrGetter, toValue } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  createAgentFlow,
  getAgentFlow,
  getAgentFlowEvents,
  observeAgentFlowEvents,
  resumeAgentFlow,
  type AgentFlowBinding,
  type AgentFlowResumeRequest,
  type AgentFlowState,
  type AgentFlowStartRequest,
} from "../../lib/api/agent-flow";
import { BridgeApiError } from "../../lib/api/errors";

const TERMINAL_FLOW_STATUSES = new Set(["completed", "draft_ready", "stale", "refused", "cancelled", "failed"]);

export function shouldRetryAgentFlowQuery(error: unknown): boolean {
  if (error instanceof BridgeApiError) return error.retryable || error.status >= 500;
  return error instanceof TypeError;
}

export function agentFlowRefetchInterval(query: { state: { data?: AgentFlowState; error?: unknown } }): number | false {
  if (query.state.data && TERMINAL_FLOW_STATUSES.has(query.state.data.status)) return false;
  if (query.state.error && !shouldRetryAgentFlowQuery(query.state.error)) return false;
  return 2_000;
}

function bindingKey(binding: AgentFlowBinding | null | undefined): unknown {
  if (!binding) return null;
  return {
    session_id: binding.session_id,
    flow_id: binding.flow_id,
    run_id: binding.run_id,
    run_context_revision: binding.run_context_revision,
    backend_identity: binding.backend_identity,
    schema_set_revision: binding.schema_set_revision,
    input_snapshot_digest: binding.input_snapshot_digest,
    artifact_bindings: binding.artifact_bindings.map((artifact) => ({ ...artifact })),
  };
}

export function agentFlowQueryKey(flowId: string, binding?: AgentFlowBinding | null) {
  return ["agent-flow", "state", flowId, bindingKey(binding)] as const;
}

export function agentFlowEventsQueryKey(flowId: string, afterSequence: number, binding?: AgentFlowBinding | null) {
  return ["agent-flow", "events", flowId, afterSequence, bindingKey(binding)] as const;
}

export function useAgentFlowQuery(
  flowId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentFlowBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(flowId) || "");
  const expected = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => agentFlowQueryKey(id.value, expected.value)),
    queryFn: () => getAgentFlow(id.value, expected.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => (id.value ? agentFlowRefetchInterval(query) : false),
  });
}

export function useAgentFlowEventsQuery(
  flowId: MaybeRefOrGetter<string | null | undefined>,
  afterSequence: MaybeRefOrGetter<number> = 0,
  binding: MaybeRefOrGetter<AgentFlowBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(flowId) || "");
  const after = computed(() => Number(toValue(afterSequence) || 0));
  const expected = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => agentFlowEventsQueryKey(id.value, after.value, expected.value)),
    queryFn: () => getAgentFlowEvents(id.value, after.value, expected.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
  });
}

export function useCreateAgentFlowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { request: AgentFlowStartRequest; idempotencyKey?: string }) =>
      createAgentFlow(variables.request, variables.idempotencyKey),
    onSuccess: (flow) => {
      void queryClient.setQueryData(agentFlowQueryKey(flow.flow_id, flow.binding), flow);
      void queryClient.invalidateQueries({ queryKey: ["agent-flow", "state", flow.flow_id] });
    },
  });
}

export function useResumeAgentFlowMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { flowId: string; request: AgentFlowResumeRequest; idempotencyKey?: string }) =>
      resumeAgentFlow(variables.flowId, variables.request, variables.idempotencyKey),
    onSuccess: (response) => {
      const flow = response.flow;
      void queryClient.setQueryData(agentFlowQueryKey(flow.flow_id, flow.binding), flow);
      void queryClient.invalidateQueries({ queryKey: ["agent-flow", "state", flow.flow_id] });
    },
  });
}

/**
 * Opens one fenced SSE observer. When the stream fails, the status query keeps
 * polling; a later call can reconnect with the last accepted sequence.
 */
export function useAgentFlowEventStream(
  flowId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentFlowBinding | null | undefined> = null,
) {
  const queryClient = useQueryClient();
  const id = computed(() => toValue(flowId) || "");
  const expected = computed(() => toValue(binding) || null);
  const active = ref(false);
  const lastSequence = ref(0);
  const streamError = ref<unknown>(null);
  let controller: AbortController | null = null;
  let token = 0;

  async function start(value: string, currentToken: number): Promise<void> {
    const localController = new AbortController();
    controller = localController;
    active.value = true;
    streamError.value = null;
    try {
      await observeAgentFlowEvents(value, {
        lastEventSequence: lastSequence.value,
        binding: expected.value,
        signal: localController.signal,
        onEvent: (event) => {
          if (currentToken !== token) return;
          if (event.sequence !== lastSequence.value + 1) {
            localController.abort();
            streamError.value = new Error("Flow event sequence is not contiguous.");
            return;
          }
          lastSequence.value = event.sequence;
          void queryClient.invalidateQueries({ queryKey: ["agent-flow", "state", value] });
        },
        onTerminal: () => {
          if (currentToken === token) void queryClient.invalidateQueries({ queryKey: ["agent-flow", "state", value] });
        },
      });
    } catch (error) {
      if (currentToken === token && !localController.signal.aborted) streamError.value = error;
      // Polling remains the source of truth if SSE is unavailable.
    } finally {
      if (currentToken === token) active.value = false;
    }
  }

  watch(
    [id, expected],
    ([value]) => {
      token += 1;
      controller?.abort();
      controller = null;
      lastSequence.value = 0;
      active.value = false;
      streamError.value = null;
      if (value) void start(value, token);
    },
    { immediate: true },
  );
  onBeforeUnmount(() => {
    token += 1;
    controller?.abort();
  });
  return { active, lastSequence, streamError };
}
