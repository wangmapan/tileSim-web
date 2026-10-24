param(
    [string]$Version = "",
    [ValidateSet("wsl-prebuilt", "windows-native")]
    [string]$RuntimeKind = "wsl-prebuilt",
    [string]$WslRootfsTar = "",
    [string]$RuntimeMetadataPath = "",
    [string]$BackendSourceRoot = "",
    [string]$BackendCliPath = "",
    [string]$BackendResourceRoot = "",
    [string]$OutputDirectory = "",
    [switch]$AllowDirty,
    [switch]$SkipValidation,
    [switch]$SkipWebBuild
)

$ErrorActionPreference = "Stop"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "`n== $Message ==" -ForegroundColor Cyan
}

function Find-FirstExistingFile {
    param([Parameter(Mandatory = $true)][string[]]$Candidates)
    foreach ($candidate in $Candidates) {
        if (-not [string]::IsNullOrWhiteSpace($candidate) -and (Test-Path -LiteralPath $candidate -PathType Leaf)) {
            return (Resolve-Path -LiteralPath $candidate).Path
        }
    }
    return ""
}

function Read-RequiredPath {
    param(
        [Parameter(Mandatory = $true)][string]$Prompt,
        [Parameter(Mandatory = $true)][ValidateSet("Leaf", "Container")][string]$PathType
    )
    while ($true) {
        $value = Read-Host $Prompt
        if ([string]::IsNullOrWhiteSpace($value)) { throw "A required path was not provided." }
        $candidate = [System.IO.Path]::GetFullPath($value.Trim().Trim('"'))
        if (Test-Path -LiteralPath $candidate -PathType $PathType) { return (Resolve-Path -LiteralPath $candidate).Path }
        Write-Host "Path not found: $candidate" -ForegroundColor Yellow
    }
}

try {
    if ([string]::IsNullOrWhiteSpace($Version)) {
        $Version = ([System.IO.File]::ReadAllText((Join-Path $webRoot "package.json")) | ConvertFrom-Json).version
    }
    if (-not [string]::IsNullOrWhiteSpace($RuntimeMetadataPath)) {
        if (-not (Test-Path -LiteralPath $RuntimeMetadataPath -PathType Leaf)) {
            throw "Runtime metadata was not found: $RuntimeMetadataPath"
        }
        $runtimeMetadata = Get-Content -Raw -LiteralPath $RuntimeMetadataPath | ConvertFrom-Json
        if ($runtimeMetadata.runtime_kind) { $RuntimeKind = [string]$runtimeMetadata.runtime_kind }
    }
    if ([string]::IsNullOrWhiteSpace($BackendSourceRoot)) {
        $defaultBackend = Join-Path (Split-Path -Parent $webRoot) "tileSim"
        if (Test-Path -LiteralPath $defaultBackend -PathType Container) { $BackendSourceRoot = (Resolve-Path $defaultBackend).Path }
    }
    if ([string]::IsNullOrWhiteSpace($BackendResourceRoot) -and $BackendSourceRoot) {
        $defaultResources = Join-Path $BackendSourceRoot "docs\examples"
        if (Test-Path -LiteralPath $defaultResources -PathType Container) { $BackendResourceRoot = (Resolve-Path $defaultResources).Path }
    }
    if ([string]::IsNullOrWhiteSpace($BackendSourceRoot)) {
        $BackendSourceRoot = Read-RequiredPath -Prompt "Backend source root (for revision only)" -PathType Container
    }
    if ([string]::IsNullOrWhiteSpace($BackendResourceRoot)) {
        $BackendResourceRoot = Read-RequiredPath -Prompt "Backend resource directory (normally tileSim\docs\examples)" -PathType Container
    }

    if ($RuntimeKind -eq "windows-native" -and [string]::IsNullOrWhiteSpace($BackendCliPath)) {
        $nativeCandidates = @()
        if ($BackendSourceRoot) {
            $nativeCandidates += @(
                (Join-Path $BackendSourceRoot "build-ca1\Release\TileSimCLI.exe"),
                (Join-Path $BackendSourceRoot "build-dv1-utf8\Release\TileSimCLI.exe"),
                (Join-Path $BackendSourceRoot "build\Release\TileSimCLI.exe"),
                (Join-Path $BackendSourceRoot "build\TileSimCLI.exe")
            )
        }
        $BackendCliPath = Find-FirstExistingFile -Candidates $nativeCandidates
    }
    if ($RuntimeKind -eq "windows-native" -and [string]::IsNullOrWhiteSpace($BackendCliPath)) {
        $BackendCliPath = Read-RequiredPath -Prompt "Windows-native TileSimCLI.exe path" -PathType Leaf
    }

    if ($RuntimeKind -eq "wsl-prebuilt") {
        if ([string]::IsNullOrWhiteSpace($WslRootfsTar)) {
            $WslRootfsTar = Find-FirstExistingFile @(
                (Join-Path $webRoot "runtime\tilesim-rootfs.tar"),
                (Join-Path $webRoot "runtime\windows-release\tilesim-rootfs.tar")
            )
        }
        if ([string]::IsNullOrWhiteSpace($WslRootfsTar)) {
            $WslRootfsTar = Read-RequiredPath -Prompt "WSL rootfs tar path (tested wsl --import tar)" -PathType Leaf
        }
        if ([string]::IsNullOrWhiteSpace($RuntimeMetadataPath)) {
            $RuntimeMetadataPath = Find-FirstExistingFile @(
                (Join-Path $webRoot "runtime\tilesim-runtime.json"),
                (Join-Path $webRoot "runtime\backend-current.json")
            )
        }
        if ([string]::IsNullOrWhiteSpace($RuntimeMetadataPath)) {
            $RuntimeMetadataPath = Read-RequiredPath -Prompt "Runtime metadata JSON path" -PathType Leaf
        }
    }
    if ([string]::IsNullOrWhiteSpace($OutputDirectory)) {
        $OutputDirectory = Join-Path $webRoot "runtime\windows-release"
    }

    Write-Step "Preflight"
    $global:LASTEXITCODE = 0
    & (Join-Path $webRoot "scripts\doctor.ps1") -RuntimeKind $RuntimeKind -SkipWebView2 -SkipPortCheck
    if ($LASTEXITCODE -ne 0) { throw "Windows publishing preflight failed." }

    Write-Step "Build and package"
    $packageParameters = @{
        Version = $Version
        OutputDirectory = $OutputDirectory
        RuntimeKind = $RuntimeKind
        BackendSourceRoot = $BackendSourceRoot
        BackendResourceRoot = $BackendResourceRoot
    }
    if ($BackendCliPath) { $packageParameters.BackendCliPath = $BackendCliPath }
    if ($WslRootfsTar) { $packageParameters.WslRootfsTar = $WslRootfsTar }
    if ($RuntimeMetadataPath) { $packageParameters.RuntimeMetadataPath = $RuntimeMetadataPath }
    if ($AllowDirty) { $packageParameters.AllowDirty = $true }
    if ($SkipValidation) { $packageParameters.SkipValidation = $true }
    if ($SkipWebBuild) { $packageParameters.SkipWebBuild = $true }
    $global:LASTEXITCODE = 0
    & (Join-Path $webRoot "scripts\package-windows-release.ps1") @packageParameters
    if ($LASTEXITCODE -ne 0) { throw "Windows release packaging failed." }

    Write-Step "Complete"
    Write-Host "The verified runtime ZIP and SHA-256 manifests are in: $([System.IO.Path]::GetFullPath($OutputDirectory))" -ForegroundColor Green
    Write-Host "The manifest is intentionally marked runtime_zip_only_installer_pending until the signed installer is implemented." -ForegroundColor Yellow
    if (-not $env:TILESIM_PUBLISH_NO_EXPLORER) {
        Start-Process explorer.exe -ArgumentList ("/select,`"{0}`"" -f (Join-Path ([System.IO.Path]::GetFullPath($OutputDirectory)) ("TileSimWebRuntime-{0}-x64.zip" -f $Version)))
    }
} catch {
    Write-Host "`nPublishing stopped: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
