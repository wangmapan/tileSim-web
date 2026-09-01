param(
    [Parameter(Mandatory = $true)]
    [string]$Endpoint,
    [string]$Model = "gpt-5.6-sol",
    [string]$ModelRevision = "",
    [string]$WslDistro = "Ubuntu-24.04",
    [int]$TimeoutMs = 30000
)

$ErrorActionPreference = "Stop"
if (-not $ModelRevision) { $ModelRevision = $Model }
if ($Model -ne $ModelRevision) {
    throw "The NewAPI adapter requires one exact model identity for both model and revision."
}
if ($TimeoutMs -lt 1 -or $TimeoutMs -gt 120000) {
    throw "TimeoutMs must be between 1 and 120000."
}

$parsedEndpoint = $null
if (-not [uri]::TryCreate($Endpoint, [System.UriKind]::Absolute, [ref]$parsedEndpoint) -or
    $parsedEndpoint.Scheme -ne "https" -or
    $parsedEndpoint.UserInfo -or
    $parsedEndpoint.Query -or
    $parsedEndpoint.Fragment) {
    throw "Endpoint must be one fixed HTTPS origin, /v1 path, or /v1/chat/completions endpoint."
}
$normalizedPath = $parsedEndpoint.AbsolutePath.TrimEnd("/")
if ($normalizedPath -notin @("", "/v1", "/v1/chat/completions")) {
    throw "Endpoint path must be empty, /v1, or /v1/chat/completions."
}

$secureApiKey = Read-Host "NewAPI key (input is hidden and is not persisted)" -AsSecureString
$secretPointer = [IntPtr]::Zero
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
    if ([string]::IsNullOrWhiteSpace($apiKey)) { throw "The NewAPI key cannot be empty." }

    $env:TILESIM_EVIDENCE_AGENT_PROVIDER = "tilesim_newapi_openai_v1"
    $env:TILESIM_EVIDENCE_AGENT_ENDPOINT = $Endpoint
    $env:TILESIM_EVIDENCE_AGENT_API_KEY = $apiKey
    $env:TILESIM_EVIDENCE_AGENT_MODEL = $Model
    $env:TILESIM_EVIDENCE_AGENT_MODEL_REVISION = $ModelRevision
    $env:TILESIM_EVIDENCE_AGENT_TIMEOUT_MS = [string]$TimeoutMs
    $env:TILESIM_EVIDENCE_AGENT_PROBE_CACHE_SECONDS = "0"

    & (Join-Path $PSScriptRoot "start-backend.ps1") -WslDistro $WslDistro
    $descriptor = Invoke-RestMethod -Uri "http://127.0.0.1:5173/api/agent/evidence-capabilities" -TimeoutSec 75
    if ($descriptor.availability -ne "available" -or
        -not $descriptor.provider.configured -or
        $descriptor.provider.provider_id -ne "tilesim_newapi_openai_v1" -or
        $descriptor.provider.model_id -ne $Model -or
        $descriptor.provider.model_revision -ne $ModelRevision) {
        throw "The authenticated NewAPI capability probe did not match the configured Provider/model/revision."
    }

    [pscustomobject]@{
        availability = $descriptor.availability
        provider_id = $descriptor.provider.provider_id
        model_id = $descriptor.provider.model_id
        model_revision = $descriptor.provider.model_revision
        credential_persisted = $false
    } | ConvertTo-Json -Depth 4
} finally {
    $apiKey = $null
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    foreach ($name in $environmentNames) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
}
