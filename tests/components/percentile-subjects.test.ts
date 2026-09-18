/** @vitest-environment jsdom */

import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import PercentileSubjects from "../../src/features/run-bound-evidence/components/PercentileSubjects.vue";
import BrandMark from "../../src/components/ui/BrandMark.vue";
import type { PercentileNavigation } from "../../src/features/run-bound-evidence/types";
import { setLocale } from "../../src/i18n";

enableAutoUnmount(afterEach);
beforeEach(() => setLocale("zh-CN"));
afterEach(() => setLocale("zh-CN"));

function subject(overrides: Partial<PercentileNavigation> = {}): PercentileNavigation {
  return {
    key: "ttft:99:0",
    metricKind: "ttft_ps",
    percentile: 99,
    valuePs: 9007199254740993123n,
    selectionRule: "nearest_rank; stable exact-value ties",
    semantics: "single_request",
    selectedRequestId: "request-7",
    memberRequestIds: ["request-7"],
    availability: "available",
    detail: "后端明确选择了唯一 percentile request，可安全导航。",
    reference: {
      artifactId: "metrics",
      schemaIdentity: "tilesim.metrics_report.v1",
      sha256: "a".repeat(64),
      jsonPointer: "/percentile_subjects/0",
      sourcePath: "metrics:/percentile_subjects/0",
      entityKind: "percentile_subject",
      entityId: "ttft_ps:p99",
      label: "percentile subject",
    },
    ...overrides,
  };
}

function render(subjects: PercentileNavigation[]) {
  return mount(PercentileSubjects, {
    props: { subjects, selectedRequestId: "request-7" },
    global: {
      stubs: {
        ArtifactEvidenceLink: {
          props: ["sourcePath"],
          template: '<a class="evidence-stub" :data-source="sourcePath" />',
        },
      },
    },
  });
}

describe("P99 evidence table", () => {
  it("keeps original order, lossless values, zero and exact reference paths", async () => {
    const wrapper = render([subject(), subject({ key: "tpot:99:1", metricKind: "tpot_ps", valuePs: 0n })]);
    expect(wrapper.findAll("tbody th").map((cell) => cell.text())).toEqual(["TTFT", "TPOT"]);
    expect(wrapper.findAll("tbody .percentile-value").map((cell) => cell.text())).toEqual([
      "9,007,199,254,740,993,123",
      "0",
    ]);
    expect(wrapper.findAll("article")).toHaveLength(0);
    expect(wrapper.find("details").attributes("open")).toBeUndefined();
    expect(wrapper.get("details").text()).toContain("nearest_rank; stable exact-value ties");
    expect(wrapper.find(".evidence-stub").attributes("data-source")).toBe("metrics:/percentile_subjects/0");
    await wrapper.find("tbody button").trigger("click");
    expect(wrapper.emitted("requestSelected")).toEqual([["request-7"]]);
  });

  it("shows all tied members without inventing a navigable single request", () => {
    const wrapper = render([
      subject({
        semantics: "tie_no_single_request",
        selectedRequestId: null,
        memberRequestIds: ["request-7", "request-2"],
      }),
    ]);
    expect(wrapper.get("summary").text()).toBe("并列请求");
    expect(wrapper.findAll(".percentile-members code").map((member) => member.text())).toEqual([
      "request-7",
      "request-2",
    ]);
    expect(wrapper.findAll("button")).toHaveLength(0);
    expect(wrapper.get(".percentile-members span").text()).toBe("当前请求");
  });

  it.each(["contract_gap", "artifact_identity_missing", "ambiguous_reference"] as const)(
    "keeps %s visible and non-navigable",
    (availability) => {
      const wrapper = render([subject({ availability, reference: null })]);
      expect(wrapper.get(".percentile-warning").text()).toBe("关联未通过校验");
      expect(wrapper.text()).toContain("引用不可用");
      expect(wrapper.findAll("button, .evidence-stub")).toHaveLength(0);
    },
  );

  it("distinguishes not applicable from an absent section", () => {
    const wrapper = render([
      subject({
        semantics: "not_applicable",
        availability: "not_applicable",
        selectedRequestId: null,
        memberRequestIds: [],
        valuePs: 0n,
      }),
    ]);
    expect(wrapper.get("summary").text()).toBe("不适用");
    expect(wrapper.text()).toContain("无关联请求");
    expect(wrapper.find(".percentile-warning").exists()).toBe(false);
    expect(render([]).find("section").exists()).toBe(false);
  });

  it("translates display labels without translating raw request IDs or selection rules", () => {
    setLocale("en-US");
    const wrapper = render([subject({ metricKind: "end_to_end_latency_ps" })]);
    expect(wrapper.text()).toContain("Single request");
    expect(wrapper.text()).toContain("Linked request");
    expect(wrapper.text()).toContain("request-7");
    expect(wrapper.text()).toContain("nearest_rank; stable exact-value ties");
  });
});

it("uses a decorative static brand mark with a quoted shared SVG mask", () => {
  const wrapper = mount(BrandMark);
  expect(wrapper.attributes("aria-hidden")).toBe("true");
  expect(wrapper.element.style.getPropertyValue("--brand-mark-url")).toMatch(/^url\(".*tilesim-mark\.svg"\)$/);
  expect(wrapper.findAll("img, button, svg animate")).toHaveLength(0);
});
