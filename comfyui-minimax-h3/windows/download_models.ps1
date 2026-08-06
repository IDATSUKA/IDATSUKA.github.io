<#
.SYNOPSIS
    Downloads (or tops up) MiniMax H3 weights for an existing ComfyUI install.

.EXAMPLE
    .\download_models.ps1 -InstallDir D:\AI\ComfyUI -Quant int8 -Ref2va

.EXAMPLE
    # Show every file published in the repack without downloading anything
    .\download_models.ps1 -InstallDir D:\AI\ComfyUI -ListOnly
#>
[CmdletBinding()]
param(
    [string]$InstallDir = "$env:USERPROFILE\ComfyUI",
    [ValidateSet("bf16", "int8", "nvfp4", "fp8")]
    [string]$Quant = "nvfp4",
    [switch]$Ref2va,
    [switch]$ListOnly
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

$py = Join-Path $InstallDir "venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
    Write-Host "[x] No venv at $py. Run install.ps1 first, or point -InstallDir at your ComfyUI." -ForegroundColor Red
    exit 1
}

$env:HF_HUB_ENABLE_HF_TRANSFER = "1"
# Gated repos need a token: setx HF_TOKEN hf_xxx  (then reopen the terminal)

$dlScript = Join-Path $repoRoot "scripts\download_models.py"
if ($ListOnly) {
    & $py $dlScript --list
    exit $LASTEXITCODE
}

$argsList = @($dlScript, "--models-dir", (Join-Path $InstallDir "models"), "--profile", $Quant)
if ($Ref2va) { $argsList += "--ref2va" }
& $py @argsList
exit $LASTEXITCODE
