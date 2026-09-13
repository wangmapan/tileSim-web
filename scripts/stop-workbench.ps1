param(
    [string]$WslDistro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Stop"
Import-Module (Join-Path $PSScriptRoot "deployment-common.psm1") -Force
Assert-TileSimWslDistro $WslDistro
Stop-TileSimBridge -WslDistro $WslDistro
[ordered]@{
    stopped = $true
    port = 5173
} | ConvertTo-Json -Compress
