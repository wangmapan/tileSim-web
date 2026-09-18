param(
    [string]$BackendRepositoryUrl = "https://github.com/lqf0624/tileSim.git",
    [string]$BackendRepositoryRoot = "",
    [string]$BackendDeploymentRoot = "",
    [string]$WslDistro = "Ubuntu-24.04",
    [switch]$SkipBrowserInstall,
    [switch]$BuildOnly,
    [switch]$NoRestart
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "deployment-common.psm1") -Force

$webRoot = Resolve-TileSimWebRoot $PSScriptRoot
$backendRepository = Resolve-TileSimBackendRepositoryRoot $webRoot $BackendRepositoryRoot
$backendDeployment = Resolve-TileSimBackendDeploymentRoot $webRoot $BackendDeploymentRoot
$node = Resolve-TileSimNode

$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if ($null -eq $pnpm) { $pnpm = Get-Command "pnpm" -ErrorAction SilentlyContinue }
if ($null -eq $pnpm) {
    throw "pnpm was not found on PATH. Enable Corepack or install pnpm 11 before continuing."
}

if (-not $BuildOnly) {
    Assert-TileSimWslDistro $WslDistro
    $git = Get-Command "git.exe" -ErrorAction SilentlyContinue
    if ($null -eq $git) { $git = Get-Command "git" -ErrorAction SilentlyContinue }
    if ($null -eq $git) { throw "Git was not found on PATH." }

    if (-not (Test-Path -LiteralPath $backendRepository)) {
        $parent = Split-Path -Parent $backendRepository
        New-Item -ItemType Directory -Path $parent -Force | Out-Null
        & $git.Source clone --filter=blob:none $BackendRepositoryUrl $backendRepository
        if ($LASTEXITCODE -ne 0) { throw "Could not clone the TileSim backend repository." }
    } elseif (-not (Test-Path -LiteralPath (Join-Path $backendRepository ".git"))) {
        throw "BackendRepositoryRoot exists but is not a Git repository: $backendRepository"
    }

    Assert-TileSimBackendEvidenceRevisions `
        -BackendRepositoryRoot $backendRepository `
        -CatalogPath (Join-Path $webRoot "bridge/contracts/agent_orchestration_capability/catalog-content.json") `
        -GitCommand $git.Source
}

Push-Location $webRoot
try {
    & $pnpm.Source install --frozen-lockfile
    if ($LASTEXITCODE -ne 0) { throw "pnpm install failed." }
    if (-not $SkipBrowserInstall) {
        & $pnpm.Source exec playwright install chromium
        if ($LASTEXITCODE -ne 0) { throw "Playwright Chromium installation failed." }
    }
    if ($BuildOnly) {
        & $pnpm.Source build
        if ($LASTEXITCODE -ne 0) { throw "TileSim Web production build failed." }
    } else {
        & (Join-Path $PSScriptRoot "update-backend.ps1") `
            -RepositoryRoot $backendRepository `
            -BackendRoot $backendDeployment `
            -WslDistro $WslDistro `
            -NoRestart:$NoRestart
        if ($LASTEXITCODE -ne 0) { throw "TileSim backend deployment failed." }
    }
} finally {
    Pop-Location
}

[ordered]@{
    schema_version = "tilesim.workbench_bootstrap.v1"
    web_root = $webRoot
    backend_repository_root = $backendRepository
    backend_deployment_root = $backendDeployment
    wsl_distro = $WslDistro
    node = $node
    mode = if ($BuildOnly) { "frontend_build_only" } elseif ($NoRestart) { "validated_deployment_without_restart" } else { "validated_deployment" }
} | ConvertTo-Json -Compress
