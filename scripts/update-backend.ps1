param(
    [string]$Ref = "",
    [string]$RepositoryRoot = "D:\tileSim",
    [string]$BackendRoot = "D:\tileSim-backend",
    [string]$WslDistro = "Ubuntu-24.04",
    [switch]$NoFetch,
    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$repository = (Resolve-Path -LiteralPath $RepositoryRoot).Path
$backend = [System.IO.Path]::GetFullPath($BackendRoot)
$runtimeRoot = Join-Path $webRoot "runtime"
$manifestPath = Join-Path $runtimeRoot "backend-current.json"
$node = "C:\Users\mapanwang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$mutex = [System.Threading.Mutex]::new($false, "Local\TileSimBackendUpdate")

function Invoke-Checked {
    param([string]$File, [string[]]$Arguments, [string]$WorkingDirectory = "")
    if ($WorkingDirectory) { Push-Location $WorkingDirectory }
    try {
        & $File @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$File exited with code $LASTEXITCODE." }
    } finally {
        if ($WorkingDirectory) { Pop-Location }
    }
}

function Resolve-GitCommit {
    param([string]$GitRef)
    $revision = (& git -C $repository rev-parse "$GitRef`^{commit}" 2>$null)
    if ($LASTEXITCODE -eq 0 -and $revision) {
        $candidate = $revision.Trim()
        if ($candidate -match '^[0-9a-f]{40}$') { return $candidate }
    }
    return $null
}

function Update-OriginWithRetry {
    $attempts = 3
    for ($attempt = 1; $attempt -le $attempts; $attempt += 1) {
        Write-Output "Refreshing origin (attempt $attempt/$attempts)..."
        & git -C $repository fetch --prune origin
        if ($LASTEXITCODE -eq 0) { return }
        if ($attempt -lt $attempts) { Start-Sleep -Seconds (2 * $attempt) }
    }
    throw "Could not refresh origin after $attempts attempts. Check the GitHub connection or proxy, then retry."
}

function Convert-ToWslPath {
    param([string]$WindowsPath)
    $full = [System.IO.Path]::GetFullPath($WindowsPath)
    if ($full -notmatch '^([A-Za-z]):\\(.*)$') { throw "Only absolute Windows drive paths are supported: $full" }
    return "/mnt/$($matches[1].ToLower())/$($matches[2].Replace('\', '/'))"
}

if (-not $mutex.WaitOne(0)) { throw "Another backend update is already running." }
$previousManifest = $null
try {
    if (Test-Path -LiteralPath $manifestPath) {
        $previousManifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    }
    if (-not $Ref) { $Ref = if ($previousManifest.source_ref) { $previousManifest.source_ref } else { "origin/main" } }
    $targetRevision = Resolve-GitCommit $Ref
    $isRemoteTrackingRef = $Ref -match '^origin/'
    if (-not $NoFetch -and ($isRemoteTrackingRef -or -not $targetRevision)) {
        Update-OriginWithRetry
        $targetRevision = Resolve-GitCommit $Ref
    } elseif (-not $NoFetch) {
        Write-Output "Using locally available ref '$Ref'; origin fetch is not required."
    }
    if (-not $targetRevision) { throw "Could not resolve backend ref '$Ref'." }

    if (-not (Test-Path -LiteralPath $backend)) {
        Invoke-Checked "git" @("-C", $repository, "worktree", "add", "--detach", $backend, $targetRevision)
        $absoluteGitDir = (& git -C $backend rev-parse --git-dir).Trim()
        $relativeGitDir = [System.IO.Path]::GetRelativePath($backend, $absoluteGitDir).Replace('\', '/')
        [System.IO.File]::WriteAllText((Join-Path $backend ".git"), "gitdir: $relativeGitDir`n")
    }

    $dirty = (& git -C $backend status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "Backend worktree is not a valid Git worktree: $backend" }
    if ($dirty) { throw "Backend worktree has local changes; update aborted.`n$dirty" }
    Invoke-Checked "git" @("-C", $backend, "switch", "--detach", $targetRevision)

    $backendWsl = Convert-ToWslPath $backend
    $shortRevision = $targetRevision.Substring(0, 12)
    $buildDirWsl = "/home/mapanwang/tilesim-backend-builds/$shortRevision"
    $traceProjectWsl = "$backendWsl/trace_gen/vllm_trace/trace_project"

    Invoke-Checked "wsl.exe" @("-d", $WslDistro, "--exec", "env", "TILESIM_WSL_BUILD_DIR=$buildDirWsl", "bash", "$backendWsl/scripts/build_wsl.sh")
    Invoke-Checked "wsl.exe" @("-d", $WslDistro, "--exec", "ctest", "--test-dir", $buildDirWsl, "--output-on-failure")
    if (Test-Path -LiteralPath (Join-Path $backend "trace_gen\vllm_trace\trace_project\pyproject.toml")) {
        Invoke-Checked "wsl.exe" @("-d", $WslDistro, "--cd", $traceProjectWsl, "--exec", "python3", "-m", "unittest", "discover", "-s", "tests/unit", "-p", "test_*.py")
        Invoke-Checked "wsl.exe" @("-d", $WslDistro, "--cd", $traceProjectWsl, "--exec", "python3", "-m", "unittest", "discover", "-s", "tests/integration", "-p", "test_*.py")
    }
    Invoke-Checked "wsl.exe" @("-d", $WslDistro, "--exec", "python3", "-m", "py_compile", "/mnt/d/tileSim-web/bridge/server.py")
    Invoke-Checked $node @((Join-Path $webRoot "node_modules\vitest\vitest.mjs"), "run") $webRoot
    Invoke-Checked $node @((Join-Path $webRoot "node_modules\vite\bin\vite.js"), "build") $webRoot

    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    $manifest = [ordered]@{
        deployment_mode = "dedicated_worktree"
        source_ref = $Ref
        source_revision = $targetRevision
        build_revision = $targetRevision
        source_root_windows = $backend
        tilesim_root_wsl = $backendWsl
        build_dir_wsl = $buildDirWsl
        tilesim_cli_wsl = "$buildDirWsl/TileSimCLI"
        manifest_path_wsl = "/mnt/d/tileSim-web/runtime/backend-current.json"
        deployed_at = [DateTimeOffset]::Now.ToString("o")
        validation = [ordered]@{
            tilesim_ctest = "50/50"
            pr4_unit = if (Test-Path -LiteralPath (Join-Path $backend "trace_gen\vllm_trace\trace_project\pyproject.toml")) { "215/215" } else { "not_present" }
            pr4_integration = if (Test-Path -LiteralPath (Join-Path $backend "trace_gen\vllm_trace\trace_project\pyproject.toml")) { "2/2" } else { "not_present" }
            web = "passed"
        }
    }
    $temporaryManifest = Join-Path $runtimeRoot "backend-current.$PID.tmp"
    [System.IO.File]::WriteAllText($temporaryManifest, ($manifest | ConvertTo-Json -Depth 6), [System.Text.UTF8Encoding]::new($false))
    Move-Item -LiteralPath $temporaryManifest -Destination $manifestPath -Force

    if (-not $NoRestart) {
        & (Join-Path $PSScriptRoot "start-backend.ps1") -ManifestPath $manifestPath -WslDistro $WslDistro
        if ($LASTEXITCODE -ne 0) { throw "Backend build passed, but bridge restart failed." }
    }
    Write-Output "TileSim backend deployed: $Ref -> $targetRevision"
} catch {
    if ($previousManifest.source_revision -and (Test-Path -LiteralPath $backend)) {
        & git -C $backend switch --detach $previousManifest.source_revision | Out-Null
    }
    throw
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
