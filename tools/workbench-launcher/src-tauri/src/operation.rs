use regex::Regex;
use serde::{Deserialize, Serialize};
use std::{
    collections::VecDeque,
    path::{Path, PathBuf},
    process::Stdio,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::Instant,
};

use tauri::{AppHandle, Emitter, State};
use tokio::{
    io::{AsyncBufReadExt, AsyncRead, AsyncWriteExt, BufReader},
    process::Command,
    sync::mpsc,
};
use url::Url;
use uuid::Uuid;
use zeroize::{Zeroize, Zeroizing};

use crate::{
    error::{classify_failure, redact, PublicError},
    platform::{
        encode_powershell_arguments, powershell_utf8_runner, windows_powershell,
        POWERSHELL_ARGUMENTS_ENV, POWERSHELL_SCRIPT_ENV,
    },
    runtime::{
        canonicalize_compatible, extract_bundled_node, process_path_with_node, resolve_web_root,
    },
};

#[derive(Clone, Default)]
pub struct LauncherState {
    active: Arc<AtomicBool>,
}

impl LauncherState {
    fn try_begin(&self) -> bool {
        self.active
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    fn finish(&self) {
        self.active.store(false, Ordering::Release);
    }
}

#[derive(Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum OperationRequest {
    Start {
        wsl_distro: String,
    },
    Deploy {
        backend_repository: String,
        backend_deployment: String,
        wsl_distro: String,
    },
    RepairWsl {
        wsl_distro: String,
    },
    SaveModel {
        base_url: String,
        model: String,
        timeout_ms: u32,
        api_key: Option<String>,
        keep_existing_key: bool,
    },
}

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum OperationPhase {
    CheckingEnvironment,
    Starting,
    Validating,
    Fetching,
    BuildingBackend,
    TestingBackend,
    TestingWeb,
    BuildingWeb,
    PublishingRelease,
    Restarting,
    Succeeded,
    Failed,
    Blocked,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationEvent {
    operation_id: String,
    sequence: u64,
    phase: OperationPhase,
    message: String,
    elapsed_ms: u128,
    #[serde(skip_serializing_if = "Option::is_none")]
    log_line: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<PublicError>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OperationStarted {
    operation_id: String,
}

struct PreparedOperation {
    script: PathBuf,
    arguments: Vec<String>,
    secret_stdin: Option<Zeroizing<String>>,
    initial_phase: OperationPhase,
}

fn validate_wsl_distro(value: &str) -> Result<String, PublicError> {
    let normalized = value.trim();
    let allowed = Regex::new(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$").expect("WSL regex");
    if !allowed.is_match(normalized) {
        return Err(PublicError::new(
            "WSL 发行版名称无效",
            "只填写 wsl -l 中显示的发行版名称。",
            "WSL distribution failed the launcher allowlist",
        ));
    }
    Ok(normalized.to_owned())
}

fn validate_model(base_url: &str, model: &str, timeout_ms: u32) -> Result<(), PublicError> {
    let url = Url::parse(base_url).map_err(|error| {
        PublicError::new(
            "Base URL 无效",
            "填写 HTTPS 地址，或 loopback HTTP 地址。",
            error.to_string(),
        )
    })?;
    let loopback = matches!(url.host_str(), Some("127.0.0.1" | "localhost" | "::1"));
    if url.scheme() != "https" && !(url.scheme() == "http" && loopback) {
        return Err(PublicError::new(
            "Base URL 不安全",
            "远程模型服务必须使用 HTTPS；HTTP 只允许 loopback。",
            "provider URL did not pass HTTPS/loopback validation",
        ));
    }
    if !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(PublicError::new(
            "Base URL 包含不安全内容",
            "移除 URL 中的用户名、密码、查询参数和片段；凭据只填写在 API Key 字段。",
            "provider URL contained user info, query parameters, or a fragment",
        ));
    }
    if model.trim().is_empty() || model.len() > 180 || model.chars().any(char::is_control) {
        return Err(PublicError::new(
            "模型名无效",
            "填写服务返回的准确模型名。",
            "model identity failed validation",
        ));
    }
    if !(1_000..=120_000).contains(&timeout_ms) {
        return Err(PublicError::new(
            "超时设置无效",
            "选择 30、60 或 120 秒。",
            "timeout is outside the supported range",
        ));
    }
    Ok(())
}

fn validate_backend_repository(value: &str) -> Result<PathBuf, PublicError> {
    let path = PathBuf::from(value);
    let canonical = canonicalize_compatible(&path).map_err(|error| {
        PublicError::new(
            "后端仓库目录不可用",
            "重新选择一个存在的 TileSim Git 仓库。",
            error.to_string(),
        )
    })?;
    if !canonical.join(".git").exists() {
        return Err(PublicError::new(
            "目录不是 Git 工作树",
            "请选择 TileSim 后端仓库根目录。",
            "selected backend path has no .git entry",
        ));
    }
    Ok(canonical)
}

fn same_windows_path(left: &Path, right: &Path) -> bool {
    left.to_string_lossy()
        .trim_end_matches(['\\', '/'])
        .eq_ignore_ascii_case(right.to_string_lossy().trim_end_matches(['\\', '/']))
}

fn prepare_operation(
    web_root: &Path,
    request: OperationRequest,
) -> Result<PreparedOperation, PublicError> {
    let scripts = web_root.join("scripts");
    match request {
        OperationRequest::Start { wsl_distro } => Ok(PreparedOperation {
            script: scripts.join("start-workbench.ps1"),
            arguments: vec![
                "-ManifestPath".into(),
                web_root
                    .join("runtime/backend-current.json")
                    .to_string_lossy()
                    .into_owned(),
                "-WslDistro".into(),
                validate_wsl_distro(&wsl_distro)?,
            ],
            secret_stdin: None,
            initial_phase: OperationPhase::Validating,
        }),
        OperationRequest::RepairWsl { wsl_distro } => Ok(PreparedOperation {
            script: scripts.join("request-wsl-repair.ps1"),
            arguments: vec!["-WslDistro".into(), validate_wsl_distro(&wsl_distro)?],
            secret_stdin: None,
            initial_phase: OperationPhase::CheckingEnvironment,
        }),
        OperationRequest::Deploy {
            backend_repository,
            backend_deployment,
            wsl_distro,
        } => {
            let repository = validate_backend_repository(&backend_repository)?;
            let default_deployment = web_root
                .parent()
                .ok_or_else(|| {
                    PublicError::new(
                        "Web checkout 路径无效",
                        "将启动器放回 TileSim Web 仓库根目录。",
                        "Web root has no parent",
                    )
                })?
                .join("tileSim-backend");
            let requested_deployment = PathBuf::from(backend_deployment);
            if !requested_deployment.is_absolute()
                || !same_windows_path(&requested_deployment, &default_deployment)
            {
                return Err(PublicError::new(
                    "部署目录超出允许范围",
                    "使用工作台显示的默认独立部署工作树。",
                    "backend deployment path failed the launcher allowlist",
                ));
            }
            Ok(PreparedOperation {
                script: scripts.join("update-backend.ps1"),
                arguments: vec![
                    "-RepositoryRoot".into(),
                    repository.to_string_lossy().into_owned(),
                    "-BackendRoot".into(),
                    default_deployment.to_string_lossy().into_owned(),
                    "-WslDistro".into(),
                    validate_wsl_distro(&wsl_distro)?,
                ],
                secret_stdin: None,
                initial_phase: OperationPhase::CheckingEnvironment,
            })
        }
        OperationRequest::SaveModel {
            base_url,
            model,
            timeout_ms,
            api_key,
            keep_existing_key,
        } => {
            let api_key = api_key.map(Zeroizing::new);
            validate_model(&base_url, &model, timeout_ms)?;
            if api_key
                .as_deref()
                .map(|value| value.is_empty())
                .unwrap_or(true)
                && !keep_existing_key
            {
                return Err(PublicError::new(
                    "缺少 API Key",
                    "首次配置需要填写 API Key；已有 Key 可选择保留。",
                    "no API key or keep-existing instruction was provided",
                ));
            }
            if api_key.is_some() && keep_existing_key {
                return Err(PublicError::new(
                    "模型密钥请求冲突",
                    "填写新 Key，或保留已有 Key，不能同时选择。",
                    "save-model request failed closed",
                ));
            }
            if api_key
                .as_deref()
                .map(|value| value.len() > 8_192 || value.chars().any(char::is_control))
                .unwrap_or(false)
            {
                return Err(PublicError::new(
                    "API Key 格式无效",
                    "填写不含换行或控制字符的 API Key。",
                    "API key failed length or control-character validation",
                ));
            }
            let mut arguments = vec![
                "-Action".into(),
                "Set".into(),
                "-ConfigPath".into(),
                web_root
                    .join("runtime/evidence-agent.local.json")
                    .to_string_lossy()
                    .into_owned(),
                "-BaseUrl".into(),
                base_url,
                "-Model".into(),
                model,
                "-TimeoutMs".into(),
                timeout_ms.to_string(),
            ];
            if api_key.is_some() {
                arguments.push("-ApiKeyFromStdin".into());
            } else {
                arguments.push("-KeepExistingKey".into());
            }
            Ok(PreparedOperation {
                script: scripts.join("configure-evidence-agent.ps1"),
                arguments,
                secret_stdin: api_key,
                initial_phase: OperationPhase::CheckingEnvironment,
            })
        }
    }
}

fn phase_for_line(line: &str, current: OperationPhase) -> OperationPhase {
    let value = line.to_ascii_lowercase();
    if value.contains("refreshing origin") || value.contains("fetch --prune") {
        OperationPhase::Fetching
    } else if value.contains("ctest") || value.contains("backend validation") {
        OperationPhase::TestingBackend
    } else if value.contains("vitest") || value.contains("frontend once") {
        OperationPhase::TestingWeb
    } else if value.contains("vite") && value.contains("build") {
        OperationPhase::BuildingWeb
    } else if value.contains("immutable") || value.contains("release snapshot") {
        OperationPhase::PublishingRelease
    } else if value.contains("cmake") || value.contains("build_wsl") || value.contains("building") {
        OperationPhase::BuildingBackend
    } else if value.contains("restart") || value.contains("bridge") {
        OperationPhase::Restarting
    } else if value.contains("start") {
        OperationPhase::Starting
    } else {
        current
    }
}

fn phase_message(phase: OperationPhase) -> &'static str {
    match phase {
        OperationPhase::CheckingEnvironment => "正在检查本地环境…",
        OperationPhase::Starting => "正在启动本地服务…",
        OperationPhase::Validating => "正在验证当前部署…",
        OperationPhase::Fetching => "正在获取后端版本…",
        OperationPhase::BuildingBackend => "正在构建后端…",
        OperationPhase::TestingBackend => "正在运行后端验证…",
        OperationPhase::TestingWeb => "正在运行 Web 验证…",
        OperationPhase::BuildingWeb => "正在构建 Web…",
        OperationPhase::PublishingRelease => "正在发布不可变本地版本…",
        OperationPhase::Restarting => "正在重启本地服务…",
        OperationPhase::Succeeded => "操作已完成。",
        OperationPhase::Failed => "操作失败。",
        OperationPhase::Blocked => "操作已阻止。",
    }
}

fn bounded_log_line(value: &str) -> String {
    value
        .chars()
        .rev()
        .take(4_000)
        .collect::<String>()
        .chars()
        .rev()
        .collect()
}

fn emit_event(
    app: &AppHandle,
    operation_id: &str,
    sequence: &mut u64,
    phase: OperationPhase,
    started: Instant,
    log_line: Option<String>,
    error: Option<PublicError>,
) {
    *sequence += 1;
    let _ = app.emit(
        "launcher://operation",
        OperationEvent {
            operation_id: operation_id.to_owned(),
            sequence: *sequence,
            phase,
            message: phase_message(phase).to_owned(),
            elapsed_ms: started.elapsed().as_millis(),
            log_line,
            error,
        },
    );
}

async fn relay_lines<R>(reader: R, sender: mpsc::Sender<String>)
where
    R: AsyncRead + Unpin,
{
    let mut reader = BufReader::new(reader);
    let mut buffer = Vec::new();
    loop {
        buffer.clear();
        match reader.read_until(b'\n', &mut buffer).await {
            Ok(0) => break,
            Ok(_) => {
                while matches!(buffer.last(), Some(b'\r' | b'\n')) {
                    buffer.pop();
                }
                let line = String::from_utf8_lossy(&buffer).into_owned();
                if sender.send(line).await.is_err() {
                    break;
                }
            }
            Err(error) => {
                let _ = sender
                    .send(format!("launcher output stream read failed: {error}"))
                    .await;
                break;
            }
        }
    }
}

async fn execute_operation(
    app: AppHandle,
    state: LauncherState,
    operation_id: String,
    request: OperationRequest,
) {
    let started = Instant::now();
    let mut sequence = 0;
    let result = async {
        let web_root = resolve_web_root()?;
        let node = extract_bundled_node()?;
        let prepared = prepare_operation(&web_root, request)?;
        if !prepared.script.is_file() {
            return Err(PublicError::new(
                "启动器脚本缺失",
                "重新获取完整的 TileSim Web checkout。",
                "allowlisted PowerShell entry point is missing",
            ));
        }
        emit_event(
            &app,
            &operation_id,
            &mut sequence,
            prepared.initial_phase,
            started,
            None,
            None,
        );

        let mut command = Command::new(windows_powershell());
        #[cfg(windows)]
        command.creation_flags(crate::platform::CREATE_NO_WINDOW);
        command
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                powershell_utf8_runner(),
            ])
            .current_dir(&web_root)
            .env(POWERSHELL_SCRIPT_ENV, &prepared.script)
            .env(
                POWERSHELL_ARGUMENTS_ENV,
                encode_powershell_arguments(&prepared.arguments),
            )
            .env("TILESIM_NODE", &node)
            .env("PATH", process_path_with_node(&node))
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .stdin(if prepared.secret_stdin.is_some() {
                Stdio::piped()
            } else {
                Stdio::null()
            })
            .kill_on_drop(false);

        let mut child = command.spawn().map_err(|error| {
            PublicError::new(
                "无法启动本地脚本",
                "确认 Windows PowerShell 可用后重试。",
                error.to_string(),
            )
        })?;

        if let Some(mut secret) = prepared.secret_stdin {
            let write_result = if let Some(mut stdin) = child.stdin.take() {
                let result = stdin.write_all(secret.as_bytes()).await;
                let result = match result {
                    Ok(()) => stdin.write_all(b"\n").await,
                    error => error,
                };
                let _ = stdin.shutdown().await;
                result
            } else {
                Err(std::io::Error::new(
                    std::io::ErrorKind::BrokenPipe,
                    "PowerShell stdin pipe was unavailable",
                ))
            };
            secret.zeroize();
            write_result.map_err(|error| {
                PublicError::new(
                    "无法传递模型密钥",
                    "关闭其他启动器窗口后重新保存。",
                    error.to_string(),
                )
            })?;
        }

        let (sender, mut receiver) = mpsc::channel::<String>(64);
        if let Some(stdout) = child.stdout.take() {
            tokio::spawn(relay_lines(stdout, sender.clone()));
        }
        if let Some(stderr) = child.stderr.take() {
            tokio::spawn(relay_lines(stderr, sender.clone()));
        }
        drop(sender);

        let mut tail = VecDeque::with_capacity(400);
        let mut current_phase = prepared.initial_phase;
        while let Some(raw_line) = receiver.recv().await {
            let line = bounded_log_line(&redact(&raw_line));
            if line.trim().is_empty() {
                continue;
            }
            if tail.len() == 400 {
                tail.pop_front();
            }
            tail.push_back(line.clone());
            current_phase = phase_for_line(&line, current_phase);
            emit_event(
                &app,
                &operation_id,
                &mut sequence,
                current_phase,
                started,
                Some(line),
                None,
            );
        }

        let status = child.wait().await.map_err(|error| {
            PublicError::new(
                "无法确认脚本结果",
                "查看操作日志并确认后台进程是否完成。",
                error.to_string(),
            )
        })?;
        if !status.success() {
            return Err(classify_failure(
                &tail.into_iter().collect::<Vec<_>>().join("\n"),
            ));
        }
        Ok::<(), PublicError>(())
    }
    .await;

    match result {
        Ok(()) => emit_event(
            &app,
            &operation_id,
            &mut sequence,
            OperationPhase::Succeeded,
            started,
            None,
            None,
        ),
        Err(error) => {
            let phase = if error.category == "操作已阻止" {
                OperationPhase::Blocked
            } else {
                OperationPhase::Failed
            };
            emit_event(
                &app,
                &operation_id,
                &mut sequence,
                phase,
                started,
                None,
                Some(error),
            );
        }
    }
    state.finish();
}

#[tauri::command]
pub async fn run_operation(
    app: AppHandle,
    state: State<'_, LauncherState>,
    request: OperationRequest,
) -> Result<OperationStarted, PublicError> {
    if !state.try_begin() {
        return Err(PublicError::blocked(
            "the launcher mutation slot is already occupied",
        ));
    }
    let operation_id = Uuid::new_v4().to_string();
    let task_state = state.inner().clone();
    let task_app = app.clone();
    let task_id = operation_id.clone();
    tauri::async_runtime::spawn(async move {
        tokio::task::yield_now().await;
        execute_operation(task_app, task_state, task_id, request).await;
    });
    Ok(OperationStarted { operation_id })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn typed_arguments_never_include_secret() {
        let root = Path::new(r"C:\workspace\tileSim-web");
        let request = OperationRequest::SaveModel {
            base_url: "https://provider.example.invalid/v1".into(),
            model: "gpt-test".into(),
            timeout_ms: 30_000,
            api_key: Some("never-in-arguments".into()),
            keep_existing_key: false,
        };
        let prepared = prepare_operation(root, request).expect("prepare save-model operation");
        assert!(!prepared
            .arguments
            .iter()
            .any(|value| value.contains("never-in-arguments")));
        assert_eq!(
            prepared.secret_stdin.as_deref().map(String::as_str),
            Some("never-in-arguments")
        );
    }

    #[test]
    fn rejects_remote_plaintext_provider() {
        assert!(validate_model("http://provider.example.invalid", "gpt-test", 30_000).is_err());
        assert!(validate_model("http://127.0.0.1:9999", "gpt-test", 30_000).is_ok());
        assert!(validate_model(
            "https://user:secret@provider.example.invalid/v1",
            "gpt-test",
            30_000
        )
        .is_err());
        assert!(validate_model(
            "https://provider.example.invalid/v1?api_key=secret",
            "gpt-test",
            30_000
        )
        .is_err());
    }

    #[test]
    fn validates_wsl_names_without_shell_syntax() {
        assert!(validate_wsl_distro("Ubuntu-24.04").is_ok());
        assert!(validate_wsl_distro("Ubuntu; whoami").is_err());
    }

    #[test]
    fn windows_paths_support_spaces_chinese_and_case_insensitive_matching() {
        assert!(same_windows_path(
            Path::new(r"D:\工作区\TileSim 后端部署\"),
            Path::new(r"d:\工作区\tilesim 后端部署")
        ));
        assert!(!same_windows_path(
            Path::new(r"D:\工作区\TileSim 后端部署"),
            Path::new(r"D:\工作区\其他部署")
        ));
    }

    #[test]
    fn backend_log_line_is_bounded_and_keeps_the_tail() {
        let value = format!("prefix{}tail", "x".repeat(4_500));
        let bounded = bounded_log_line(&value);
        assert_eq!(bounded.chars().count(), 4_000);
        assert!(bounded.ends_with("tail"));
        assert!(!bounded.starts_with("prefix"));
    }

    #[test]
    fn mutation_slot_fails_closed_under_competition() {
        let state = LauncherState::default();
        assert!(state.try_begin());
        assert!(!state.try_begin());
        state.finish();
        assert!(state.try_begin());
    }

    #[tokio::test(flavor = "current_thread")]
    async fn non_utf8_powershell_output_is_preserved_lossily() {
        let (mut writer, reader) = tokio::io::duplex(64);
        writer
            .write_all(b"failure \xff detail\r\n")
            .await
            .expect("write invalid UTF-8 fixture");
        drop(writer);
        let (sender, mut receiver) = mpsc::channel(1);
        relay_lines(reader, sender).await;
        let line = receiver.recv().await.expect("relayed output");
        assert!(line.starts_with("failure "));
        assert!(line.ends_with(" detail"));
    }
}
