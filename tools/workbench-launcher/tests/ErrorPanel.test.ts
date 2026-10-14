import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ErrorPanel from "../src/components/ErrorPanel.vue";

describe("friendly error details", () => {
  const writeText = vi.fn(async () => undefined);

  beforeEach(() => {
    writeText.mockClear();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("leads with an action and copies plain technical detail", async () => {
    const wrapper = mount(ErrorPanel, {
      props: {
        category: "WSL 服务已禁用",
        action: "先修复 WSL，再重新启动。",
        technicalDetail: "TILESIM_WSL_SERVICE_DISABLED: <path>",
      },
    });
    expect(wrapper.text().indexOf("先修复 WSL")).toBeLessThan(wrapper.text().indexOf("技术详情"));
    await wrapper.get("summary").trigger("click");
    await wrapper.get("button").trigger("click");
    expect(writeText).toHaveBeenCalledWith("TILESIM_WSL_SERVICE_DISABLED: <path>");
  });
});
