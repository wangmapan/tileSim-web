use std::{env, path::PathBuf, process::Command as StdCommand};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

pub const CREATE_NO_WINDOW: u32 = 0x0800_0000;

pub fn configure_hidden_std_command(command: &mut StdCommand) {
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
}

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

pub const POWERSHELL_SCRIPT_ENV: &str = "TILESIM_LAUNCHER_SCRIPT";
pub const POWERSHELL_ARGUMENTS_ENV: &str = "TILESIM_LAUNCHER_ARGUMENTS_JSON";

pub fn powershell_utf8_runner() -> &'static str {
    r#"$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [System.Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$launcherArguments = ConvertFrom-Json -InputObject $env:TILESIM_LAUNCHER_ARGUMENTS_JSON
$namedArguments = @{}
for ($index = 0; $index -lt $launcherArguments.Count; $index++) {
    $key = [string]$launcherArguments[$index]
    if (-not $key.StartsWith('-')) { throw "Invalid launcher argument key: $key" }
    $key = $key.TrimStart('-')
    if ($index + 1 -lt $launcherArguments.Count -and -not ([string]$launcherArguments[$index + 1]).StartsWith('-')) {
        $namedArguments[$key] = [string]$launcherArguments[++$index]
    } else {
        $namedArguments[$key] = $true
    }
}
& $env:TILESIM_LAUNCHER_SCRIPT @namedArguments"#
}

pub fn encode_powershell_arguments(arguments: &[String]) -> String {
    serde_json::to_string(arguments).expect("PowerShell arguments serialize to JSON")
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

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn powershell_runner_emits_utf8_when_output_is_redirected() {
        let output = StdCommand::new(windows_powershell())
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                powershell_utf8_runner(),
            ])
            .env(POWERSHELL_SCRIPT_ENV, "Write-Output")
            .env(
                POWERSHELL_ARGUMENTS_ENV,
                encode_powershell_arguments(&["-InputObject".into(), "位置".into()]),
            )
            .output()
            .expect("run Windows PowerShell UTF-8 fixture");
        assert!(output.status.success());
        assert_eq!(
            String::from_utf8(output.stdout)
                .expect("PowerShell output is UTF-8")
                .trim(),
            "位置"
        );
    }
}
