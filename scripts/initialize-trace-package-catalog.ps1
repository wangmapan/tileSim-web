param(
    [string]$OutputRoot = (Join-Path $PSScriptRoot "..\runtime\trace-packages"),
    [string]$BackendRoot = "",
    [string]$PackageId = "synthetic-s1-demo"
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "deployment-common.psm1") -Force
$webRoot = Resolve-TileSimWebRoot $PSScriptRoot
$BackendRoot = Resolve-TileSimBackendDeploymentRoot $webRoot $BackendRoot

if ($PackageId -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') {
    throw "PackageId must be a safe HTTP identifier."
}

$output = [System.IO.Path]::GetFullPath($OutputRoot)
$backend = (Resolve-Path -LiteralPath $BackendRoot).Path
$entrySource = Join-Path $backend "docs\examples\s1_runtime_trace.json"
if (-not (Test-Path -LiteralPath $entrySource -PathType Leaf)) {
    throw "The backend S1 runtime Trace example was not found: $entrySource"
}

$packageDirectory = [System.IO.Path]::GetFullPath((Join-Path $output $PackageId))
$outputPrefix = $output.TrimEnd('\') + '\'
if (-not $packageDirectory.StartsWith($outputPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Resolved package directory escapes the configured output root."
}
if (Test-Path -LiteralPath $packageDirectory) {
    $existingManifestPath = Join-Path $packageDirectory "trace_package.json"
    if (-not (Test-Path -LiteralPath $existingManifestPath -PathType Leaf)) {
        throw "Existing package directory is not the generated TileSim demo: $packageDirectory"
    }
    $existingManifest = Get-Content -Raw -LiteralPath $existingManifestPath | ConvertFrom-Json
    if (
        $existingManifest.package_id -ne $PackageId -or
        $existingManifest.producer.name -ne "TileSim Web synthetic demo generator"
    ) {
        throw "Existing package directory is owned by another producer: $packageDirectory"
    }
} else {
    New-Item -ItemType Directory -Path $packageDirectory -Force | Out-Null
}

function Write-Utf8Text {
    param([string]$Path, [string]$Text)
    [System.IO.File]::WriteAllText($Path, $Text, [System.Text.UTF8Encoding]::new($false))
}

function Get-Sha256 {
    param([string]$Path)
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

$provenance = [ordered]@{
    source_mode = "synthetic_trace"
    calibration_level = "uncalibrated"
    allowed_claim_scope = "exploratory"
    source_id = "tilesim-web.$PackageId"
    generation_path = "scripts/initialize-trace-package-catalog.ps1"
    capture_or_generation_time = "deterministic-demo"
    upstream_tooling = "TileSim origin/main semantic example"
    trace_kind = "trace_package"
    notes = @("Synthetic consistency example; not real-system evidence or calibration ground truth.")
}
$entryProvenance = [ordered]@{}
foreach ($item in $provenance.GetEnumerator()) {
    $entryProvenance[$item.Key] = $item.Value
}
$entryProvenance.trace_kind = "s1_runtime"

$upstreamPath = Join-Path $packageDirectory "upstream_manifest.json"
Write-Utf8Text $upstreamPath (([ordered]@{
            schema_version = "tilesim.synthetic_trace_demo.v1"
            package_id = $PackageId
        } | ConvertTo-Json -Depth 4) + "`n")

$entry = Get-Content -Raw -LiteralPath $entrySource | ConvertFrom-Json
$entry | Add-Member -NotePropertyName trace_provenance -NotePropertyValue $entryProvenance -Force
$entryPath = Join-Path $packageDirectory "entry_s1_runtime.json"
Write-Utf8Text $entryPath (($entry | ConvertTo-Json -Depth 100) + "`n")

$roles = @("request", "batch", "iteration", "tile_execution", "kv_cache", "network_flow")
$artifacts = foreach ($role in $roles) {
    $relativePath = "$role.jsonl"
    $artifactPath = Join-Path $packageDirectory $relativePath
    $record = [ordered]@{
        semantic_role = $role
        experiment_id = "tilesim-web-synthetic-demo"
        physical_run_id = "tilesim-web-synthetic-demo-run"
        record_id = "$role-demo-001"
        evidence_scope = "synthetic_consistency"
    }
    Write-Utf8Text $artifactPath (($record | ConvertTo-Json -Compress -Depth 4) + "`n")
    [ordered]@{
        semantic_role = $role
        path = $relativePath
        sha256 = Get-Sha256 $artifactPath
    }
}

$manifest = [ordered]@{
    schema_version = "tilesim.trace_package.v1alpha1"
    package_id = $PackageId
    producer = [ordered]@{
        name = "TileSim Web synthetic demo generator"
        version = "1.0.0"
    }
    identity = [ordered]@{
        experiment_id = "tilesim-web-synthetic-demo"
        physical_run_id = "tilesim-web-synthetic-demo-run"
    }
    upstream_manifest = [ordered]@{
        path = "upstream_manifest.json"
        sha256 = Get-Sha256 $upstreamPath
    }
    trace_provenance = $provenance
    entry_trace = [ordered]@{
        boundary = "S1"
        trace_kind = "s1_runtime"
        path = "entry_s1_runtime.json"
        sha256 = Get-Sha256 $entryPath
    }
    artifacts = @($artifacts)
}
$manifestPath = Join-Path $packageDirectory "trace_package.json"
Write-Utf8Text $manifestPath (($manifest | ConvertTo-Json -Depth 12) + "`n")

[ordered]@{
    schema_version = "tilesim.trace_package_catalog_initialization.v1"
    package_id = $PackageId
    manifest_path = $manifestPath
    manifest_sha256 = "sha256:$(Get-Sha256 $manifestPath)"
    source_mode = "synthetic_trace"
    calibration_level = "uncalibrated"
    allowed_claim_scope = "exploratory"
} | ConvertTo-Json -Compress
