import { parse } from "lossless-json";

const integerPattern = /^-?\d+$/;

export function parseJsonLossless(text: string): unknown {
  return parse(text, null, {
    parseNumber(value) {
      if (!integerPattern.test(value)) return Number(value);
      const integer = BigInt(value);
      if (integer <= BigInt(Number.MAX_SAFE_INTEGER) && integer >= BigInt(Number.MIN_SAFE_INTEGER))
        return Number(value);
      return value;
    },
    onDuplicateKey({ key }) {
      throw new SyntaxError(`JSON contains a duplicate key: ${key}`);
    },
  });
}

export function isLosslessInteger(value: unknown): value is number | string | bigint {
  return (
    typeof value === "bigint" ||
    (typeof value === "number" && Number.isSafeInteger(value)) ||
    (typeof value === "string" && integerPattern.test(value))
  );
}

export function losslessIntegerToBigInt(value: number | string | bigint): bigint {
  if (!isLosslessInteger(value)) throw new TypeError("Expected a lossless integer value.");
  return BigInt(value);
}
