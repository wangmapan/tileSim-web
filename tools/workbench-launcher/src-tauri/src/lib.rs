mod error;
mod operation;
mod platform;
mod runtime;
mod self_check;
mod snapshot;

use error::PublicError;
use operation::{run_operation, LauncherState};
use snapshot::get_launcher_snapshot;
use std::path::{Path, PathBuf};

#[cfg(windows)]
use std::os::windows::ffi::OsStrExt;

#[tauri::command]
async fn pick_backend_directory(current: String) -> Result<Option<String>, PublicError> {
    let selected = tauri::async_runtime::spawn_blocking(move || {
        let mut dialog = rfd::FileDialog::new().set_title("选择 TileSim 后端仓库目录");
        let current_path = PathBuf::from(current);
        if current_path.is_dir() {
            dialog = dialog.set_directory(current_path);
        }
        dialog.pick_folder()
    })
    .await
    .map_err(|error| {
        PublicError::new(
            "无法打开目录选择器",
            "确认当前 Windows 会话允许打开系统文件对话框。",
            error.to_string(),
        )
    })?;
    Ok(selected.map(|path| path.to_string_lossy().into_owned()))
}

#[tauri::command]
fn open_workbench() -> Result<(), PublicError> {
    #[cfg(windows)]
    {
        use windows_sys::Win32::UI::{
            Shell::ShellExecuteW,
            WindowsAndMessaging::SW_SHOWNORMAL,
        };
        let wide = |value: &str| {
            std::ffi::OsStr::new(value)
                .encode_wide()
                .chain(Some(0))
                .collect::<Vec<_>>()
        };
        let operation = wide("open");
        let target = wide("http://127.0.0.1:5173/");
        let result = unsafe {
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                target.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
                SW_SHOWNORMAL,
            )
        };
        if result as isize <= 32 {
            return Err(PublicError::new(
                "无法打开默认浏览器",
                "手动访问 http://127.0.0.1:5173/。",
                format!("ShellExecuteW returned {}", result as isize),
            ));
        }
        Ok(())
    }
    #[cfg(not(windows))]
    {
        Err(PublicError::new(
            "平台不受支持",
            "请在 Windows 10 或 Windows 11 上运行启动器。",
            "open_workbench is Windows-only",
        ))
    }
}

pub fn write_self_check(path: &Path) -> Result<(), PublicError> {
    self_check::write_self_check(path)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(LauncherState::default())
        .invoke_handler(tauri::generate_handler![
            get_launcher_snapshot,
            run_operation,
            open_workbench,
            pick_backend_directory
        ])
        .run(tauri::generate_context!())
        .expect("error while running the TileSim workbench launcher");
}
