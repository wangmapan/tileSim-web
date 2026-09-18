import type { Availability } from "../../contracts/report-model";

export interface CoverageCell {
  key: string;
  label: string;
  text: string | null;
  mono?: boolean;
  numeric?: boolean;
  availability: Availability;
  availabilityNote?: string;
}

export interface CoverageRecord {
  key: string;
  cells: CoverageCell[];
}

export interface CoverageColumn {
  key: string;
  label: string;
  numeric?: boolean;
  mono?: boolean;
}

export interface CoverageList {
  key: string;
  title: string;
  description?: string;
  columns: CoverageColumn[];
  records: CoverageRecord[];
  /** Evidence pointer for the array itself, e.g. `validation:/error_budget`. */
  sourcePaths: string[];
  availability: Availability;
  /** States explicitly which of missing / not covered / not applicable applies. */
  emptyNote: string;
}

export interface CoverageField {
  key: string;
  /** Backend field name, kept verbatim so the label stays traceable. */
  label: string;
  text: string | null;
  detail?: string | null;
  sourcePaths: string[];
  availability: Availability;
  mono?: boolean;
  /**
   * Boolean facts (`has_*`) are rendered as an explicit 是/否 and are never
   * tinted to imply the underlying evidence was captured.
   */
  fact?: boolean;
}

export interface CoverageGroup {
  key: string;
  title: string;
  description?: string;
  availability: Availability;
  fields: CoverageField[];
  lists: CoverageList[];
}
