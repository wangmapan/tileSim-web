Set-StrictMode -Version Latest

$securityModulePath = Join-Path $PSHOME "Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1"
if (Test-Path -LiteralPath $securityModulePath) {
    Import-Module $securityModulePath -Force
} else {
    Import-Module Microsoft.PowerShell.Security -Force
}

$script:SettingsSchemaVersion = "tilesim.evidence_agent_local_config.v1"
$script:ProviderId = "tilesim_newapi_openai_v1"

function Get-ConfigValue {
    param(
        [Parameter(Mandatory = $true)]$Config,
        [Parameter(Mandatory = $true)][string[]]$Names
    )

    foreach ($name in $Names) {
        $property = $Config.PSObject.Properties[$name]
        if ($null -ne $property -and -not [string]::IsNullOrWhiteSpace([string]$property.Value)) {
            return [string]$property.Value
        }
    }
    return ""
}

function Resolve-EvidenceAgentBaseUrl {
    param([Parameter(Mandatory = $true)][string]$BaseUrl)

    $candidate = $BaseUrl.Trim()
    $parsed = $null
    if (-not [uri]::TryCreate($candidate, [System.UriKind]::Absolute, [ref]$parsed) -or
        $parsed.Scheme -notin @("https", "http") -or
        [string]::IsNullOrWhiteSpace($parsed.Host) -or
        -not [string]::IsNullOrWhiteSpace($parsed.UserInfo) -or
        -not [string]::IsNullOrWhiteSpace($parsed.Query) -or
        -not [string]::IsNullOrWhiteSpace($parsed.Fragment)) {
        throw "Base URL must be one absolute HTTP(S) origin, /v1 path, or /v1/chat/completions endpoint without credentials, query, or fragment."
    }

    if ($parsed.Scheme -eq "http") {
        $isLoopback = $parsed.Host.Equals("localhost", [System.StringComparison]::OrdinalIgnoreCase)
        $address = $null
        if ([System.Net.IPAddress]::TryParse($parsed.Host, [ref]$address)) {
            $isLoopback = $isLoopback -or [System.Net.IPAddress]::IsLoopback($address)
        }
        if (-not $isLoopback) {
            throw "Plain HTTP model endpoints are restricted to localhost or another loopback address."
        }
    }

    $normalizedPath = $parsed.AbsolutePath.TrimEnd("/")
    if ($normalizedPath -notin @("", "/v1", "/v1/chat/completions")) {
        throw "Base URL path must be empty, /v1, or /v1/chat/completions."
    }
    return $parsed.AbsoluteUri.TrimEnd("/")
}

function Resolve-EvidenceAgentModel {
    param([Parameter(Mandatory = $true)][string]$Model)

    $candidate = $Model.Trim()
    if ($candidate.Length -lt 1 -or $candidate.Length -gt 200 -or $candidate -match '[\s\x00-\x1f]') {
        throw "Model must be a non-empty identity of at most 200 characters without whitespace or control characters."
    }
    return $candidate
}

function Read-EvidenceAgentSettings {
    param([Parameter(Mandatory = $true)][string]$ConfigPath)

    $resolvedPath = (Resolve-Path -LiteralPath $ConfigPath).Path
    try {
        $config = Get-Content -Raw -LiteralPath $resolvedPath | ConvertFrom-Json
    } catch {
        throw "Evidence Agent settings are not valid JSON: $resolvedPath"
    }

    $provider = Get-ConfigValue $config @("provider", "TILESIM_EVIDENCE_AGENT_PROVIDER")
    if ($provider -ne $script:ProviderId) {
        throw "Evidence Agent settings must select $($script:ProviderId)."
    }
    $baseUrl = Resolve-EvidenceAgentBaseUrl (Get-ConfigValue $config @("base_url", "TILESIM_EVIDENCE_AGENT_ENDPOINT"))
    $model = Resolve-EvidenceAgentModel (Get-ConfigValue $config @("model", "TILESIM_EVIDENCE_AGENT_MODEL"))
    $modelRevision = Get-ConfigValue $config @("model_revision", "TILESIM_EVIDENCE_AGENT_MODEL_REVISION")
    if ([string]::IsNullOrWhiteSpace($modelRevision)) { $modelRevision = $model }
    $modelRevision = Resolve-EvidenceAgentModel $modelRevision
    if ($model -ne $modelRevision) {
        throw "The OpenAI-compatible adapter requires model and model revision to use one exact identity."
    }

    $timeoutText = Get-ConfigValue $config @("timeout_ms", "TILESIM_EVIDENCE_AGENT_TIMEOUT_MS")
    $timeoutMs = 30000
    if ($timeoutText) {
        $parsedTimeout = 0
        if (-not [int]::TryParse($timeoutText, [ref]$parsedTimeout)) {
            throw "Evidence Agent timeout must be an integer."
        }
        $timeoutMs = $parsedTimeout
    }
    if ($timeoutMs -lt 1000 -or $timeoutMs -gt 120000) {
        throw "Evidence Agent timeout must be between 1000 and 120000 milliseconds."
    }

    $probeCacheText = Get-ConfigValue $config @(
        "probe_cache_seconds",
        "TILESIM_EVIDENCE_AGENT_PROBE_CACHE_SECONDS"
    )
    $probeCacheSeconds = 60
    if ($probeCacheText) {
        $parsedProbeCache = 0
        if (-not [int]::TryParse($probeCacheText, [ref]$parsedProbeCache)) {
            throw "Evidence Agent probe cache duration must be an integer."
        }
        $probeCacheSeconds = $parsedProbeCache
    }
    if ($probeCacheSeconds -lt 0 -or $probeCacheSeconds -gt 3600) {
        throw "Evidence Agent probe cache duration must be between 0 and 3600 seconds."
    }

    $protectedApiKey = Get-ConfigValue $config @(
        "api_key_dpapi",
        "TILESIM_EVIDENCE_AGENT_API_KEY_DPAPI"
    )
    $plainApiKey = Get-ConfigValue $config @("TILESIM_EVIDENCE_AGENT_API_KEY")
    if ($plainApiKey) {
        throw "Plaintext API keys are not accepted. Re-save the settings so the key is protected with Windows DPAPI."
    }
    if ([string]::IsNullOrWhiteSpace($protectedApiKey)) {
        throw "Evidence Agent settings do not contain a Windows DPAPI-protected API key."
    }

    return [pscustomobject]@{
        SchemaVersion = $script:SettingsSchemaVersion
        ConfigPath = $resolvedPath
        Provider = $provider
        BaseUrl = $baseUrl
        Model = $model
        ModelRevision = $modelRevision
        TimeoutMs = $timeoutMs
        ProbeCacheSeconds = $probeCacheSeconds
        ProtectedApiKey = $protectedApiKey
    }
}

function ConvertFrom-EvidenceAgentProtectedApiKey {
    param([Parameter(Mandatory = $true)][string]$ProtectedApiKey)

    try {
        return Microsoft.PowerShell.Security\ConvertTo-SecureString $ProtectedApiKey
    } catch {
        throw "The saved API key cannot be decrypted by the current Windows user on this computer."
    }
}

function ConvertTo-EvidenceAgentSecureString {
    param([Parameter(Mandatory = $true)][string]$PlainText)

    if ([string]::IsNullOrWhiteSpace($PlainText)) { throw "The API key cannot be empty." }
    $secure = [System.Security.SecureString]::new()
    foreach ($character in $PlainText.ToCharArray()) {
        $secure.AppendChar($character)
    }
    $secure.MakeReadOnly()
    return $secure
}

function Write-EvidenceAgentSettings {
    param(
        [Parameter(Mandatory = $true)][string]$ConfigPath,
        [Parameter(Mandatory = $true)][string]$BaseUrl,
        [Parameter(Mandatory = $true)][string]$Model,
        [Parameter(Mandatory = $true)][int]$TimeoutMs,
        [int]$ProbeCacheSeconds = 60,
        [SecureString]$ApiKey,
        [string]$ProtectedApiKey = ""
    )

    $resolvedBaseUrl = Resolve-EvidenceAgentBaseUrl $BaseUrl
    $resolvedModel = Resolve-EvidenceAgentModel $Model
    if ($TimeoutMs -lt 1000 -or $TimeoutMs -gt 120000) {
        throw "Evidence Agent timeout must be between 1000 and 120000 milliseconds."
    }
    if ($ProbeCacheSeconds -lt 0 -or $ProbeCacheSeconds -gt 3600) {
        throw "Evidence Agent probe cache duration must be between 0 and 3600 seconds."
    }
    if ($null -ne $ApiKey) {
        $ProtectedApiKey = Microsoft.PowerShell.Security\ConvertFrom-SecureString $ApiKey
    }
    if ([string]::IsNullOrWhiteSpace($ProtectedApiKey)) {
        throw "An API key is required."
    }

    # Validate that the protected value belongs to this Windows user before replacing a working config.
    $validationKey = ConvertFrom-EvidenceAgentProtectedApiKey $ProtectedApiKey
    $validationKey.Dispose()

    $settings = [ordered]@{
        schema_version = $script:SettingsSchemaVersion
        provider = $script:ProviderId
        base_url = $resolvedBaseUrl
        api_key_dpapi = $ProtectedApiKey
        api_key_protection = "windows_dpapi_current_user"
        model = $resolvedModel
        model_revision = $resolvedModel
        timeout_ms = $TimeoutMs
        probe_cache_seconds = $ProbeCacheSeconds
        updated_at = [DateTimeOffset]::Now.ToString("o")
    }

    $fullPath = [System.IO.Path]::GetFullPath($ConfigPath)
    $directory = Split-Path -Parent $fullPath
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
    $temporary = Join-Path $directory "$([System.IO.Path]::GetFileName($fullPath)).$PID.tmp"
    try {
        $json = $settings | ConvertTo-Json -Depth 4
        [System.IO.File]::WriteAllText($temporary, "$json`n", [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporary -Destination $fullPath -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }

    return Read-EvidenceAgentSettings $fullPath
}

function Get-EvidenceAgentPublicSettings {
    param([Parameter(Mandatory = $true)]$Settings)

    return [ordered]@{
        schema_version = $Settings.SchemaVersion
        configured = $true
        provider = $Settings.Provider
        base_url = $Settings.BaseUrl
        model = $Settings.Model
        model_revision = $Settings.ModelRevision
        timeout_ms = $Settings.TimeoutMs
        probe_cache_seconds = $Settings.ProbeCacheSeconds
        api_key_status = "stored_with_windows_dpapi"
        config_path = $Settings.ConfigPath
    }
}

Export-ModuleMember -Function @(
    "Resolve-EvidenceAgentBaseUrl",
    "Resolve-EvidenceAgentModel",
    "Read-EvidenceAgentSettings",
    "ConvertFrom-EvidenceAgentProtectedApiKey",
    "ConvertTo-EvidenceAgentSecureString",
    "Write-EvidenceAgentSettings",
    "Get-EvidenceAgentPublicSettings"
)
