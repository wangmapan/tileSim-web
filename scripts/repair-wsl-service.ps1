#Requires -RunAsAdministrator

param(
    [string]$WslDistro = "Ubuntu-24.04",
    [string]$ResultPath = ""
)

$ErrorActionPreference = "Stop"

trap {
    if ($ResultPath) {
        [ordered]@{
            schema_version = "tilesim.wsl_repair.v1"
            ready = $false
            error = $_.Exception.Message
        } | ConvertTo-Json -Compress | Set-Content -LiteralPath $ResultPath -Encoding UTF8
    }
    exit 1
}

$wslCommand = Get-Command "wsl.exe" -ErrorAction SilentlyContinue
if ($null -eq $wslCommand) {
    throw "Windows Subsystem for Linux is not installed."
}

$service = Get-CimInstance Win32_Service -Filter "Name='WslService'" -ErrorAction SilentlyContinue
if ($null -eq $service) {
    # A Store-delivered WSL package installs the service on its first elevated
    # invocation. Running --status here lets that supported installer path
    # complete without exposing a console window from the desktop launcher.
    & $wslCommand.Source --status
    if ($LASTEXITCODE -ne 0) {
        throw "WSL could not install its Windows service."
    }
} elseif ($service.StartMode -eq "Disabled") {
    $serviceConfigOutput = & sc.exe config WslService start= demand 2>&1
    if ($LASTEXITCODE -ne 0) {
        if (($serviceConfigOutput -join " ") -match "1072") {
            throw (
                "TILESIM_WSL_SERVICE_PENDING_DELETE: Windows has marked WslService for deletion. " +
                "Restart Windows once, then run this repair script again as Administrator."
            )
        }
        throw "The WSL Service startup type could not be restored: $($serviceConfigOutput -join ' ')"
    }
}

Start-Service -Name "WslService"
$service = Get-Service -Name "WslService"
if ($service.Status -ne "Running") {
    throw "The WSL Service did not reach the running state."
}

& $wslCommand.Source -d $WslDistro --exec true
if ($LASTEXITCODE -ne 0) {
    throw "WSL is running, but distribution '$WslDistro' could not start."
}

$result = [ordered]@{
    schema_version = "tilesim.wsl_repair.v1"
    service = $service.Name
    status = [string]$service.Status
    startup_type = [string]$service.StartType
    distribution = $WslDistro
    ready = $true
} | ConvertTo-Json -Compress

if ($ResultPath) {
    $result | Set-Content -LiteralPath $ResultPath -Encoding UTF8
}
$result
