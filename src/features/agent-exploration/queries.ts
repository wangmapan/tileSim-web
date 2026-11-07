import { computed, toValue, type MaybeRefOrGetter } from "vue";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { authorizeExploration, confirmExplorationPlan, createExploration, explorationAction, getExploration, listExplorations, planExploration } from "./api";
import type { ExplorationCreateRequest, ExplorationPlanningRequest } from "./types";

export function usePlanAgentExplorationMutation() {
  return useMutation({
    mutationFn: (request: ExplorationPlanningRequest) => planExploration(request),
  });
}

export function useConfirmAgentExplorationPlanMutation() {
  return useMutation({
    mutationFn: (value: { plan: Record<string, unknown>; confirmation: Record<string, unknown> }) =>
      confirmExplorationPlan(value.plan, value.confirmation),
  });
}

export function useAgentExplorationsQuery(enabled: MaybeRefOrGetter<boolean> = true) {
  return useQuery({
    queryKey: ["agent-explorations", "list"],
    queryFn: listExplorations,
    enabled: computed(() => Boolean(toValue(enabled))),
    refetchInterval: 1500,
    retry: false,
  });
}
export function useAgentExplorationQuery(id: MaybeRefOrGetter<string | null | undefined>) {
  const value = computed(() => toValue(id) || "");
  return useQuery({
    queryKey: computed(() => ["agent-explorations", value.value]),
    queryFn: () => getExploration(value.value),
    enabled: computed(() => Boolean(value.value)),
    refetchInterval: 1000,
    retry: false,
  });
}
export function useCreateAgentExplorationMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (request: ExplorationCreateRequest) => createExploration(request),
    onSuccess: (data) => {
      client.invalidateQueries({ queryKey: ["agent-explorations"] });
      client.setQueryData(["agent-explorations", data.session.session_id], data);
    },
  });
}
export function useAuthorizeAgentExplorationMutation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; budget?: unknown }) => authorizeExploration(v.id, v.budget),
    onSuccess: (data) => {
      client.invalidateQueries({ queryKey: ["agent-explorations"] });
      client.setQueryData(["agent-explorations", data.session.session_id], data);
    },
  });
}
export function useAgentExplorationActionMutation(action: "pause" | "resume" | "cancel") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => explorationAction(id, action),
    onSuccess: (data) => {
      client.invalidateQueries({ queryKey: ["agent-explorations"] });
      client.setQueryData(["agent-explorations", data.session.session_id], data);
    },
  });
}
