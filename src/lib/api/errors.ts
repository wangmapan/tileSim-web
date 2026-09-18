export class BridgeApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldPath: string | null;
  readonly requestId: string;
  readonly retryable: boolean;

  constructor(
    message: string,
    {
      status,
      code,
      fieldPath,
      requestId,
      retryable,
    }: {
      status: number;
      code: string;
      fieldPath?: string | null;
      requestId?: string;
      retryable?: boolean;
    },
  ) {
    super(message);
    this.name = "BridgeApiError";
    this.status = status;
    this.code = code;
    this.fieldPath = fieldPath ?? null;
    this.requestId = requestId || "";
    this.retryable = Boolean(retryable);
  }
}
