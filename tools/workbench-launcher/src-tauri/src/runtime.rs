use sha2::{Digest, Sha256};
use std::{
    env,
    ffi::OsString,
    fs,
    path::{Path, PathBuf},
};

use crate::error::PublicError;

static BUNDLED_NODE: &[u8] = include_bytes!(env!("TILESIM_BUNDLED_NODE_SOURCE"));

pub fn bundled_node_digest() -> String {
    hex::encode(Sha256::digest(BUNDLED_NODE))
}

fn extracted_node_is_valid(path: &Path) -> bool {
    fs::read(path)
        .map(|bytes| Sha256::digest(bytes) == Sha256::digest(BUNDLED_NODE))
        .unwrap_or(false)
}

const REQUIRED_SCRIPTS: &[&str] = &[
    "scripts/start-workbench.ps1",
    "scripts/update-backend.ps1",
    "scripts/configure-evidence-agent.ps1",
    "scripts/request-wsl-repair.ps1",
    "scripts/deployment-common.psm1",
];

pub fn required_scripts() -> &'static [&'static str] {
    REQUIRED_SCRIPTS
}

pub fn canonicalize_compatible(path: &Path) -> std::io::Result<PathBuf> {
    dunce::canonicalize(path)
}

fn valid_web_root(path: &Path) -> bool {
    REQUIRED_SCRIPTS
        .iter()
        .all(|relative| path.join(relative).is_file())
}

pub fn resolve_web_root() -> Result<PathBuf, PublicError> {
    let executable_root = env::current_exe()
        .ok()
        .and_then(|path| path.parent().map(Path::to_path_buf));
    let configured_root = env::var_os("TILESIM_WEB_ROOT").map(PathBuf::from);
    let source_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../..");
    for candidate in [configured_root, executable_root, Some(source_root)]
        .into_iter()
        .flatten()
    {
        if valid_web_root(&candidate) {
            if let Ok(canonical) = canonicalize_compatible(&candidate) {
                return Ok(canonical);
            }
            if candidate.is_absolute() {
                return Ok(candidate);
            }
        }
    }
    Err(PublicError::new(
        "未找到 TileSim Web checkout",
        "将启动器放回包含 scripts 目录的 TileSim Web 仓库根目录。",
        "required launcher scripts were not found beside the executable",
    ))
}

pub fn process_path_with_node(node: &Path) -> OsString {
    let mut entries = vec![node
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf()];
    if let Some(existing) = env::var_os("PATH") {
        entries.extend(env::split_paths(&existing));
    }
    env::join_paths(entries).unwrap_or_else(|_| env::var_os("PATH").unwrap_or_default())
}

pub fn extract_bundled_node() -> Result<PathBuf, PublicError> {
    let local_app_data = env::var_os("LOCALAPPDATA").ok_or_else(|| {
        PublicError::new(
            "运行时目录不可用",
            "确认当前 Windows 用户具有 LocalAppData 目录写入权限。",
            "LOCALAPPDATA is unavailable",
        )
    })?;
    let digest = bundled_node_digest();
    let root = PathBuf::from(local_app_data)
        .join("TileSim")
        .join("workbench-launcher")
        .join("node")
        .join(&digest[..16]);
    let executable = root.join("node.exe");
    if extracted_node_is_valid(&executable) {
        return Ok(executable);
    }
    fs::create_dir_all(&root).map_err(|error| {
        PublicError::new(
            "无法准备内置 Node",
            "确认当前用户可写入本地应用数据目录。",
            error.to_string(),
        )
    })?;
    let temporary = root.join(format!("node-{}.tmp", std::process::id()));
    fs::write(&temporary, BUNDLED_NODE).map_err(|error| {
        PublicError::new(
            "无法提取内置 Node",
            "检查磁盘空间与安全软件拦截记录。",
            error.to_string(),
        )
    })?;
    if executable.exists() {
        if let Ok(metadata) = executable.metadata() {
            let mut permissions = metadata.permissions();
            // The launcher is Windows-only. Clearing FILE_ATTRIBUTE_READONLY does
            // not broaden ACLs as the equivalent Unix operation would.
            #[allow(clippy::permissions_set_readonly_false)]
            permissions.set_readonly(false);
            let _ = fs::set_permissions(&executable, permissions);
        }
        fs::remove_file(&executable).map_err(|error| {
            PublicError::new(
                "无法更新内置 Node",
                "关闭其他 TileSim 启动器窗口后重试。",
                error.to_string(),
            )
        })?;
    }
    fs::rename(&temporary, &executable).map_err(|error| {
        PublicError::new(
            "无法启用内置 Node",
            "检查本地应用数据目录权限后重试。",
            error.to_string(),
        )
    })?;
    let mut permissions = executable
        .metadata()
        .map_err(|error| {
            PublicError::new(
                "无法验证内置 Node",
                "检查本地应用数据目录权限后重试。",
                error.to_string(),
            )
        })?
        .permissions();
    permissions.set_readonly(true);
    fs::set_permissions(&executable, permissions).map_err(|error| {
        PublicError::new(
            "无法保护内置 Node",
            "检查本地应用数据目录权限后重试。",
            error.to_string(),
        )
    })?;
    Ok(executable)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn canonical_paths_remain_compatible_with_powershell_and_wsl_conversion() {
        let canonical = canonicalize_compatible(Path::new(env!("CARGO_MANIFEST_DIR")))
            .expect("canonicalize launcher manifest directory");
        let rendered = canonical.to_string_lossy();
        assert!(canonical.is_absolute());
        assert!(!rendered.starts_with(r"\\?\"));
    }

    #[test]
    fn packaged_launcher_only_requires_runtime_scripts_beside_the_executable() {
        assert!(required_scripts()
            .iter()
            .all(|path| !path.starts_with("tools/workbench-launcher/")));
    }
}
