param(
    [string]$SourceRoot = "",
    [string]$WslDistro = "Ubuntu-24.04",
    [string]$BuildRootWsl = "",
    [string]$BuildDirWsl = "",
    [switch]$ReuseVerifiedArtifacts,
    [switch]$ForceFullValidation,
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
$fastPath = $ReuseVerifiedArtifacts -and -not $ForceFullValidation

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

function Test-WslExecutable {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    & wsl.exe -d $WslDistro --exec test -x $Path *> $null
    return $LASTEXITCODE -eq 0
}

function Get-WslFileDigest {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { throw "Cannot hash an empty WSL path." }
    $output = @(& wsl.exe -d $WslDistro --exec sha256sum -- $Path)
    if ($LASTEXITCODE -ne 0) { throw "Could not hash WSL file: $Path" }
    $digest = $output | Where-Object { $_ -match '^([0-9a-f]{64})\s' } | ForEach-Object { $matches[1] } | Select-Object -Last 1
    if (-not $digest) { throw "WSL did not return a SHA-256 digest for: $Path" }
    return $digest.Trim()
}

function Get-ManifestValue {
    param([object]$Manifest, [string]$Name)
    if ($null -eq $Manifest) { return $null }
    $property = $Manifest.PSObject.Properties[$Name]
    if ($null -eq $property) { return $null }
    return $property.Value
}

function Test-ReusableBackendBuild {
    param(
        [object]$Manifest,
        [string]$SourceRoot,
        [string]$Revision,
        [string]$SourceDigest,
        [string]$BuildDirectory
    )
    if (-not $fastPath -or $null -eq $Manifest) { return $false }
    if ((Get-ManifestValue $Manifest "deployment_mode") -ne "local_worktree_snapshot") { return $false }
    if ([string](Get-ManifestValue $Manifest "wsl_distro") -ne $WslDistro) { return $false }
    $manifestSourceValue = Get-ManifestValue $Manifest "source_root_windows"
    if ([string]::IsNullOrWhiteSpace([string]$manifestSourceValue)) { return $false }
    $manifestSource = ([System.IO.Path]::GetFullPath([string]$manifestSourceValue)).TrimEnd('\', '/')
    $requestedSource = ([System.IO.Path]::GetFullPath($SourceRoot)).TrimEnd('\', '/')
    if (-not $manifestSource.Equals($requestedSource, [System.StringComparison]::OrdinalIgnoreCase)) {
        return $false
    }
    if ([string](Get-ManifestValue $Manifest "source_revision") -ne $Revision -or
        [string](Get-ManifestValue $Manifest "build_revision") -ne $Revision -or
        [string](Get-ManifestValue $Manifest "source_state_digest") -ne $SourceDigest -or
        [string](Get-ManifestValue $Manifest "build_state_digest") -ne $SourceDigest -or
        [string](Get-ManifestValue $Manifest "build_dir_wsl") -ne $BuildDirectory) {
        return $false
    }
    $validation = Get-ManifestValue $Manifest "validation"
    $ctestStatus = Get-ManifestValue $validation "tilesim_ctest"
    if ([string]$ctestStatus -notmatch '^([1-9][0-9]*)/\1$') { return $false }
    $cliPath = [string](Get-ManifestValue $Manifest "tilesim_cli_wsl")
    if ($cliPath -ne "$BuildDirectory/TileSimCLI" -or -not (Test-WslExecutable $cliPath)) { return $false }
    $declaredCliDigest = [string](Get-ManifestValue $Manifest "tilesim_cli_digest")
    if ($declaredCliDigest -notmatch '^[0-9a-f]{64}$' -or (Get-WslFileDigest $cliPath) -ne $declaredCliDigest) { return $false }
    return $true
}

function Get-ReusableWebRelease {
    param(
        [object]$Manifest,
        [string]$WebSourceDigest,
        [string]$SchemaSetRevision
    )
    if (-not $fastPath -or $null -eq $Manifest) { return $null }
    $releaseRootValue = Get-ManifestValue $Manifest "web_release_root_windows"
    $buildDigestValue = Get-ManifestValue $Manifest "web_build_digest"
    if ([string](Get-ManifestValue $Manifest "web_source_state_digest") -ne $WebSourceDigest -or
        [string](Get-ManifestValue $Manifest "schema_set_revision") -ne $SchemaSetRevision -or
        [string]::IsNullOrWhiteSpace([string]$releaseRootValue) -or
        [string]::IsNullOrWhiteSpace([string]$buildDigestValue)) {
        return $null
    }
    $releaseRoot = [string]$releaseRootValue
    $releasesRoot = [System.IO.Path]::GetFullPath((Join-Path $runtimeRoot "releases")).TrimEnd('\', '/')
    $resolvedRelease = [System.IO.Path]::GetFullPath($releaseRoot)
    if (-not ([System.IO.Path]::GetDirectoryName($resolvedRelease)).TrimEnd('\', '/').Equals(
        $releasesRoot, [System.StringComparison]::OrdinalIgnoreCase)) { return $null }
    if (-not (Test-Path -LiteralPath $releaseRoot -PathType Container)) { return $null }
    $output = & $node (Join-Path $PSScriptRoot "release-snapshot.mjs") verify --release-root $releaseRoot 2>&1
    if ($LASTEXITCODE -ne 0) { return $null }
    try { $verified = ($output | Select-Object -Last 1) | ConvertFrom-Json } catch { return $null }
    if ([string](Get-ManifestValue $verified "web_source_state_digest") -ne $WebSourceDigest -or
        [string](Get-ManifestValue $verified "web_build_digest") -ne [string]$buildDigestValue -or
        [string](Get-ManifestValue $verified "schema_set_revision") -ne $SchemaSetRevision -or
        [string](Get-ManifestValue $verified "release_digest") -ne [string](Get-ManifestValue $Manifest "web_release_digest") -or
        [string](Get-ManifestValue (Get-ManifestValue $verified "bridge") "digest") -ne [string](Get-ManifestValue $Manifest "web_bridge_digest") -or
        [string](Get-ManifestValue (Get-ManifestValue $verified "static") "digest") -ne [string](Get-ManifestValue $Manifest "web_static_digest")) {
        return $null
    }
    return $verified
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
$previousManifest = $null
$manifestWritten = $false
$restartAttempted = $false
try {
    if (Test-Path -LiteralPath $manifestPath) {
        $previousManifestText = Get-Content -Raw -LiteralPath $manifestPath
        $previousManifest = $previousManifestText | ConvertFrom-Json
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
        $previousMode = Get-ManifestValue $previousManifest "deployment_mode"
        $previousSource = Get-ManifestValue $previousManifest "source_root_windows"
        $previousBuildDir = Get-ManifestValue $previousManifest "build_dir_wsl"
        if ($previousMode -eq "local_worktree_snapshot" -and
            $previousSource -and
            ([System.IO.Path]::GetFullPath([string]$previousSource)).TrimEnd('\', '/').Equals(
                ([System.IO.Path]::GetFullPath($source)).TrimEnd('\', '/'),
                [System.StringComparison]::OrdinalIgnoreCase) -and
            $previousBuildDir) {
            $BuildDirWsl = $previousBuildDir
        } else {
            $resolvedBuildRootWsl = Resolve-TileSimWslBuildRoot $WslDistro $BuildRootWsl
            $BuildDirWsl = "$resolvedBuildRootWsl/local-builds/$($revision.Substring(0, 12))-snapshot"
        }
    }

    $schemaSetRevision = Get-SchemaSetRevision
    $backendReused = Test-ReusableBackendBuild $previousManifest $source $revision $sourceDigest $BuildDirWsl
    $webRelease = Get-ReusableWebRelease $previousManifest $webSourceDigest $schemaSetRevision
    $webReused = $null -ne $webRelease

    if ($backendReused) {
        Write-Output "Reusing verified TileSim build and CTest result for unchanged backend state. Use -ForceFullValidation to rerun them."
        $testStatus = [string](Get-ManifestValue (Get-ManifestValue $previousManifest "validation") "tilesim_ctest")
    } else {
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
        $testStatus = "$testCount/$testCount"
    }
    $cliPath = "$BuildDirWsl/TileSimCLI"
    $cliDigest = Get-WslFileDigest $cliPath

    if ($webReused) {
        Write-Output "Reusing verified immutable Web release for unchanged Web state. Use -ForceFullValidation to rerun Web tests and build."
        $webBuildDigest = [string](Get-ManifestValue $previousManifest "web_build_digest")
    } elseif ($fastPath -and $null -ne $previousManifest) {
        Write-Output "Fast path: validating contract drift and rebuilding changed Web sources; use -ForceFullValidation to rerun the full Vitest suite."
        Invoke-Checked $node @((Join-Path $webRoot "scripts\generate-contract-types.mjs"), "--check") $webRoot
        Invoke-Checked $node @((Join-Path $webRoot "scripts\generate-bridge-client.mjs"), "--check") $webRoot
        Invoke-Checked "wsl.exe" @(
            "-d", $WslDistro, "--cd", "$webRootWsl/bridge", "--exec",
            "python3", "check_schema_set_revision.py"
        )
        Invoke-Checked "wsl.exe" @(
            "-d", $WslDistro, "--cd", "$webRootWsl/bridge", "--exec",
            "python3", "-m", "unittest", "test_server.py"
        )
        Invoke-Checked "wsl.exe" @(
            "-d", $WslDistro, "--exec", "python3", "-m", "py_compile",
            "$webRootWsl/bridge/server.py"
        )
        Invoke-Checked $node @((Join-Path $webRoot "node_modules\vite\bin\vite.js"), "build") $webRoot
        $webBuildDigest = Get-DirectoryDigest (Join-Path $webRoot "dist") ""
    } else {
        Write-Output "Web source changed or no verified release matched; running the existing Bridge and Web validation flow."
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
        $webBuildDigest = Get-DirectoryDigest (Join-Path $webRoot "dist") ""
    }

    $verifiedDigest = Get-SourceStateDigest $sourceWsl
    if ($verifiedDigest -ne $sourceDigest) {
        throw "Local backend source changed during build or validation; deployment aborted."
    }
    $verifiedWebSourceDigest = Get-DirectoryDigest $webRoot
    if ($verifiedWebSourceDigest -ne $webSourceDigest) {
        throw "TileSim Web source changed during build or validation; deployment aborted."
    }
    if (-not $webReused) {
        $webRelease = New-WebReleaseSnapshot $webRevision $webSourceDigest $webBuildDigest $schemaSetRevision
    }
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
        tilesim_cli_digest = $cliDigest
        wsl_distro = $WslDistro
        manifest_path_wsl = ConvertTo-TileSimWslPath $manifestPath
        deployed_at = [DateTimeOffset]::Now.ToString("o")
        validation = [ordered]@{
            tilesim_ctest = $testStatus
            source_state = "sha256:$sourceDigest"
            frontend_bridge = if ($webReused) { "reused:verified-release" } elseif ($fastPath -and $null -ne $previousManifest) { "fast:contract+bridge+compile" } else { "passed" }
            web = if ($webReused) { "reused:verified-release" } elseif ($fastPath -and $null -ne $previousManifest) { "fast:production-build" } else { "passed" }
            backend_build = if ($backendReused) { "reused:verified-build" } else { "passed" }
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
