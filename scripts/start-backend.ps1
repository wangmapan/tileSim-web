param(
    [string]$ManifestPath = (Join-Path $PSScriptRoot "..\runtime\backend-current.json"),
    [string]$TracePackageRoot = (Join-Path $PSScriptRoot "..\runtime\trace-packages"),
    [string]$WslDistro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "deployment-common.psm1") -Force

$wslCommand = Get-Command "wsl.exe" -ErrorAction SilentlyContinue
if ($null -eq $wslCommand) {
    throw "TILESIM_WSL_NOT_INSTALLED: Windows Subsystem for Linux is required to start TileSim Web."
}

$wslService = Get-CimInstance Win32_Service -Filter "Name='WslService'" -ErrorAction SilentlyContinue
if ($null -ne $wslService -and $wslService.StartMode -eq "Disabled") {
    throw (
        "TILESIM_WSL_SERVICE_DISABLED: The Windows WSL Service is disabled. " +
        "Open PowerShell as Administrator and run: " +
        "Set-Service -Name WslService -StartupType Manual; Start-Service -Name WslService"
    )
}

$webRoot = Resolve-TileSimWebRoot $PSScriptRoot
$webRootWsl = ConvertTo-TileSimWslPath $webRoot
$node = Resolve-TileSimNode
Assert-TileSimWslDistro $WslDistro
$manifestFile = (Resolve-Path -LiteralPath $ManifestPath).Path
$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$tracePackageRootWindows = [System.IO.Path]::GetFullPath($TracePackageRoot)
New-Item -ItemType Directory -Path $tracePackageRootWindows -Force | Out-Null
$tracePackageRootWsl = ConvertTo-TileSimWslPath $tracePackageRootWindows
$required = @("source_revision", "tilesim_root_wsl", "tilesim_cli_wsl", "manifest_path_wsl")
foreach ($name in $required) {
    if (-not $manifest.$name) { throw "Deployment manifest is missing '$name'." }
}

if ($manifest.web_release_root_windows) {
    $releaseOutput = & $node (Join-Path $PSScriptRoot "release-snapshot.mjs") verify `
        --release-root $manifest.web_release_root_windows
    if ($LASTEXITCODE -ne 0) { throw "TileSim Web immutable release snapshot verification failed." }
    $release = ($releaseOutput | Select-Object -Last 1) | ConvertFrom-Json
    $releaseBindings = @(
        @("release_digest", "web_release_digest"),
        @("web_source_revision", "web_source_revision"),
        @("web_source_state_digest", "web_source_state_digest"),
        @("web_build_digest", "web_build_digest"),
        @("schema_set_revision", "schema_set_revision")
    )
    foreach ($binding in $releaseBindings) {
        if ($release.($binding[0]) -ne $manifest.($binding[1])) {
            throw "TileSim Web immutable release identity '$($binding[0])' does not match the deployment manifest."
        }
    }
    if ($release.bridge.digest -ne $manifest.web_bridge_digest -or
        $release.static.digest -ne $manifest.web_static_digest) {
        throw "TileSim Web immutable release byte inventory does not match the deployment manifest."
    }
    if (-not $manifest.web_release_root_wsl -or -not $manifest.web_state_root_wsl) {
        throw "Deployment manifest is missing immutable release runtime paths."
    }
    $bridgeScriptWsl = "$($manifest.web_release_root_wsl)/bridge/server.py"
    $webStateRootWsl = $manifest.web_state_root_wsl
} else {
    if ($manifest.web_source_state_digest) {
        $actualWebSourceDigest = (& $node (Join-Path $PSScriptRoot "release-traceability.mjs") $webRoot).Trim()
        if ($LASTEXITCODE -ne 0 -or $actualWebSourceDigest -ne $manifest.web_source_state_digest) {
            throw "TileSim Web source state no longer matches the deployment manifest."
        }
    }
    if ($manifest.web_build_digest) {
        $actualWebBuildDigest = (& $node (Join-Path $PSScriptRoot "release-traceability.mjs") (Join-Path $webRoot "dist") "").Trim()
        if ($LASTEXITCODE -ne 0 -or $actualWebBuildDigest -ne $manifest.web_build_digest) {
            throw "TileSim Web build output no longer matches the deployment manifest."
        }
    }
    $bridgeScriptWsl = "$webRootWsl/bridge/server.py"
    $webStateRootWsl = $webRootWsl
}

Stop-TileSimBridge -WslDistro $WslDistro
Start-Sleep -Milliseconds 350

$arguments = @(
    "-d", $WslDistro,
    "--exec", "env",
    "TILESIM_ROOT=$($manifest.tilesim_root_wsl)",
    "TILESIM_CLI=$($manifest.tilesim_cli_wsl)",
    "TILESIM_BUILD_REVISION=$($manifest.build_revision)",
    "TILESIM_BUILD_STATE_DIGEST=$($manifest.build_state_digest)",
    "TILESIM_DEPLOYMENT_MANIFEST=$($manifest.manifest_path_wsl)",
    "TILESIM_WEB_STATE_ROOT=$webStateRootWsl",
    "TILESIM_TRACE_PACKAGE_ROOT=$tracePackageRootWsl",
    "python3", $bridgeScriptWsl
)
$evidenceAgentEnvironmentNames = @(
    "TILESIM_EVIDENCE_AGENT_PROVIDER",
    "TILESIM_EVIDENCE_AGENT_ENDPOINT",
    "TILESIM_EVIDENCE_AGENT_API_KEY",
    "TILESIM_EVIDENCE_AGENT_MODEL",
    "TILESIM_EVIDENCE_AGENT_MODEL_REVISION",
    "TILESIM_EVIDENCE_AGENT_TIMEOUT_MS",
    "TILESIM_EVIDENCE_AGENT_PROBE_CACHE_SECONDS"
)
$forwardedEvidenceAgentEnvironmentNames = @(
    $evidenceAgentEnvironmentNames | Where-Object {
        -not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($_, "Process"))
    }
)
$previousWslEnvironment = [Environment]::GetEnvironmentVariable("WSLENV", "Process")
try {
    if ($forwardedEvidenceAgentEnvironmentNames.Count -gt 0) {
        $existingWslEnvironmentNames = @(
            $previousWslEnvironment -split ":" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        )
        $env:WSLENV = (@($existingWslEnvironmentNames + $forwardedEvidenceAgentEnvironmentNames) |
            Select-Object -Unique) -join ":"
    }
    $launcher = Start-Process -FilePath "wsl.exe" -ArgumentList $arguments -WindowStyle Hidden -PassThru
} finally {
    if ($null -eq $previousWslEnvironment) {
        Remove-Item Env:WSLENV -ErrorAction SilentlyContinue
    } else {
        $env:WSLENV = $previousWslEnvironment
    }
}

for ($attempt = 0; $attempt -lt 8; $attempt += 1) {
    try {
        # A local worktree snapshot verifies its full tracked/untracked digest
        # on first health check. On an NTFS-mounted WSL worktree this can take
        # longer than the old eight-second request timeout even when healthy.
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:5173/api/health" -Method Get -TimeoutSec 75
        $apiManifest = Invoke-RestMethod -Uri "http://127.0.0.1:5173/api/manifest" -Method Get -TimeoutSec 75
        if ($health.source_revision -eq $manifest.source_revision -and
            $health.build_revision -eq $manifest.build_revision -and
            (-not $manifest.source_state_digest -or
             ($health.source_state_digest -eq $manifest.source_state_digest -and
              $health.build_state_digest -eq $manifest.build_state_digest -and
              $health.state_digests_match)) -and
            $health.versions_match -and $health.execution_ready -and
            (-not $manifest.web_release_digest -or
             ($health.web_release_digest -eq $manifest.web_release_digest -and
              $health.web_bridge_digest -eq $manifest.web_bridge_digest -and
              $health.web_static_digest -eq $manifest.web_static_digest -and
              $health.web_source_revision -eq $manifest.web_source_revision -and
              $health.web_source_state_digest -eq $manifest.web_source_state_digest -and
              $health.web_build_digest -eq $manifest.web_build_digest)) -and
            (-not $manifest.schema_set_revision -or
             ($health.schema_set_revision -eq $manifest.schema_set_revision -and
              $apiManifest.schema_set_revision -eq $manifest.schema_set_revision))) {
            [pscustomobject]@{
                launcher_pid = $launcher.Id
                source_revision = $health.source_revision
                build_revision = $health.build_revision
                source_state_digest = $health.source_state_digest
                web_source_state_digest = $manifest.web_source_state_digest
                web_build_digest = $manifest.web_build_digest
                web_release_digest = $manifest.web_release_digest
                schema_set_revision = $apiManifest.schema_set_revision
                deployment_ref = $health.deployment_ref
                execution_ready = $health.execution_ready
            } | ConvertTo-Json
            exit 0
        }
    } catch {
        # The relay may need a moment to bind after the WSL process starts.
    }
    Start-Sleep -Milliseconds 500
}

throw "TileSim Web bridge did not start with the deployed source/build revision."
