param(
    [string]$ConfigPath = "",
    [string]$Endpoint = "",
    [string]$Model = "gpt-5.6-sol",
    [string]$ModelRevision = "",
    [string]$WslDistro = "Ubuntu-24.04",
    [int]$TimeoutMs = 30000
)

$ErrorActionPreference = "Stop"
$credentialPersisted = $false
$configApiKey = $null
$secureConfigApiKey = $null
if ($ConfigPath) {
    $resolvedConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path
    $localConfig = Get-Content -Raw -LiteralPath $resolvedConfigPath | ConvertFrom-Json
    $requiredConfigNames = @(
        "TILESIM_EVIDENCE_AGENT_PROVIDER",
        "TILESIM_EVIDENCE_AGENT_ENDPOINT",
        "TILESIM_EVIDENCE_AGENT_MODEL",
        "TILESIM_EVIDENCE_AGENT_MODEL_REVISION"
    )
    foreach ($name in $requiredConfigNames) {
        if ([string]::IsNullOrWhiteSpace([string]$localConfig.$name)) {
            throw "Evidence Agent config is missing '$name'."
        }
    }
    if ($localConfig.TILESIM_EVIDENCE_AGENT_PROVIDER -ne "tilesim_newapi_openai_v1") {
        throw "Evidence Agent config must select tilesim_newapi_openai_v1."
    }
    if (-not [string]::IsNullOrWhiteSpace([string]$localConfig.TILESIM_EVIDENCE_AGENT_API_KEY_DPAPI)) {
        $secureConfigApiKey = ConvertTo-SecureString (
            [string]$localConfig.TILESIM_EVIDENCE_AGENT_API_KEY_DPAPI
        )
    } elseif (-not [string]::IsNullOrWhiteSpace([string]$localConfig.TILESIM_EVIDENCE_AGENT_API_KEY)) {
        $configApiKey = [string]$localConfig.TILESIM_EVIDENCE_AGENT_API_KEY
    } else {
        throw "Evidence Agent config is missing a DPAPI-protected or plaintext TILESIM_EVIDENCE_AGENT_API_KEY."
    }

    $Endpoint = [string]$localConfig.TILESIM_EVIDENCE_AGENT_ENDPOINT
    $Model = [string]$localConfig.TILESIM_EVIDENCE_AGENT_MODEL
    $ModelRevision = [string]$localConfig.TILESIM_EVIDENCE_AGENT_MODEL_REVISION
    if ($null -ne $localConfig.TILESIM_EVIDENCE_AGENT_TIMEOUT_MS) {
        $TimeoutMs = [int]$localConfig.TILESIM_EVIDENCE_AGENT_TIMEOUT_MS
    }
    $credentialPersisted = $true
} elseif (-not $Endpoint) {
    throw "Endpoint is required when ConfigPath is not supplied."
}

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

$secureApiKey = $null
if (-not $ConfigPath) {
    $secureApiKey = Read-Host "NewAPI key (input is hidden and is not persisted)" -AsSecureString
}
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
    if ($ConfigPath) {
        if ($null -ne $secureConfigApiKey) {
            $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureConfigApiKey)
            $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
        } else {
            $apiKey = $configApiKey
        }
    } else {
        $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureApiKey)
        $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
    }
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
        credential_persisted = $credentialPersisted
    } | ConvertTo-Json -Depth 4
} finally {
    $apiKey = $null
    $configApiKey = $null
    if ($null -ne $secureConfigApiKey) { $secureConfigApiKey.Dispose() }
    if ($secretPointer -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
    }
    foreach ($name in $environmentNames) {
        Remove-Item "Env:$name" -ErrorAction SilentlyContinue
    }
}
