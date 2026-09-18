import { describe, expect, it } from "vitest";
import { contrastRatio, customPalette, hexToRgb, hsvToRgb, normalizeHex, rgbToHex, rgbToHsv, type RGB } from "./color";

describe("custom theme colors", () => {
  it("accepts only RGB hex values and normalizes shorthand", () => {
    expect(normalizeHex(" #AbC ")).toBe("#aabbcc");
    expect(normalizeHex("A025CC")).toBe("#a025cc");
    for (const value of ["", "#abcd", "#ffffffff", "rgb(0,0,0)", "url(test)", "#xy1234"])
      expect(normalizeHex(value)).toBeNull();
  });
  it("round trips RGB through the spectrum including achromatic extremes", () => {
    for (const rgb of [
      [0, 0, 0],
      [255, 255, 255],
      [255, 0, 0],
      [0, 255, 0],
      [0, 0, 255],
      [39, 105, 90],
      [128, 128, 128],
    ] as RGB[]) {
      expect(hsvToRgb(rgbToHsv(rgb))).toEqual(rgb);
      expect(hexToRgb(rgbToHex(rgb))).toEqual(rgb);
    }
    expect(contrastRatio("#ffffff", "#000000")).toBe(21);
  });
  it("keeps text, hover and button contrast across the RGB cube and both appearances", () => {
    for (const appearance of ["light", "dark"] as const) {
      const surfaces = appearance === "light" ? ["#ffffff", "#f5f5f5", "#f7f7f8"] : ["#191a1c", "#222427", "#202225"];
      for (const red of [0, 51, 102, 153, 204, 255])
        for (const green of [0, 51, 102, 153, 204, 255])
          for (const blue of [0, 51, 102, 153, 204, 255]) {
            const palette = customPalette(rgbToHex([red, green, blue]), appearance);
            for (const surface of [...surfaces, palette.soft, palette.nav, palette.header, palette.table]) {
              expect(contrastRatio(palette.accent, surface)).toBeGreaterThanOrEqual(4.5);
              expect(contrastRatio(palette.hover, surface)).toBeGreaterThanOrEqual(4.5);
            }
            expect(contrastRatio(appearance === "dark" ? "#c3c5c9" : "#484c50", palette.nav)).toBeGreaterThanOrEqual(
              4.5,
            );
            expect(contrastRatio(palette.accent, palette.onAccent)).toBeGreaterThanOrEqual(4.5);
            expect(contrastRatio(palette.hover, palette.onAccent)).toBeGreaterThanOrEqual(4.5);
          }
    }
  });
});
