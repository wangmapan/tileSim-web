import { readonly, ref } from "vue";

export type AppTheme = "blue" | "cloud" | "mint" | "classic";
export type AppAppearance = "light" | "dark";

export const supportedThemes: readonly AppTheme[] = ["blue", "cloud", "mint", "classic"];

const STORAGE_KEY = "tilesim-web.theme.v1";
const APPEARANCE_STORAGE_KEY = "tilesim-web.appearance.v1";

function storedTheme(): AppTheme {
  if (typeof window === "undefined") return "blue";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return supportedThemes.includes(stored as AppTheme) ? (stored as AppTheme) : "blue";
}

const themeState = ref<AppTheme>(storedTheme());

function storedAppearance(): AppAppearance {
  if (typeof window === "undefined") return "light";
  return window.localStorage.getItem(APPEARANCE_STORAGE_KEY) === "dark" ? "dark" : "light";
}

const appearanceState = ref<AppAppearance>(storedAppearance());

function applyTheme(theme: AppTheme) {
  if (typeof document !== "undefined") document.documentElement.dataset.theme = theme;
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

export function currentTheme(): AppTheme {
  return themeState.value;
}

export function setAppearance(appearance: AppAppearance) {
  appearanceState.value = appearance;
  if (typeof window !== "undefined") window.localStorage.setItem(APPEARANCE_STORAGE_KEY, appearance);
  applyAppearance(appearance);
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
