/// <reference lib="webworker" />

import {
  buildStructuredReportWorkerResponse,
  type StructuredReportWorkerFailure,
  type StructuredReportWorkerRequest,
} from "./worker-contract";

const workerScope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

workerScope.onmessage = (event: MessageEvent<StructuredReportWorkerRequest>) => {
  try {
    workerScope.postMessage(buildStructuredReportWorkerResponse(event.data));
  } catch (error) {
    const failure: StructuredReportWorkerFailure = {
      requestId: event.data.requestId,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
    workerScope.postMessage(failure);
  }
};
