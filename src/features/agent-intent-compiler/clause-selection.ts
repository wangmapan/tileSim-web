/**
 * Clause selection shared by the deterministic intent compiler and the
 * clarification answer binding.
 *
 * The compiler resolves every matched alias against the clause that owns it.
 * Answering a clarification must rewrite exactly the span the compiler reads,
 * so both paths use the definitions in this module instead of keeping two
 * copies of the same rule.
 */
import type { AliasMatch } from "./normalizers";

/** Same delimiter set the compiler uses to split one instruction into clauses. */
export const CLAUSE_DELIMITER_PATTERN = /[,，;；。]|\band\b|以及|并且/iu;

const negationPrefixPattern =
  /(?:不要|不得|禁止|至少|至多|最大|最小|do\s+not|don't|without|at\s+(?:least|most)|min|max)/iu;
const trailingConnectorPattern = /(?:\band\b|以及|并且)\s*$/iu;

export interface InstructionClause {
  text: string;
  start: number;
  end: number;
}

export interface ClauseSpan {
  start: number;
  end: number;
}

export function instructionClauses(instruction: string): InstructionClause[] {
  const delimiter = new RegExp(CLAUSE_DELIMITER_PATTERN.source, "giu");
  const clauses: InstructionClause[] = [];
  let cursor = 0;
  for (const match of instruction.matchAll(delimiter)) {
    const start = match.index ?? cursor;
    clauses.push({ text: instruction.slice(cursor, start), start: cursor, end: start });
    cursor = start + match[0].length;
  }
  clauses.push({ text: instruction.slice(cursor), start: cursor, end: instruction.length });
  return clauses;
}

/**
 * Span the compiler attributes to `matches[index]`: the alias itself plus a
 * leading negation/modifier cue when one sits immediately before it.
 */
export function clauseSpanForMatch(instruction: string, matches: readonly AliasMatch[], index: number): ClauseSpan {
  const match = matches[index];
  const previousEnd = index === 0 ? 0 : matches[index - 1].end;
  const nextStart = index + 1 < matches.length ? matches[index + 1].start : instruction.length;
  const prefix = instruction.slice(Math.max(previousEnd, match.start - 24), match.start);
  const meaningfulPrefix = negationPrefixPattern.test(prefix) ? prefix : "";
  return { start: match.start - meaningfulPrefix.length, end: nextStart };
}

/** Clause text the compiler feeds into the field normalizers. */
export function clauseForMatch(instruction: string, matches: readonly AliasMatch[], index: number): string {
  const span = clauseSpanForMatch(instruction, matches, index);
  return instruction.slice(span.start, span.end).replace(trailingConnectorPattern, "").trim();
}
