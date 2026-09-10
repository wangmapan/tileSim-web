param(
    [string]$OutputDirectory = "",
    [string]$ExecutableName = "TileSimWorkbench",
    [string]$PythonLauncher = "py.exe"
)

$ErrorActionPreference = "Stop"
$pyInstallerVersion = "6.22.2"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$source = Join-Path $PSScriptRoot "tilesim_launcher.py"
$buildRoot = Join-Path $webRoot "runtime\launcher-build"
$virtualEnvironment = Join-Path $buildRoot "venv"
$buildPython = Join-Path $virtualEnvironment "Scripts\python.exe"
$workPath = Join-Path $buildRoot "work"
$specPath = Join-Path $buildRoot "spec"
$output = if ($OutputDirectory) {
    [System.IO.Path]::GetFullPath($OutputDirectory)
} else {
    Join-Path $webRoot "runtime\launcher-dist"
}
$executable = Join-Path $output "$ExecutableName.exe"
$checkFile = Join-Path $buildRoot "launcher-check.json"

if (-not (Test-Path -LiteralPath $source)) {
    throw "Launcher source was not found: $source"
}
New-Item -ItemType Directory -Path $buildRoot, $output -Force | Out-Null

if (-not (Test-Path -LiteralPath $buildPython)) {
    & $PythonLauncher -3 -m venv $virtualEnvironment
    if ($LASTEXITCODE -ne 0) { throw "Could not create the launcher build environment." }
}

$installedVersion = & $buildPython -c "import PyInstaller; print(PyInstaller.__version__)" 2>$null
if ($LASTEXITCODE -ne 0 -or $installedVersion.Trim() -ne $pyInstallerVersion) {
    & $buildPython -m pip install --disable-pip-version-check "pyinstaller==$pyInstallerVersion"
    if ($LASTEXITCODE -ne 0) { throw "Could not install PyInstaller $pyInstallerVersion." }
}

& $buildPython -m PyInstaller `
    --noconfirm `
    --clean `
    --onefile `
    --windowed `
    --name $ExecutableName `
    --distpath $output `
    --workpath $workPath `
    --specpath $specPath `
    $source
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $executable)) {
    throw "The TileSim launcher executable was not produced."
}

# IMAGE_SUBSYSTEM_WINDOWS_GUI (2) proves the executable will not allocate a
# console window. IMAGE_SUBSYSTEM_WINDOWS_CUI (3) would show a black console.
$bytes = [System.IO.File]::ReadAllBytes($executable)
if ($bytes.Length -lt 256) { throw "The launcher executable is not a valid PE file." }
$peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
$subsystem = [BitConverter]::ToUInt16($bytes, $peOffset + 24 + 68)
if ($subsystem -ne 2) {
    throw "The launcher executable was not built for the Windows GUI subsystem."
}

if (Test-Path -LiteralPath $checkFile) { Remove-Item -LiteralPath $checkFile -Force }
$checkProcess = Start-Process `
    -FilePath $executable `
    -ArgumentList @("--check-file", "`"$checkFile`"") `
    -WindowStyle Hidden `
    -Wait `
    -PassThru
if ($checkProcess.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $checkFile)) {
    throw "The packaged launcher self-check failed."
}
$check = Get-Content -Raw -LiteralPath $checkFile | ConvertFrom-Json
if ($check.ready -ne $true -or $check.web_root -ne $webRoot) {
    throw "The packaged launcher could not locate the TileSim Web runtime."
}
Remove-Item -LiteralPath $checkFile -Force

[ordered]@{
    schema_version = "tilesim.workbench_launcher_build.v1"
    executable = $executable
    pyinstaller_version = $pyInstallerVersion
    subsystem = "windows_gui"
    console_window = $false
    self_check = "passed"
    size_bytes = (Get-Item -LiteralPath $executable).Length
} | ConvertTo-Json -Compress
