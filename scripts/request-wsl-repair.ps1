param(
    [string]$WslDistro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Stop"
$repairScript = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "repair-wsl-service.ps1")).Path
$resultPath = Join-Path ([System.IO.Path]::GetTempPath()) "tilesim-wsl-repair-$PID.json"
$arguments = (
    '-NoLogo -NoProfile -ExecutionPolicy Bypass -File "{0}" -WslDistro "{1}" -ResultPath "{2}"' -f
    $repairScript,
    $WslDistro.Replace('"', ''),
    $resultPath
)

try {
    try {
        $process = Start-Process `
            -FilePath "powershell.exe" `
            -ArgumentList $arguments `
            -Verb RunAs `
            -WindowStyle Hidden `
            -Wait `
            -PassThru
    } catch {
        throw "TILESIM_WSL_REPAIR_CANCELLED: Administrator approval is required to repair WSL."
    }

    $result = $null
    if (Test-Path -LiteralPath $resultPath) {
        $result = Get-Content -Raw -LiteralPath $resultPath | ConvertFrom-Json
    }
    if ($process.ExitCode -ne 0 -or $null -eq $result -or $result.ready -ne $true) {
        $detail = if ($null -ne $result -and $result.error) {
            [string]$result.error
        } else {
            "The elevated WSL repair did not return a valid result."
        }
        throw $detail
    }
    $result | ConvertTo-Json -Compress
} finally {
    if (Test-Path -LiteralPath $resultPath) {
        Remove-Item -LiteralPath $resultPath -Force -ErrorAction SilentlyContinue
    }
}
