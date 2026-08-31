import { computed, readonly, ref } from "vue";
import { englishCatalog } from "./english-catalog";

export type AppLocale = "zh-CN" | "en-US";

const STORAGE_KEY = "tilesim-web.locale.v1";

function initialLocale(): AppLocale {
  if (typeof window === "undefined") return "zh-CN";
  return window.localStorage.getItem(STORAGE_KEY) === "en-US" ? "en-US" : "zh-CN";
}

const localeState = ref<AppLocale>(initialLocale());

function interpolate(template: string, params: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => String(params[key] ?? match));
}

export function t(source: string, params: Record<string, string | number> = {}): string {
  const template = localeState.value === "en-US" ? englishCatalog[source] || source : source;
  return interpolate(template, params);
}

export function hasEnglishTranslation(source: string): boolean {
  return Object.prototype.hasOwnProperty.call(englishCatalog, source);
}

export function setLocale(locale: AppLocale) {
  localeState.value = locale;
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, locale);
  if (typeof document !== "undefined") document.documentElement.lang = locale === "en-US" ? "en" : "zh-CN";
}

export function toggleLocale() {
  setLocale(localeState.value === "zh-CN" ? "en-US" : "zh-CN");
}

export function currentLocale(): AppLocale {
  return localeState.value;
}

export function useI18n() {
  return {
    locale: readonly(localeState),
    isEnglish: computed(() => localeState.value === "en-US"),
    t,
    setLocale,
    toggleLocale,
  };
}

if (typeof document !== "undefined") {
  document.documentElement.lang = localeState.value === "en-US" ? "en" : "zh-CN";
}

export const localeStorageKey = STORAGE_KEY;
