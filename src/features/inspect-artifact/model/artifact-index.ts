import { parseJsonLossless } from "../../../contracts/lossless-json";
import type { ArtifactLineMatch, ArtifactVirtualLine } from "./worker-contract";

export class ArtifactIndexError extends Error {
  constructor(
    message: string,
    readonly code: "parse_failed" | "schema_identity_mismatch" | "index_failed",
  ) {
    super(message);
    this.name = "ArtifactIndexError";
  }
}

export interface ArtifactTextIndex {
  formattedText: string;
  lineOffsets: number[];
  pointerToLine: Map<string, number>;
  lineToPointer: Map<number, string>;
  schemaIdentity: string;
}

interface ContainerFrame {
  depth: number;
  pointer: string;
  type: "array" | "object";
  nextIndex: number;
}

function schemaIdentity(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const record = value as Record<string, unknown>;
  if (typeof record.contract_version === "string") return record.contract_version;
  return typeof record.schema_version === "string" ? record.schema_version : "";
}

function lineOffsets(text: string): number[] {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1) if (text.charCodeAt(index) === 10) offsets.push(index + 1);
  return offsets;
}

function lineAt(text: string, offsets: number[], index: number): string {
  const end = index + 1 < offsets.length ? offsets[index + 1] - 1 : text.length;
  return text.slice(offsets[index], end);
}

function escapePointerToken(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function opensContainer(value: string): "array" | "object" | null {
  const normalized = value.replace(/,$/, "").trim();
  if (normalized === "{") return "object";
  if (normalized === "[") return "array";
  return null;
}

function buildPointerMaps(text: string, offsets: number[]) {
  const pointerToLine = new Map<string, number>();
  const lineToPointer = new Map<number, string>();
  const stack: ContainerFrame[] = [];

  for (let index = 0; index < offsets.length; index += 1) {
    const line = lineAt(text, offsets, index);
    const trimmed = line.trim();
    const depth = Math.floor((line.length - line.trimStart().length) / 2);
    if (trimmed.startsWith("}") || trimmed.startsWith("]")) {
      while (stack.length && stack.at(-1)!.depth >= depth) stack.pop();
      continue;
    }
    while (stack.length && stack.at(-1)!.depth >= depth) stack.pop();

    let pointer = "";
    let valueText = trimmed;
    const parent = stack.at(-1);
    if (parent?.type === "object") {
      const property = trimmed.match(/^("(?:\\.|[^"\\])*")\s*:\s*(.*)$/);
      if (!property) continue;
      const key = JSON.parse(property[1]) as string;
      pointer = `${parent.pointer}/${escapePointerToken(key)}`;
      valueText = property[2];
    } else if (parent?.type === "array") {
      pointer = `${parent.pointer}/${parent.nextIndex}`;
      parent.nextIndex += 1;
    }

    const lineNumber = index + 1;
    pointerToLine.set(pointer, lineNumber);
    lineToPointer.set(lineNumber, pointer);
    const container = opensContainer(valueText);
    if (container) stack.push({ depth, pointer, type: container, nextIndex: 0 });
  }
  return { pointerToLine, lineToPointer };
}

export function buildArtifactTextIndex(rawText: string, expectedSchemaIdentity = ""): ArtifactTextIndex {
  let value: unknown;
  try {
    value = parseJsonLossless(rawText);
  } catch (error) {
    throw new ArtifactIndexError(error instanceof Error ? error.message : String(error), "parse_failed");
  }
  const actualSchemaIdentity = schemaIdentity(value);
  if (expectedSchemaIdentity && actualSchemaIdentity !== expectedSchemaIdentity) {
    throw new ArtifactIndexError(
      `Artifact schema identity ${actualSchemaIdentity || "<missing>"} does not match ${expectedSchemaIdentity}.`,
      "schema_identity_mismatch",
    );
  }
  let formattedText: string;
  try {
    formattedText = JSON.stringify(value, null, 2);
  } catch (error) {
    throw new ArtifactIndexError(error instanceof Error ? error.message : String(error), "index_failed");
  }
  const offsets = lineOffsets(formattedText);
  const pointers = buildPointerMaps(formattedText, offsets);
  return {
    formattedText,
    lineOffsets: offsets,
    pointerToLine: pointers.pointerToLine,
    lineToPointer: pointers.lineToPointer,
    schemaIdentity: actualSchemaIdentity,
  };
}

export function artifactLineMatch(index: ArtifactTextIndex, lineNumber: number): ArtifactLineMatch | null {
  if (!Number.isInteger(lineNumber) || lineNumber < 1 || lineNumber > index.lineOffsets.length) return null;
  const startOffset = index.lineOffsets[lineNumber - 1];
  const endOffset =
    lineNumber < index.lineOffsets.length ? index.lineOffsets[lineNumber] - 1 : index.formattedText.length;
  const line = index.formattedText.slice(startOffset, endOffset);
  const previewLimit = 600;
  return {
    lineNumber,
    startOffset,
    endOffset,
    preview: line.length > previewLimit ? `${line.slice(0, previewLimit)}…` : line,
    pointer: index.lineToPointer.get(lineNumber) ?? null,
  };
}

export function artifactLineWindow(
  index: ArtifactTextIndex,
  startLine: number,
  lineCount: number,
  characterLimit = 4000,
): ArtifactVirtualLine[] {
  const safeStart = Math.max(1, Math.floor(startLine));
  const safeCount = Math.min(300, Math.max(0, Math.floor(lineCount)));
  const safeCharacterLimit = Math.min(20_000, Math.max(80, Math.floor(characterLimit)));
  const endLine = Math.min(index.lineOffsets.length, safeStart + safeCount - 1);
  const lines: ArtifactVirtualLine[] = [];
  for (let lineNumber = safeStart; lineNumber <= endLine; lineNumber += 1) {
    const startOffset = index.lineOffsets[lineNumber - 1];
    const endOffset =
      lineNumber < index.lineOffsets.length ? index.lineOffsets[lineNumber] - 1 : index.formattedText.length;
    const fullText = index.formattedText.slice(startOffset, endOffset);
    const truncated = fullText.length > safeCharacterLimit;
    lines.push({
      lineNumber,
      text: truncated ? `${fullText.slice(0, safeCharacterLimit - 1)}…` : fullText,
      pointer: index.lineToPointer.get(lineNumber) ?? null,
      truncated,
    });
  }
  return lines;
}

export async function searchArtifactTextIndex(
  index: ArtifactTextIndex,
  query: string,
  maxResults: number,
  cancelled: () => boolean = () => false,
) {
  const needle = query.trim().toLowerCase();
  const matches: ArtifactLineMatch[] = [];
  let totalMatches = 0;
  for (let lineNumber = 1; lineNumber <= index.lineOffsets.length; lineNumber += 1) {
    if (cancelled()) throw new DOMException("Artifact search was cancelled.", "AbortError");
    const match = artifactLineMatch(index, lineNumber);
    if (match && index.formattedText.slice(match.startOffset, match.endOffset).toLowerCase().includes(needle)) {
      totalMatches += 1;
      if (matches.length < maxResults) matches.push(match);
    }
    if (lineNumber % 50_000 === 0) await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return { matches, totalMatches, truncated: totalMatches > matches.length };
}
