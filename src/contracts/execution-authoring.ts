// The schema validates these heterogeneous editor documents before submission.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ExecutionDocument = Record<string, any>;
export interface ExecutionIssue {
  path: string;
  message: string;
}
