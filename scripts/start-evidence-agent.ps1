param(
    [string]$ConfigPath = "",
    [string]$ManifestPath = (Join-Path $PSScriptRoot "..\runtime\backend-current.json"),
    [string]$TracePackageRoot = (Join-Path $PSScriptRoot "..\runtime\trace-packages"),
    [Alias("Endpoint")]
    [string]$BaseUrl = "",
    [string]$Model = "gpt-5.6-sol",
    [string]$ModelRevision = "",
    [string]$WslDistro = "Ubuntu-24.04",
    [int]$TimeoutMs = 30000,
    [int]$ProbeCacheSeconds = 60,
    [switch]$ValidateConfigOnly
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "evidence-agent-settings.psm1") -Force

$defaultConfigPath = Join-Path $PSScriptRoot "..\runtime\evidence-agent.local.json"
if (-not $ConfigPath -and -not $BaseUrl -and (Test-Path -LiteralPath $defaultConfigPath)) {
    $ConfigPath = $defaultConfigPath
}

$credentialPersisted = $false
$secureApiKey = $null
if ($ConfigPath) {
    $settings = Read-EvidenceAgentSettings $ConfigPath
    $BaseUrl = $settings.BaseUrl
    $Model = $settings.Model
    $ModelRevision = $settings.ModelRevision
    $TimeoutMs = $settings.TimeoutMs
    $ProbeCacheSeconds = $settings.ProbeCacheSeconds
    $secureApiKey = ConvertFrom-EvidenceAgentProtectedApiKey $settings.ProtectedApiKey
    $credentialPersisted = $true
} else {
    if (-not $BaseUrl) {
        throw "BaseUrl is required when no saved Evidence Agent config is available."
    }
    $BaseUrl = Resolve-EvidenceAgentBaseUrl $BaseUrl
    $Model = Resolve-EvidenceAgentModel $Model
    if (-not $ModelRevision) { $ModelRevision = $Model }
    $ModelRevision = Resolve-EvidenceAgentModel $ModelRevision
    if ($Model -ne $ModelRevision) {
        throw "The OpenAI-compatible adapter requires model and model revision to use one exact identity."
    }
    if ($TimeoutMs -lt 1000 -or $TimeoutMs -gt 120000) {
        throw "TimeoutMs must be between 1000 and 120000."
    }
    if ($ProbeCacheSeconds -lt 0 -or $ProbeCacheSeconds -gt 3600) {
        throw "ProbeCacheSeconds must be between 0 and 3600."
    }
    $secureApiKey = Read-Host "API key (hidden and not persisted)" -AsSecureString
}

if ($ValidateConfigOnly) {
    try {
        [ordered]@{
            schema_version = "tilesim.evidence_agent_local_config.v1"
            configured = $true
            provider = "tilesim_newapi_openai_v1"
            base_url = $BaseUrl
            model = $Model
            model_revision = $ModelRevision
            timeout_ms = $TimeoutMs
            probe_cache_seconds = $ProbeCacheSeconds
            api_key_status = if ($credentialPersisted) { "stored_with_windows_dpapi" } else { "provided_for_current_process" }
        } | ConvertTo-Json -Compress
        exit 0
    } finally {
        if ($null -ne $secureApiKey) { $secureApiKey.Dispose() }
    }
}

$secretPointer = [IntPtr]::Zero
$apiKey = $null
$environmentNames = @(
    "TILESIM_EVIDENCE_AGENT_PROVIDER",
    "TILESIM_EVIDENCE_AGENT_ENDPOINT",
    "TILESIM_EVIDENCE_AGENT_API_KEY",
    "TILESIM_EVIDENCE_AGENT_MODEL",
    "TILESIM_EVIDENCE_AGENT_MODEL_REVISION",
    "TILESIM_EVIDENCE_AGENT_TIMEOUT_MS",
    "TILESIM_EVIDENCE_AGENT_PROBE_CACHE_SECONDS"
)
try {
    $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApiKey)
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "The API key cannot be empty." }

    $env:TILESIM_EVIDENCE_AGENT_PROVIDER = "tilesim_newapi_openai_v1"
    $env:TILESIM_EVIDENCE_AGENT_ENDPOINT = $BaseUrl
    $env:TILESIM_EVIDENCE_AGENT_API_KEY = $apiKey
    $env:TILESIM_EVIDENCE_AGENT_MODEL = $Model
    $env:TILESIM_EVIDENCE_AGENT_MODEL_REVISION = $ModelRevision
    $env:TILESIM_EVIDENCE_AGENT_TIMEOUT_MS = [string]$TimeoutMs
    $env:TILESIM_EVIDENCE_AGENT_PROBE_CACHE_SECONDS = [string]$ProbeCacheSeconds

    & (Join-Path $PSScriptRoot "start-backend.ps1") `
        -ManifestPath $ManifestPath `
        -TracePackageRoot $TracePackageRoot `
        -WslDistro $WslDistro
    if ($LASTEXITCODE -ne 0) { throw "Bridge startup returned exit code $LASTEXITCODE." }

    $descriptor = Invoke-RestMethod `
        -Uri "http://127.0.0.1:5173/api/agent/evidence-capabilities" `
        -TimeoutSec ([Math]::Ceiling($TimeoutMs / 1000) + 15)
    if ($descriptor.availability -ne "available" -or
        -not $descriptor.provider.configured -or
        $descriptor.provider.provider_id -ne "tilesim_newapi_openai_v1" -or
        $descriptor.provider.model_id -ne $Model -or
        $descriptor.provider.model_revision -ne $ModelRevision) {
        throw "The authenticated capability probe did not match the configured Provider, model, and revision."
    }

    [ordered]@{
        availability = $descriptor.availability
        provider_id = $descriptor.provider.provider_id
        model_id = $descriptor.provider.model_id
        model_revision = $descriptor.provider.model_revision
        credential_persisted = $credentialPersisted
    } | ConvertTo-Json -Compress
} finally {
    $apiKey = $null
    if ($null -ne $secureApiKey) { $secureApiKey.Dispose() }
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    foreach ($name in $environmentNames) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
}
