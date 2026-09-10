param(
    [ValidateSet("Set", "Show")]
    [string]$Action = "Set",
    [string]$ConfigPath = (Join-Path $PSScriptRoot "..\runtime\evidence-agent.local.json"),
    [Alias("Endpoint")]
    [string]$BaseUrl = "",
    [string]$Model = "",
    [int]$TimeoutMs = 0,
    [int]$ProbeCacheSeconds = -1,
    [switch]$KeepExistingKey,
    [switch]$ApiKeyFromStdin
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "evidence-agent-settings.psm1") -Force

if ($Action -eq "Show") {
    if (-not (Test-Path -LiteralPath $ConfigPath)) {
        [ordered]@{
            schema_version = "tilesim.evidence_agent_local_config.v1"
            configured = $false
            api_key_status = "not_configured"
            config_path = [System.IO.Path]::GetFullPath($ConfigPath)
        } | ConvertTo-Json -Compress
        exit 0
    }
    $settings = Read-EvidenceAgentSettings $ConfigPath
    Get-EvidenceAgentPublicSettings $settings | ConvertTo-Json -Compress
    exit 0
}

$existing = $null
if (Test-Path -LiteralPath $ConfigPath) {
    try {
        $existing = Read-EvidenceAgentSettings $ConfigPath
    } catch {
        if ($KeepExistingKey) { throw }
        # A complete replacement with a new key is the recovery path for a
        # malformed, legacy-plaintext, or different-Windows-user config.
        $existing = $null
    }
}

if ([string]::IsNullOrWhiteSpace($BaseUrl)) {
    if ($null -ne $existing) {
        $BaseUrl = $existing.BaseUrl
    } else {
        $BaseUrl = Read-Host "OpenAI-compatible Base URL (HTTPS, or loopback HTTP)"
    }
}
if ([string]::IsNullOrWhiteSpace($Model)) {
    if ($null -ne $existing) {
        $Model = $existing.Model
    } else {
        $Model = Read-Host "Exact model identity"
    }
}
if ($TimeoutMs -eq 0) {
    $TimeoutMs = if ($null -ne $existing) { $existing.TimeoutMs } else { 30000 }
}
if ($ProbeCacheSeconds -eq -1) {
    $ProbeCacheSeconds = if ($null -ne $existing) { $existing.ProbeCacheSeconds } else { 60 }
}

$BaseUrl = Resolve-EvidenceAgentBaseUrl $BaseUrl
$Model = Resolve-EvidenceAgentModel $Model
if ($TimeoutMs -lt 1000 -or $TimeoutMs -gt 120000) {
    throw "Evidence Agent timeout must be between 1000 and 120000 milliseconds."
}
if ($ProbeCacheSeconds -lt 0 -or $ProbeCacheSeconds -gt 3600) {
    throw "Evidence Agent probe cache duration must be between 0 and 3600 seconds."
}

$secureApiKey = $null
$protectedApiKey = ""
try {
    if ($KeepExistingKey) {
        if ($null -eq $existing) {
            throw "KeepExistingKey was requested, but no existing protected key is available."
        }
        $protectedApiKey = $existing.ProtectedApiKey
    } elseif ($ApiKeyFromStdin) {
        $plainApiKey = [Console]::In.ReadLine()
        if ([string]::IsNullOrWhiteSpace($plainApiKey)) { throw "The API key cannot be empty." }
        $secureApiKey = ConvertTo-EvidenceAgentSecureString $plainApiKey
        $plainApiKey = $null
    } else {
        $secureApiKey = Read-Host "API key (hidden; stored with Windows DPAPI for this user only)" -AsSecureString
    }

    $settings = Write-EvidenceAgentSettings `
        -ConfigPath $ConfigPath `
        -BaseUrl $BaseUrl `
        -Model $Model `
        -TimeoutMs $TimeoutMs `
        -ProbeCacheSeconds $ProbeCacheSeconds `
        -ApiKey $secureApiKey `
        -ProtectedApiKey $protectedApiKey
    Get-EvidenceAgentPublicSettings $settings | ConvertTo-Json -Compress
} finally {
    $plainApiKey = $null
    if ($null -ne $secureApiKey) { $secureApiKey.Dispose() }
}
