import type { LauncherBridge, LauncherSnapshot, OperationEvent, OperationRequest } from "./types";

const fixtureSnapshot: LauncherSnapshot = {
  service: {
    state: "stopped",
    label: "服务未启动",
    guidance: "已有验证部署，可启动服务；也可以先查看环境诊断。",
  },
  deployment: {
    manifestPresent: true,
    identity: "origin/main · dedicated_worktree",
    mode: "dedicated_worktree",
    sourceRevision: "a876859a44f660c4627dab495034d52b4ae61f57",
    buildRevision: "a876859a44f660c4627dab495034d52b4ae61f57",
    webRevision: "32a8703d66d9b4acd5ca6e4661a5608f6ce33720",
    schemaRevision: `sha256:${"8".repeat(64)}`,
    ctestStatus: "passed",
    webTestStatus: "passed",
  },
  model: {
    configured: true,
    baseUrl: "https://provider.example.invalid/v1",
    model: "gpt-5.6-sol",
    timeoutMs: 30_000,
    protectedKeyPresent: true,
  },
  environment: [
    { id: "git", label: "Git", status: "ready", summary: "2.45.1.windows.1" },
    { id: "wsl", label: "WSL2", status: "ready", summary: "Ubuntu-24.04 可用" },
    { id: "node", label: "内置 Node", status: "ready", summary: "v24.19.0，不依赖 PATH" },
    { id: "webview", label: "WebView2", status: "ready", summary: "Evergreen Runtime 可用" },
    { id: "manifest", label: "部署清单", status: "ready", summary: "identity 已绑定" },
  ],
  paths: {
    webRoot: "D:\\工作区\\TileSim Web",
    backendRepository: "D:\\工作区\\TileSim 后端源码",
    backendDeployment: "D:\\工作区\\TileSim 后端部署",
  },
  launcherVersion: "0.1.0-fixture",
};

const fixtureHandlers = new Set<(event: OperationEvent) => void>();
let fixtureActive = false;

function emitFixture(event: OperationEvent) {
  for (const handler of fixtureHandlers) handler(event);
}

function phaseLabelForFixture(phase: string) {
  return phase.replaceAll("_", " ");
}

function createFixtureBridge(): LauncherBridge {
  return {
    async getSnapshot() {
      return structuredClone(fixtureSnapshot);
    },
    async runOperation(request: OperationRequest) {
      if (fixtureActive) throw new Error("已有修改型操作正在运行");
      fixtureActive = true;
      const operationId = `fixture-${Date.now()}`;
      const shouldFail = request.kind === "deploy" && request.backendRepository.includes("触发失败");
      const phases =
        request.kind === "deploy"
          ? ([
              "checking_environment",
              "fetching",
              "building_backend",
              "testing_backend",
              "testing_web",
              "building_web",
              "publishing_release",
              "restarting",
            ] as const)
          : request.kind === "start"
            ? (["validating", "starting", "restarting"] as const)
            : (["checking_environment"] as const);
      phases.forEach((phase, index) => {
        window.setTimeout(() => {
          emitFixture({
            operationId,
            sequence: index + 1,
            phase,
            message: `${phaseLabelForFixture(phase)}…`,
            elapsedMs: index * 220,
            logLine: `[fixture] ${phase}`,
          });
        }, index * 40);
      });
      window.setTimeout(
        () => {
          emitFixture(
            shouldFail
              ? {
                  operationId,
                  sequence: phases.length + 1,
                  phase: "failed",
                  message: "操作失败。",
                  elapsedMs: phases.length * 220,
                  error: {
                    category: "部署工作树包含本地修改",
                    action: "检查部署目录并保留这些修改；确认处理方式后再重试。",
                    technicalDetail: "local changes; update aborted at <path>",
                  },
                }
              : {
                  operationId,
                  sequence: phases.length + 1,
                  phase: "succeeded",
                  message: "操作已完成。",
                  elapsedMs: phases.length * 220,
                },
          );
          if (!shouldFail && request.kind === "start") {
            fixtureSnapshot.service = {
              state: "ready",
              label: "服务已就绪",
              guidance: "可以直接打开工作台；当前服务与 deployment identity 一致。",
            };
          }
          fixtureActive = false;
        },
        phases.length * 40 + 20,
      );
      return { operationId };
    },
    async onOperationEvent(handler) {
      fixtureHandlers.add(handler);
      return () => fixtureHandlers.delete(handler);
    },
    async openWorkbench() {
      document.documentElement.dataset.fixtureOpened = "true";
    },
    async pickBackendDirectory() {
      return "D:\\含 空格\\后端源码";
    },
  };
}

function createTauriBridge(): LauncherBridge {
  return {
    async getSnapshot() {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<LauncherSnapshot>("get_launcher_snapshot");
    },
    async runOperation(request) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<{ operationId: string }>("run_operation", { request });
    },
    async onOperationEvent(handler) {
      const { listen } = await import("@tauri-apps/api/event");
      return listen<OperationEvent>("launcher://operation", ({ payload }) => handler(payload));
    },
    async openWorkbench() {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("open_workbench");
    },
    async pickBackendDirectory(current) {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<string | null>("pick_backend_directory", { current });
    },
  };
}

export function createLauncherBridge(): LauncherBridge {
  const fixture = import.meta.env.VITE_LAUNCHER_FIXTURE === "1" || !("__TAURI_INTERNALS__" in window);
  return fixture ? createFixtureBridge() : createTauriBridge();
}
