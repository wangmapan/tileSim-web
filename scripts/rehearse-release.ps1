param(
    [string]$DeploymentManifest = (Join-Path $PSScriptRoot "..\runtime\backend-current.json"),
    [string]$WslDistro = "Ubuntu-24.04",
    [int]$Port = 58173
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "deployment-common.psm1") -Force
if ($Port -lt 1024 -or $Port -gt 65535 -or $Port -eq 5173) {
    throw "Release rehearsal requires an unprivileged temporary port other than 5173."
}

$webRoot = Resolve-TileSimWebRoot $PSScriptRoot
$runtimeRoot = Join-Path $webRoot "runtime\rehearsal"
$releasesRoot = Join-Path $runtimeRoot "releases"
$node = Resolve-TileSimNode
Assert-TileSimWslDistro $WslDistro
$activeManifestPath = (Resolve-Path -LiteralPath $DeploymentManifest).Path
$activeManifest = Get-Content -Raw -LiteralPath $activeManifestPath | ConvertFrom-Json

function Get-DirectoryDigest {
    param([string]$Directory, [switch]$IncludeEveryDirectory)
    $arguments = @((Join-Path $PSScriptRoot "release-traceability.mjs"), $Directory)
    if ($IncludeEveryDirectory) { $arguments += "" }
    $digest = (& $node @arguments).Trim()
    if ($LASTEXITCODE -ne 0 -or $digest -notmatch '^[0-9a-f]{64}$') {
        throw "Could not calculate the release digest for $Directory."
    }
    return $digest
}

function Write-AtomicJson {
    param([string]$Path, [object]$Value)
    $temporary = "$Path.$PID.tmp"
    try {
        [System.IO.File]::WriteAllText(
            $temporary,
            ($Value | ConvertTo-Json -Depth 8),
            [System.Text.UTF8Encoding]::new($false)
        )
        Move-Item -LiteralPath $temporary -Destination $Path -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
}

function Stop-RehearsalBridge {
    & wsl.exe -d $WslDistro --exec sh -lc "fuser -k $Port/tcp >/dev/null 2>&1 || true"
    if ($LASTEXITCODE -ne 0) { throw "Could not stop the temporary rehearsal Bridge on port $Port." }
}

function Start-RehearsalBridge {
    param([object]$Manifest, [string]$ManifestPathWsl, [string]$StateRootWsl)
    $arguments = @(
        "-d", $WslDistro,
        "--exec", "env",
        "TILESIM_ROOT=$($Manifest.tilesim_root_wsl)",
        "TILESIM_CLI=$($Manifest.tilesim_cli_wsl)",
        "TILESIM_BUILD_REVISION=$($Manifest.build_revision)",
        "TILESIM_BUILD_STATE_DIGEST=$($Manifest.build_state_digest)",
        "TILESIM_DEPLOYMENT_MANIFEST=$ManifestPathWsl",
        "TILESIM_WEB_STATE_ROOT=$StateRootWsl",
        "TILESIM_WEB_PORT=$Port",
        "python3", "$($Manifest.web_release_root_wsl)/bridge/server.py"
    )
    return Start-Process -FilePath "wsl.exe" -ArgumentList $arguments -WindowStyle Hidden -PassThru
}

function Wait-RehearsalHealth {
    param([bool]$ExpectedExecutionReady, [string]$ExpectedReleaseDigest, [string]$ExpectedSchemaRevision)
    $lastError = $null
    for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
        try {
            $health = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 15
            $manifest = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/manifest" -TimeoutSec 15
            if ([bool]$health.execution_ready -eq $ExpectedExecutionReady -and
                $health.web_release_digest -eq $ExpectedReleaseDigest -and
                $health.schema_set_revision -eq $ExpectedSchemaRevision -and
                $manifest.schema_set_revision -eq $ExpectedSchemaRevision) {
                return [pscustomobject]@{ health = $health; manifest = $manifest }
            }
            $lastError = "temporary Bridge returned a mismatched identity"
        } catch {
            $lastError = $_.Exception.Message
        }
        Start-Sleep -Milliseconds 500
    }
    throw "Temporary Bridge did not reach the expected state: $lastError"
}

function Wait-RehearsalRun {
    param([string]$RunId)
    for ($attempt = 0; $attempt -lt 120; $attempt += 1) {
        $run = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/runs/$RunId" -TimeoutSec 15
        if ($run.status -in @("completed", "failed")) { return $run }
        Start-Sleep -Milliseconds 500
    }
    throw "Temporary rehearsal run did not reach a terminal state."
}

foreach ($field in @(
    "source_revision",
    "build_revision",
    "source_state_digest",
    "build_state_digest",
    "tilesim_root_wsl",
    "tilesim_cli_wsl"
)) {
    if (-not $activeManifest.$field) { throw "Deployment manifest is missing '$field'." }
}

$webRevision = (& git -C $webRoot rev-parse HEAD).Trim()
if ($LASTEXITCODE -ne 0 -or $webRevision -notmatch '^[0-9a-f]{40}$') {
    throw "TileSim Web source revision could not be resolved."
}
$webSourceDigest = Get-DirectoryDigest $webRoot
$webBuildDigest = Get-DirectoryDigest (Join-Path $webRoot "dist") -IncludeEveryDirectory
$schemaOutput = @(& wsl.exe -d $WslDistro --exec python3 (ConvertTo-TileSimWslPath (Join-Path $webRoot "bridge\server.py")) --print-schema-set-revision)
if ($LASTEXITCODE -ne 0) { throw "Could not calculate the Bridge schema-set revision." }
$schemaRevision = $schemaOutput | Where-Object { $_ -match '^sha256:[0-9a-f]{64}$' } | Select-Object -Last 1
if (-not $schemaRevision) { throw "Bridge schema-set revision was not returned." }

$snapshotOutput = & $node (Join-Path $PSScriptRoot "release-snapshot.mjs") create `
    --source-root $webRoot `
    --releases-root $releasesRoot `
    --web-source-revision $webRevision `
    --web-source-state-digest $webSourceDigest `
    --web-build-digest $webBuildDigest `
    --schema-set-revision $schemaRevision
if ($LASTEXITCODE -ne 0) { throw "Could not create the rehearsal release snapshot." }
$snapshot = ($snapshotOutput | Select-Object -Last 1) | ConvertFrom-Json

$rehearsalId = "run-$(Get-Date -Format 'yyyyMMdd-HHmmss')-$PID"
$stateRoot = Join-Path $runtimeRoot $rehearsalId
$manifestPath = Join-Path $stateRoot "backend-current.json"
New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null
$manifestPathWsl = ConvertTo-TileSimWslPath $manifestPath
$stateRootWsl = ConvertTo-TileSimWslPath $stateRoot
$releaseRootWsl = ConvertTo-TileSimWslPath $snapshot.release_root_windows

$candidate = [ordered]@{}
foreach ($property in $activeManifest.PSObject.Properties) { $candidate[$property.Name] = $property.Value }
$candidate.web_source_revision = $webRevision
$candidate.web_source_state_digest = $webSourceDigest
$candidate.web_build_digest = $webBuildDigest
$candidate.web_release_identity = $snapshot.identity
$candidate.web_release_digest = $snapshot.release_digest
$candidate.web_bridge_digest = $snapshot.bridge.digest
$candidate.web_static_digest = $snapshot.static.digest
$candidate.web_release_root_windows = $snapshot.release_root_windows
$candidate.web_release_root_wsl = $releaseRootWsl
$candidate.web_state_root_wsl = $stateRootWsl
$candidate.schema_set_revision = $schemaRevision
$candidate.manifest_path_wsl = $manifestPathWsl
$candidate.deployment_mode = "temporary_release_rehearsal"

$launcher = $null
$runId = $null
try {
    Write-AtomicJson $manifestPath $candidate
    Stop-RehearsalBridge
    $launcher = Start-RehearsalBridge $candidate $manifestPathWsl $stateRootWsl
    $first = Wait-RehearsalHealth $true $snapshot.release_digest $schemaRevision

    $idempotencyKey = "release-rehearsal-$rehearsalId"
    $created = Invoke-RestMethod `
        -Uri "http://127.0.0.1:$Port/api/runs" `
        -Method Post `
        -Headers @{ "Idempotency-Key" = $idempotencyKey } `
        -ContentType "application/json" `
        -Body '{"scenario_id":"s1_des_example"}' `
        -TimeoutSec 30
    $runId = $created.run_id
    if (-not $runId) { throw "Temporary Bridge did not return a run ID." }
    $terminal = Wait-RehearsalRun $runId
    if ($terminal.status -ne "completed") { throw "Temporary rehearsal run failed." }

    Stop-RehearsalBridge
    $failedCandidate = [ordered]@{}
    foreach ($property in $candidate.GetEnumerator()) { $failedCandidate[$property.Key] = $property.Value }
    $failedCandidate.tilesim_cli_wsl = "/tmp/tilesim-release-rehearsal-missing-cli"
    Write-AtomicJson $manifestPath $failedCandidate
    $launcher = Start-RehearsalBridge $failedCandidate $manifestPathWsl $stateRootWsl
    $failed = Wait-RehearsalHealth $false $snapshot.release_digest $schemaRevision
    Stop-RehearsalBridge

    Write-AtomicJson $manifestPath $candidate
    $launcher = Start-RehearsalBridge $candidate $manifestPathWsl $stateRootWsl
    $restored = Wait-RehearsalHealth $true $snapshot.release_digest $schemaRevision
    $restoredRun = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/runs/$runId" -TimeoutSec 15
    if ($restoredRun.status -ne "completed") { throw "Restored Bridge did not retain the completed run." }

    [pscustomobject]@{
        identity = "tilesim.web.release_rehearsal.v1"
        rehearsal_id = $rehearsalId
        port = $Port
        release_digest = $snapshot.release_digest
        schema_set_revision = $schemaRevision
        run_id = $runId
        initial_execution_ready = $first.health.execution_ready
        injected_execution_ready = $failed.health.execution_ready
        restored_execution_ready = $restored.health.execution_ready
        restored_run_status = $restoredRun.status
        manifest_restored = $true
        immutable_bytes_verified = $true
    } | ConvertTo-Json -Depth 5
} finally {
    Stop-RehearsalBridge
}
