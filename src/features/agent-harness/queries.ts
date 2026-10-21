import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { computed, type MaybeRefOrGetter, toValue } from "vue";
import {
  AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
  getAgentHarnessCapabilities,
  getAgentHarnessOperation,
  getAgentHarnessOperationSnapshots,
  getAgentHarnessOperations,
  getAgentHarnessToolCatalog,
  createAgentHarnessDraft,
  createAgentHarnessDraftApproval,
  deleteAgentHarnessDraft,
  getAgentHarnessDraft,
  getAgentHarnessDraftApproval,
  getAgentHarnessDraftEvents,
  type AgentHarnessBinding,
  type AgentHarnessApprovalCreateRequest,
  type AgentHarnessDraftBinding,
  type AgentHarnessDraftCreateRequest,
  type AgentHarnessDraftValidationRequest,
  type AgentHarnessOperationSnapshot,
  rejectAgentHarnessDraftApproval,
  revokeAgentHarnessDraftApproval,
  getAgentHarnessExecution,
  getAgentHarnessExecutionEvents,
  getAgentHarnessExecutionResult,
  getAgentHarnessExecutionSnapshots,
  mutateAgentHarnessExecution,
  observeAgentHarnessExecution,
  submitAgentHarnessExecution,
  type AgentHarnessExecutionBinding,
  type AgentHarnessExecutionProjection,
  type AgentHarnessExecutionRequest,
  validateAgentHarnessDraft,
} from "../../lib/api/agent-harness";
import { shouldRefreshAgentHarnessSnapshots } from "./task-center";

export const AGENT_HARNESS_OPERATION_REFRESH_INTERVAL_MS = 5_000;

function bindingKey(binding: AgentHarnessDraftBinding | null | undefined) {
  if (!binding) return null;
  return {
    backend_identity: binding.backend_identity || null,
    schema_set_revision: binding.schema_set_revision || AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    input_snapshot_digest: binding.input_snapshot_digest || null,
    draft_digest: binding.draft_digest || null,
    validation_id: binding.validation_id || null,
  };
}

export function agentHarnessDraftQueryKey(draftId: string, binding?: AgentHarnessDraftBinding | null) {
  return ["agent-harness", "draft", draftId, bindingKey(binding)] as const;
}

export function agentHarnessApprovalQueryKey(
  draftId: string,
  approvalId: string,
  binding?: AgentHarnessDraftBinding | null,
) {
  return ["agent-harness", "approval", draftId, approvalId, bindingKey(binding)] as const;
}

export function useAgentHarnessDraftQuery(
  draftId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentHarnessDraftBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(draftId) || "");
  const expectedBinding = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => agentHarnessDraftQueryKey(id.value, expectedBinding.value)),
    queryFn: () => getAgentHarnessDraft(id.value, expectedBinding.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
  });
}

export function useAgentHarnessDraftEventsQuery(
  draftId: MaybeRefOrGetter<string | null | undefined>,
  lastEventSequence: MaybeRefOrGetter<number> = 0,
  binding: MaybeRefOrGetter<AgentHarnessDraftBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(draftId) || "");
  const sequence = computed(() => toValue(lastEventSequence));
  const expectedBinding = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => [
      "agent-harness",
      "draft-events",
      id.value,
      sequence.value,
      AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
      bindingKey(expectedBinding.value),
    ]),
    queryFn: () => getAgentHarnessDraftEvents(id.value, sequence.value, expectedBinding.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
  });
}

export function useAgentHarnessApprovalQuery(
  draftId: MaybeRefOrGetter<string | null | undefined>,
  approvalId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentHarnessDraftBinding | null | undefined> = null,
) {
  const draft = computed(() => toValue(draftId) || "");
  const approval = computed(() => toValue(approvalId) || "");
  const expectedBinding = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => agentHarnessApprovalQueryKey(draft.value, approval.value, expectedBinding.value)),
    queryFn: () => getAgentHarnessDraftApproval(draft.value, approval.value, expectedBinding.value),
    enabled: computed(() => Boolean(draft.value && approval.value)),
    staleTime: 0,
    retry: false,
  });
}

export function useCreateAgentHarnessDraftMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      request: AgentHarnessDraftCreateRequest;
      idempotencyKey?: string;
      expectedBinding?: AgentHarnessDraftBinding | null;
    }) => createAgentHarnessDraft(variables.request, variables),
    onSuccess: (draft) => queryClient.invalidateQueries({ queryKey: ["agent-harness", "draft", draft.draft_id] }),
  });
}

export function useValidateAgentHarnessDraftMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      draftId: string;
      request?: AgentHarnessDraftValidationRequest;
      idempotencyKey?: string;
      expectedBinding?: AgentHarnessDraftBinding | null;
    }) => validateAgentHarnessDraft(variables.draftId, variables.request, variables),
    onSuccess: (_validation, variables) =>
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "draft", variables.draftId] }),
  });
}

export function useDeleteAgentHarnessDraftMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: { draftId: string; idempotencyKey?: string }) =>
      deleteAgentHarnessDraft(variables.draftId, variables.idempotencyKey),
    onSuccess: (_result, variables) =>
      queryClient.removeQueries({ queryKey: ["agent-harness", "draft", variables.draftId] }),
  });
}

export function useCreateAgentHarnessApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      draftId: string;
      request: AgentHarnessApprovalCreateRequest;
      idempotencyKey?: string;
      expectedBinding?: AgentHarnessDraftBinding | null;
    }) => createAgentHarnessDraftApproval(variables.draftId, variables.request, variables),
    onSuccess: (approval) =>
      queryClient.invalidateQueries({
        queryKey: ["agent-harness", "approval", approval.draft_id, approval.approval_id],
      }),
  });
}

export function useRejectAgentHarnessApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      draftId: string;
      approvalId: string;
      reason: string;
      idempotencyKey?: string;
      expectedBinding?: AgentHarnessDraftBinding | null;
    }) => rejectAgentHarnessDraftApproval(variables.draftId, variables.approvalId, variables.reason, variables),
    onSuccess: (approval) =>
      queryClient.invalidateQueries({
        queryKey: ["agent-harness", "approval", approval.draft_id, approval.approval_id],
      }),
  });
}

export function useRevokeAgentHarnessApprovalMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      draftId: string;
      approvalId: string;
      reason: string;
      idempotencyKey?: string;
      expectedBinding?: AgentHarnessDraftBinding | null;
    }) => revokeAgentHarnessDraftApproval(variables.draftId, variables.approvalId, variables.reason, variables),
    onSuccess: (approval) =>
      queryClient.invalidateQueries({
        queryKey: ["agent-harness", "approval", approval.draft_id, approval.approval_id],
      }),
  });
}

export function useAgentHarnessCapabilitiesQuery(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({
    queryKey: ["agent-harness", "capabilities"],
    queryFn: getAgentHarnessCapabilities,
    enabled: computed(() => Boolean(toValue(enabled))),
    staleTime: 30_000,
    retry: false,
  });
}

export function useAgentHarnessToolCatalogQuery() {
  return useQuery({
    queryKey: ["agent-harness", "tools"],
    queryFn: getAgentHarnessToolCatalog,
    staleTime: 30_000,
    retry: false,
  });
}

export function useAgentHarnessOperationQuery(
  operationId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentHarnessBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(operationId) || "");
  const expectedBinding = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: ["agent-harness", "operation", id, expectedBinding],
    enabled: computed(() => Boolean(id.value)),
    queryFn: () => getAgentHarnessOperation(id.value, expectedBinding.value),
    staleTime: 0,
    retry: false,
  });
}

export function useAgentHarnessOperationsQuery(
  enabled: MaybeRefOrGetter<boolean> = true,
  runId: MaybeRefOrGetter<string | null | undefined> = null,
) {
  const queryEnabled = computed(() => toValue(enabled));
  const selectedRunId = computed(() => toValue(runId) || null);
  return useQuery({
    queryKey: ["agent-harness", "operations", selectedRunId, AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION],
    queryFn: getAgentHarnessOperations,
    enabled: queryEnabled,
    staleTime: 0,
    retry: false,
  });
}

export function useAgentHarnessOperationSnapshotsQuery(
  enabled: MaybeRefOrGetter<boolean> = true,
  runId: MaybeRefOrGetter<string | null | undefined> = null,
) {
  const queryEnabled = computed(() => toValue(enabled));
  const selectedRunId = computed(() => toValue(runId) || null);
  return useQuery<AgentHarnessOperationSnapshot[]>({
    queryKey: ["agent-harness", "operation-snapshots", selectedRunId, AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION],
    queryFn: () => getAgentHarnessOperationSnapshots(selectedRunId.value),
    enabled: queryEnabled,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) =>
      shouldRefreshAgentHarnessSnapshots(query.state.data) ? AGENT_HARNESS_OPERATION_REFRESH_INTERVAL_MS : false,
  });
}

export function agentHarnessExecutionQueryKey(operationId: string, binding?: AgentHarnessExecutionBinding | null) {
  return ["agent-harness", "execution", operationId, binding || null] as const;
}

export function useAgentHarnessExecutionQuery(
  operationId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentHarnessExecutionBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(operationId) || "");
  const expectedBinding = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => agentHarnessExecutionQueryKey(id.value, expectedBinding.value)),
    queryFn: () => getAgentHarnessExecution(id.value, expectedBinding.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
  });
}

export function useAgentHarnessExecutionSnapshotsQuery(
  enabled: MaybeRefOrGetter<boolean> = true,
  runId: MaybeRefOrGetter<string | null | undefined> = null,
) {
  const queryEnabled = computed(() => toValue(enabled));
  const selectedRunId = computed(() => toValue(runId) || null);
  return useQuery({
    queryKey: computed(() => [
      "agent-harness",
      "execution-snapshots",
      selectedRunId.value,
      AGENT_HARNESS_SUCCESSOR_SCHEMA_SET_REVISION,
    ]),
    queryFn: () => getAgentHarnessExecutionSnapshots(selectedRunId.value),
    enabled: queryEnabled,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const snapshots = query.state.data;
      return snapshots?.some(
        (snapshot) =>
          snapshot.error ||
          (snapshot.execution &&
            !["completed", "failed", "cancelled", "recovery_required", "manual_intervention_required"].includes(
              snapshot.execution.state,
            )),
      )
        ? AGENT_HARNESS_OPERATION_REFRESH_INTERVAL_MS
        : false;
    },
  });
}

export function useAgentHarnessExecutionEventsQuery(
  operationId: MaybeRefOrGetter<string | null | undefined>,
  lastEventSequence: MaybeRefOrGetter<number> = 0,
  binding: MaybeRefOrGetter<AgentHarnessExecutionBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(operationId) || "");
  const sequence = computed(() => toValue(lastEventSequence));
  const expectedBinding = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => ["agent-harness", "execution-events", id.value, sequence.value, expectedBinding.value]),
    queryFn: () => getAgentHarnessExecutionEvents(id.value, sequence.value, expectedBinding.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
  });
}

export function useObserveAgentHarnessExecutionQuery(
  operationId: MaybeRefOrGetter<string | null | undefined>,
  options: {
    binding?: MaybeRefOrGetter<AgentHarnessExecutionBinding | null | undefined>;
    enabled?: MaybeRefOrGetter<boolean>;
    preferSse?: boolean;
  } = {},
) {
  const id = computed(() => toValue(operationId) || "");
  const expectedBinding = computed(() => toValue(options.binding || null) || null);
  const enabled = computed(
    () => Boolean(id.value) && (options.enabled === undefined || Boolean(toValue(options.enabled))),
  );
  return useQuery<AgentHarnessExecutionProjection>({
    queryKey: computed(() => ["agent-harness", "execution-observation", id.value, expectedBinding.value]),
    queryFn: () =>
      observeAgentHarnessExecution(id.value, { expectedBinding: expectedBinding.value, preferSse: options.preferSse }),
    enabled,
    staleTime: 0,
    retry: false,
    refetchInterval: (query) => {
      const projection = query.state.data;
      return projection && (projection.terminal || projection.requires_recovery)
        ? false
        : AGENT_HARNESS_OPERATION_REFRESH_INTERVAL_MS;
    },
  });
}

export function useSubmitAgentHarnessExecutionMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      request: AgentHarnessExecutionRequest;
      idempotencyKey?: string;
      expectedBinding?: AgentHarnessExecutionBinding | null;
    }) => submitAgentHarnessExecution(variables.request, variables),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "execution", response.execution.operation_id] });
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "operations"] });
    },
  });
}

export function useAgentHarnessExecutionActionMutation(action: "cancel" | "retry" | "resume") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (variables: {
      operationId: string;
      idempotencyKey?: string;
      expectedBinding?: AgentHarnessExecutionBinding | null;
    }) => mutateAgentHarnessExecution(variables.operationId, action, variables),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "execution", response.execution.operation_id] });
      queryClient.invalidateQueries({ queryKey: ["agent-harness", "operations"] });
    },
  });
}

export function useAgentHarnessExecutionResultQuery(
  operationId: MaybeRefOrGetter<string | null | undefined>,
  binding: MaybeRefOrGetter<AgentHarnessExecutionBinding | null | undefined> = null,
) {
  const id = computed(() => toValue(operationId) || "");
  const expectedBinding = computed(() => toValue(binding) || null);
  return useQuery({
    queryKey: computed(() => ["agent-harness", "execution-result", id.value, expectedBinding.value]),
    queryFn: () => getAgentHarnessExecutionResult(id.value, expectedBinding.value),
    enabled: computed(() => Boolean(id.value)),
    staleTime: 0,
    retry: false,
  });
}
