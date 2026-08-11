<#
  Installs the MCP Bridge CEP panel on Windows.

    powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
    powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1 -Uninstall
#>

param(
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"

$BundleId = "com.idatsuka.adobebridge"
$RepoDir  = Split-Path -Parent $PSScriptRoot
$Source   = Join-Path $RepoDir "cep\$BundleId"
$TargetDir = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$Target   = Join-Path $TargetDir $BundleId

if ($Uninstall) {
    if (Test-Path $Target) {
        Remove-Item -Recurse -Force $Target
        Write-Host "Removed $Target"
    } else {
        Write-Host "Nothing to remove at $Target"
    }
    exit 0
}

if (-not (Test-Path $Source)) {
    throw "Cannot find the panel at $Source"
}

# Unsigned panels only load when PlayerDebugMode is on. The CSXS version differs
# per application release, so set it for every version currently in the wild.
Write-Host "Enabling PlayerDebugMode..."
foreach ($v in 6..12) {
    $key = "HKCU:\Software\Adobe\CSXS.$v"
    if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
    New-ItemProperty -Path $key -Name "PlayerDebugMode" -Value "1" -PropertyType String -Force | Out-Null
}

New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
if (Test-Path $Target) { Remove-Item -Recurse -Force $Target }
Copy-Item -Recurse -Force $Source $Target

Write-Host "Copied panel to $Target"
Write-Host ""
Write-Host "Done. Next:"
Write-Host "  1. Quit and relaunch Premiere Pro (a full quit, not just closing the project)."
Write-Host "  2. Window > Extensions > MCP Bridge."
Write-Host "  3. The panel should read Connected once the MCP server is running."
