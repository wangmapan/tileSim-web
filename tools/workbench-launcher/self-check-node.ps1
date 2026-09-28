param(
    [Parameter(Mandatory = $true)]
    [string]$ModulePath
)

$ErrorActionPreference = "Stop"
Import-Module -Name $ModulePath -Force
Resolve-TileSimNode
