use serde::Serialize;
use std::{env, fs, path::Path, process::Command};

use crate::{
    error::PublicError,
    platform::{configure_hidden_std_command, webview2_version, windows_powershell},
    runtime::{
        bundled_node_digest, canonicalize_compatible, extract_bundled_node, required_scripts,
        resolve_web_root,
    },
};

#[derive(Serialize)]
struct SelfCheckResult {
    schema_version: &'static str,
    ready: bool,
    web_root: String,
    resolved_from_executable_directory: bool,
    required_scripts_present: bool,
    missing_files: Vec<String>,
    deployment_manifest_present: bool,
    bundled_node_runtime: bool,
    bundled_node_sha256: String,
    node_without_path: bool,
    webview2_available: bool,
    webview2_version: Option<String>,
    credentials_read: bool,
    provider_accessed: bool,
    port_5173_touched: bool,
}

fn verify_node_without_path(web_root: &Path, node: &Path) -> bool {
    let system_root = env::var_os("SYSTEMROOT").unwrap_or_else(|| "C:\\Windows".into());
    let path = Path::new(&system_root).join("System32");
    let mut command = Command::new(windows_powershell());
    configure_hidden_std_command(&mut command);
    let output = command
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-ExecutionPolicy",
            "Bypass",
            "-Command",
            r#"$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
Import-Module $env:TILESIM_LAUNCHER_MODULE -Force
Resolve-TileSimNode"#,
        ])
        .current_dir(web_root)
        .env(
            "TILESIM_LAUNCHER_MODULE",
            web_root.join("scripts/deployment-common.psm1"),
        )
        .env("TILESIM_NODE", node)
        .env("PATH", &path)
        .output();
    output
        .ok()
        .filter(|result| result.status.success())
        .map(|result| {
            String::from_utf8_lossy(&result.stdout)
                .trim()
                .eq_ignore_ascii_case(node.to_string_lossy().as_ref())
        })
        .unwrap_or(false)
}

pub fn write_self_check(output_path: &Path) -> Result<(), PublicError> {
    let web_root = resolve_web_root()?;
    let node = extract_bundled_node()?;
    let missing_files = required_scripts()
        .iter()
        .map(|relative| web_root.join(relative))
        .filter(|path| !path.is_file())
        .map(|path| path.to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    let executable_parent = env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));
    let resolved_from_executable_directory = executable_parent
        .as_deref()
        .map(|parent| {
            parent == web_root
                || canonicalize_compatible(parent)
                    .ok()
                    .zip(canonicalize_compatible(&web_root).ok())
                    .map(|(left, right)| left == right)
                    .unwrap_or(false)
        })
        .unwrap_or(false);
    let bundled_node_runtime = node.is_file();
    let node_without_path = verify_node_without_path(&web_root, &node);
    let webview2 = webview2_version();
    let result = SelfCheckResult {
        schema_version: "tilesim.workbench_launcher_check.v2",
        ready: missing_files.is_empty()
            && bundled_node_runtime
            && node_without_path
            && webview2.is_some(),
        web_root: web_root.to_string_lossy().into_owned(),
        resolved_from_executable_directory,
        required_scripts_present: missing_files.is_empty(),
        missing_files,
        deployment_manifest_present: web_root.join("runtime/backend-current.json").is_file(),
        bundled_node_runtime,
        bundled_node_sha256: bundled_node_digest(),
        node_without_path,
        webview2_available: webview2.is_some(),
        webview2_version: webview2,
        credentials_read: false,
        provider_accessed: false,
        port_5173_touched: false,
    };
    let serialized = serde_json::to_string_pretty(&result).map_err(|error| {
        PublicError::new(
            "无法生成 self-check 结果",
            "重新运行 packaged self-check。",
            error.to_string(),
        )
    })?;
    fs::write(output_path, format!("{serialized}\n")).map_err(|error| {
        PublicError::new(
            "无法写入 self-check 结果",
            "选择当前用户可写的输出目录。",
            error.to_string(),
        )
    })
}
