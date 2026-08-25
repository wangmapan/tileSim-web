function apiRoots() {
  if (["5173", "4173"].includes(window.location.port)) return ["/api"];
  return ["http://127.0.0.1:5173/api", "/api"];
}

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json"))
    throw new Error(`本地服务返回了非 JSON 响应（HTTP ${response.status}）。`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `请求失败（HTTP ${response.status}）`);
  return payload;
}

export async function apiRequest(path, options = {}) {
  let lastError;
  for (const root of apiRoots()) {
    try {
      const response = await fetch(`${root}${path}`, { cache: "no-store", ...options });
      return await parseResponse(response);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("无法连接 TileSim 本地桥接服务。");
}

export function rawArtifactUrl(runId, artifact) {
  const root = ["5173", "4173"].includes(window.location.port) ? "/api" : "http://127.0.0.1:5173/api";
  return `${root}/runs/${encodeURIComponent(runId)}/files/${encodeURIComponent(artifact)}`;
}

export const bridgeApi = {
  health: () => apiRequest("/health"),
  catalog: () => apiRequest("/catalog"),
  capabilities: () => apiRequest("/capabilities"),
  listRuns: () => apiRequest("/runs"),
  getRun: (runId) => apiRequest(`/runs/${encodeURIComponent(runId)}`),
  getReports: (runId) => apiRequest(`/runs/${encodeURIComponent(runId)}/reports`),
  getTemplate: (scenarioId) => apiRequest(`/templates/${encodeURIComponent(scenarioId)}`),
  getInput: (runId) => apiRequest(`/runs/${encodeURIComponent(runId)}/files/input-runtime-trace`),
  renameRun: (runId, runName) =>
    apiRequest(`/runs/${encodeURIComponent(runId)}/name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ run_name: runName }),
    }),
  createRun: (payload) =>
    apiRequest("/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),
};
