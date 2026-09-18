import { createApp } from "vue";
import App from "./App.vue";
import { routeForView, router } from "./app/router";
import { appPinia, vueQueryProvider } from "./app/providers";
import { configureDashboardNavigation } from "./store/dashboard";
import { useEvidenceSelectionStore } from "./stores/evidence-selection";
import "./theme";
import "./styles/main.css";

const app = createApp(App);
configureDashboardNavigation((view, runId, replace = false) => {
  const requestId = useEvidenceSelectionStore(appPinia).requestForRun(runId);
  void router[replace ? "replace" : "push"](routeForView(view, runId, requestId));
});
app.use(router);
app.use(appPinia);
app.use(vueQueryProvider.plugin, vueQueryProvider.options);
router.isReady().then(() => app.mount("#app"));
