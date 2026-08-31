import { computed, reactive } from "vue";
import { defineStore } from "pinia";
import type { HistoryState } from "../entities/dashboard/types";

export const useHistoryStore = defineStore("history", () => {
  const history = reactive<HistoryState>({
    runs: [],
    loading: false,
    selected: [],
    comparisons: {},
    query: "",
  });
  const filteredRuns = computed(() => {
    const query = history.query.trim().toLowerCase();
    if (!query) return history.runs;
    return history.runs.filter((run) =>
      [run.run_name, run.run_id, run.status, run.input_mode].some((value) =>
        String(value || "")
          .toLowerCase()
          .includes(query),
      ),
    );
  });

  return { history, filteredRuns };
});
