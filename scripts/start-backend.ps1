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
if ($manifest.tilesim_cli_digest) {
    if ($manifest.tilesim_cli_digest -notmatch '^[0-9a-f]{64}$') {
        throw "Deployment manifest contains an invalid TileSimCLI digest."
    }
    $cliHashOutput = @(& wsl.exe -d $WslDistro --exec sha256sum -- $manifest.tilesim_cli_wsl)
    if ($LASTEXITCODE -ne 0) { throw "Could not verify the deployed TileSimCLI digest." }
    $cliHash = $cliHashOutput | Where-Object { $_ -match '^([0-9a-f]{64})\s' } | ForEach-Object { $matches[1] } | Select-Object -Last 1
    if (-not $cliHash -or $cliHash.Trim() -ne $manifest.tilesim_cli_digest) {
        throw "Deployed TileSimCLI digest does not match the deployment manifest."
    }
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
$modelChannelEnvironmentNames = @(
    "TILESIM_EVIDENCE_AGENT_PROVIDER",
    "TILESIM_EVIDENCE_AGENT_ENDPOINT",
    "TILESIM_EVIDENCE_AGENT_API_KEY",
    "TILESIM_EVIDENCE_AGENT_MODEL",
    "TILESIM_EVIDENCE_AGENT_MODEL_REVISION",
    "TILESIM_EVIDENCE_AGENT_TIMEOUT_MS",
    "TILESIM_EVIDENCE_AGENT_PROBE_CACHE_SECONDS",
    # The right-side panel assistant channel. These are forwarded the same way - through WSLENV, never on
    # the command line - so the credential never appears in a process argument list.
    "TILESIM_ASSISTANT_BASE_URL",
    "TILESIM_ASSISTANT_API_KEY",
    "TILESIM_ASSISTANT_MODEL",
    "TILESIM_ASSISTANT_TIMEOUT_MS",
    # Automatic exploration execution is opt-in. Forward the selector and
    # same-origin Run Intake base URL without putting either value in argv.
    # Candidate generation switches are forwarded only when explicitly set;
    # their absence keeps the default deterministic generator unchanged.
    "TILESIM_EXPLORATION_MODEL_CANDIDATES",
    "TILESIM_AGENT_EXPLORATION_MODEL_CANDIDATES",
    "TILESIM_EXPLORATION_EXECUTOR",
    "TILESIM_RUN_INTAKE_BASE_URL"
)
$forwardedModelChannelEnvironmentNames = @(
    $modelChannelEnvironmentNames | Where-Object {
        -not [string]::IsNullOrEmpty([Environment]::GetEnvironmentVariable($_, "Process"))
    }
)
$previousWslEnvironment = [Environment]::GetEnvironmentVariable("WSLENV", "Process")
try {
    if ($forwardedModelChannelEnvironmentNames.Count -gt 0) {
        $existingWslEnvironmentNames = @(
            $previousWslEnvironment -split ":" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        )
        $env:WSLENV = (@($existingWslEnvironmentNames + $forwardedModelChannelEnvironmentNames) |
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

# A newly copied release imports thousands of files from the drvfs mount before
# it binds the port. Connection attempts during that import fail immediately;
# spending the whole retry budget there used to roll the manifest back while
# the process was still starting. Wait until something is listening, then give
# the first identity check long enough to hash the backend worktree.
$listenDeadline = [DateTime]::UtcNow.AddMinutes(3)
while (-not (Test-TileSimBridgeListening)) {
    if ($launcher.HasExited) {
        throw "TileSim Web bridge exited before it accepted connections (exit $($launcher.ExitCode))."
    }
    if ([DateTime]::UtcNow -gt $listenDeadline) {
        throw "TileSim Web bridge did not accept connections on port 5173 before the startup deadline."
    }
    Start-Sleep -Milliseconds 500
}

$lastMismatch = "no health response"
for ($attempt = 0; $attempt -lt 4; $attempt += 1) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:5173/api/health" -Method Get -TimeoutSec 240
        $apiManifest = Invoke-RestMethod -Uri "http://127.0.0.1:5173/api/manifest" -Method Get -TimeoutSec 240
        $differences = @()
        if ($health.source_revision -ne $manifest.source_revision) { $differences += "source_revision" }
        if ($health.build_revision -ne $manifest.build_revision) { $differences += "build_revision" }
        if ($manifest.source_state_digest -and (
            $health.source_state_digest -ne $manifest.source_state_digest -or
            $health.build_state_digest -ne $manifest.build_state_digest -or
            -not $health.state_digests_match)) { $differences += "source_state_digest" }
        if (-not $health.versions_match -or -not $health.execution_ready) { $differences += "execution_ready" }
        if ($manifest.web_release_digest -and (
            $health.web_release_digest -ne $manifest.web_release_digest -or
            $health.web_bridge_digest -ne $manifest.web_bridge_digest -or
            $health.web_static_digest -ne $manifest.web_static_digest -or
            $health.web_source_revision -ne $manifest.web_source_revision -or
            $health.web_source_state_digest -ne $manifest.web_source_state_digest -or
            $health.web_build_digest -ne $manifest.web_build_digest)) { $differences += "web_release" }
        if ($manifest.schema_set_revision -and (
            $health.schema_set_revision -ne $manifest.schema_set_revision -or
            $apiManifest.schema_set_revision -ne $manifest.schema_set_revision)) { $differences += "schema_set_revision" }
        if ($differences.Count -eq 0) {
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
        $lastMismatch = "identity fields differ: $($differences -join ', ')"
    } catch {
        $lastMismatch = $_.Exception.Message
    }
    Start-Sleep -Seconds 2
}

throw "TileSim Web bridge did not start with the deployed source/build revision. $lastMismatch"
