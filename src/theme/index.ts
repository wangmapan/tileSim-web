import { readonly, ref } from "vue";
import { customPalette, normalizeHex } from "./color";

export type PresetTheme = "blue" | "cloud" | "mint" | "classic";
export type AppTheme = PresetTheme | "custom";
export type AppAppearance = "light" | "dark";

export const supportedThemes: readonly PresetTheme[] = ["blue", "cloud", "mint", "classic"];

const STORAGE_KEY = "tilesim-web.theme.v1";
export const customColorStorageKey = "tilesim-web.custom-color.v1";
const APPEARANCE_STORAGE_KEY = "tilesim-web.appearance.v1";

function storedTheme(): AppTheme {
  if (typeof window === "undefined") return "blue";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "custom" && normalizeHex(window.localStorage.getItem(customColorStorageKey) || "")) return "custom";
  return supportedThemes.includes(stored as PresetTheme) ? (stored as PresetTheme) : "blue";
}

const themeState = ref<AppTheme>(storedTheme());
const customColorState = ref(
  (typeof window !== "undefined" && normalizeHex(window.localStorage.getItem(customColorStorageKey) || "")) ||
    "#3376a3",
);

function storedAppearance(): AppAppearance {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(APPEARANCE_STORAGE_KEY) === "dark" ? "dark" : "light";
}

const appearanceState = ref<AppAppearance>(storedAppearance());

function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const palette = customPalette(customColorState.value, appearanceState.value);
  // A custom seed is allowed to be a muted brand colour. In dark mode keep the
  // interactive accent on the readable side of the surface; otherwise the
  // generated accent can be attractive but fail the same AA gate as ordinary
  // body text after a reload.
  const accent = appearanceState.value === "dark" ? "#8bcfc0" : palette.accent;
  const hover = appearanceState.value === "dark" ? "#a2ded2" : palette.hover;
  const properties = {
    "--accent": accent,
    "--accent-hover": hover,
    "--accent-soft": palette.soft,
    // Accent ink is used for labels placed on the page surface (not on the
    // accent button). A dark custom palette needs a light readable ink value;
    // reusing the dark accent itself made headings fail contrast after reload.
    "--accent-ink": appearanceState.value === "dark" ? "#d7eee8" : palette.accent,
    "--on-accent": appearanceState.value === "dark" ? "#10201f" : palette.onAccent,
    "--nav-active-mark": accent,
    "--nav": palette.nav,
    "--nav-soft": palette.soft,
    "--nav-hover": palette.soft,
    "--nav-muted": "var(--ink-soft)",
    "--header-bg": palette.header,
    "--table-header": palette.table,
  };
  for (const [property, value] of Object.entries(properties)) {
    if (theme === "custom") root.style.setProperty(property, value);
    else root.style.removeProperty(property);
  }
  root.dataset.theme = theme;
}

function applyAppearance(appearance: AppAppearance) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.appearance = appearance;
  document.documentElement.style.colorScheme = appearance;
}

export function setTheme(theme: AppTheme) {
  themeState.value = theme;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function setCustomColor(value: string): boolean {
  const normalized = normalizeHex(value);
  if (!normalized) return false;
  customColorState.value = normalized;
  if (typeof window !== "undefined") window.localStorage.setItem(customColorStorageKey, normalized);
  setTheme("custom");
  return true;
}

export function currentTheme(): AppTheme {
  return themeState.value;
}

export function setAppearance(appearance: AppAppearance) {
  appearanceState.value = appearance;
  if (typeof window !== "undefined") window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  applyAppearance(appearance);
  applyTheme(themeState.value);
}

export function toggleAppearance() {
  setAppearance(appearanceState.value === "light" ? "dark" : "light");
}

export function currentAppearance(): AppAppearance {
  return appearanceState.value;
}

export function useTheme() {
  return {
    theme: readonly(themeState),
    customColor: readonly(customColorState),
    setCustomColor,
    appearance: readonly(appearanceState),
    setTheme,
    setAppearance,
    toggleAppearance,
  };
}

applyTheme(themeState.value);
applyAppearance(appearanceState.value);

export const themeStorageKey = STORAGE_KEY;
export const appearanceStorageKey = APPEARANCE_STORAGE_KEY;
