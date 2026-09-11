param(
    [Parameter(Mandatory = $true)]
    [string]$ModulePath
)

$ErrorActionPreference = "Stop"
Import-Module -LiteralPath $ModulePath -Force
Resolve-TileSimNode
