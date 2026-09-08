// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  appearanceStorageKey,
  currentAppearance,
  customColorStorageKey,
  setCustomColor,
  currentTheme,
  setAppearance,
  setTheme,
  supportedThemes,
  themeStorageKey,
  toggleAppearance,
} from "./index";

afterEach(() => {
  setTheme("blue");
  setAppearance("light");
});

describe("application theme", () => {
  it("persists custom RGB without changing status or chart colors and clears overrides for presets", () => {
    expect(setCustomColor("#D05A20")).toBe(true);
    expect(currentTheme()).toBe("custom");
    expect(localStorage.getItem(customColorStorageKey)).toBe("#d05a20");
    expect(localStorage.getItem(themeStorageKey)).toBe("custom");
    const light = document.documentElement.style.getPropertyValue("--accent");
    setAppearance("dark");
    expect(document.documentElement.style.getPropertyValue("--accent")).not.toBe(light);
    expect(document.documentElement.style.getPropertyValue("--warning")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--chart-series-1")).toBe("");
    expect(setCustomColor("invalid")).toBe(false);
    expect(localStorage.getItem(customColorStorageKey)).toBe("#d05a20");
    setTheme("blue");
    expect(document.documentElement.style.getPropertyValue("--accent")).toBe("");
    expect(document.documentElement.style.getPropertyValue("--on-accent")).toBe("");
    for (const property of ["--nav", "--nav-soft", "--nav-hover", "--nav-muted", "--header-bg", "--table-header"]) {
      expect(document.documentElement.style.getPropertyValue(property)).toBe("");
    }
  });
  it("uses blue as the default theme and applies the selected theme to the document", () => {
    setTheme("blue");
    expect(currentTheme()).toBe("blue");
    expect(document.documentElement.dataset.theme).toBe("blue");
  });

  it("exposes and persists every supported palette", () => {
    expect(supportedThemes).toEqual(["blue", "cloud", "mint", "classic"]);
    for (const theme of supportedThemes) {
      setTheme(theme);
      expect(currentTheme()).toBe(theme);
      expect(window.localStorage.getItem(themeStorageKey)).toBe(theme);
      expect(document.documentElement.dataset.theme).toBe(theme);
    }
  });

  it("keeps appearance independent from the selected palette", () => {
    setTheme("mint");
    setAppearance("dark");
    expect(currentTheme()).toBe("mint");
    expect(currentAppearance()).toBe("dark");
    expect(document.documentElement.dataset.appearance).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");
    expect(window.localStorage.getItem(appearanceStorageKey)).toBe("dark");

    toggleAppearance();
    expect(currentAppearance()).toBe("light");
    expect(currentTheme()).toBe("mint");
  });
});
