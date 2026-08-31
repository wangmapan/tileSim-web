param(
    [string]$ManifestPath = (Join-Path $PSScriptRoot "..\runtime\backend-current.json"),
    [string]$WslDistro = "Ubuntu-24.04"
)

$ErrorActionPreference = "Stop"
$webRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$node = "C:\Users\mapanwang\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$manifestFile = (Resolve-Path -LiteralPath $ManifestPath).Path
$manifest = Get-Content -Raw -LiteralPath $manifestFile | ConvertFrom-Json
$required = @("source_revision", "tilesim_root_wsl", "tilesim_cli_wsl", "manifest_path_wsl")
foreach ($name in $required) {
    if (-not $manifest.$name) { throw "Deployment manifest is missing '$name'." }
}

if ($manifest.web_source_state_digest) {
    $actualWebSourceDigest = (& $node (Join-Path $PSScriptRoot "release-traceability.mjs") $webRoot).Trim()
    if ($LASTEXITCODE -ne 0 -or $actualWebSourceDigest -ne $manifest.web_source_state_digest) {
        throw "TileSim Web source state no longer matches the deployment manifest."
    }
}
if ($manifest.web_build_digest) {
    $actualWebBuildDigest = (& $node (Join-Path $PSScriptRoot "release-traceability.mjs") (Join-Path $webRoot "dist") "").Trim()
    if ($LASTEXITCODE -ne 0 -or $actualWebBuildDigest -ne $manifest.web_build_digest) {
        throw "TileSim Web build output no longer matches the deployment manifest."
    }
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
    "TILESIM_BUILD_STATE_DIGEST=$($manifest.build_state_digest)",
    "TILESIM_DEPLOYMENT_MANIFEST=$($manifest.manifest_path_wsl)",
    "python3", "/mnt/d/tileSim-web/bridge/server.py"
)
$launcher = Start-Process -FilePath "wsl.exe" -ArgumentList $arguments -WindowStyle Hidden -PassThru

for ($attempt = 0; $attempt -lt 8; $attempt += 1) {
    try {
        # A local worktree snapshot verifies its full tracked/untracked digest
        # on first health check. On an NTFS-mounted WSL worktree this can take
        # longer than the old eight-second request timeout even when healthy.
        $health = Invoke-RestMethod -Uri "http://127.0.0.1:5173/api/health" -Method Get -TimeoutSec 75
        $apiManifest = Invoke-RestMethod -Uri "http://127.0.0.1:5173/api/manifest" -Method Get -TimeoutSec 75
        if ($health.source_revision -eq $manifest.source_revision -and
            $health.build_revision -eq $manifest.build_revision -and
            (-not $manifest.source_state_digest -or
             ($health.source_state_digest -eq $manifest.source_state_digest -and
              $health.build_state_digest -eq $manifest.build_state_digest -and
              $health.state_digests_match)) -and
            $health.versions_match -and $health.execution_ready -and
            (-not $manifest.schema_set_revision -or
             $apiManifest.schema_set_revision -eq $manifest.schema_set_revision)) {
            [pscustomobject]@{
                launcher_pid = $launcher.Id
                source_revision = $health.source_revision
                build_revision = $health.build_revision
                source_state_digest = $health.source_state_digest
                web_source_state_digest = $manifest.web_source_state_digest
                web_build_digest = $manifest.web_build_digest
                schema_set_revision = $apiManifest.schema_set_revision
                deployment_ref = $health.deployment_ref
                execution_ready = $health.execution_ready
            } | ConvertTo-Json
            exit 0
        }
    } catch {
        # The relay may need a moment to bind after the WSL process starts.
    }
    Start-Sleep -Milliseconds 500
}

throw "TileSim Web bridge did not start with the deployed source/build revision."
