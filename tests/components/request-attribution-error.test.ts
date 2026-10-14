/** @vitest-environment jsdom */
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import RequestAttributionPanel from "../../src/features/execution-inspector/components/RequestAttributionPanel.vue";

describe("request attribution failure contract", () => {
  it("exposes the CLI code, duplicate pointer, remediation and retry without a fake cause chain", () => {
    const wrapper = mount(RequestAttributionPanel, {
      props: {
        runId: "run-duplicate",
        run: null,
        runMetadata: {
          run_id: "run-duplicate",
          status: "failed",
          cli_error_code: "REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED",
          cli_field_path: "/requests/1/request_id",
          cli_cause: "S0 workload request r1 duplicates /requests/0/request_id",
          cli_next_action:
            "Change the duplicated request_id values, then rerun attribution; no attribution artifact was produced.",
        },
        artifactManifest: null,
        backendRevision: "test",
        bridgeManifest: null,
        selectedRequestId: null,
      },
      global: { stubs: { RouterLink: { template: "<a href='/experiment'><slot /></a>" } } },
    });
    expect(wrapper.get('[role="alert"]').text()).toContain("REQUEST_ATTRIBUTION_REQUEST_ID_DUPLICATED");
    expect(wrapper.get('[role="alert"]').text()).toContain("/requests/1/request_id");
    expect(wrapper.get('[role="alert"]').text()).toContain("/requests/0/request_id");
    expect(wrapper.get('[role="alert"]').text()).toContain("未产生逐请求归因工件");
    expect(wrapper.get("a").attributes("href")).toBe("/experiment");
    expect(wrapper.find("table").exists()).toBe(false);
  });
});
