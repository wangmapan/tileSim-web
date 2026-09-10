interface DecimalParts {
  coefficient: bigint;
  scale: number;
}

function pow10(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

export function parseDecimal(value: string): DecimalParts | null {
  const match = value.trim().match(/^([+-]?)(\d+)(?:\.(\d+))?$/u);
  if (!match) return null;
  const fraction = match[3] ?? "";
  const sign = match[1] === "-" ? -1n : 1n;
  return { coefficient: sign * BigInt(`${match[2]}${fraction}`), scale: fraction.length };
}

export function formatDecimal(value: DecimalParts): string {
  let coefficient = value.coefficient;
  const negative = coefficient < 0n;
  if (negative) coefficient = -coefficient;
  let digits = coefficient.toString().padStart(value.scale + 1, "0");
  if (value.scale > 0) {
    digits = `${digits.slice(0, -value.scale)}.${digits.slice(-value.scale)}`.replace(/\.?0+$/u, "");
  }
  if (digits === "") digits = "0";
  return negative && digits !== "0" ? `-${digits}` : digits;
}

export function multiplyDecimals(left: string, right: string): string | null {
  const leftParts = parseDecimal(left);
  const rightParts = parseDecimal(right);
  if (!leftParts || !rightParts) return null;
  return formatDecimal({
    coefficient: leftParts.coefficient * rightParts.coefficient,
    scale: leftParts.scale + rightParts.scale,
  });
}

export function divideByPowerOfTen(value: string, exponent: number): string | null {
  const parts = parseDecimal(value);
  if (!parts) return null;
  return formatDecimal({ coefficient: parts.coefficient, scale: parts.scale + exponent });
}

export function compareDecimals(left: string, right: string): number | null {
  const leftParts = parseDecimal(left);
  const rightParts = parseDecimal(right);
  if (!leftParts || !rightParts) return null;
  const scale = Math.max(leftParts.scale, rightParts.scale);
  const normalizedLeft = leftParts.coefficient * pow10(scale - leftParts.scale);
  const normalizedRight = rightParts.coefficient * pow10(scale - rightParts.scale);
  return normalizedLeft < normalizedRight ? -1 : normalizedLeft > normalizedRight ? 1 : 0;
}

export function addDecimals(left: string, right: string): string | null {
  const leftParts = parseDecimal(left);
  const rightParts = parseDecimal(right);
  if (!leftParts || !rightParts) return null;
  const scale = Math.max(leftParts.scale, rightParts.scale);
  return formatDecimal({
    coefficient:
      leftParts.coefficient * pow10(scale - leftParts.scale) + rightParts.coefficient * pow10(scale - rightParts.scale),
    scale,
  });
}
