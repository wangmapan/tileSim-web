import { isLosslessInteger } from "../../../contracts/lossless-json";
export type EvidenceObject = Record<string, unknown>;
export interface OperatorEvidence {
  id: string;
  fragmentId: string;
  requestId: string;
  kind: string;
  state: string;
  startPs: string | null;
  endPs: string | null;
  attributes: EvidenceObject;
  pointer: string;
  raw: EvidenceObject;
}
const obj = (value: unknown): EvidenceObject =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as EvidenceObject) : {};
export function normalizeOperatorEvidence(value: unknown): OperatorEvidence[] {
  const rows: OperatorEvidence[] = [];
  function visit(value: unknown, pointer: string) {
    if (Array.isArray(value)) {
      value.forEach((v, i) => visit(v, `${pointer}/${i}`));
      return;
    }
    const r = obj(value),
      a = obj(r.attributes);
    if (typeof r.operation_id === "string" && typeof r.fragment_id === "string" && Object.keys(a).length) {
      rows.push({
        id: r.operation_id,
        fragmentId: r.fragment_id,
        requestId: String(a.data_request_id || r.data_request_id || ""),
        kind: String(a.source_operation_kind || r.operation_kind || r.resource_kind || "missing"),
        state: String(r.state || "missing"),
        startPs: isLosslessInteger(r.start_time_ps) ? String(r.start_time_ps) : null,
        endPs: isLosslessInteger(r.completion_time_ps) ? String(r.completion_time_ps) : null,
        attributes: a,
        pointer,
        raw: r,
      });
      return;
    }
    for (const [key, child] of Object.entries(r))
      visit(child, `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`);
  }
  visit(value, "");
  return rows;
}
export function evidenceValue(value: unknown): string {
  return value === undefined || value === null || value === ""
    ? "missing"
    : typeof value === "object"
      ? JSON.stringify(value)
      : String(value);
}
