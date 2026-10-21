import { isLosslessInteger, losslessIntegerToBigInt } from "../contracts/lossless-json";
import { formatNumber } from "../lib/format";

function toLosslessBigInt(value: unknown): bigint | null {
  return isLosslessInteger(value) ? losslessIntegerToBigInt(value) : null;
}

function isSafeNumeric(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))
  );
}

export function compareLosslessValues(a: unknown, b: unknown): number | null {
  const integerA = toLosslessBigInt(a);
  const integerB = toLosslessBigInt(b);
  if (integerA !== null && integerB !== null) return integerA < integerB ? -1 : integerA > integerB ? 1 : 0;
  if (!isSafeNumeric(a) || !isSafeNumeric(b)) return null;
  return a < b ? -1 : a > b ? 1 : 0;
}

export function losslessDeltaText(a: unknown, b: unknown): string {
  const integerA = toLosslessBigInt(a);
  const integerB = toLosslessBigInt(b);
  if (integerA !== null && integerB !== null) {
    const difference = integerB - integerA;
    return `${difference >= 0n ? "+" : ""}${formatNumber(difference)}`;
  }
  if (!isSafeNumeric(a) || !isSafeNumeric(b)) return "—";
  return `${b - a >= 0 ? "+" : ""}${formatNumber(b - a)}`;
}

export function losslessPercentDeltaText(a: unknown, b: unknown): string {
  const integerA = toLosslessBigInt(a);
  const integerB = toLosslessBigInt(b);
  if (integerA !== null && integerB !== null) {
    if (integerA === 0n) return "—";
    const difference = integerB - integerA;
    const absoluteDifference = difference < 0n ? -difference : difference;
    const denominator = integerA < 0n ? -integerA : integerA;
    const scaled = (absoluteDifference * 10000n) / denominator;
    const whole = scaled / 100n;
    const fraction = (scaled % 100n).toString().padStart(2, "0").replace(/0+$/, "");
    return `${formatNumber(whole)}${fraction ? `.${fraction}` : ""}%`;
  }
  if (!isSafeNumeric(a) || !a || !isSafeNumeric(b)) return "—";
  return `${formatNumber(Math.abs(((b - a) / a) * 100))}%`;
}
