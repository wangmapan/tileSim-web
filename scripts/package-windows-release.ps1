param(
    [string]$Version = "",
    [string]$OutputDirectory = (Join-Path $PSScriptRoot "..\runtime\windows-release"),
    [string]$BackendSourceRoot = "",
    [string]$BackendRevision = "",
    [string]$RuntimeMetadataPath = "",
    [ValidateSet("wsl-prebuilt", "windows-native")]
    [string]$RuntimeKind = "wsl-prebuilt",
    [string]$WslRootfsTar = "",
    [string]$BackendCliPath = "",
    [string]$BackendResourceRoot = "",
    [string]$LauncherPath = "",
    [string]$InstallerPath = "",
    [switch]$AllowDirty,
    [switch]$SkipValidation,
    [switch]$SkipWebBuild
)

$ErrorActionPreference = "Stop"
Import-Module Microsoft.PowerShell.Utility -ErrorAction Stop
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$packageJsonPath = Join-Path $webRoot "package.json"

if (-not [string]::IsNullOrWhiteSpace($InstallerPath)) {
    throw "-InstallerPath is reserved until the signed launcher payload is embedded in the NSIS installer; this command currently emits the verified runtime ZIP only."
}

function Throw-Usage {
    param([Parameter(Mandatory = $true)][string]$Message)
    throw "$Message`nWSL example: .\scripts\package-windows-release.ps1 -Version 0.3.0 -RuntimeMetadataPath E:\artifacts\tilesim-runtime.json -WslRootfsTar E:\artifacts\tilesim-rootfs.tar`nNative example: .\scripts\package-windows-release.ps1 -Version 0.3.0 -RuntimeKind windows-native -BackendCliPath D:\tileSim\build-ca1\Release\TileSimCLI.exe"
}

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)
    $algorithm = [System.Security.Cryptography.SHA256]::Create()
    $stream = [System.IO.File]::OpenRead($Path)
    try {
        return ([BitConverter]::ToString($algorithm.ComputeHash($stream))).Replace('-', '').ToLowerInvariant()
    } finally {
        $stream.Dispose()
        $algorithm.Dispose()
    }
}

function Get-GitValue {
    param([Parameter(Mandatory = $true)][string]$Root, [Parameter(Mandatory = $true)][string[]]$Arguments)
    $value = (& git -C $Root @Arguments 2>$null | Select-Object -Last 1)
    if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace([string]$value)) { return "" }
    return ([string]$value).Trim().ToLowerInvariant()
}

function Assert-Revision {
    param([Parameter(Mandatory = $true)][string]$Value, [Parameter(Mandatory = $true)][string]$Name)
    if ($Value -notmatch '^[0-9a-f]{40}$') { Throw-Usage "$Name must be a full lowercase Git revision." }
}

function Copy-Directory {
    param([Parameter(Mandatory = $true)][string]$Source, [Parameter(Mandatory = $true)][string]$Destination)
    if (-not (Test-Path -LiteralPath $Source -PathType Container)) { Throw-Usage "Required directory is missing: $Source" }
    New-Item -ItemType Directory -Path $Destination -Force | Out-Null
    Get-ChildItem -LiteralPath $Source -Force | Copy-Item -Destination $Destination -Recurse -Force
}

function Remove-PayloadDevelopmentFiles {
    param([Parameter(Mandatory = $true)][string]$Root)
    $excludedDirectories = @(".git", "__pycache__", ".pytest_cache", ".mypy_cache", "runs", "test-results")
    foreach ($directory in @(Get-ChildItem -LiteralPath $Root -Directory -Recurse -Force |
        Where-Object { $excludedDirectories -contains $_.Name } |
        Sort-Object FullName -Descending)) {
        Remove-Item -LiteralPath $directory.FullName -Recurse -Force
    }
    foreach ($file in @(Get-ChildItem -LiteralPath $Root -File -Recurse -Force |
        Where-Object { $_.Name -like ".env*" -or $_.Name -in @(".gitignore", ".gitattributes") -or $_.Name -like "*.local.json" -or $_.Name -like "*.secret*" -or $_.Name -like "*credential*" -or $_.Name -like "test_*" -or $_.Name -like "*_test.*" })) {
        Remove-Item -LiteralPath $file.FullName -Force
    }
}

function Assert-PayloadSafe {
    param([Parameter(Mandatory = $true)][string]$Root)
    $unsafe = @(Get-ChildItem -LiteralPath $Root -File -Recurse -Force |
        Where-Object { $_.Name -like ".env*" -or $_.Name -in @(".gitignore", ".gitattributes") -or $_.Name -like "*.local.json" -or $_.Name -like "*.secret*" -or $_.Name -like "*credential*" })
    if ($unsafe.Count -gt 0) {
        throw "Refusing to package credential-like files: $($unsafe.FullName -join ', ')"
    }
}

function Write-Utf8Json {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Value)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    New-Item -ItemType Directory -Path (Split-Path -Parent $fullPath) -Force | Out-Null
    [System.IO.File]::WriteAllText($fullPath, (($Value | ConvertTo-Json -Depth 20) + "`n"), [System.Text.UTF8Encoding]::new($false))
}

function Get-DirectoryInventory {
    param([Parameter(Mandatory = $true)][string]$Root)
    $rootPath = (Resolve-Path -LiteralPath $Root).Path
    $files = Get-ChildItem -LiteralPath $rootPath -File -Recurse -Force |
        Where-Object { $_.FullName -notmatch '[\\/]\.git([\\/]|$)' -and $_.FullName -notmatch '[\\/]runs([\\/]|$)' } |
        Sort-Object FullName
    $entries = foreach ($file in $files) {
        $relative = $file.FullName.Substring($rootPath.Length).TrimStart('\', '/') -replace '\\', '/'
        [ordered]@{
            path = $relative
            bytes = [UInt64]$file.Length
            sha256 = Get-Sha256 -Path $file.FullName
        }
    }
    $canonical = ($entries | ConvertTo-Json -Depth 8 -Compress)
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $digest = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    [UInt64]$totalBytes = 0
    foreach ($entry in @($entries)) { $totalBytes += [UInt64]$entry["bytes"] }
    return [ordered]@{
        file_count = @($entries).Count
        total_bytes = [UInt64]$totalBytes
        digest = $digest
        files = @($entries)
    }
}

if ([string]::IsNullOrWhiteSpace($Version)) {
    $Version = ([System.IO.File]::ReadAllText($packageJsonPath) | ConvertFrom-Json).version
}
if ($Version -notmatch '^[0-9A-Za-z][0-9A-Za-z.+-]{0,63}$') { Throw-Usage "Version is not a safe release identifier: $Version" }

$metadata = $null
if (-not [string]::IsNullOrWhiteSpace($RuntimeMetadataPath)) {
    if (-not (Test-Path -LiteralPath $RuntimeMetadataPath -PathType Leaf)) { Throw-Usage "Runtime metadata was not found: $RuntimeMetadataPath" }
    $metadata = Get-Content -Raw -LiteralPath $RuntimeMetadataPath | ConvertFrom-Json
    if ($metadata.runtime_kind) { $RuntimeKind = [string]$metadata.runtime_kind }
    if (-not $BackendRevision -and $metadata.backend_source_revision) { $BackendRevision = [string]$metadata.backend_source_revision }
    if (-not $BackendRevision -and $metadata.source_revision) { $BackendRevision = [string]$metadata.source_revision }
    if (-not $BackendRevision -and $metadata.build_revision) { $BackendRevision = [string]$metadata.build_revision }
}

if (-not $AllowDirty) {
    $dirty = @(git -C $webRoot status --porcelain --untracked-files=all)
    if ($LASTEXITCODE -ne 0) { Throw-Usage "Could not inspect the Web Git worktree." }
    if ($dirty.Count -gt 0) { Throw-Usage "Web worktree is dirty. Commit the release inputs or pass -AllowDirty for a disposable development package." }
}

if (-not $SkipValidation) {
    Push-Location $webRoot
    try {
        & pnpm contracts:check
        if ($LASTEXITCODE -ne 0) { throw "contracts:check failed." }
        & pnpm deps:check
        if ($LASTEXITCODE -ne 0) { throw "deps:check failed." }
        & pnpm typecheck
        if ($LASTEXITCODE -ne 0) { throw "typecheck failed." }
        & pnpm test
        if ($LASTEXITCODE -ne 0) { throw "frontend tests failed." }
        Push-Location (Join-Path $webRoot "bridge")
        try {
            & python -m unittest test_server.py test_packaged_identity.py
            if ($LASTEXITCODE -ne 0) { throw "Bridge tests failed." }
        } finally { Pop-Location }
    } finally { Pop-Location }
}

if (-not $SkipWebBuild) {
    Push-Location $webRoot
    try {
        & pnpm build
        if ($LASTEXITCODE -ne 0) { throw "Web production build failed." }
    } finally { Pop-Location }
}

foreach ($required in @((Join-Path $webRoot "dist\index.html"), (Join-Path $webRoot "bridge\server.py"))) {
    if (-not (Test-Path -LiteralPath $required -PathType Leaf)) { Throw-Usage "Required Web build input is missing: $required" }
}

if (-not $BackendRevision -and $BackendSourceRoot) { $BackendRevision = Get-GitValue -Root $BackendSourceRoot -Arguments @("rev-parse", "HEAD") }
if (-not $BackendRevision) { Throw-Usage "Provide -BackendRevision, -BackendSourceRoot, or runtime metadata with backend_source_revision." }
if (-not $BackendResourceRoot -and $BackendSourceRoot) {
    $candidateResources = Join-Path $BackendSourceRoot "docs\examples"
    if (Test-Path -LiteralPath $candidateResources -PathType Container) { $BackendResourceRoot = $candidateResources }
}
if (-not $BackendResourceRoot -or -not (Test-Path -LiteralPath $BackendResourceRoot -PathType Container)) {
    Throw-Usage "BackendResourceRoot is required and must contain the checked runtime resources (normally backend docs\\examples)."
}
Assert-Revision -Value $BackendRevision -Name "BackendRevision"
$webRevision = Get-GitValue -Root $webRoot -Arguments @("rev-parse", "HEAD")
if (-not $webRevision) { Throw-Usage "Could not resolve the Web Git revision." }
Assert-Revision -Value $webRevision -Name "Web revision"

$node = Get-Command node.exe -ErrorAction SilentlyContinue
if ($null -eq $node) { $node = Get-Command node -ErrorAction SilentlyContinue }
if ($null -eq $node) { Throw-Usage "Node.js is required to calculate release inventories." }
$webStateDigest = ((& $node.Source (Join-Path $webRoot "scripts\release-traceability.mjs") $webRoot).Trim())
$webBuildDigest = ((& $node.Source (Join-Path $webRoot "scripts\release-traceability.mjs") (Join-Path $webRoot "dist") "").Trim())
$bridgeDigest = ((& $node.Source (Join-Path $webRoot "scripts\release-traceability.mjs") (Join-Path $webRoot "bridge") "").Trim())
$schemaRevision = ((& python (Join-Path $webRoot "bridge\check_schema_set_revision.py") | Select-Object -Last 1).Trim())
if ($schemaRevision -notmatch '^sha256:[0-9a-f]{64}$') { Throw-Usage "Could not resolve the canonical schema-set revision." }

$cliDigest = ""
$rootfsDigest = ""
if ($RuntimeKind -eq "wsl-prebuilt") {
    if (-not $WslRootfsTar -and $metadata -and $metadata.rootfs_tar) { $WslRootfsTar = [string]$metadata.rootfs_tar }
    if (-not $WslRootfsTar -or -not (Test-Path -LiteralPath $WslRootfsTar -PathType Leaf)) { Throw-Usage "wsl-prebuilt requires -WslRootfsTar pointing to a tested wsl --import tar." }
    $rootfsDigest = Get-Sha256 -Path $WslRootfsTar
    if ($metadata -and $metadata.rootfs_sha256 -and ([string]$metadata.rootfs_sha256).ToLowerInvariant() -ne $rootfsDigest) { Throw-Usage "Rootfs SHA-256 does not match runtime metadata." }
    if ($metadata -and $metadata.tilesim_cli_digest) { $cliDigest = [string]$metadata.tilesim_cli_digest }
} else {
    if (-not $BackendCliPath -or -not (Test-Path -LiteralPath $BackendCliPath -PathType Leaf)) { Throw-Usage "windows-native requires -BackendCliPath pointing to TileSimCLI.exe." }
    $cliDigest = Get-Sha256 -Path $BackendCliPath
    if ($metadata -and $metadata.tilesim_cli_digest -and ([string]$metadata.tilesim_cli_digest).ToLowerInvariant() -ne $cliDigest) { Throw-Usage "Native TileSimCLI SHA-256 does not match runtime metadata." }
}
if ($cliDigest -notmatch '^[0-9a-f]{64}$') { Throw-Usage "Runtime metadata must declare tilesim_cli_digest as a lowercase SHA-256." }

$outputRoot = [System.IO.Path]::GetFullPath($OutputDirectory)
$releaseId = "{0}-{1}" -f $Version, $webRevision.Substring(0, 12)
$stagingRoot = Join-Path $outputRoot ".staging-$releaseId-$PID"
$payloadRoot = Join-Path $stagingRoot "payload"
$zipPath = Join-Path $outputRoot "TileSimWebRuntime-$Version-x64.zip"
$manifestPath = Join-Path $outputRoot "tilesim-workbench-release.json"
$sumsPath = Join-Path $outputRoot "SHA256SUMS"
if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
New-Item -ItemType Directory -Path $payloadRoot -Force | Out-Null

try {
    Copy-Directory -Source (Join-Path $webRoot "dist") -Destination (Join-Path $payloadRoot "app\web\dist")
    Copy-Directory -Source (Join-Path $webRoot "bridge") -Destination (Join-Path $payloadRoot "app\bridge")
    Copy-Directory -Source (Join-Path $webRoot "scripts") -Destination (Join-Path $payloadRoot "app\scripts")
    Remove-PayloadDevelopmentFiles -Root $payloadRoot

    if ($BackendResourceRoot) {
        $resourceDestination = Join-Path $payloadRoot "app\backend\resources\docs\examples"
        Copy-Directory -Source $BackendResourceRoot -Destination $resourceDestination
    }
    if ($RuntimeKind -eq "wsl-prebuilt") {
        New-Item -ItemType Directory -Path (Join-Path $payloadRoot "runtime\wsl") -Force | Out-Null
        Copy-Item -LiteralPath $WslRootfsTar -Destination (Join-Path $payloadRoot "runtime\wsl\tilesim-rootfs.tar")
    } else {
        New-Item -ItemType Directory -Path (Join-Path $payloadRoot "runtime\native") -Force | Out-Null
        Copy-Item -LiteralPath $BackendCliPath -Destination (Join-Path $payloadRoot "runtime\native\TileSimCLI.exe")
    }
    if ($LauncherPath) {
        if (-not (Test-Path -LiteralPath $LauncherPath -PathType Leaf)) { Throw-Usage "LauncherPath was not found: $LauncherPath" }
        New-Item -ItemType Directory -Path (Join-Path $payloadRoot "runtime\launcher") -Force | Out-Null
        Copy-Item -LiteralPath $LauncherPath -Destination (Join-Path $payloadRoot "runtime\launcher\TileSimWorkbench.exe")
    }

    $inventory = Get-DirectoryInventory -Root $payloadRoot
    $manifest = [ordered]@{
        schema_version = "tilesim.workbench.release.v1"
        release_id = $releaseId
        version = $Version
        created_at = [DateTimeOffset]::Now.ToString("o")
        web_source_revision = $webRevision
        backend_source_revision = $BackendRevision
        schema_set_revision = $schemaRevision
        deployment_mode = "packaged"
        web_source_state_digest = $webStateDigest
        web_build_digest = $webBuildDigest
        bridge_digest = $bridgeDigest
        web_release_identity = $releaseId
        web_static_digest = $webBuildDigest
        web_bridge_digest = $bridgeDigest
        tilesim_cli_digest = $cliDigest
        runtime_kind = $RuntimeKind
        minimum_windows_build = "19045"
        minimum_webview2 = "Evergreen"
        rootfs_sha256 = if ($rootfsDigest) { $rootfsDigest } else { $null }
        payload = [ordered]@{ file_count = $inventory.file_count; total_bytes = $inventory.total_bytes; digest = $inventory.digest }
        installer = [ordered]@{ included = $false; filename = $null; sha256 = $null }
        security = [ordered]@{ api_key_in_payload = $false; source_control_metadata_in_payload = $false; user_data_in_payload = $false }
        implementation_status = "runtime_zip_only_installer_pending"
    }
    Assert-PayloadSafe -Root $payloadRoot
    Write-Utf8Json -Path (Join-Path $payloadRoot "release.json") -Value $manifest

    $payloadSums = @($inventory.files | ForEach-Object { "{0}  payload/{1}" -f $_.sha256, $_.path })
    [System.IO.File]::WriteAllLines((Join-Path $payloadRoot "PAYLOAD-SHA256SUMS"), $payloadSums, [System.Text.UTF8Encoding]::new($false))
    New-Item -ItemType Directory -Path $outputRoot -Force | Out-Null
    if (Test-Path -LiteralPath $zipPath) { Remove-Item -LiteralPath $zipPath -Force }
    Compress-Archive -LiteralPath (Join-Path $stagingRoot "payload") -DestinationPath $zipPath -CompressionLevel Optimal

    Write-Utf8Json -Path $manifestPath -Value $manifest

    $filesForSums = @($zipPath, $manifestPath)
    if ($manifest.installer.included) { $filesForSums += Join-Path $outputRoot $manifest.installer.filename }
    $sumLines = foreach ($file in $filesForSums) { "{0}  {1}" -f (Get-Sha256 -Path $file), [System.IO.Path]::GetFileName($file) }
    [System.IO.File]::WriteAllLines($sumsPath, $sumLines, [System.Text.UTF8Encoding]::new($false))
    [ordered]@{
        schema_version = "tilesim.windows_release_package.v1"
        release_id = $releaseId
        runtime_kind = $RuntimeKind
        runtime_zip = $zipPath
        manifest = $manifestPath
        sha256sums = $sumsPath
        installer = if ($manifest.installer.included) { Join-Path $outputRoot $manifest.installer.filename } else { $null }
        status = $manifest.implementation_status
    } | ConvertTo-Json -Depth 8
} finally {
    if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
}
