/** @vitest-environment jsdom */

import { mount, flushPromises } from "@vue/test-utils";
import { createPinia } from "pinia";
import { createMemoryHistory, createRouter } from "vue-router";
import { describe, expect, it } from "vitest";
import { RunBoundEvidencePanel } from "../../src/features/run-bound-evidence";
import { normalizeApiReports } from "../../src/lib/reports";
import { fixtureCase } from "../helpers/fixtures";

describe("run-bound evidence panel", () => {
  it("renders S3/S4/S5 as one peer group and deep-links the explicit tail request", async () => {
    const pinia = createPinia();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/metrics", name: "metrics", component: { template: "<div />" } },
        { path: "/attribution", name: "attribution", component: { template: "<div />" } },
        { path: "/execution", name: "execution", component: { template: "<div />" } },
        { path: "/validation", name: "validation", component: { template: "<div />" } },
      ],
    });
    await router.push({ name: "metrics", query: { run: "run-f6b-panel" } });
    await router.isReady();
    const fixture = fixtureCase("synthetic-s1-s6-complete");

    const wrapper = mount(RunBoundEvidencePanel, {
      props: {
        runId: "run-f6b-panel",
        bundle: normalizeApiReports(fixture.reports),
        inputs: fixture.inputs,
        artifactManifest: null,
        selectedRequestId: "req-0",
      },
      global: { plugins: [pinia, router] },
    });
    await flushPromises();

    expect(wrapper.findAll(".run-bound-peer-group .run-bound-node").map((node) => node.text().slice(0, 2))).toEqual([
      "S3",
      "S4",
      "S5",
    ]);
    expect(wrapper.find(".run-bound-output-grid").text()).toContain("契约缺口");
    expect(wrapper.find(".run-bound-page-links a").attributes("href")).toContain("evidence_request=req-0");
  });
});
