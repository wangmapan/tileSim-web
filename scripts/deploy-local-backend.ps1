param(
    [string]$SourceRoot = "",
    [string]$WslDistro = "Ubuntu-24.04",
    [string]$BuildRootWsl = "",
    [string]$BuildDirWsl = "",
    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "deployment-common.psm1") -Force
$webRoot = Resolve-TileSimWebRoot $PSScriptRoot
$sourcePath = Resolve-TileSimBackendRepositoryRoot $webRoot $SourceRoot
if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "The TileSim backend repository was not found: $sourcePath. Run scripts/bootstrap-workbench.ps1 first or pass -SourceRoot."
}
$source = (Resolve-Path -LiteralPath $sourcePath).Path
$webRootWsl = ConvertTo-TileSimWslPath $webRoot
Assert-TileSimWslDistro $WslDistro
$runtimeRoot = Join-Path $webRoot "runtime"
$manifestPath = Join-Path $runtimeRoot "backend-current.json"
$node = Resolve-TileSimNode
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

function Write-AtomicTextFile {
    param([string]$Path, [string]$Text)
    $directory = Split-Path -Parent $Path
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $temporary = Join-Path $directory "$([System.IO.Path]::GetFileName($Path)).$PID.tmp"
    try {
        [System.IO.File]::WriteAllText($temporary, $Text, [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporary -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

function Get-SourceStateDigest {
    param([string]$SourceRootWsl)
    $output = @(& wsl.exe -d $WslDistro --exec env "TILESIM_ROOT=$SourceRootWsl" python3 "$webRootWsl/bridge/server.py" --print-source-state-digest)
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
    $output = @(& wsl.exe -d $WslDistro --exec python3 "$webRootWsl/bridge/server.py" --print-schema-set-revision)
    if ($LASTEXITCODE -ne 0) { throw "Could not calculate the Bridge schema-set revision." }
    $revision = $output | Where-Object { $_ -match '^sha256:[0-9a-f]{64}$' } | Select-Object -Last 1
    if (-not $revision) { throw "The Bridge schema-set revision was not returned." }
    return $revision.Trim()
}

function New-WebReleaseSnapshot {
    param(
        [string]$WebRevision,
        [string]$WebSourceDigest,
        [string]$WebBuildDigest,
        [string]$SchemaSetRevision
    )
    $releaseRoot = Join-Path $runtimeRoot "releases"
    $output = & $node (Join-Path $PSScriptRoot "release-snapshot.mjs") create `
        --source-root $webRoot `
        --releases-root $releaseRoot `
        --web-source-revision $WebRevision `
        --web-source-state-digest $WebSourceDigest `
        --web-build-digest $WebBuildDigest `
        --schema-set-revision $SchemaSetRevision
    if ($LASTEXITCODE -ne 0) { throw "Could not create the immutable TileSim Web release snapshot." }
    return ($output | Select-Object -Last 1) | ConvertFrom-Json
}

function Start-DeployedBridge {
    & (Join-Path $PSScriptRoot "start-workbench.ps1") `
        -ManifestPath $manifestPath `
        -WslDistro $WslDistro
    if ($LASTEXITCODE -ne 0) { throw "Bridge restart returned exit code $LASTEXITCODE." }
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
    $sourceWsl = ConvertTo-TileSimWslPath $source
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
            $resolvedBuildRootWsl = Resolve-TileSimWslBuildRoot $WslDistro $BuildRootWsl
            $BuildDirWsl = "$resolvedBuildRootWsl/local-builds/$($revision.Substring(0, 12))-snapshot"
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
        "-d", $WslDistro, "--cd", "$webRootWsl/bridge", "--exec",
        "python3", "-m", "unittest", "test_server.py"
    )
    Invoke-Checked "wsl.exe" @(
        "-d", $WslDistro, "--exec", "python3", "-m", "py_compile",
        "$webRootWsl/bridge/server.py"
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
    $webRelease = New-WebReleaseSnapshot $webRevision $webSourceDigest $webBuildDigest $schemaSetRevision
    $webReleaseRootWsl = ConvertTo-TileSimWslPath $webRelease.release_root_windows
    $webStateRootWsl = ConvertTo-TileSimWslPath $webRoot

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
        web_release_identity = $webRelease.identity
        web_release_digest = $webRelease.release_digest
        web_bridge_digest = $webRelease.bridge.digest
        web_static_digest = $webRelease.static.digest
        web_release_root_windows = $webRelease.release_root_windows
        web_release_root_wsl = $webReleaseRootWsl
        web_state_root_wsl = $webStateRootWsl
        schema_set_revision = $schemaSetRevision
        source_root_windows = $source
        tilesim_root_wsl = $sourceWsl
        build_dir_wsl = $BuildDirWsl
        tilesim_cli_wsl = "$BuildDirWsl/TileSimCLI"
        manifest_path_wsl = ConvertTo-TileSimWslPath $manifestPath
        deployed_at = [DateTimeOffset]::Now.ToString("o")
        validation = [ordered]@{
            tilesim_ctest = "$testCount/$testCount"
            source_state = "sha256:$sourceDigest"
            frontend_bridge = "passed"
            web = "passed"
        }
    }
    Write-AtomicTextFile $manifestPath ($manifest | ConvertTo-Json -Depth 6)
    $manifestWritten = $true

    if (-not $NoRestart) {
        $restartAttempted = $true
        Start-DeployedBridge
    }
    Write-Output "TileSim local backend deployed: $branch @ $revision, state $sourceDigest"
} catch {
    $deploymentError = $_
    $rollbackError = $null
    if ($manifestWritten -and $null -ne $previousManifestText) {
        Write-AtomicTextFile $manifestPath $previousManifestText
        if ($restartAttempted) {
            try {
                Start-DeployedBridge
                Write-Warning "Deployment failed; the previous deployment manifest and Bridge service were restored."
            } catch {
                $rollbackError = $_
            }
        }
    } elseif ($manifestWritten -and (Test-Path -LiteralPath $manifestPath)) {
        Remove-Item -LiteralPath $manifestPath -Force
    }
    if ($rollbackError) {
        throw "Deployment failed: $($deploymentError.Exception.Message) Rollback also failed: $($rollbackError.Exception.Message)"
    }
    throw $deploymentError
} finally {
    $mutex.ReleaseMutex()
    $mutex.Dispose()
}
