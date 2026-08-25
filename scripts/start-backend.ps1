param(
    [string]$ManifestPath = (Join-Path $PSScriptRoot "..\runtime\backend-current.json"),
    [string]$WslDistro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Stop"
$manifestFile = (Resolve-Path -LiteralPath $ManifestPath).Path
$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$required = @("source_revision", "tilesim_root_wsl", "tilesim_cli_wsl", "manifest_path_wsl")
foreach ($name in $required) {
    if (-not $manifest.$name) { throw "Deployment manifest is missing '$name'." }
}

& wsl.exe -d $WslDistro --exec sh -lc "pkill -f '^python3 /mnt/d/tileSim-web/bridge/server.py$' || true"
if ($LASTEXITCODE -ne 0) { throw "Could not stop the previous TileSim Web bridge." }
Start-Sleep -Milliseconds 350

$arguments = @(
    "-d", $WslDistro,
    "--exec", "env",
    "TILESIM_ROOT=$($manifest.tilesim_root_wsl)",
    "TILESIM_CLI=$($manifest.tilesim_cli_wsl)",
    "TILESIM_BUILD_REVISION=$($manifest.build_revision)",
    "TILESIM_DEPLOYMENT_MANIFEST=$($manifest.manifest_path_wsl)",
    "python3", "/mnt/d/tileSim-web/bridge/server.py"
)
$launcher = Start-Process -FilePath "wsl.exe" -ArgumentList $arguments -WindowStyle Hidden -PassThru

for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    try {
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:5173/api/health" -Method Get -TimeoutSec 2
        if ($health.source_revision -eq $manifest.source_revision -and
            $health.build_revision -eq $manifest.build_revision -and
            $health.versions_match -and $health.execution_ready) {
            [pscustomobject]@{
                launcher_pid = $launcher.Id
                source_revision = $health.source_revision
                build_revision = $health.build_revision
                deployment_ref = $health.deployment_ref
                execution_ready = $health.execution_ready
            } | ConvertTo-Json
            exit 0
        }
    } catch {
        # The relay may need a moment to bind after the WSL process starts.
    }
    Start-Sleep -Milliseconds 250
}

throw "TileSim Web bridge did not start with the deployed source/build revision."
