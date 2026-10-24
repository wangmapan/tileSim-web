param(
    [string]$PayloadRoot = "",
    [string]$PayloadZipPath = "",
    [ValidateSet("install", "upgrade", "rollback", "validate")]
    [string]$Mode = "install",
    [string]$InstallRoot = (Join-Path $env:ProgramFiles "TileSim\Workbench"),
    [string]$DataRoot = (Join-Path $env:LocalAppData "TileSim"),
    [int]$KeepReleases = 2,
    [switch]$AllowUnverifiedRuntime
)

$ErrorActionPreference = "Stop"

function Write-Utf8Json {
    param([Parameter(Mandatory = $true)][string]$Path, [Parameter(Mandatory = $true)]$Value)
    $fullPath = [System.IO.Path]::GetFullPath($Path)
    New-Item -ItemType Directory -Path (Split-Path -Parent $fullPath) -Force | Out-Null
    $temporary = "$fullPath.$PID.tmp"
    try {
        [System.IO.File]::WriteAllText($temporary, (($Value | ConvertTo-Json -Depth 20) + "`n"), [System.Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporary -Destination $fullPath -Force
    } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
    }
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

function Assert-ChildPath {
    param([Parameter(Mandatory = $true)][string]$Parent, [Parameter(Mandatory = $true)][string]$Child)
    $parentPath = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
    $childPath = [System.IO.Path]::GetFullPath($Child)
    if (-not $childPath.StartsWith($parentPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Path escapes the managed install root: $Child"
    }
}

function Test-PayloadFiles {
    param(
        [Parameter(Mandatory = $true)][string]$PayloadPath,
        [Parameter(Mandatory = $true)]$Manifest
    )
    $sumsPath = Join-Path $PayloadPath "PAYLOAD-SHA256SUMS"
    if (-not (Test-Path -LiteralPath $sumsPath -PathType Leaf)) { throw "Payload PAYLOAD-SHA256SUMS is missing." }
    $sumLines = @(Get-Content -LiteralPath $sumsPath | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    if ($sumLines.Count -ne [int]$Manifest.payload.file_count) {
        throw "Payload file count does not match release.json."
    }
    $entries = foreach ($line in $sumLines) {
        if ($line -notmatch '^([0-9a-fA-F]{64})\s{2}payload/(.+)$') { throw "Invalid PAYLOAD-SHA256SUMS line." }
        $expected = $matches[1].ToLowerInvariant()
        $relative = $matches[2] -replace '/', '\\'
        $filePath = [System.IO.Path]::GetFullPath((Join-Path $PayloadPath $relative))
        Assert-ChildPath -Parent $PayloadPath -Child $filePath
        if (-not (Test-Path -LiteralPath $filePath -PathType Leaf)) { throw "Payload file is missing: $relative" }
        $actual = Get-Sha256 -Path $filePath
        if ($actual -ne $expected) { throw "Payload SHA-256 mismatch: $relative" }
        [ordered]@{ path = ($matches[2] -replace '\\', '/'); bytes = [UInt64](Get-Item -LiteralPath $filePath).Length; sha256 = $actual }
    }
    $totalBytes = [UInt64]0
    foreach ($entry in @($entries)) { $totalBytes += [UInt64]$entry["bytes"] }
    if ($totalBytes -ne [UInt64]$Manifest.payload.total_bytes) { throw "Payload byte count does not match release.json." }
    $canonical = (@($entries) | ConvertTo-Json -Depth 8 -Compress)
    $digestBytes = [System.Text.Encoding]::UTF8.GetBytes($canonical)
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $digest = ([BitConverter]::ToString($sha.ComputeHash($digestBytes))).Replace('-', '').ToLowerInvariant() } finally { $sha.Dispose() }
    if ($digest -ne [string]$Manifest.payload.digest) { throw "Payload inventory digest does not match release.json." }
    return $true
}

$temporaryPayloadRoot = $null
$payloadPath = $null
$manifest = $null
if ($Mode -ne "rollback") {
    if ([string]::IsNullOrWhiteSpace($PayloadRoot) -eq ([string]::IsNullOrWhiteSpace($PayloadZipPath))) {
        throw "Provide exactly one of -PayloadRoot or -PayloadZipPath."
    }
    if (-not [string]::IsNullOrWhiteSpace($PayloadZipPath)) {
        if (-not (Test-Path -LiteralPath $PayloadZipPath -PathType Leaf)) { throw "Payload ZIP was not found: $PayloadZipPath" }
        $temporaryPayloadRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("tilesim-payload-{0}-{1}" -f $PID, [guid]::NewGuid().ToString("N"))
        New-Item -ItemType Directory -Path $temporaryPayloadRoot -Force | Out-Null
        Expand-Archive -LiteralPath $PayloadZipPath -DestinationPath $temporaryPayloadRoot -Force
        $candidate = Join-Path $temporaryPayloadRoot "payload"
        if (Test-Path -LiteralPath (Join-Path $candidate "release.json") -PathType Leaf) { $PayloadRoot = $candidate } else { $PayloadRoot = $temporaryPayloadRoot }
    }
    $payloadPath = (Resolve-Path -LiteralPath $PayloadRoot).Path
    $manifestPath = Join-Path $payloadPath "release.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw "Payload release.json is missing: $manifestPath" }
    $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
    if ($manifest.schema_version -ne "tilesim.workbench.release.v1") { throw "Unsupported TileSim release manifest schema." }
    Test-PayloadFiles -PayloadPath $payloadPath -Manifest $manifest | Out-Null
    if ($manifest.release_id -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') { throw "Invalid release_id in payload manifest." }
    if ($manifest.implementation_status -eq "runtime_zip_only_installer_pending" -and -not $AllowUnverifiedRuntime -and $Mode -ne "validate") {
        throw "This payload does not yet contain the packaged launcher/installer runtime. Use the completed signed installer payload, or pass -AllowUnverifiedRuntime only for development staging."
    }
}

$releaseRoot = $null
$stagingRoot = $null
if ($null -ne $manifest) {
    $releaseRoot = [System.IO.Path]::GetFullPath((Join-Path $InstallRoot ("releases\{0}" -f $manifest.release_id)))
    $stagingRoot = [System.IO.Path]::GetFullPath((Join-Path $InstallRoot (".staging-{0}-{1}" -f $manifest.release_id, $PID)))
}
$currentPath = [System.IO.Path]::GetFullPath((Join-Path $InstallRoot "current.json"))
$previousPath = [System.IO.Path]::GetFullPath((Join-Path $InstallRoot "previous.json"))
if ($null -ne $manifest) {
    Assert-ChildPath -Parent $InstallRoot -Child $releaseRoot
    Assert-ChildPath -Parent $InstallRoot -Child $stagingRoot
}

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $InstallRoot "releases") -Force | Out-Null
New-Item -ItemType Directory -Path $DataRoot -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DataRoot "config") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DataRoot "runs") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $DataRoot "logs") -Force | Out-Null

if ($Mode -eq "validate") {
    [ordered]@{
        schema_version = "tilesim.windows_install_validation.v1"
        release_id = $manifest.release_id
        version = $manifest.version
        runtime_kind = $manifest.runtime_kind
        implementation_status = $manifest.implementation_status
        payload_root = $payloadPath
        install_root = [System.IO.Path]::GetFullPath($InstallRoot)
        data_root = [System.IO.Path]::GetFullPath($DataRoot)
        ready_for_transaction = ($manifest.implementation_status -ne "runtime_zip_only_installer_pending")
    } | ConvertTo-Json -Depth 8
    if ($temporaryPayloadRoot -and (Test-Path -LiteralPath $temporaryPayloadRoot)) { Remove-Item -LiteralPath $temporaryPayloadRoot -Recurse -Force -ErrorAction SilentlyContinue }
    exit 0
}

if ($Mode -eq "rollback") {
    if (-not (Test-Path -LiteralPath $previousPath -PathType Leaf)) { throw "No previous release pointer is available for rollback." }
    $previous = Get-Content -Raw -LiteralPath $previousPath | ConvertFrom-Json
    if (-not $previous.release_id) { throw "Previous release pointer is invalid." }
    $previousRoot = [System.IO.Path]::GetFullPath((Join-Path $InstallRoot ("releases\{0}" -f $previous.release_id)))
    Assert-ChildPath -Parent $InstallRoot -Child $previousRoot
    if (-not (Test-Path -LiteralPath $previousRoot -PathType Container)) { throw "Previous release directory is missing: $previousRoot" }
    Write-Utf8Json -Path $currentPath -Value $previous
    [ordered]@{ schema_version = "tilesim.windows_install_transaction.v1"; mode = "rollback"; current = $previous } | ConvertTo-Json -Depth 8
    if ($temporaryPayloadRoot -and (Test-Path -LiteralPath $temporaryPayloadRoot)) { Remove-Item -LiteralPath $temporaryPayloadRoot -Recurse -Force -ErrorAction SilentlyContinue }
    exit 0
}

try {
    if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }
    New-Item -ItemType Directory -Path $stagingRoot -Force | Out-Null
    Get-ChildItem -LiteralPath $payloadPath -Force | Copy-Item -Destination $stagingRoot -Recurse -Force
    if (-not (Test-Path -LiteralPath (Join-Path $stagingRoot "release.json") -PathType Leaf)) { throw "Staging copy does not contain release.json." }
    if (Test-Path -LiteralPath $releaseRoot) {
        $existing = Get-Content -Raw -LiteralPath (Join-Path $releaseRoot "release.json") | ConvertFrom-Json
        if ($existing.payload.digest -ne $manifest.payload.digest) { throw "Release ID already exists with a different payload digest." }
        Remove-Item -LiteralPath $stagingRoot -Recurse -Force
    } else {
        Move-Item -LiteralPath $stagingRoot -Destination $releaseRoot
    }

    $current = [ordered]@{
        schema_version = "tilesim.windows_current_release.v1"
        release_id = [string]$manifest.release_id
        version = [string]$manifest.version
        release_path = $releaseRoot
        runtime_kind = [string]$manifest.runtime_kind
        payload_digest = [string]$manifest.payload.digest
        data_root = [System.IO.Path]::GetFullPath($DataRoot)
        activated_at = [DateTimeOffset]::Now.ToString("o")
        health = "not_run"
    }
    if (Test-Path -LiteralPath $currentPath -PathType Leaf) {
        Copy-Item -LiteralPath $currentPath -Destination $previousPath -Force
    }
    Write-Utf8Json -Path $currentPath -Value $current

    $releaseDirectories = @(Get-ChildItem -LiteralPath (Join-Path $InstallRoot "releases") -Directory | Sort-Object LastWriteTimeUtc -Descending)
    if ($KeepReleases -lt 1) { $KeepReleases = 1 }
    foreach ($old in ($releaseDirectories | Select-Object -Skip $KeepReleases)) {
        if ($old.FullName -eq $releaseRoot) { continue }
        Remove-Item -LiteralPath $old.FullName -Recurse -Force
    }
    [ordered]@{
        schema_version = "tilesim.windows_install_transaction.v1"
        mode = $Mode
        current = $current
        health = "not_run"
        warning = "Payload transaction completed; Bridge health/smoke integration is still required before production distribution."
    } | ConvertTo-Json -Depth 8
} catch {
    if (Test-Path -LiteralPath $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force -ErrorAction SilentlyContinue }
    throw
} finally {
    if ($temporaryPayloadRoot -and (Test-Path -LiteralPath $temporaryPayloadRoot)) { Remove-Item -LiteralPath $temporaryPayloadRoot -Recurse -Force -ErrorAction SilentlyContinue }
}
