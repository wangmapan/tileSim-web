import { FIELD_ALIASES, type CurrentSubsetFieldId } from "./constants";
import { addDecimals, compareDecimals, divideByPowerOfTen, multiplyDecimals, parseDecimal } from "./decimal";
import type { DraftFieldValue, IntentSlot, Phase1CapabilityFieldProjection } from "./types";

export interface AliasMatch {
  field: Phase1CapabilityFieldProjection;
  fieldId: CurrentSubsetFieldId;
  alias: string;
  start: number;
  end: number;
}

export interface NormalizedCandidate {
  slot: IntentSlot;
  issue:
    | null
    | { kind: "clarification"; reasonCode: string; options: readonly { label: string; value: string }[] }
    | { kind: "invalid"; reasonCode: string; message: string };
}

function normalizedText(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("en-US");
}

export function findAliasMatches(
  instruction: string,
  fields: readonly Phase1CapabilityFieldProjection[],
): AliasMatch[] {
  const haystack = normalizedText(instruction);
  const candidates: AliasMatch[] = [];
  for (const field of fields) {
    const fieldId = field.field_id as CurrentSubsetFieldId;
    const aliases = [...(FIELD_ALIASES[fieldId] ?? []), ...field.aliases]
      .map((alias) => normalizedText(alias.trim()))
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);
    for (const alias of new Set(aliases)) {
      let from = 0;
      while (from < haystack.length) {
        const start = haystack.indexOf(alias, from);
        if (start < 0) break;
        candidates.push({ field, fieldId, alias, start, end: start + alias.length });
        from = start + Math.max(alias.length, 1);
      }
    }
  }
  candidates.sort((left, right) => left.start - right.start || right.alias.length - left.alias.length);
  const selected: AliasMatch[] = [];
  for (const candidate of candidates) {
    if (selected.some((match) => candidate.start < match.end && candidate.end > match.start)) continue;
    if (selected.some((match) => match.fieldId === candidate.fieldId)) continue;
    selected.push(candidate);
  }
  return selected.sort((left, right) => left.start - right.start);
}

function slot(match: AliasMatch, originalText: string, overrides: Partial<IntentSlot> = {}): IntentSlot {
  return {
    field_id: match.fieldId,
    original_text: originalText.trim(),
    candidate_value: null,
    original_unit: null,
    canonical_unit: match.field.canonical_unit,
    modality: "required",
    cardinality: "single",
    resolution: "resolved",
    alternatives: [],
    reason_code: null,
    ...overrides,
  };
}

function modality(text: string): IntentSlot["modality"] {
  if (/(?:不要|不得|禁止|do\s+not|don't|must\s+not|without)/iu.test(text)) return "forbidden";
  if (/(?:至少|不低于|下限|minimum\s+(?:of\s+)?\d|min\.?\s*(?:=|to)?\s*\d|at\s+least)/iu.test(text)) return "minimum";
  if (/(?:至多|不超过|最多|上限|maximum\s+(?:of\s+)?\d|max\.?\s*(?:=|to)\s*\d|at\s+most|no\s+more\s+than)/iu.test(text))
    return "maximum";
  if (/(?:prefer|preferred|最好|倾向)/iu.test(text)) return "preferred";
  return "required";
}

function numberToken(text: string): { value: string; unit: string | null } | null {
  const match = text.match(/([+-]?\d+(?:\.\d+)?)\s*([a-zA-Z/%倍]+(?:\s*\/\s*[a-zA-Z]+)?|%|倍)?/u);
  return match ? { value: match[1], unit: match[2]?.replace(/\s+/gu, "") ?? null } : null;
}

function explicitReplacementSuffix(text: string): string | null {
  const cues = [...text.matchAll(/(?:\bto\b|\bwith\b|改为|改成|换成|替换为|设为|设置为)/giu)];
  const last = cues.at(-1);
  return last?.index === undefined ? null : text.slice(last.index + last[0].length);
}

function selectedNumberToken(text: string): { value: string; unit: string | null } | null {
  const suffix = explicitReplacementSuffix(text);
  return numberToken(suffix ?? text);
}

function rangeTokens(text: string): { left: string; right: string; unit: string | null } | null {
  const match = text.match(/([+-]?\d+(?:\.\d+)?)\s*(?:-|~|～|到|至|\bto\b)\s*([+-]?\d+(?:\.\d+)?)\s*([a-zA-Z/]+)?/iu);
  return match ? { left: match[1], right: match[2], unit: match[3] ?? null } : null;
}

function currentNumeric(currentValue: DraftFieldValue | null | undefined): string | null {
  if (!currentValue || !["integer", "uint64", "decimal", "number"].includes(currentValue.value_type)) return null;
  return parseDecimal(currentValue.serialized_value) ? currentValue.serialized_value : null;
}

function normalizedNumber(value: string): string | null {
  const parsed = parseDecimal(value);
  if (!parsed) return null;
  return value.includes(".") ? value.replace(/(?:\.0+|(?:(\.\d*?)0+))$/u, "$1") : value.replace(/^\+/, "");
}

function normalizeMultiplier(
  match: AliasMatch,
  text: string,
  currentValue: DraftFieldValue | null | undefined,
): NormalizedCandidate {
  const base = slot(match, text, { modality: modality(text) });
  if (base.modality === "forbidden") {
    return {
      slot: { ...base, resolution: "ambiguous", reason_code: "negated_numeric_value_requires_replacement" },
      issue: { kind: "clarification", reasonCode: "negated_numeric_value_requires_replacement", options: [] },
    };
  }
  let value: string | null;
  let originalUnit: string | null;
  const selectedText = explicitReplacementSuffix(text) ?? text;
  const percent = selectedText.match(/([+-]?\d+(?:\.\d+)?)\s*%/u);
  const multiple = selectedText.match(/([+-]?\d+(?:\.\d+)?)\s*(?:x|倍)/iu);
  if (/(?:double|翻倍|加倍)/iu.test(text)) {
    value = "2";
    originalUnit = "multiplier";
  } else if (percent) {
    originalUnit = "%";
    const fraction = divideByPowerOfTen(percent[1], 2);
    if (/(?:increase|raise|提高|增加|上调)/iu.test(text)) {
      const current = currentNumeric(currentValue);
      const factor = fraction ? addDecimals("1", fraction) : null;
      value = current && factor ? multiplyDecimals(current, factor) : null;
    } else if (/(?:decrease|reduce|lower|降低|减少|下调)/iu.test(text)) {
      const current = currentNumeric(currentValue);
      const negative = fraction ? multiplyDecimals(fraction, "-1") : null;
      const factor = negative ? addDecimals("1", negative) : null;
      value = current && factor ? multiplyDecimals(current, factor) : null;
    } else {
      value = fraction;
    }
  } else if (multiple) {
    value = normalizedNumber(multiple[1]);
    originalUnit = multiple[0].replace(multiple[1], "").trim();
  } else {
    const token = selectedNumberToken(text);
    value = token ? normalizedNumber(token.value) : null;
    originalUnit = token?.unit ?? null;
  }
  if (!value) {
    return {
      slot: { ...base, resolution: "ambiguous", reason_code: "numeric_value_missing" },
      issue: { kind: "clarification", reasonCode: "numeric_value_missing", options: [] },
    };
  }
  return {
    slot: {
      ...base,
      candidate_value: { value_type: "number", serialized_value: value },
      original_unit: originalUnit,
    },
    issue: null,
  };
}

function normalizeInteger(match: AliasMatch, text: string): NormalizedCandidate {
  const base = slot(match, text, { modality: modality(text) });
  if (base.modality === "forbidden") {
    return {
      slot: { ...base, resolution: "ambiguous", reason_code: "negated_numeric_value_requires_replacement" },
      issue: { kind: "clarification", reasonCode: "negated_numeric_value_requires_replacement", options: [] },
    };
  }
  const replacementSuffix = explicitReplacementSuffix(text);
  const range = rangeTokens(replacementSuffix ?? text);
  if (range) {
    return {
      slot: {
        ...base,
        cardinality: "range",
        resolution: "ambiguous",
        original_unit: range.unit,
        alternatives: [range.left, range.right],
        reason_code: "range_requires_single_value",
      },
      issue: {
        kind: "clarification",
        reasonCode: "range_requires_single_value",
        options: [
          { label: range.left, value: range.left },
          { label: range.right, value: range.right },
        ],
      },
    };
  }
  const token = numberToken(replacementSuffix ?? text);
  if (!token) {
    return {
      slot: { ...base, resolution: "ambiguous", reason_code: "integer_value_missing" },
      issue: { kind: "clarification", reasonCode: "integer_value_missing", options: [] },
    };
  }
  let value = normalizedNumber(token.value);
  const unit = token.unit?.toLocaleLowerCase("en-US") ?? null;
  if (unit && /^(?:k|ktoken|ktokens)$/u.test(unit)) value = multiplyDecimals(token.value, "1000");
  if (!value || !/^\d+$/u.test(value)) {
    return {
      slot: { ...base, resolution: "ambiguous", original_unit: token.unit, reason_code: "integer_value_invalid" },
      issue: { kind: "clarification", reasonCode: "integer_value_invalid", options: [] },
    };
  }
  return {
    slot: {
      ...base,
      candidate_value: { value_type: "integer", serialized_value: value },
      original_unit: token.unit,
    },
    issue: null,
  };
}

function enumAliases(value: string): readonly string[] {
  if (value === "fifo") return ["fifo", "first in first out", "先进先出"];
  if (value === "decode_priority") return ["decode_priority", "decode priority", "解码优先"];
  if (value === "fabric_backpressure_aware")
    return ["fabric_backpressure_aware", "fabric backpressure aware", "backpressure aware", "网络反压感知", "反压感知"];
  return [value, value.replaceAll("_", " ")];
}

function normalizeEnum(match: AliasMatch, text: string): NormalizedCandidate {
  const mode = modality(text);
  const base = slot(match, text, { modality: mode });
  const normalized = normalizedText(explicitReplacementSuffix(text) ?? text);
  const values = match.field.enum_values.filter((value) =>
    enumAliases(value).some((alias) => normalized.includes(normalizedText(alias))),
  );
  if (mode === "forbidden") {
    const alternatives = match.field.enum_values.filter((value) => !values.includes(value));
    return {
      slot: {
        ...base,
        cardinality: "set",
        resolution: "ambiguous",
        alternatives,
        reason_code: "negated_enum_requires_replacement",
      },
      issue: {
        kind: "clarification",
        reasonCode: "negated_enum_requires_replacement",
        options: alternatives.map((value) => ({ label: value, value })),
      },
    };
  }
  if (values.length !== 1) {
    return {
      slot: {
        ...base,
        resolution: "ambiguous",
        alternatives: [...match.field.enum_values],
        reason_code: values.length ? "ambiguous_enum_value" : "enum_value_missing_or_unknown",
      },
      issue: {
        kind: "clarification",
        reasonCode: values.length ? "ambiguous_enum_value" : "enum_value_missing_or_unknown",
        options: match.field.enum_values.map((value) => ({ label: value, value })),
      },
    };
  }
  return {
    slot: {
      ...base,
      candidate_value: { value_type: "enum", serialized_value: values[0] },
      original_unit: match.field.canonical_unit,
    },
    issue: null,
  };
}

function bandwidthValue(text: string): { value: string; unit: string } | null {
  const candidates = [
    { pattern: /([+-]?\d+(?:\.\d+)?)\s*(?:Gbps|Gbit\/s|Gb\/s)\b/u, factor: "1", unit: "Gbps" },
    { pattern: /([+-]?\d+(?:\.\d+)?)\s*(?:Mbps|Mbit\/s|Mb\/s)\b/u, factor: "0.001", unit: "Mbps" },
    { pattern: /([+-]?\d+(?:\.\d+)?)\s*(?:Tbps|Tbit\/s|Tb\/s)\b/u, factor: "1000", unit: "Tbps" },
    { pattern: /([+-]?\d+(?:\.\d+)?)\s*(?:GB\/s|GByte\/s)\b/u, factor: "8", unit: "GB/s" },
    { pattern: /([+-]?\d+(?:\.\d+)?)\s*(?:MB\/s|MByte\/s)\b/u, factor: "0.008", unit: "MB/s" },
    { pattern: /([+-]?\d+(?:\.\d+)?)\s*(?:TB\/s|TByte\/s)\b/u, factor: "8000", unit: "TB/s" },
  ];
  for (const candidate of candidates) {
    const match = text.match(candidate.pattern);
    if (match) {
      const value = multiplyDecimals(match[1], candidate.factor);
      if (value) return { value, unit: candidate.unit };
    }
  }
  return null;
}

function normalizeBandwidth(match: AliasMatch, text: string): NormalizedCandidate {
  const base = slot(match, text, { modality: modality(text) });
  const selectedText = explicitReplacementSuffix(text) ?? text;
  const shortcut = /([+-]?\d+(?:\.\d+)?)\s*[gG](?![a-zA-Z/])/u.exec(selectedText);
  const perLink = /(?:per[- ]?link|each\s+link|每(?:条)?链路|单链路)/iu.test(text);
  if (shortcut || !perLink) {
    const magnitude = shortcut?.[1] ?? numberToken(selectedText)?.value ?? "";
    return {
      slot: {
        ...base,
        resolution: "ambiguous",
        original_unit: shortcut ? "G" : null,
        alternatives: magnitude ? [`${magnitude} Gbps per-link`, `${magnitude} GB/s per-link`] : [],
        reason_code: "ambiguous_bandwidth_unit_or_scope",
      },
      issue: {
        kind: "clarification",
        reasonCode: "ambiguous_bandwidth_unit_or_scope",
        options: magnitude
          ? [
              { label: `${magnitude} Gbps per-link`, value: `${magnitude} Gbps per-link` },
              { label: `${magnitude} GB/s per-link`, value: `${magnitude} GB/s per-link` },
            ]
          : [],
      },
    };
  }
  const normalized = bandwidthValue(selectedText);
  if (!normalized) {
    return {
      slot: { ...base, resolution: "ambiguous", reason_code: "bandwidth_value_or_unit_missing" },
      issue: { kind: "clarification", reasonCode: "bandwidth_value_or_unit_missing", options: [] },
    };
  }
  return {
    slot: {
      ...base,
      candidate_value: { value_type: "number", serialized_value: normalized.value },
      original_unit: normalized.unit,
    },
    issue: null,
  };
}

function normalizeLatency(match: AliasMatch, text: string): NormalizedCandidate {
  const base = slot(match, text, { modality: modality(text) });
  const replacementSuffix = explicitReplacementSuffix(text);
  const range = rangeTokens(replacementSuffix ?? text);
  if (range) {
    return {
      slot: {
        ...base,
        cardinality: "range",
        resolution: "ambiguous",
        original_unit: range.unit,
        alternatives: [range.left, range.right],
        reason_code: "range_requires_single_value",
      },
      issue: {
        kind: "clarification",
        reasonCode: "range_requires_single_value",
        options: [
          { label: `${range.left} ${range.unit ?? "us"}`, value: range.left },
          { label: `${range.right} ${range.unit ?? "us"}`, value: range.right },
        ],
      },
    };
  }
  const latency = (replacementSuffix ?? text).match(/([+-]?\d+(?:\.\d+)?)\s*(ps|ns|us|µs|μs|ms|s)\b/iu);
  if (!latency) {
    return {
      slot: { ...base, resolution: "ambiguous", reason_code: "latency_value_or_unit_missing" },
      issue: { kind: "clarification", reasonCode: "latency_value_or_unit_missing", options: [] },
    };
  }
  const unit = latency[2].toLocaleLowerCase("en-US");
  const factor =
    unit === "ps" ? "0.000001" : unit === "ns" ? "0.001" : unit === "ms" ? "1000" : unit === "s" ? "1000000" : "1";
  const value = multiplyDecimals(latency[1], factor);
  return {
    slot: {
      ...base,
      candidate_value: value ? { value_type: "number", serialized_value: value } : null,
      original_unit: latency[2],
      resolution: value ? "resolved" : "ambiguous",
      reason_code: value ? null : "latency_value_invalid",
    },
    issue: value ? null : { kind: "clarification", reasonCode: "latency_value_invalid", options: [] },
  };
}

export function normalizeCandidate(
  match: AliasMatch,
  text: string,
  currentValue: DraftFieldValue | null | undefined,
): NormalizedCandidate {
  if (match.field.value_type === "enum") return normalizeEnum(match, text);
  if (match.fieldId === "s0.workload.message_size_multiplier") return normalizeMultiplier(match, text, currentValue);
  if (match.fieldId.endsWith("bandwidth_gbps")) return normalizeBandwidth(match, text);
  if (match.fieldId.endsWith("latency_us")) return normalizeLatency(match, text);
  if (match.field.value_type === "integer") return normalizeInteger(match, text);
  const token = numberToken(text);
  const value = token ? normalizedNumber(token.value) : null;
  return value
    ? {
        slot: {
          ...slot(match, text, { modality: modality(text) }),
          candidate_value: { value_type: "number", serialized_value: value },
          original_unit: token?.unit ?? null,
        },
        issue: null,
      }
    : {
        slot: { ...slot(match, text), resolution: "ambiguous", reason_code: "numeric_value_missing" },
        issue: { kind: "clarification", reasonCode: "numeric_value_missing", options: [] },
      };
}

export function validateCandidate(
  field: Phase1CapabilityFieldProjection,
  value: DraftFieldValue,
): { reasonCode: string; message: string } | null {
  if (field.value_type === "enum") {
    return value.value_type === "enum" && field.enum_values.includes(value.serialized_value)
      ? null
      : { reasonCode: "enum_not_allowed", message: "The value is not in the capability enum." };
  }
  if (!["integer", "uint64", "decimal", "number"].includes(value.value_type) || !parseDecimal(value.serialized_value)) {
    return { reasonCode: "numeric_format_invalid", message: "The value is not an exact decimal." };
  }
  if ((field.integer_only || field.value_type === "integer") && !/^\d+$/u.test(value.serialized_value)) {
    return { reasonCode: "integer_required", message: "The field requires an integer." };
  }
  if (field.minimum !== null && compareDecimals(value.serialized_value, field.minimum) === -1) {
    return { reasonCode: "value_below_minimum", message: "The value is below the capability minimum." };
  }
  if (field.maximum !== null && compareDecimals(value.serialized_value, field.maximum) === 1) {
    return { reasonCode: "value_above_maximum", message: "The value is above the capability maximum." };
  }
  return null;
}
