param(
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
$Ref = "origin/main"
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

function Resolve-GitCommit {
    param([string]$GitRef)
    $revision = (& git -C $repository rev-parse "$GitRef`^{commit}" 2>$null)
    if ($LASTEXITCODE -eq 0 -and $revision) {
        $candidate = $revision.Trim()
        if ($candidate -match '^[0-9a-f]{40}$') { return $candidate }
    }
    return $null
}

function Test-GitRevisionOwnsPath {
    param(
        [string]$WorkingTree,
        [string]$Revision,
        [string]$Path
    )
    # `git cat-file -e <revision>:<path>` treats an absent path as a fatal
    # lookup error. With $ErrorActionPreference = "Stop", Windows PowerShell
    # may promote that expected negative result to a terminating
    # NativeCommandError before $LASTEXITCODE can be checked. `git ls-tree`
    # returns success with empty output for an absent path, so it is safe for
    # this presence probe while still failing for an invalid revision.
    $entries = @(& git -C $WorkingTree ls-tree --name-only $Revision -- $Path)
    if ($LASTEXITCODE -ne 0) {
        throw "Could not inspect '$Path' in backend revision $Revision."
    }
    return $entries.Count -gt 0
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

function Get-SourceStateDigest {
    param([string]$SourceRootWsl)
    $output = @(& wsl.exe -d $WslDistro --exec env "TILESIM_ROOT=$SourceRootWsl" python3 "/mnt/d/tileSim-web/bridge/server.py" --print-source-state-digest)
    if ($LASTEXITCODE -ne 0) { throw "Could not calculate the backend source-state digest." }
    $digest = $output | Where-Object { $_ -match '^[0-9a-f]{64}$' } | Select-Object -Last 1
    if (-not $digest) { throw "The backend source-state digest was not returned." }
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

if (-not $mutex.WaitOne(0)) { throw "Another backend update is already running." }
$previousManifest = $null
$previousManifestText = $null
$manifestWritten = $false
$restartAttempted = $false
try {
    if (Test-Path -LiteralPath $manifestPath) {
        $previousManifestText = Get-Content -Raw -LiteralPath $manifestPath
        $previousManifest = $previousManifestText | ConvertFrom-Json
    }
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

    $dirtyEntries = @(& git -C $backend status --porcelain)
    if ($LASTEXITCODE -ne 0) { throw "Backend worktree is not a valid Git worktree: $backend" }
    $traceOverlayPresent = $dirtyEntries -contains "?? trace_gen/"
    $blockingChanges = @($dirtyEntries | Where-Object { $_ -ne "?? trace_gen/" })
    if ($blockingChanges.Count -gt 0) {
        throw "Backend worktree has local changes; update aborted.`n$($blockingChanges -join "`n")"
    }
    if ($traceOverlayPresent) {
        if (Test-GitRevisionOwnsPath $backend $targetRevision "trace_gen") {
            throw "The target revision owns trace_gen while the deployment worktree contains an untracked trace_gen overlay; update aborted to protect the overlay."
        }
        Write-Output "Preserving deployment-local untracked trace_gen overlay; target revision does not own that path."
    }
    Invoke-Checked "git" @("-C", $backend, "switch", "--detach", $targetRevision)

    $backendWsl = Convert-ToWslPath $backend
    $shortRevision = $targetRevision.Substring(0, 12)
    $buildDirWsl = "/home/mapanwang/tilesim-backend-builds/$shortRevision"
    $sourceDigest = Get-SourceStateDigest $backendWsl
    $webRevision = (& git -C $webRoot rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $webRevision -notmatch '^[0-9a-f]{40}$') {
        throw "TileSim Web source is not a valid Git worktree: $webRoot"
    }
    $webSourceDigest = Get-DirectoryDigest $webRoot
    Invoke-Checked "wsl.exe" @("-d", $WslDistro, "--exec", "env", "TILESIM_WSL_BUILD_DIR=$buildDirWsl", "bash", "$backendWsl/scripts/build_wsl.sh")
    Invoke-Checked "wsl.exe" @("-d", $WslDistro, "--exec", "ctest", "--test-dir", $buildDirWsl, "--output-on-failure")
    Write-Output "Backend validation passed; validating and rebuilding the frontend once..."
    Invoke-Checked "wsl.exe" @("-d", $WslDistro, "--exec", "python3", "-m", "py_compile", "/mnt/d/tileSim-web/bridge/server.py")
    Invoke-Checked $node @((Join-Path $webRoot "node_modules\vitest\vitest.mjs"), "run") $webRoot
    Invoke-Checked $node @((Join-Path $webRoot "node_modules\vite\bin\vite.js"), "build") $webRoot

    $verifiedSourceDigest = Get-SourceStateDigest $backendWsl
    if ($verifiedSourceDigest -ne $sourceDigest) {
        throw "Backend source changed during build or validation; deployment aborted."
    }
    $verifiedWebSourceDigest = Get-DirectoryDigest $webRoot
    if ($verifiedWebSourceDigest -ne $webSourceDigest) {
        throw "TileSim Web source changed during build or validation; deployment aborted."
    }
    $webBuildDigest = Get-DirectoryDigest (Join-Path $webRoot "dist") ""
    $schemaSetRevision = Get-SchemaSetRevision
    $webRelease = New-WebReleaseSnapshot $webRevision $webSourceDigest $webBuildDigest $schemaSetRevision
    $webReleaseRootWsl = Convert-ToWslPath $webRelease.release_root_windows
    $webStateRootWsl = Convert-ToWslPath $webRoot

    New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
    $manifest = [ordered]@{
        deployment_mode = "dedicated_worktree"
        source_ref = $Ref
        source_revision = $targetRevision
        build_revision = $targetRevision
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
        source_root_windows = $backend
        tilesim_root_wsl = $backendWsl
        build_dir_wsl = $buildDirWsl
        tilesim_cli_wsl = "$buildDirWsl/TileSimCLI"
        manifest_path_wsl = Convert-ToWslPath $manifestPath
        deployed_at = [DateTimeOffset]::Now.ToString("o")
        validation = [ordered]@{
            tilesim_ctest = "passed"
            web = "passed"
        }
    }
    Write-AtomicTextFile $manifestPath ($manifest | ConvertTo-Json -Depth 6)
    $manifestWritten = $true

    if (-not $NoRestart) {
        $restartAttempted = $true
        & (Join-Path $PSScriptRoot "start-backend.ps1") -ManifestPath $manifestPath -WslDistro $WslDistro
        if ($LASTEXITCODE -ne 0) { throw "Backend build passed, but bridge restart failed." }
    }
    Write-Output "TileSim backend deployed: $Ref -> $targetRevision"
} catch {
    $deploymentError = $_
    $rollbackError = $null
    if ($previousManifest.source_revision -and (Test-Path -LiteralPath $backend)) {
        & git -C $backend switch --detach $previousManifest.source_revision | Out-Null
    }
    if ($manifestWritten -and $null -ne $previousManifestText) {
        Write-AtomicTextFile $manifestPath $previousManifestText
        if ($restartAttempted) {
            try {
                & (Join-Path $PSScriptRoot "start-backend.ps1") -ManifestPath $manifestPath -WslDistro $WslDistro
                if ($LASTEXITCODE -ne 0) { throw "Previous Bridge restart returned exit code $LASTEXITCODE." }
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
