/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import MetricsView from "../../src/views/MetricsView.vue";
import UnsupportedSchemaView from "../../src/views/UnsupportedSchemaView.vue";
import { useDashboard } from "../../src/store/dashboard";
import { fixtureCase } from "../helpers/fixtures";

const { applyBundle } = useDashboard();

beforeEach(() => {
  localStorage.clear();
});

describe("report boundary components", () => {
  it("renders expected-absence boundary metrics with the five-state label while preserving real zero", () => {
    const fixture = fixtureCase("boundary-expected-absence");
    applyBundle(fixture.reports, { runName: fixture.id, inputs: fixture.inputs });
    const wrapper = mount(MetricsView, {
      global: {
        stubs: {
          RunBoundEvidencePanel: true,
          RequestEvidenceAction: true,
          RouterLink: { template: "<a><slot /></a>" },
        },
      },
    });
    // C0-7: the boundary fixture declares `expected_absence` for S1/S6, so the
    // metrics resolve to the dedicated 预期缺省 state instead of collapsing into
    // a generic 不适用 label. The metric must never fall back to an invented 0.
    expect(wrapper.text()).toContain("预期缺省");
    expect(wrapper.text()).not.toContain("不适用");
    expect(wrapper.text()).toContain("0/0 请求完成");
    expect(wrapper.text()).toContain("吞吐");
    expect(wrapper.text()).not.toContain("NaN");
  });

  it("shows an unknown-schema fallback and exposes the lazy complete-JSON viewer", () => {
    const fixture = fixtureCase("unknown-run-schema");
    applyBundle(fixture.reports, { runName: fixture.id, inputs: fixture.inputs });
    const wrapper = mount(UnsupportedSchemaView);
    expect(wrapper.text()).toContain("结构化视图尚未适配该报告版本");
    expect(wrapper.text()).toContain("wind_tunnel.run.v999");
    expect(wrapper.find(".json-artifact-panel").exists()).toBe(true);
  });
});
