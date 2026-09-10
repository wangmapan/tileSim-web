Set-StrictMode -Version Latest

function Resolve-TileSimWebRoot {
    param([Parameter(Mandatory = $true)][string]$ScriptRoot)

    return (Resolve-Path (Join-Path $ScriptRoot "..")).Path
}

function Resolve-TileSimNode {
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

function Assert-TileSimWslDistro {
    param([Parameter(Mandatory = $true)][string]$WslDistro)

    $wsl = Get-Command "wsl.exe" -ErrorAction SilentlyContinue
    if ($null -eq $wsl) {
        throw "Windows Subsystem for Linux is required. Install WSL and an Ubuntu distribution first."
    }
    & wsl.exe -d $WslDistro --exec true
    if ($LASTEXITCODE -ne 0) {
        throw "WSL distribution '$WslDistro' is not available or cannot start."
    }
}

Export-ModuleMember -Function @(
    "Resolve-TileSimWebRoot",
    "Resolve-TileSimNode",
    "ConvertTo-TileSimWslPath",
    "Resolve-TileSimBackendRepositoryRoot",
    "Resolve-TileSimBackendDeploymentRoot",
    "Resolve-TileSimWslBuildRoot",
    "Assert-TileSimWslDistro"
)
