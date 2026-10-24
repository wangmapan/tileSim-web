param(
    [ValidateSet("wsl-prebuilt", "windows-native")]
    [string]$RuntimeKind = "wsl-prebuilt",
    [string]$WslDistro = "Ubuntu-24.04",
    [int]$Port = 5173,
    [string]$InstallRoot = "",
    [UInt64]$MinimumFreeBytes = 2147483648,
    [string]$JsonPath = "",
    [switch]$SkipWebView2,
    [switch]$SkipPortCheck
)

$ErrorActionPreference = "Stop"

function New-Check {
    param(
        [Parameter(Mandatory = $true)][string]$Id,
        [Parameter(Mandatory = $true)][string]$Label,
        [Parameter(Mandatory = $true)][bool]$Ready,
        [Parameter(Mandatory = $true)][string]$Summary,
        [string]$Detail = "",
        [bool]$Required = $true
    )
    $status = "warning"
    if ($Ready) { $status = "ready" } elseif ($Required) { $status = "blocked" }
    $result = [ordered]@{ id = $Id; label = $Label; status = $status; ready = $Ready; required = $Required; summary = $Summary }
    if (-not [string]::IsNullOrWhiteSpace($Detail)) { $result.detail = $Detail }
    return $result
}

function Test-WebView2Installed {
    $paths = @(
        "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}",
        "HKCU:\SOFTWARE\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
    )
    foreach ($path in $paths) {
        if (Test-Path -LiteralPath $path) {
            $version = (Get-ItemProperty -LiteralPath $path -ErrorAction SilentlyContinue).pv
            return [pscustomobject]@{ installed = $true; version = [string]$version }
        }
    }
    return [pscustomobject]@{ installed = $false; version = "" }
}

function Test-PortListening {
    param([Parameter(Mandatory = $true)][int]$PortNumber)
    try {
        $connection = Get-NetTCPConnection -LocalPort $PortNumber -State Listen -ErrorAction Stop | Select-Object -First 1
        if ($null -ne $connection) { return [pscustomobject]@{ listening = $true; owner_pid = [int]$connection.OwningProcess } }
    } catch { }
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $PortNumber)
        $listener.Start()
        return [pscustomobject]@{ listening = $false; owner_pid = $null }
    } catch {
        return [pscustomobject]@{ listening = $true; owner_pid = $null }
    } finally {
        if ($null -ne $listener) { $listener.Stop() }
    }
}

function Get-FreeBytes {
    param([Parameter(Mandatory = $true)][string]$Path)
    $resolved = [System.IO.Path]::GetFullPath($Path)
    $root = [System.IO.Path]::GetPathRoot($resolved)
    if ([string]::IsNullOrWhiteSpace($root)) { throw "Could not resolve disk root for '$Path'." }
    $deviceId = $root.TrimEnd('\')
    $disk = Get-CimInstance Win32_LogicalDisk -Filter ("DeviceID='{0}'" -f $deviceId) -ErrorAction Stop
    if ($null -eq $disk) { throw "Could not read free space for $deviceId." }
    return [UInt64]$disk.FreeSpace
}

$checks = [System.Collections.Generic.List[object]]::new()
$osVersion = [Environment]::OSVersion.Version
$isWindows = $env:OS -eq "Windows_NT"
$is64Bit = [Environment]::Is64BitOperatingSystem
$windowsReady = $isWindows -and ($osVersion.Build -ge 19045)
$checks.Add((New-Check -Id "windows" -Label "Windows" -Ready $windowsReady -Summary ("Windows build {0}" -f $osVersion.Build) -Detail "Requires Windows 10 22H2 / build 19045 or newer."))
$architectureSummary = "32-bit operating system detected"
if ($is64Bit) { $architectureSummary = "64-bit operating system" }
$checks.Add((New-Check -Id "architecture" -Label "x64" -Ready $is64Bit -Summary $architectureSummary))

if ($SkipWebView2) {
    $checks.Add((New-Check -Id "webview2" -Label "WebView2" -Ready $true -Required $false -Summary "Check skipped"))
} else {
    $webview = Test-WebView2Installed
    $webviewSummary = "Evergreen Runtime not detected"
    if ($webview.installed) { $webviewSummary = "Evergreen Runtime $($webview.version)" }
    $checks.Add((New-Check -Id "webview2" -Label "WebView2" -Ready $webview.installed -Summary $webviewSummary -Detail "WebView2 Evergreen Runtime is required."))
}

if ($RuntimeKind -eq "wsl-prebuilt") {
    $wsl = Get-Command "wsl.exe" -ErrorAction SilentlyContinue
    $wslReady = $false
    $wslSummary = "wsl.exe not found"
    $wslDetail = "Requires WSL2, virtualization, and a managed distribution."
    if ($null -ne $wsl) {
        $output = @(& $wsl.Source --list --quiet 2>$null)
        $wslReady = $LASTEXITCODE -eq 0 -and ($output -join "`n") -match [regex]::Escape($WslDistro)
        if ($wslReady) {
            $wslSummary = "Found distribution $WslDistro"
        } else {
            $wslSummary = "Distribution $WslDistro is not available"
            $wslDetail = "Install and start the distribution before running the installer."
        }
    }
    $checks.Add((New-Check -Id "wsl" -Label "WSL2" -Ready $wslReady -Summary $wslSummary -Detail $wslDetail))
} else {
    $checks.Add((New-Check -Id "wsl" -Label "WSL2" -Ready $true -Required $false -Summary "windows-native runtime does not require WSL2"))
}

if ($SkipPortCheck) {
    $checks.Add((New-Check -Id "port" -Label "Local port" -Ready $true -Required $false -Summary "Check skipped"))
} else {
    if ($Port -lt 1 -or $Port -gt 65535) { throw "Port must be between 1 and 65535." }
    $portState = Test-PortListening -PortNumber $Port
    $portReady = -not $portState.listening
    $portSummary = "Port is occupied"
    if ($portReady) { $portSummary = "127.0.0.1:$Port is available" }
    elseif ($null -ne $portState.owner_pid) { $portSummary = "Port is occupied by PID $($portState.owner_pid)" }
    $checks.Add((New-Check -Id "port" -Label "Local port" -Ready $portReady -Summary $portSummary -Detail "The installer must not terminate unrelated processes."))
}

$diskPath = $InstallRoot
if ([string]::IsNullOrWhiteSpace($diskPath)) { $diskPath = $env:ProgramFiles }
$freeBytes = Get-FreeBytes -Path $diskPath
$diskReady = $freeBytes -ge $MinimumFreeBytes
$checks.Add((New-Check -Id "disk" -Label "Disk space" -Ready $diskReady -Summary ("{0:N0} MB free" -f ($freeBytes / 1MB)) -Detail ("Minimum {0:N0} MB; increase based on the rootfs size." -f ($MinimumFreeBytes / 1MB))))

$result = [ordered]@{
    schema_version = "tilesim.windows_doctor.v1"
    checked_at = [DateTimeOffset]::Now.ToString("o")
    runtime_kind = $RuntimeKind
    wsl_distro = $WslDistro
    port = $Port
    install_root = $diskPath
    checks = @($checks)
    ready = (@($checks | Where-Object { $_.required -and -not $_.ready }).Count -eq 0)
}
$json = $result | ConvertTo-Json -Depth 8
Write-Output $json
if (-not [string]::IsNullOrWhiteSpace($JsonPath)) {
    $fullJsonPath = [System.IO.Path]::GetFullPath($JsonPath)
    New-Item -ItemType Directory -Path (Split-Path -Parent $fullJsonPath) -Force | Out-Null
    [System.IO.File]::WriteAllText($fullJsonPath, "$json`n", [System.Text.UTF8Encoding]::new($false))
}
if (-not $result.ready) { exit 2 }
