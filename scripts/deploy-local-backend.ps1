param(
    [string]$SourceRoot = "D:\tileSim",
    [string]$WslDistro = "Ubuntu-24.04",
    [string]$BuildDirWsl = "",
    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$source = (Resolve-Path -LiteralPath $SourceRoot).Path
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

function Convert-ToWslPath {
    param([string]$WindowsPath)
    $full = [System.IO.Path]::GetFullPath($WindowsPath)
    if ($full -notmatch '^([A-Za-z]):\\(.*)$') {
        throw "Only absolute Windows drive paths are supported: $full"
    }
    return "/mnt/$($matches[1].ToLower())/$($matches[2].Replace('\', '/'))"
}

function Get-SourceStateDigest {
    param([string]$SourceRootWsl)
    $output = @(& wsl.exe -d $WslDistro --exec env "TILESIM_ROOT=$SourceRootWsl" python3 "/mnt/d/tileSim-web/bridge/server.py" --print-source-state-digest)
    if ($LASTEXITCODE -ne 0) { throw "Could not calculate the local backend source-state digest." }
    $digest = $output | Where-Object { $_ -match '^[0-9a-f]{64}$' } | Select-Object -Last 1
    if (-not $digest) { throw "The local backend source-state digest was not returned." }
    return $digest.Trim()
}

function Get-DirectoryDigest {
    param([string]$Directory, [string]$ExcludedNames = "")
    $arguments = @((Join-Path $PSScriptRoot "release-traceability.mjs"), $Directory)
    if ($ExcludedNames) { $arguments += $ExcludedNames }
    $digest = (& $node @arguments).Trim()
    if ($LASTEXITCODE -ne 0 -or $digest -notmatch '^[0-9a-f]{64}$') {
        throw "Could not calculate release traceability digest for $Directory."
    }
    return $digest
}

function Get-SchemaSetRevision {
    $output = @(& wsl.exe -d $WslDistro --exec python3 "/mnt/d/tileSim-web/bridge/server.py" --print-schema-set-revision)
    if ($LASTEXITCODE -ne 0) { throw "Could not calculate the Bridge schema-set revision." }
    $revision = $output | Where-Object { $_ -match '^sha256:[0-9a-f]{64}$' } | Select-Object -Last 1
    if (-not $revision) { throw "The Bridge schema-set revision was not returned." }
    return $revision.Trim()
}

if (-not $mutex.WaitOne(0)) { throw "Another backend deployment is already running." }
$previousManifestText = $null
$manifestWritten = $false
$restartAttempted = $false
try {
    if (Test-Path -LiteralPath $manifestPath) {
        $previousManifestText = Get-Content -Raw -LiteralPath $manifestPath
    }
    $revision = (& git -C $source rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $revision -notmatch '^[0-9a-f]{40}$') {
        throw "Local backend source is not a valid Git worktree: $source"
    }
    $branch = (& git -C $source branch --show-current).Trim()
    if (-not $branch) { $branch = "detached" }
    $sourceWsl = Convert-ToWslPath $source
    $sourceDigest = Get-SourceStateDigest $sourceWsl
    $webRevision = (& git -C $webRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $webRevision -notmatch '^[0-9a-f]{40}$') {
        throw "TileSim Web source is not a valid Git worktree: $webRoot"
    }
    $webSourceDigest = Get-DirectoryDigest $webRoot
    if (-not $BuildDirWsl) {
        $previousManifest = if ($previousManifestText) {
            $previousManifestText | ConvertFrom-Json
        } else {
            $null
        }
        if ($previousManifest.deployment_mode -eq "local_worktree_snapshot" -and
            $previousManifest.source_root_windows -eq $source -and
            $previousManifest.build_dir_wsl) {
            $BuildDirWsl = $previousManifest.build_dir_wsl
        } else {
            $BuildDirWsl = "/home/mapanwang/tilesim-local-builds/$($revision.Substring(0, 12))-snapshot"
        }
    }

    Write-Output "Building local TileSim snapshot $branch at state $sourceDigest"
    Invoke-Checked "wsl.exe" @(
        "-d", $WslDistro, "--exec", "env", "TILESIM_WSL_BUILD_DIR=$BuildDirWsl",
        "bash", "$sourceWsl/scripts/build_wsl.sh"
    )
    Invoke-Checked "wsl.exe" @(
        "-d", $WslDistro, "--exec", "ctest", "--test-dir", $BuildDirWsl,
        "--output-on-failure", "-j1"
    )
    $testInventory = (& wsl.exe -d $WslDistro --exec ctest --test-dir $BuildDirWsl --show-only=json-v1 | Out-String) | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0) { throw "Could not read the local backend CTest inventory." }
    $testCount = @($testInventory.tests).Count

    Invoke-Checked "wsl.exe" @(
        "-d", $WslDistro, "--cd", "/mnt/d/tileSim-web/bridge", "--exec",
        "python3", "-m", "unittest", "test_server.py"
    )
    Invoke-Checked "wsl.exe" @(
        "-d", $WslDistro, "--exec", "python3", "-m", "py_compile",
        "/mnt/d/tileSim-web/bridge/server.py"
    )
    Invoke-Checked $node @((Join-Path $webRoot "node_modules\vitest\vitest.mjs"), "run") $webRoot
    Invoke-Checked $node @((Join-Path $webRoot "node_modules\vite\bin\vite.js"), "build") $webRoot

    $verifiedDigest = Get-SourceStateDigest $sourceWsl
    if ($verifiedDigest -ne $sourceDigest) {
        throw "Local backend source changed during build or validation; deployment aborted."
    }
    $verifiedWebSourceDigest = Get-DirectoryDigest $webRoot
    if ($verifiedWebSourceDigest -ne $webSourceDigest) {
        throw "TileSim Web source changed during build or validation; deployment aborted."
    }
    $webBuildDigest = Get-DirectoryDigest (Join-Path $webRoot "dist") ""
    $schemaSetRevision = Get-SchemaSetRevision

    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    $manifest = [ordered]@{
        deployment_mode = "local_worktree_snapshot"
        source_ref = "local:$branch"
        source_revision = $revision
        build_revision = $revision
        source_state_digest = $sourceDigest
        build_state_digest = $sourceDigest
        web_source_revision = $webRevision
        web_source_state_digest = $webSourceDigest
        web_build_digest = $webBuildDigest
        schema_set_revision = $schemaSetRevision
        source_root_windows = $source
        tilesim_root_wsl = $sourceWsl
        build_dir_wsl = $BuildDirWsl
        tilesim_cli_wsl = "$BuildDirWsl/TileSimCLI"
        manifest_path_wsl = "/mnt/d/tileSim-web/runtime/backend-current.json"
        deployed_at = [DateTimeOffset]::Now.ToString("o")
        validation = [ordered]@{
            tilesim_ctest = "$testCount/$testCount"
            source_state = "sha256:$sourceDigest"
            frontend_bridge = "passed"
            web = "passed"
        }
    }
    $temporaryManifest = Join-Path $runtimeRoot "backend-current.$PID.tmp"
    [System.IO.File]::WriteAllText(
        $temporaryManifest,
        ($manifest | ConvertTo-Json -Depth 6),
        [System.Text.UTF8Encoding]::new($false)
    )
    Move-Item -LiteralPath $temporaryManifest -Destination $manifestPath -Force
    $manifestWritten = $true

    if (-not $NoRestart) {
        $restartAttempted = $true
        & (Join-Path $PSScriptRoot "start-backend.ps1") -ManifestPath $manifestPath -WslDistro $WslDistro
        if ($LASTEXITCODE -ne 0) { throw "Local backend build passed, but bridge restart failed." }
    }
    Write-Output "TileSim local backend deployed: $branch @ $revision, state $sourceDigest"
} catch {
    $deploymentError = $_
    $rollbackError = $null
    if ($manifestWritten -and $null -ne $previousManifestText) {
        [System.IO.File]::WriteAllText(
            $manifestPath,
            $previousManifestText,
            [System.Text.UTF8Encoding]::new($false)
        )
        if ($restartAttempted) {
            try {
                & (Join-Path $PSScriptRoot "start-backend.ps1") -ManifestPath $manifestPath -WslDistro $WslDistro
                if ($LASTEXITCODE -ne 0) { throw "Previous Bridge restart returned exit code $LASTEXITCODE." }
                Write-Warning "Deployment failed; the previous deployment manifest and Bridge service were restored."
            } catch {
                $rollbackError = $_
            }
        }
    }
    if ($rollbackError) {
        throw "Deployment failed: $($deploymentError.Exception.Message) Rollback also failed: $($rollbackError.Exception.Message)"
    }
    throw $deploymentError
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
