import { VueQueryPlugin, type VueQueryPluginOptions } from "@tanstack/vue-query";
import { queryClient } from "../lib/query-client";
import { appPinia } from "../stores/pinia";

export { appPinia };

export const vueQueryProvider = {
  plugin: VueQueryPlugin,
  options: { queryClient } satisfies VueQueryPluginOptions,
};
