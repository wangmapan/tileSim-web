import { afterEach, describe, expect, it } from "vitest";
import { currentLocale, hasEnglishTranslation, setLocale, t, toggleLocale } from "./index";

afterEach(() => setLocale("zh-CN"));

describe("application locale", () => {
  it("switches deterministic interface copy without translating unknown evidence values", () => {
    setLocale("en-US");
    expect(t("分层结果")).toBe("Layered results");
    expect(t("已导入 {count} 份报告。", { count: 2 })).toBe("Imported 2 report(s).");
    expect(t("metrics:/request_metrics/0")).toBe("metrics:/request_metrics/0");
  });

  it("toggles between the two supported locales", () => {
    setLocale("zh-CN");
    toggleLocale();
    expect(currentLocale()).toBe("en-US");
    toggleLocale();
    expect(currentLocale()).toBe("zh-CN");
  });

  it("exposes exact translation coverage for dynamic model copy", () => {
    expect(hasEnglishTranslation("没有 runtime trace 请求明细。")).toBe(true);
    expect(hasEnglishTranslation("untranslated evidence value")).toBe(false);
  });
});
