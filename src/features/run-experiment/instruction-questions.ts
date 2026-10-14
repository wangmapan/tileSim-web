/**
 * Read-only question detection used to route result explanations. This helper
 * does not choose parameter values or match scenario names.
 */
const INTERROGATIVE_MARKERS: readonly string[] = [
  "?",
  "？",
  "什么",
  "为什么",
  "怎么",
  "如何",
  "怎样",
  "多少",
  "是否",
  "能不能",
  "可不可以",
  "有没有",
  "吗",
];

function normalize(text: string): string {
  return text.replace(/[\s`"'「」“”]+/gu, "").toLowerCase();
}

export function looksInterrogative(instruction: string): boolean {
  const text = normalize(instruction);
  return INTERROGATIVE_MARKERS.some((marker) => text.includes(normalize(marker)));
}
