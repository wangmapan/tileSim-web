param(
    [string]$OutputDirectory = "",
    [string]$ExecutableName = "",
    [string]$PythonLauncher = "py.exe"
)

$ErrorActionPreference = "Stop"
if ($OutputDirectory -or $PythonLauncher -ne "py.exe") {
    throw "The Tauri launcher builds only into the Web checkout root; OutputDirectory and PythonLauncher are no longer supported."
}

& (Join-Path $PSScriptRoot "..\workbench-launcher\build-launcher.ps1") -ExecutableName $ExecutableName
if ($LASTEXITCODE -ne 0) { throw "Tauri launcher build failed with exit code $LASTEXITCODE." }
