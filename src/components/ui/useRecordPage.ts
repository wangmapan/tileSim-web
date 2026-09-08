import { computed, ref, watch, type ComputedRef } from "vue";

export function useRecordPage<T>(records: ComputedRef<readonly T[]>) {
  const pageSize = 25;
  const requestedPage = ref(1);
  const pages = computed(() => Math.max(1, Math.ceil(records.value.length / pageSize)));
  const page = computed({
    get: () => Math.min(requestedPage.value, pages.value),
    set: (value: number) => {
      requestedPage.value = Math.max(1, Math.min(value, pages.value));
    },
  });
  const visibleRecords = computed(() => records.value.slice((page.value - 1) * pageSize, page.value * pageSize));
  watch(records, () => {
    requestedPage.value = 1;
  });
  return { page, pages, visibleRecords };
}
