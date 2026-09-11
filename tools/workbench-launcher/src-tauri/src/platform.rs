use std::{env, path::PathBuf, process::Command as StdCommand};

#[cfg(windows)]
use winreg::{
    enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY},
    RegKey,
};

pub fn command_version(program: &str, arguments: &[&str]) -> Option<String> {
    let output = StdCommand::new(program).args(arguments).output().ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| line.trim().to_owned())
}

pub fn windows_powershell() -> PathBuf {
    let windows = env::var_os("SystemRoot")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
    windows.join("System32/WindowsPowerShell/v1.0/powershell.exe")
}

#[cfg(windows)]
pub fn webview2_version() -> Option<String> {
    const CLIENT: &str =
        r"SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}";
    let roots = [
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            KEY_READ | KEY_WOW64_32KEY,
        ),
        (
            RegKey::predef(HKEY_LOCAL_MACHINE),
            KEY_READ | KEY_WOW64_64KEY,
        ),
        (RegKey::predef(HKEY_CURRENT_USER), KEY_READ),
    ];
    roots.into_iter().find_map(|(root, flags)| {
        let key = root.open_subkey_with_flags(CLIENT, flags).ok()?;
        key.get_value::<String, _>("pv")
            .ok()
            .filter(|value| !value.trim().is_empty())
    })
}

#[cfg(not(windows))]
pub fn webview2_version() -> Option<String> {
    None
}
