// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import {
  appearanceStorageKey,
  currentAppearance,
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
