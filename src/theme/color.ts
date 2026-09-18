export type RGB = [number, number, number];
export type HSV = { hue: number; saturation: number; value: number };

export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  if (/^[\da-f]{3}$/i.test(hex))
    return (
      "#" +
      [...hex]
        .map((character) => character.repeat(2))
        .join("")
        .toLowerCase()
    );
  return /^[\da-f]{6}$/i.test(hex) ? "#" + hex.toLowerCase() : null;
}
export function hexToRgb(hex: string): RGB {
  const normalized = normalizeHex(hex);
  if (!normalized) throw new Error("Invalid RGB color");
  return [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16)) as RGB;
}
export function rgbToHex(rgb: RGB): string {
  return (
    "#" +
    rgb
      .map((channel) =>
        Math.round(Math.min(255, Math.max(0, channel)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export function rgbToHsv(rgb: RGB): HSV {
  const [red, green, blue] = rgb.map((channel) => channel / 255);
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const delta = maximum - minimum;
  const hue = !delta
    ? 0
    : maximum === red
      ? ((green - blue) / delta) % 6
      : maximum === green
        ? (blue - red) / delta + 2
        : (red - green) / delta + 4;
  return { hue: (hue * 60 + 360) % 360, saturation: maximum ? delta / maximum : 0, value: maximum };
}
export function hsvToRgb({ hue, saturation, value }: HSV): RGB {
  const sector = (((hue % 360) + 360) % 360) / 60;
  const chroma = value * saturation;
  const secondary = chroma * (1 - Math.abs((sector % 2) - 1));
  const base = value - chroma;
  const channels =
    sector < 1
      ? [chroma, secondary, 0]
      : sector < 2
        ? [secondary, chroma, 0]
        : sector < 3
          ? [0, chroma, secondary]
          : sector < 4
            ? [0, secondary, chroma]
            : sector < 5
              ? [secondary, 0, chroma]
              : [chroma, 0, secondary];
  return channels.map((channel) => Math.round((channel + base) * 255)) as RGB;
}
export function contrastRatio(first: string, second: string): number {
  const luminance = (hex: string) =>
    hexToRgb(hex)
      .map((channel) => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      })
      .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
  const firstLight = luminance(first);
  const secondLight = luminance(second);
  return (Math.max(firstLight, secondLight) + 0.05) / (Math.min(firstLight, secondLight) + 0.05);
}
function mix(first: string, second: string, amount: number): string {
  const target = hexToRgb(second);
  return rgbToHex(hexToRgb(first).map((channel, index) => channel + (target[index] - channel) * amount) as RGB);
}
export function customPalette(seed: string, appearance: "light" | "dark") {
  const dark = appearance === "dark";
  const background = dark ? "#191a1c" : "#ffffff";
  const surfaces = dark ? [background, "#222427", "#202225"] : [background, "#f5f5f5", "#f7f7f8"];
  const target = dark ? "#ffffff" : "#000000";
  const normalized = normalizeHex(seed) || "#3376a3";
  const nav = mix(dark ? "#141517" : "#f7f7f8", normalized, dark ? 0.2 : 0.12);
  const header = mix(background, normalized, dark ? 0.08 : 0.04);
  const table = mix(background, normalized, dark ? 0.06 : 0.03);
  surfaces.push(nav, header, table);
  let accent = normalized;
  for (let step = 0; step <= 255; step++) {
    accent = mix(normalized, target, step / 255);
    if ([...surfaces, mix(background, accent, 0.16)].every((surface) => contrastRatio(accent, surface) >= 4.5)) break;
  }
  const hover = mix(accent, target, 0.12);
  return {
    accent,
    hover,
    nav,
    header,
    table,
    soft: mix(background, accent, 0.16),
    onAccent: contrastRatio(accent, "#ffffff") >= 4.5 ? "#ffffff" : "#07131b",
  };
}
