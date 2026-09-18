import { bridgePaths } from "../../contracts/generated/bridge-client";
import { parseJsonLossless } from "../../contracts/lossless-json";
import type { ApiRun } from "../../contracts/bridge-api";
import { BridgeApiError } from "./errors";
import { t } from "../../i18n";
import { apiRequest, apiRoots, isRecord, parseResponse } from "./transport";

export interface WaitForRunOptions {
  onStatus?: (run: ApiRun, transport: "sse" | "poll") => void;
  maxPollAttempts?: number;
  pollIntervalMs?: number;
  signal?: AbortSignal;
}

class RunTerminalError extends Error {}

function waitForPollInterval(interval: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(signal?.reason || new DOMException("Run wait was cancelled.", "AbortError"));
    };
    const timer = window.setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, interval);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

function terminalRun(run: ApiRun): ApiRun | null {
  if (run.status === "completed") return run;
  if (run.status === "failed") {
    throw new RunTerminalError(typeof run.error === "string" ? run.error : t("模拟任务没有完成。"));
  }
  return null;
}

function parseSseBlock(block: string): { id: string; event: string; data: string } | null {
  let id = "";
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const separator = line.indexOf(":");
    const field = separator >= 0 ? line.slice(0, separator) : line;
    const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, "") : "";
    if (field === "id") id = value;
    else if (field === "event") event = value;
    else if (field === "data") data.push(value);
  }
  return data.length || id ? { id, event, data: data.join("\n") } : null;
}

async function consumeRunEvents(
  runId: string,
  lastEventId: string,
  onEventId: (eventId: string) => void,
  onStatus?: WaitForRunOptions["onStatus"],
  signal?: AbortSignal,
): Promise<{ run: ApiRun | null; timedOut: boolean }> {
  const headers: Record<string, string> = { Accept: "text/event-stream" };
  if (lastEventId !== "0") headers["Last-Event-ID"] = lastEventId;
  const response = await fetch(`${apiRoots()[0]}${bridgePaths.getRunEvents(runId)}`, {
    cache: "no-store",
    headers,
    signal,
  });
  if (!response.ok) await parseResponse<never>(response);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/event-stream") || !response.body) {
    throw new BridgeApiError(t("运行状态流不可用。"), {
      status: response.status,
      code: "run_event_stream_unavailable",
      requestId: response.headers.get("x-request-id") || "",
      retryable: true,
    });
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    buffer = buffer.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      const parsed = parseSseBlock(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      if (parsed?.id) onEventId(parsed.id);
      if (parsed?.event === "timeout") return { run: null, timedOut: true };
      if (parsed?.event === "run" && parsed.data) {
        const payload = parseJsonLossless(parsed.data);
        if (isRecord(payload) && typeof payload.run_id === "string") {
          const run = payload as unknown as ApiRun;
          onStatus?.(run, "sse");
          if (terminalRun(run)) return { run, timedOut: false };
        }
      }
      boundary = buffer.indexOf("\n\n");
    }
    if (done) return { run: null, timedOut: false };
  }
}

export async function waitForRun(runId: string, options: WaitForRunOptions = {}): Promise<ApiRun> {
  let lastEventId = "0";
  for (let reconnect = 0; reconnect < 2; reconnect += 1) {
    try {
      const result = await consumeRunEvents(
        runId,
        lastEventId,
        (eventId) => {
          lastEventId = eventId;
        },
        options.onStatus,
        options.signal,
      );
      if (result.run) return result.run;
      if (result.timedOut) break;
    } catch (error) {
      if (error instanceof RunTerminalError) throw error;
      if (reconnect === 1) break;
    }
  }

  const maxAttempts = options.maxPollAttempts ?? 180;
  const interval = options.pollIntervalMs ?? 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    options.signal?.throwIfAborted();
    if (attempt > 0) await waitForPollInterval(interval, options.signal);
    const run = await apiRequest<ApiRun>(bridgePaths.getRun(runId), { signal: options.signal });
    options.onStatus?.(run, "poll");
    const terminal = terminalRun(run);
    if (terminal) return terminal;
  }
  throw new Error(t("等待模拟结果超时。"));
}
