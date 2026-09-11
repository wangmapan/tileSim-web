use serde::Serialize;
use serde_json::Value;
use std::{fs, path::Path, process::Command, time::Duration};

use crate::{
    error::PublicError,
    platform::{command_version, webview2_version, windows_powershell},
    runtime::{extract_bundled_node, process_path_with_node, resolve_web_root},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LauncherSnapshot {
    service: ServiceSnapshot,
    deployment: DeploymentSnapshot,
    model: ModelSnapshot,
    environment: Vec<EnvironmentCheck>,
    paths: LauncherPaths,
    launcher_version: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ServiceSnapshot {
    state: &'static str,
    label: &'static str,
    guidance: &'static str,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DeploymentSnapshot {
    manifest_present: bool,
    identity: Option<String>,
    mode: Option<String>,
    source_revision: Option<String>,
    build_revision: Option<String>,
    web_revision: Option<String>,
    schema_revision: Option<String>,
    ctest_status: Option<String>,
    web_test_status: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ModelSnapshot {
    configured: bool,
    base_url: String,
    model: String,
    timeout_ms: u64,
    protected_key_present: bool,
}

#[derive(Serialize)]
struct EnvironmentCheck {
    id: &'static str,
    label: &'static str,
    status: &'static str,
    summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    detail: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LauncherPaths {
    web_root: String,
    backend_repository: String,
    backend_deployment: String,
}

fn string_field(value: &Value, name: &str) -> Option<String> {
    value
        .get(name)
        .and_then(Value::as_str)
        .filter(|field| !field.trim().is_empty())
        .map(ToOwned::to_owned)
}

fn read_manifest(path: &Path) -> Value {
    fs::read_to_string(path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or(Value::Null)
}

fn read_public_model_settings(web_root: &Path, node: &Path) -> ModelSnapshot {
    let config = web_root.join("runtime/evidence-agent.local.json");
    if !config.is_file() {
        return ModelSnapshot {
            configured: false,
            base_url: String::new(),
            model: String::new(),
            timeout_ms: 30_000,
            protected_key_present: false,
        };
    }
    let output = Command::new(windows_powershell())
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
        ])
        .arg(web_root.join("scripts/configure-evidence-agent.ps1"))
        .args(["-Action", "Show", "-ConfigPath"])
        .arg(&config)
        .current_dir(web_root)
        .env("TILESIM_NODE", node)
        .env("PATH", process_path_with_node(node))
        .output();
    let public = output
        .ok()
        .filter(|result| result.status.success())
        .and_then(|result| {
            String::from_utf8_lossy(&result.stdout)
                .lines()
                .rev()
                .find_map(|line| serde_json::from_str::<Value>(line).ok())
        })
        .unwrap_or(Value::Null);
    ModelSnapshot {
        configured: public
            .get("configured")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        base_url: string_field(&public, "base_url").unwrap_or_default(),
        model: string_field(&public, "model").unwrap_or_default(),
        timeout_ms: public
            .get("timeout_ms")
            .and_then(Value::as_u64)
            .unwrap_or(30_000),
        protected_key_present: public.get("api_key_status").and_then(Value::as_str)
            == Some("stored_with_windows_dpapi"),
    }
}

async fn fetch_health() -> Option<Value> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .ok()?
        .get("http://127.0.0.1:5173/api/health")
        .send()
        .await
        .ok()?
        .error_for_status()
        .ok()?
        .json::<Value>()
        .await
        .ok()
}

#[tauri::command]
pub async fn get_launcher_snapshot() -> Result<LauncherSnapshot, PublicError> {
    let web_root = resolve_web_root()?;
    let node = extract_bundled_node()?;
    let runtime = web_root.join("runtime");
    let manifest_path = runtime.join("backend-current.json");
    let manifest_present = manifest_path.is_file();
    let manifest = read_manifest(&manifest_path);
    let health = if manifest_present { fetch_health().await } else { None };
    let execution_ready = health
        .as_ref()
        .and_then(|value| value.get("execution_ready"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let versions_match = health
        .as_ref()
        .and_then(|value| value.get("versions_match"))
        .and_then(Value::as_bool)
        .unwrap_or(false);
    let service = if execution_ready && versions_match {
        ServiceSnapshot {
            state: "ready",
            label: "服务已就绪",
            guidance: "可以直接打开工作台；当前服务与 deployment identity 一致。",
        }
    } else if health.is_some() {
        ServiceSnapshot {
            state: "degraded",
            label: "在线但不可执行",
            guidance: "部署身份或执行条件不一致，请查看诊断后重新部署。",
        }
    } else if manifest_present {
        ServiceSnapshot {
            state: "stopped",
            label: "服务未启动",
            guidance: "已有验证部署，可启动服务；也可以先查看环境诊断。",
        }
    } else {
        ServiceSnapshot {
            state: "unavailable",
            label: "尚未部署",
            guidance: "前往“更新与部署”，先完成本地验证部署。",
        }
    };

    let source_ref = string_field(&manifest, "source_ref");
    let mode = string_field(&manifest, "deployment_mode");
    let validation = manifest.get("validation").unwrap_or(&Value::Null);
    let deployment = DeploymentSnapshot {
        manifest_present,
        identity: match (&source_ref, &mode) {
            (Some(reference), Some(mode)) => Some(format!("{reference} · {mode}")),
            _ => None,
        },
        mode,
        source_revision: string_field(&manifest, "source_revision"),
        build_revision: string_field(&manifest, "build_revision"),
        web_revision: string_field(&manifest, "web_source_revision"),
        schema_revision: string_field(&manifest, "schema_set_revision"),
        ctest_status: string_field(validation, "tilesim_ctest"),
        web_test_status: string_field(validation, "web"),
    };
    let model = read_public_model_settings(&web_root, &node);
    let parent = web_root.parent().ok_or_else(|| {
        PublicError::new(
            "Web checkout 路径无效",
            "将启动器放回 TileSim Web 仓库根目录。",
            "Web root has no parent",
        )
    })?;
    let backend_repository = parent.join("tileSim");
    let backend_deployment = parent.join("tileSim-backend");
    let node_version = command_version(node.to_string_lossy().as_ref(), &["--version"]);
    let git_version = command_version("git.exe", &["--version"]);
    let wsl_ready = Command::new("wsl.exe")
        .args(["-l", "-q"])
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false);
    let webview = webview2_version();

    let environment = vec![
        EnvironmentCheck {
            id: "git",
            label: "Git",
            status: if git_version.is_some() { "ready" } else { "missing" },
            summary: git_version.unwrap_or_else(|| "未找到 Git for Windows".into()),
            detail: None,
        },
        EnvironmentCheck {
            id: "wsl",
            label: "WSL2",
            status: if wsl_ready { "ready" } else { "missing" },
            summary: if wsl_ready {
                "WSL 可列出本地发行版".into()
            } else {
                "WSL 不可用或服务异常".into()
            },
            detail: None,
        },
        EnvironmentCheck {
            id: "node",
            label: "内置 Node",
            status: if node_version.is_some() { "ready" } else { "missing" },
            summary: node_version.unwrap_or_else(|| "内置 Node 无法执行".into()),
            detail: Some("通过 TILESIM_NODE 提供，不依赖资源管理器继承的 PATH。".into()),
        },
        EnvironmentCheck {
            id: "webview",
            label: "WebView2",
            status: if webview.is_some() { "ready" } else { "missing" },
            summary: webview.unwrap_or_else(|| "未检测到 Evergreen Runtime".into()),
            detail: Some("缺失时从 Microsoft 安装 WebView2 Evergreen Runtime。".into()),
        },
        EnvironmentCheck {
            id: "manifest",
            label: "部署清单",
            status: if manifest_present { "ready" } else { "warning" },
            summary: if manifest_present {
                "已发现 runtime/backend-current.json".into()
            } else {
                "尚无本地 deployment manifest".into()
            },
            detail: None,
        },
    ];

    Ok(LauncherSnapshot {
        service,
        deployment,
        model,
        environment,
        paths: LauncherPaths {
            web_root: web_root.to_string_lossy().into_owned(),
            backend_repository: backend_repository.to_string_lossy().into_owned(),
            backend_deployment: backend_deployment.to_string_lossy().into_owned(),
        },
        launcher_version: env!("CARGO_PKG_VERSION").to_owned(),
    })
}
