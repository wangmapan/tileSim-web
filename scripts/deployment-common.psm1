Set-StrictMode -Version Latest

function Resolve-TileSimWebRoot {
    param([Parameter(Mandatory = $true)][string]$ScriptRoot)

    return (Resolve-Path (Join-Path $ScriptRoot "..")).Path
}

function Resolve-TileSimNode {
    $configuredPath = [Environment]::GetEnvironmentVariable("TILESIM_NODE", "Process")
    if (-not [string]::IsNullOrWhiteSpace($configuredPath)) {
        $candidate = [System.IO.Path]::GetFullPath($configuredPath)
        if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            throw "TILESIM_NODE does not point to a Node.js executable: $candidate"
        }
        return $candidate
    }

    $command = Get-Command "node.exe" -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        $command = Get-Command "node" -ErrorAction SilentlyContinue
    }
    if ($null -eq $command) {
        throw "Node.js was not found on PATH. Install Node.js 20 or newer before deploying TileSim Web."
    }
    return $command.Source
}

function ConvertTo-TileSimWslPath {
    param([Parameter(Mandatory = $true)][string]$WindowsPath)

    $full = [System.IO.Path]::GetFullPath($WindowsPath)
    if ($full.StartsWith('\\?\UNC\', [System.StringComparison]::OrdinalIgnoreCase)) {
        $full = '\\' + $full.Substring(8)
    } elseif ($full.StartsWith('\\?\', [System.StringComparison]::OrdinalIgnoreCase)) {
        $full = $full.Substring(4)
    }
    if ($full -notmatch '^([A-Za-z]):\\(.*)$') {
        throw "Only absolute Windows drive paths are supported: $full"
    }
    return "/mnt/$($matches[1].ToLower())/$($matches[2].Replace('\', '/'))"
}

function Resolve-TileSimBackendRepositoryRoot {
    param(
        [Parameter(Mandatory = $true)][string]$WebRoot,
        [string]$RequestedPath = ""
    )

    $candidate = if ($RequestedPath) { $RequestedPath } else { Join-Path (Split-Path -Parent $WebRoot) "tileSim" }
    return [System.IO.Path]::GetFullPath($candidate)
}

function Resolve-TileSimBackendDeploymentRoot {
    param(
        [Parameter(Mandatory = $true)][string]$WebRoot,
        [string]$RequestedPath = ""
    )

    $candidate = if ($RequestedPath) { $RequestedPath } else { Join-Path (Split-Path -Parent $WebRoot) "tileSim-backend" }
    return [System.IO.Path]::GetFullPath($candidate)
}

function Resolve-TileSimWslBuildRoot {
    param(
        [Parameter(Mandatory = $true)][string]$WslDistro,
        [string]$RequestedPath = ""
    )

    if ($RequestedPath) {
        if (-not $RequestedPath.StartsWith("/")) {
            throw "The WSL build root must be an absolute Linux path: $RequestedPath"
        }
        return $RequestedPath.TrimEnd("/")
    }

    $result = & wsl.exe -d $WslDistro --exec sh -lc 'printf %s "${XDG_CACHE_HOME:-$HOME/.cache}/tilesim"'
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($result)) {
        throw "Could not resolve the TileSim build cache in WSL distribution '$WslDistro'."
    }
    return ([string]$result).Trim().TrimEnd("/")
}

function Get-TileSimPathIdentity {
    param([Parameter(Mandatory = $true)][string]$Path)

    $normalized = [System.IO.Path]::GetFullPath($Path).TrimEnd('\').Replace('\', '/').ToLowerInvariant()
    $sha256 = [System.Security.Cryptography.SHA256]::Create()
    try {
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($normalized)
        $digest = [BitConverter]::ToString($sha256.ComputeHash($bytes)).Replace('-', '').ToLowerInvariant()
        return $digest.Substring(0, 12)
    } finally {
        $sha256.Dispose()
    }
}

function Assert-TileSimWslDistro {
    param([Parameter(Mandatory = $true)][string]$WslDistro)

    $wsl = Get-Command "wsl.exe" -ErrorAction SilentlyContinue
    if ($null -eq $wsl) {
        throw "Windows Subsystem for Linux is required. Install WSL and an Ubuntu distribution first."
    }
    $wslProcess = Start-Process -FilePath $wsl.Source `
        -ArgumentList @("-d", $WslDistro, "--exec", "true") `
        -WindowStyle Hidden -Wait -PassThru
    if ($wslProcess.ExitCode -ne 0) {
        throw "WSL distribution '$WslDistro' is not available or cannot start."
    }
}

function Test-TileSimBridgeListening {
    $connections = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
    return $null -ne ($connections | Select-Object -First 1)
}

function Stop-TileSimBridge {
    param([Parameter(Mandatory = $true)][string]$WslDistro)

    $wsl = Get-Command "wsl.exe" -ErrorAction SilentlyContinue
    if ($null -eq $wsl) {
        throw "Windows Subsystem for Linux is required to stop TileSim Web."
    }

    for ($attempt = 0; $attempt -lt 3; $attempt++) {
        $stopProcess = Start-Process -FilePath $wsl.Source `
            -ArgumentList @("-d", $WslDistro, "--exec", "sh", "-lc", '"fuser -k 5173/tcp >/dev/null 2>&1 || true"') `
            -WindowStyle Hidden -Wait -PassThru
        # WSL localhost/NAT warnings may produce a non-zero wsl.exe exit code;
        # the port state is the authoritative result for this operation.
        Start-Sleep -Milliseconds 350
        if (-not (Test-TileSimBridgeListening)) { return }
    }

    throw "Could not stop the previous TileSim Web bridge on port 5173."
}

function Assert-TileSimBackendEvidenceRevisions {
    param(
        [Parameter(Mandatory = $true)][string]$BackendRepositoryRoot,
        [Parameter(Mandatory = $true)][string]$CatalogPath,
        [Parameter(Mandatory = $true)][string]$GitCommand
    )

    if (-not (Test-Path -LiteralPath $CatalogPath -PathType Leaf)) {
        throw "Agent orchestration capability catalog was not found: $CatalogPath"
    }

    $catalog = Get-Content -LiteralPath $CatalogPath -Raw | ConvertFrom-Json
    $revisions = @(
        $catalog.parameter_descriptors |
            ForEach-Object { $_.execution_evidence } |
            ForEach-Object { $_.revision } |
            Where-Object { $_ } |
            Sort-Object -Unique
    )

    foreach ($revision in $revisions) {
        if ($revision -notmatch '^[0-9a-f]{40}$') {
            throw "Capability catalog contains an invalid backend evidence revision: $revision"
        }
        & $GitCommand -C $BackendRepositoryRoot cat-file -e "$revision`^{commit}" 2>$null
        if ($LASTEXITCODE -ne 0) {
            throw "Backend repository cannot resolve published execution-evidence revision $revision. Fetch or publish the referenced backend commit, or pass -BackendRepositoryRoot pointing to a repository that contains it. Do not bypass the evidence gate."
        }
    }
}

Export-ModuleMember -Function @(
    "Resolve-TileSimWebRoot",
    "Resolve-TileSimNode",
    "ConvertTo-TileSimWslPath",
    "Resolve-TileSimBackendRepositoryRoot",
    "Resolve-TileSimBackendDeploymentRoot",
    "Resolve-TileSimWslBuildRoot",
    "Get-TileSimPathIdentity",
    "Assert-TileSimWslDistro",
    "Test-TileSimBridgeListening",
    "Stop-TileSimBridge",
    "Assert-TileSimBackendEvidenceRevisions"
)
