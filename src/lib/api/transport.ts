import { parseJsonLossless } from "../../contracts/lossless-json";
import { BridgeApiError } from "./errors";
import { t } from "../../i18n";

interface StructuredApiError {
  code?: string;
  message?: string;
  field_path?: string | null;
  retryable?: boolean;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function apiRoots(): string[] {
  if (["5173", "4173"].includes(window.location.port)) return ["/api"];
  return ["http://127.0.0.1:5173/api", "/api"];
}

export async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new BridgeApiError(t("本地服务返回了非 JSON 响应（HTTP {status}）。", { status: response.status }), {
      status: response.status,
      code: "non_json_response",
      requestId: response.headers.get("x-request-id") || "",
      retryable: response.status >= 500,
    });
  }
  const payload = parseJsonLossless(await response.text());
  const error = isRecord(payload) ? payload.error : null;
  if (!response.ok) {
    const structured = isRecord(error) ? (error as StructuredApiError) : null;
    const message =
      typeof error === "string"
        ? error
        : typeof structured?.message === "string"
          ? structured.message
          : t("请求失败（HTTP {status}）", { status: response.status });
    throw new BridgeApiError(message, {
      status: response.status,
      code: typeof structured?.code === "string" ? structured.code : `http_${response.status}`,
      fieldPath: typeof structured?.field_path === "string" ? structured.field_path : null,
      requestId:
        response.headers.get("x-request-id") ||
        (isRecord(payload) && typeof payload.request_id === "string" ? payload.request_id : ""),
      retryable: structured?.retryable === true,
    });
  }
  return payload as T;
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = String(options.method || "GET").toUpperCase();
  const roots = method === "GET" ? apiRoots() : apiRoots().slice(0, 1);
  let lastError: unknown;
  for (const root of roots) {
    try {
      const response = await fetch(`${root}${path}`, { cache: "no-store", ...options });
      return await parseResponse<T>(response);
    } catch (error) {
      if (error instanceof BridgeApiError) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(t("无法连接 TileSim 本地桥接服务。"));
}

export interface ApiResponseMetadata<T> {
  payload: T;
  schemaSetRevision: string;
}

export async function apiRequestWithMetadata<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponseMetadata<T>> {
  const method = String(options.method || "GET").toUpperCase();
  const roots = method === "GET" ? apiRoots() : apiRoots().slice(0, 1);
  let lastError: unknown;
  for (const root of roots) {
    try {
      const response = await fetch(`${root}${path}`, { cache: "no-store", ...options });
      const schemaSetRevision = response.headers.get("x-tilesim-schema-set-revision") || "";
      return { payload: await parseResponse<T>(response), schemaSetRevision };
    } catch (error) {
      if (error instanceof BridgeApiError) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(t("无法连接 TileSim 本地桥接服务。"));
}

export async function rawJsonTextRequest(path: string): Promise<string> {
  const bytes = await rawJsonBytesRequest(path);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new BridgeApiError(t("本地服务返回了无效的 UTF-8 JSON 工件。"), {
      status: 0,
      code: "invalid_artifact_encoding",
      retryable: false,
    });
  }
}

export async function rawJsonBytesRequest(path: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (const root of apiRoots()) {
    try {
      const response = await fetch(`${root}${path}`, { cache: "no-store" });
      if (!response.ok) await parseResponse<never>(response);
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new BridgeApiError(t("本地服务返回了非 JSON 响应（HTTP {status}）。", { status: response.status }), {
          status: response.status,
          code: "non_json_response",
          requestId: response.headers.get("x-request-id") || "",
          retryable: response.status >= 500,
        });
      }
      return new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (error instanceof BridgeApiError) throw error;
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(t("无法读取 TileSim 运行工件。"));
}
