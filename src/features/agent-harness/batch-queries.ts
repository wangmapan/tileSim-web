import { computed, onBeforeUnmount, ref, watch, type MaybeRefOrGetter, toValue } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import {
  approveAgentBatch,
  createAgentBatch,
  getAgentBatch,
  getAgentBatchEvents,
  listAgentBatches,
  mutateAgentBatch,
  observeAgentBatchEvents,
  type AgentBatchBinding,
} from "../../lib/api/agent-batch";
import type {
  AgentHarnessBatchActionRequest,
  AgentHarnessBatchCreateRequest,
} from "../../contracts/generated/agent-harness";

export function useAgentBatchesQuery(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({
    queryKey: ["agent-harness", "batches"],
    queryFn: listAgentBatches,
    enabled: computed(() => Boolean(toValue(enabled))),
    staleTime: 0,
    retry: false,
    refetchInterval: 2000,
  });
}
export function useAgentBatchQuery(
  batchId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentBatchBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(batchId) || "");
  const expected = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => ["agent-harness", "batch", id.value, expected.value]),
    queryFn: () => getAgentBatch(id.value, expected.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
    refetchInterval: 1500,
  });
}
function refresh(queryClient: ReturnType<typeof useQueryClient>, batchId: string) {
  void queryClient.invalidateQueries({ queryKey: ["agent-harness", "batches"] });
  void queryClient.invalidateQueries({ queryKey: ["agent-harness", "batch", batchId] });
}
export function useCreateAgentBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: AgentHarnessBatchCreateRequest) => createAgentBatch(request),
    onSuccess: (detail) => refresh(queryClient, detail.batch.batch_id),
  });
}
export function useApproveAgentBatchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { batchId: string }) => approveAgentBatch(variables.batchId),
    onSuccess: (detail) => refresh(queryClient, detail.batch.batch_id),
  });
}
export function useAgentBatchActionMutation(action: AgentHarnessBatchActionRequest["action"]) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { batchId: string; recoveryAcknowledged?: boolean }) =>
      mutateAgentBatch(variables.batchId, action, variables.recoveryAcknowledged === true),
    onSuccess: (detail) => refresh(queryClient, detail.batch.batch_id),
  });
}
export function useAgentBatchEventsQuery(
  batchId: MaybeRefOrGetter<string | null | undefined>,
  lastEventId: MaybeRefOrGetter<number> = 0,
) {
  const id = computed(() => toValue(batchId) || "");
  const after = computed(() => String(toValue(lastEventId)));
  return useQuery({
    queryKey: computed(() => ["agent-harness", "batch-events", id.value, after.value]),
    queryFn: () => getAgentBatchEvents(id.value, after.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
  });
}
export function useAgentBatchEventStream(batchId: MaybeRefOrGetter<string | null | undefined>) {
  const queryClient = useQueryClient();
  const id = computed(() => toValue(batchId) || "");
  const lastSequence = ref(0);
  const active = ref(false);
  let controller: AbortController | null = null;
  let streamToken = 0;
  const start = async (value: string, token: number) => {
    const localController = new AbortController();
    controller = localController;
    active.value = true;
    try {
      await observeAgentBatchEvents(value, {
        lastEventSequence: lastSequence.value,
        signal: localController.signal,
        onEvent: (event) => {
          if (token !== streamToken) return;
          if (typeof event.sequence !== "number") return;
          if (event.sequence === lastSequence.value + 1) {
            lastSequence.value = event.sequence;
            void queryClient.invalidateQueries({ queryKey: ["agent-harness", "batch", value] });
            return;
          }
          if (event.sequence !== lastSequence.value) {
            localController.abort();
            void queryClient.invalidateQueries({ queryKey: ["agent-harness", "batch", value] });
            void queryClient.invalidateQueries({ queryKey: ["agent-harness", "batch-events", value] });
          }
        },
      });
    } catch {
      /* polling remains the durable fallback */
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
