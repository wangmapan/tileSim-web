param(
    [string]$ManifestPath = (Join-Path $PSScriptRoot "..\runtime\backend-current.json"),
    [string]$EvidenceAgentConfigPath = (Join-Path $PSScriptRoot "..\runtime\evidence-agent.local.json"),
    [string]$TracePackageRoot = (Join-Path $PSScriptRoot "..\runtime\trace-packages"),
    [string]$WslDistro = "Ubuntu-24.04",
    [switch]$WithoutEvidenceAgent,
    [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ManifestPath)) {
    $fallbackManifestPath = Join-Path $PSScriptRoot "..\runtime\backend-current.json"
    if (Test-Path -LiteralPath $fallbackManifestPath) {
        $ManifestPath = $fallbackManifestPath
    } else {
        throw "No deployment manifest is available. Deploy a validated origin/main release before starting TileSim Web."
    }
}

if ($ValidateOnly) {
    if (-not $WithoutEvidenceAgent -and (Test-Path -LiteralPath $EvidenceAgentConfigPath)) {
        & (Join-Path $PSScriptRoot "start-evidence-agent.ps1") `
            -ConfigPath $EvidenceAgentConfigPath `
            -TracePackageRoot $TracePackageRoot `
            -ValidateConfigOnly
        if ($LASTEXITCODE -ne 0) { throw "Evidence Agent settings validation failed." }
    } else {
        [ordered]@{
            schema_version = "tilesim.workbench_startup_check.v1"
            deployment_manifest_present = $true
            evidence_agent_configured = $false
        } | ConvertTo-Json -Compress
    }
    exit 0
}

if (-not $WithoutEvidenceAgent -and (Test-Path -LiteralPath $EvidenceAgentConfigPath)) {
    & (Join-Path $PSScriptRoot "start-evidence-agent.ps1") `
        -ConfigPath $EvidenceAgentConfigPath `
        -ManifestPath $ManifestPath `
        -TracePackageRoot $TracePackageRoot `
        -WslDistro $WslDistro
} else {
    & (Join-Path $PSScriptRoot "start-backend.ps1") `
        -ManifestPath $ManifestPath `
        -TracePackageRoot $TracePackageRoot `
        -WslDistro $WslDistro
}

if ($LASTEXITCODE -ne 0) {
    throw "TileSim Web startup returned exit code $LASTEXITCODE."
}
