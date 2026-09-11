param(
    [string]$ExecutableName = ""
)

$ErrorActionPreference = "Stop"
$defaultExecutableName = "$([char]0x542F)$([char]0x52A8)TileSim$([char]0x5DE5)$([char]0x4F5C)$([char]0x53F0)"
if ([string]::IsNullOrWhiteSpace($ExecutableName)) { $ExecutableName = $defaultExecutableName }

$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$tauriRoot = Join-Path $PSScriptRoot "src-tauri"
$tauriConfig = Join-Path $tauriRoot "tauri.conf.json"
$targetExecutable = Join-Path $tauriRoot "target\release\tilesim-workbench-launcher.exe"
$publishedExecutable = Join-Path $webRoot "$ExecutableName.exe"
$candidateExecutable = Join-Path $webRoot "$ExecutableName.tauri-candidate.exe"
$buildRoot = Join-Path $webRoot "runtime\launcher-tauri-build"
$checkFile = Join-Path $buildRoot "packaged-self-check.json"
$fallbackRoot = Join-Path $webRoot "runtime\launcher-fallback"

Import-Module (Join-Path $webRoot "scripts\deployment-common.psm1") -Force
$nodeRuntime = Resolve-TileSimNode
$nodeVersionText = (& $nodeRuntime --version).Trim()
if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($nodeVersionText)) {
    throw "The launcher build Node runtime could not be executed."
}
$nodeVersion = [version]$nodeVersionText.TrimStart("v").Split("-")[0]
if ($nodeVersion.Major -lt 20) {
    throw "Node.js 20 or newer is required. Found $nodeVersionText."
}

$pnpmVersion = (& pnpm --version).Trim()
if ($LASTEXITCODE -ne 0 -or $pnpmVersion -ne "11.19.0") {
    throw "pnpm 11.19.0 is required. Activate it with Corepack before building."
}
foreach ($commandName in @("cargo", "rustc")) {
    if ($null -eq (Get-Command $commandName -ErrorAction SilentlyContinue)) {
        throw "$commandName was not found. Install the stable MSVC Rust toolchain described in the launcher guide."
    }
}
if (-not (Test-Path -LiteralPath $tauriConfig -PathType Leaf)) {
    throw "Tauri config was not found: $tauriConfig"
}

New-Item -ItemType Directory -Path $buildRoot -Force | Out-Null
$previousNodeSource = [Environment]::GetEnvironmentVariable("TILESIM_BUNDLED_NODE_SOURCE", "Process")
[Environment]::SetEnvironmentVariable("TILESIM_BUNDLED_NODE_SOURCE", $nodeRuntime, "Process")
try {
    Push-Location $tauriRoot
    try {
        & cargo fmt --check
        if ($LASTEXITCODE -ne 0) { throw "cargo fmt --check failed." }
        & cargo clippy --all-targets --all-features -- -D warnings
        if ($LASTEXITCODE -ne 0) { throw "cargo clippy failed." }
        & cargo test
        if ($LASTEXITCODE -ne 0) { throw "cargo test failed." }
    } finally {
        Pop-Location
    }

    Push-Location $webRoot
    try {
        & pnpm launcher:test
        if ($LASTEXITCODE -ne 0) { throw "Launcher unit and component tests failed." }
        & pnpm launcher:test:e2e
        if ($LASTEXITCODE -ne 0) { throw "Launcher fixture E2E tests failed." }
        & pnpm exec tauri build --config $tauriConfig --bundles nsis --ci
        if ($LASTEXITCODE -ne 0) { throw "Tauri production build failed." }
    } finally {
        Pop-Location
    }
} finally {
    [Environment]::SetEnvironmentVariable("TILESIM_BUNDLED_NODE_SOURCE", $previousNodeSource, "Process")
}

if (-not (Test-Path -LiteralPath $targetExecutable -PathType Leaf)) {
    throw "The Tauri launcher executable was not produced: $targetExecutable"
}
Copy-Item -LiteralPath $targetExecutable -Destination $candidateExecutable -Force

# IMAGE_SUBSYSTEM_WINDOWS_GUI (2) proves the launcher does not allocate a console window.
$bytes = [System.IO.File]::ReadAllBytes($candidateExecutable)
if ($bytes.Length -lt 256) { throw "The launcher candidate is not a valid PE file." }
$peOffset = [BitConverter]::ToInt32($bytes, 0x3c)
$subsystem = [BitConverter]::ToUInt16($bytes, $peOffset + 24 + 68)
if ($subsystem -ne 2) { throw "The launcher candidate is not a Windows GUI executable." }

$previousWebRoot = [Environment]::GetEnvironmentVariable("TILESIM_WEB_ROOT", "Process")
[Environment]::SetEnvironmentVariable("TILESIM_WEB_ROOT", $null, "Process")
$checkExitCode = $null
$checkFilePresent = $false
try {
    for ($selfCheckAttempt = 1; $selfCheckAttempt -le 3; $selfCheckAttempt++) {
        if (Test-Path -LiteralPath $checkFile) { Remove-Item -LiteralPath $checkFile -Force }
        $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
        $startInfo.FileName = $candidateExecutable
        $startInfo.UseShellExecute = $false
        $startInfo.CreateNoWindow = $true
        [void]$startInfo.ArgumentList.Add("--self-check-file")
        [void]$startInfo.ArgumentList.Add($checkFile)
        $checkProcess = [System.Diagnostics.Process]::Start($startInfo)
        if ($null -eq $checkProcess) { throw "The packaged launcher self-check could not be started." }
        try {
            $checkProcess.WaitForExit()
            $checkExitCode = $checkProcess.ExitCode
        } finally {
            $checkProcess.Dispose()
        }
        $checkFilePresent = Test-Path -LiteralPath $checkFile -PathType Leaf
        if ($checkExitCode -eq 0 -and $checkFilePresent) { break }
        if ($selfCheckAttempt -lt 3) { Start-Sleep -Seconds 1 }
    }
} finally {
    [Environment]::SetEnvironmentVariable("TILESIM_WEB_ROOT", $previousWebRoot, "Process")
}
if ($checkExitCode -ne 0 -or -not $checkFilePresent) {
    Remove-Item -LiteralPath $candidateExecutable -Force -ErrorAction SilentlyContinue
    throw "The packaged launcher self-check did not complete successfully (exit=$checkExitCode, output=$checkFilePresent)."
}
$check = Get-Content -Raw -LiteralPath $checkFile | ConvertFrom-Json
$safeSelfCheck =
    $check.ready -eq $true -and
    $check.resolved_from_executable_directory -eq $true -and
    $check.required_scripts_present -eq $true -and
    $check.bundled_node_runtime -eq $true -and
    $check.node_without_path -eq $true -and
    $check.credentials_read -eq $false -and
    $check.provider_accessed -eq $false -and
    $check.port_5173_touched -eq $false
if (-not $safeSelfCheck) {
    Remove-Item -LiteralPath $candidateExecutable -Force -ErrorAction SilentlyContinue
    throw "The packaged launcher failed the checkout, Node, WebView2, or safety self-check."
}

$fallbackExecutable = $null
if (Test-Path -LiteralPath $publishedExecutable -PathType Leaf) {
    New-Item -ItemType Directory -Path $fallbackRoot -Force | Out-Null
    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $fallbackExecutable = Join-Path $fallbackRoot "$ExecutableName.previous-$stamp-$PID.exe"
    [System.IO.File]::Replace($candidateExecutable, $publishedExecutable, $fallbackExecutable, $true)
} else {
    Move-Item -LiteralPath $candidateExecutable -Destination $publishedExecutable
}

$publishedHash = (Get-FileHash -LiteralPath $publishedExecutable -Algorithm SHA256).Hash.ToLowerInvariant()
$installer = Get-ChildItem -LiteralPath (Join-Path $tauriRoot "target\release\bundle\nsis") -Filter "*.exe" -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1

[ordered]@{
    schema_version = "tilesim.workbench_launcher_build.v2"
    executable = $publishedExecutable
    size_bytes = (Get-Item -LiteralPath $publishedExecutable).Length
    sha256 = $publishedHash
    installer = if ($null -ne $installer) { $installer.FullName } else { $null }
    previous_launcher_fallback = $fallbackExecutable
    node_version = $nodeVersionText
    pnpm_version = $pnpmVersion
    windows_gui = $true
    bundled_node_runtime = $true
    self_check = "passed"
    credentials_read = $false
    provider_accessed = $false
    port_5173_touched = $false
} | ConvertTo-Json -Compress
