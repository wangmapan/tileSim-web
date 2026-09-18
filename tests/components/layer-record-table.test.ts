/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { LayerRecordTable } from "../../src/features/execution-inspector";
import type { ExecutionRecord } from "../../src/features/execution-inspector";
import { availabilityLabel, availabilityTone } from "../../src/features/report-coverage";
import { setLocale } from "../../src/i18n";

const records: ExecutionRecord[] = [
  {
    id: "record-reported",
    title: "已报告记录",
    status: "reported",
    facts: [
      { label: "延迟", value: 0, unit: "µs" },
      { label: "占比", value: 0.5, unit: "%ratio" },
    ],
  },
  {
    id: "record-unreported",
    title: "未报告记录",
    status: "unknown",
    facts: [{ label: "延迟", value: null, unit: "µs" }],
  },
];

function mounted() {
  const wrapper = mount(LayerRecordTable, { props: { records } });
  const rows = wrapper.findAll("tbody tr");
  expect(rows).toHaveLength(2);
  return { wrapper, rows };
}

describe("execution record table availability", () => {
  beforeEach(() => setLocale("zh-CN"));

  it("resolves an absent fact to the shared missing state instead of a unified placeholder", () => {
    const { wrapper, rows } = mounted();
    // Cell 0 is the status column; column `占比` only exists on the first record, so the second
    // record's cell has no fact at all.
    const absentCell = rows[1].findAll("td")[2];
    const badge = absentCell.find(".availability-badge");

    expect(badge.attributes("data-availability")).toBe("missing");
    expect(badge.text()).toBe(availabilityLabel("missing"));
    expect(badge.classes()).toContain(`availability-badge--${availabilityTone("missing")}`);
    expect(absentCell.find("span[title]").attributes("title")).toBeTruthy();
    expect(absentCell.classes()).toContain(`record-value--${availabilityTone("missing")}`);
    expect(wrapper.text()).not.toContain("不适用");
  });

  it("keeps a reported zero as a value and a reported null as missing", () => {
    const { rows } = mounted();

    const zeroCell = rows[0].findAll("td")[1];
    expect(zeroCell.text()).toBe("0 µs");
    expect(zeroCell.find(".availability-badge").exists()).toBe(false);
    expect(zeroCell.classes()).toContain(`record-value--${availabilityTone("available")}`);

    const nullCell = rows[1].findAll("td")[1];
    expect(nullCell.text()).not.toBe("不适用");
    expect(nullCell.text()).toBe(availabilityLabel("missing"));
    expect(nullCell.find(".availability-badge").attributes("data-availability")).toBe("missing");
  });

  it("replaces the unreported status dash with the shared missing state", () => {
    const { wrapper, rows } = mounted();

    const reportedStatus = rows[0].findAll("td")[0];
    expect(reportedStatus.text()).not.toBe("—");
    expect(reportedStatus.find(".availability-badge").exists()).toBe(false);

    const unreportedStatus = rows[1].findAll("td")[0];
    expect(unreportedStatus.text()).not.toBe("—");
    expect(unreportedStatus.find(".availability-badge").attributes("data-availability")).toBe("missing");
    expect(unreportedStatus.text()).toBe(availabilityLabel("missing"));
    expect(wrapper.text()).not.toContain("不适用");
  });
});
