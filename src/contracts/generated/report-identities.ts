// Generated from the frontend compatibility schema. Do not edit by hand.
// This file is not a canonical TileSim backend contract.

/**
 * Frontend compatibility schema derived from versioned Week 6 examples. This is not a canonical backend schema.
 */
export type TileSimCompatibilityReport =
  | RunReportContract
  | MetricsReportContract
  | ValidationReportContract
  | TailReportContract
  | DesignSpaceReportContract
  | ExecutionEnvelopeContract;

export interface RunReportContract {
  report_kind: "wind_tunnel_run_result";
  contract_version: "wind_tunnel.run.v1alpha1";
  status?: string;
  summary: {
    trace_name: string;
    range_label: string;
    end_to_end_latency_us?: number;
    runtime_event_count?: number;
    fabric_record_count?: number;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}
export interface MetricsReportContract {
  report_id: string;
  schema_version?: string;
  contract_version?: string;
  summary: {
    [k: string]: unknown;
  };
  request_metrics?: {
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface ValidationReportContract {
  report_id: string;
  schema_version?: string;
  contract_version?: string;
  validation_lane: string;
  checks?: {
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface TailReportContract {
  report_id: string;
  schema_version?: string;
  contract_version?: string;
  cause_chain?: {
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface DesignSpaceReportContract {
  report_kind: "design_space_report";
  contract_version: "design_space.report.v1alpha1";
  execution_scope: "S6_only";
  ranking: {
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
export interface ExecutionEnvelopeContract {
  envelope_id: string;
  schema_version?: string;
  contract_version?: string;
  host_path: "S7";
  stages: {
    [k: string]: unknown;
  }[];
  [k: string]: unknown;
}
