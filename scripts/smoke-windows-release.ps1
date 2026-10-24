param(
    [string]$BaseUrl = "http://127.0.0.1:5173",
    [Parameter(Mandatory = $true)][string]$ReleaseManifestPath,
    [int]$TimeoutSec = 20
)

$ErrorActionPreference = "Stop"

function Get-JsonFile {
    param([Parameter(Mandatory = $true)][string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Release manifest was not found: $Path" }
    return Get-Content -Raw -LiteralPath $Path | ConvertFrom-Json
}

$expected = Get-JsonFile -Path $ReleaseManifestPath
if ($expected.schema_version -ne "tilesim.workbench.release.v1") { throw "Unsupported release manifest schema." }
$normalizedBaseUrl = $BaseUrl.TrimEnd("/")
$checks = [System.Collections.Generic.List[object]]::new()
$health = $null
$apiManifest = $null
$errors = [System.Collections.Generic.List[string]]::new()

try {
    $health = Invoke-RestMethod -Uri "$normalizedBaseUrl/api/health" -Method Get -TimeoutSec $TimeoutSec
    $checks.Add([ordered]@{ id = "health"; ready = $true; summary = "Bridge health endpoint responded" })
} catch {
    $errors.Add("health: $($_.Exception.Message)")
    $checks.Add([ordered]@{ id = "health"; ready = $false; summary = "Bridge health endpoint did not respond" })
}
try {
    $apiManifest = Invoke-RestMethod -Uri "$normalizedBaseUrl/api/manifest" -Method Get -TimeoutSec $TimeoutSec
    $checks.Add([ordered]@{ id = "manifest"; ready = $true; summary = "Bridge API manifest responded" })
} catch {
    $errors.Add("manifest: $($_.Exception.Message)")
    $checks.Add([ordered]@{ id = "manifest"; ready = $false; summary = "Bridge API manifest did not respond" })
}

if ($null -ne $health) {
    $healthReady = $health.execution_ready -eq $true -and $health.versions_match -eq $true
    if (-not $healthReady) { $errors.Add("health: execution_ready and versions_match must both be true") }
    $checks.Add([ordered]@{ id = "execution"; ready = $healthReady; summary = "Packaged execution identity is ready" })
    foreach ($field in @("web_source_revision", "backend_revision", "schema_set_revision", "tilesim_cli_digest")) {
        if ($expected.$field -and [string]$health.$field -ne [string]$expected.$field) {
            $errors.Add("health: $field does not match release.json")
        }
    }
}
if ($null -ne $apiManifest -and $expected.schema_set_revision -and [string]$apiManifest.schema_set_revision -ne [string]$expected.schema_set_revision) {
    $errors.Add("manifest: schema_set_revision does not match release.json")
}

$result = [ordered]@{
    schema_version = "tilesim.windows_release_smoke.v1"
    checked_at = [DateTimeOffset]::Now.ToString("o")
    base_url = $normalizedBaseUrl
    release_id = [string]$expected.release_id
    checks = @($checks)
    ready = ($errors.Count -eq 0)
    errors = @($errors)
}
$result | ConvertTo-Json -Depth 8
if (-not $result.ready) { exit 2 }
