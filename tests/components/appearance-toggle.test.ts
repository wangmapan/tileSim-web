/** @vitest-environment jsdom */

import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import AppearanceToggle from "../../src/components/AppearanceToggle.vue";
import { setLocale } from "../../src/i18n";
import { appearanceStorageKey, currentAppearance, setAppearance } from "../../src/theme";

describe("appearance toggle", () => {
  beforeEach(() => {
    localStorage.clear();
    setLocale("zh-CN");
    setAppearance("light");
  });

  afterEach(() => setAppearance("light"));

  it("switches and persists the independent light/dark appearance", async () => {
    const wrapper = mount(AppearanceToggle);
    const button = wrapper.get("button");

    expect(button.attributes("aria-label")).toBe("切换到深色模式");
    expect(button.attributes("aria-pressed")).toBe("false");
    await button.trigger("click");

    expect(currentAppearance()).toBe("dark");
    expect(document.documentElement.dataset.appearance).toBe("dark");
    expect(localStorage.getItem(appearanceStorageKey)).toBe("dark");
    expect(button.attributes("aria-label")).toBe("切换到浅色模式");
    expect(button.attributes("aria-pressed")).toBe("true");
  });
});
