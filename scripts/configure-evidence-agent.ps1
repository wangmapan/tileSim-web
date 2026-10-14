param(
    [ValidateSet("Set", "Show", "ListModels")]
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

if ($Action -eq "ListModels") {
    # Read-only: ask the configured service which model identities it exposes so the
    # launcher can offer them as a list instead of asking the operator to retype an
    # identity from memory.  Nothing is written, and the key never leaves this process.
    $listBaseUrl = $BaseUrl
    $listSettings = $null
    if (Test-Path -LiteralPath $ConfigPath) {
        try {
            $listSettings = Read-EvidenceAgentSettings $ConfigPath
        } catch {
            $listSettings = $null
        }
    }
    if ([string]::IsNullOrWhiteSpace($listBaseUrl) -and $null -ne $listSettings) {
        $listBaseUrl = $listSettings.BaseUrl
    }

    $listKey = ""
    $listModels = @()
    $listError = ""
    $listResolved = ""
    try {
        $listResolved = Resolve-EvidenceAgentBaseUrl $listBaseUrl

        if ($ApiKeyFromStdin) {
            $listKey = [Console]::In.ReadLine()
        } elseif ($null -ne $listSettings) {
            $secureForList = ConvertFrom-EvidenceAgentProtectedApiKey $listSettings.ProtectedApiKey
            try {
                $listKey = (New-Object System.Net.NetworkCredential("", $secureForList)).Password
            } finally {
                $secureForList.Dispose()
            }
        }
        if ([string]::IsNullOrWhiteSpace($listKey)) {
            throw "No API key is available: enter one, or save the settings once and retry."
        }

        # The model catalogue lives beside the chat endpoint the Bridge derives from the
        # same Base URL, so both agree on where the service keeps it.
        $origin = [System.Uri]$listResolved
        $modelsUri = "{0}://{1}/v1/models" -f $origin.Scheme, $origin.Authority
        if ($origin.Scheme -eq "https") {
            [System.Net.ServicePointManager]::SecurityProtocol =
                [System.Net.ServicePointManager]::SecurityProtocol -bor
                [System.Net.SecurityProtocolType]::Tls12
        } else {
            # Plain HTTP is only accepted for loopback, where a system proxy is always a
            # wrong detour and the usual reason a local service looks unreachable.  This
            # helper is a short-lived process, so clearing the proxy cannot leak.
            [System.Net.WebRequest]::DefaultWebProxy = $null
        }
        $listResponse = Invoke-RestMethod -Uri $modelsUri -Method Get `
            -Headers @{ Authorization = "Bearer $listKey" } -TimeoutSec 25
        $listModels = @(
            $listResponse.data |
                ForEach-Object { [string]$_.id } |
                Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
        )
        if ($listModels.Count -eq 0) {
            throw "The service returned no models (empty /v1/models)."
        }
    } catch {
        $listError = $_.Exception.Message
        $listModels = @()
    } finally {
        $listKey = ""
    }

    [ordered]@{
        schema_version = "tilesim.evidence_agent_model_list.v1"
        ok = ($listError -eq "")
        base_url = $listResolved
        count = $listModels.Count
        models = $listModels
        error = $listError
    } | ConvertTo-Json -Compress
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
