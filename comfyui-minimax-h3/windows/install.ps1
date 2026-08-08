<#
.SYNOPSIS
    Installs ComfyUI + MiniMax H3 on Windows.

.DESCRIPTION
    Two modes:

    Local weights (default) - needs an NVIDIA GPU with 24GB+ VRAM and compute
    capability 8.0+. Clones ComfyUI at a revision that ships the native MiniMax
    H3 nodes, builds a venv with CUDA 13.0 PyTorch, downloads the weights for the
    chosen quantization profile, and writes run_comfyui.bat.

        .\install.ps1 -InstallDir D:\AI\ComfyUI -Quant nvfp4

    -ApiOnly - no GPU requirement at all. Installs the same ComfyUI but skips the
    weights entirely and wires up the hosted MiniMax H3 API nodes, where the
    generation runs on MiniMax's servers. Use this when the GPU is too small
    (or absent). Billed per clip - about $0.13 per second of 768P video.

        .\install.ps1 -InstallDir D:\AI\ComfyUI -ApiOnly

    Run from a normal (non-admin) PowerShell:
        Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

.PARAMETER InstallDir
    Where ComfyUI goes. Local mode wants a fast SSD with 60-150 GB free;
    -ApiOnly needs about 10 GB.

.PARAMETER ApiOnly
    Skip the weights and use the hosted API nodes. No GPU needed.

.PARAMETER Quant
    bf16 | int8 | nvfp4 | fp8 - see ..\docs\windows-setup.md for the VRAM table.
    Ignored with -ApiOnly.

.PARAMETER SkipModels
    Install ComfyUI but do not download weights.

.PARAMETER Ref2va
    Also download the reference-to-video checkpoint.
#>
[CmdletBinding()]
param(
    [string]$InstallDir = "$env:USERPROFILE\ComfyUI",
    [ValidateSet("bf16", "int8", "nvfp4", "fp8")]
    [string]$Quant = "nvfp4",
    [switch]$ApiOnly,
    [switch]$SkipModels,
    [switch]$Ref2va,
    [string]$ComfyUIRef = "2eb609766a749e3104485979615e062e401bab97",
    # cu130 is required, not merely preferred: comfy/quant_ops.py turns off the
    # comfy-kitchen CUDA backend when torch.version.cuda < 13, and that backend
    # provides the INT8 convrot / NVFP4 kernels every quantized profile needs.
    [string]$TorchIndex = "https://download.pytorch.org/whl/cu130"
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot  = Split-Path -Parent $scriptDir

function Info($m) { Write-Host "[+] $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "[!] $m" -ForegroundColor Yellow }
function Die($m)  { Write-Host "[x] $m" -ForegroundColor Red; exit 1 }

function Need($cmd, $hint) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Die "$cmd not found. $hint" }
}

# --- preflight -------------------------------------------------------------
Info "Checking prerequisites"

Need git    "Install it with: winget install --id Git.Git -e"
Need python "Install Python 3.12 with: winget install --id Python.Python.3.12 -e (tick 'Add to PATH')"

$pyVersion = (python -c "import sys; print('%d.%d' % sys.version_info[:2])").Trim()
if ($pyVersion -notin @("3.12", "3.13")) {
    Warn "Python $pyVersion detected. ComfyUI is tested on 3.12/3.13; 3.14+ often has no wheels yet."
}

if ($ApiOnly) {
    Info "Mode: hosted API nodes (no weights, no GPU requirement)"
} else {
    Info "Mode: local weights (profile: $Quant)"
}

if (Get-Command nvidia-smi -ErrorAction SilentlyContinue) {
    $gpu = (nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader | Select-Object -First 1)
    Info "GPU: $gpu"
    if (-not $ApiOnly) {
        # 24GB is the practical floor: the pruned INT8 DiT alone is ~19.5GB.
        $vramMb = [int]((nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | Select-Object -First 1).Trim())
        if ($vramMb -lt 20000) {
            Warn "This GPU has ${vramMb}MB of VRAM. MiniMax H3's smallest checkpoint is about 19.5GB,"
            Warn "so local generation is very unlikely to work here (24GB is the practical floor)."
            Warn "Re-run with -ApiOnly to install the hosted-API setup instead, which has no GPU"
            Warn "requirement and skips the multi-tens-of-GB download."
            $answer = Read-Host "Continue with the local install anyway? [y/N]"
            if ($answer -notmatch '^(y|yes)$') { Die "Stopped. Re-run with -ApiOnly." }
        }
    }
} elseif (-not $ApiOnly) {
    Warn "nvidia-smi not found. Local MiniMax H3 needs an NVIDIA GPU with a recent driver."
    Warn "If this machine has no suitable GPU, re-run with -ApiOnly."
}

if (-not $ApiOnly -and $Quant -eq "nvfp4") {
    Warn "Quant 'nvfp4' needs a Blackwell GPU (RTX 50xx / RTX PRO 6000 / B200). On Ada or Hopper use -Quant int8."
}

$longPaths = (Get-ItemProperty "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -ErrorAction SilentlyContinue).LongPathsEnabled
if ($longPaths -ne 1) {
    Warn "Win32 long paths are disabled. If pip fails on long filenames, run as admin:"
    Warn '  New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name LongPathsEnabled -Value 1 -PropertyType DWord -Force'
}

# --- clone -----------------------------------------------------------------
if (Test-Path (Join-Path $InstallDir ".git")) {
    Info "ComfyUI already at $InstallDir - fetching"
    git -C $InstallDir fetch --all --tags
} else {
    Info "Cloning ComfyUI into $InstallDir"
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $InstallDir) | Out-Null
    git clone https://github.com/comfyanonymous/ComfyUI.git $InstallDir
}
git -C $InstallDir checkout $ComfyUIRef
$needFile = if ($ApiOnly) { "comfy_api_nodes\nodes_minimax.py" } else { "comfy_extras\nodes_minimax_h3.py" }
if (-not (Test-Path (Join-Path $InstallDir $needFile))) {
    Die "This ComfyUI revision is missing $needFile. Pass a newer -ComfyUIRef (or 'master')."
}

# --- venv ------------------------------------------------------------------
$venv = Join-Path $InstallDir "venv"
$py   = Join-Path $venv "Scripts\python.exe"
if (-not (Test-Path $py)) {
    Info "Creating venv"
    python -m venv $venv
}

Info "Installing PyTorch (CUDA 13.0)"
& $py -m pip install --upgrade pip setuptools wheel
& $py -m pip install torch torchvision torchaudio --index-url $TorchIndex

Info "Installing ComfyUI requirements"
& $py -m pip install -r (Join-Path $InstallDir "requirements.txt")
& $py -m pip install huggingface_hub hf_transfer

$torchCuda = (& $py -c "import torch; print(torch.version.cuda or 'none')").Trim()
$cudaOk    = (& $py -c "import torch; v=torch.version.cuda; print(int(bool(v) and tuple(map(int,v.split('.')))>=(13,0)))").Trim()
Info "torch CUDA: $torchCuda"
if ($cudaOk -ne "1") {
    Warn "torch is built for CUDA $torchCuda. ComfyUI will log 'You need pytorch with cu130 or"
    Warn "higher to use optimized CUDA operations' and disable the INT8/NVFP4 kernels, so the"
    Warn "quantized profiles will be far slower. Reinstall with:"
    Warn "  $py -m pip install --force-reinstall torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130"
}

# --- models ----------------------------------------------------------------
$modelsDir = Join-Path $InstallDir "models"
if ($ApiOnly) {
    Info "Skipping weights - the hosted API nodes do not use them."
} elseif ($SkipModels) {
    Warn "Skipping model download (-SkipModels). Run later:"
    Warn "  $py $repoRoot\scripts\download_models.py --models-dir $modelsDir --profile $Quant"
} else {
    Info "Downloading weights (profile: $Quant). This is tens of GB - grab a coffee."
    $env:HF_HUB_ENABLE_HF_TRANSFER = "1"
    $dlArgs = @("$repoRoot\scripts\download_models.py", "--models-dir", $modelsDir, "--profile", $Quant)
    if ($Ref2va) { $dlArgs += "--ref2va" }
    & $py @dlArgs
    if ($LASTEXITCODE -ne 0) { Die "Model download failed. See the message above." }
}

# --- workflows + launcher --------------------------------------------------
if ($ApiOnly) {
    $wfDest = Join-Path $InstallDir "user\default\workflows\minimax_h3_api"
    $wfSrc  = Join-Path $repoRoot "workflows\api\*.json"
} else {
    $wfDest = Join-Path $InstallDir "user\default\workflows\minimax_h3"
    $wfSrc  = Join-Path $repoRoot "workflows\*.json"
}
New-Item -ItemType Directory -Force -Path $wfDest | Out-Null
Copy-Item $wfSrc $wfDest -Force
Info "API-format workflows copied to $wfDest"

# On a card that cannot hold the DiT outright, ComfyUI streams transformer blocks
# from system RAM. Reserving a little VRAM keeps the desktop compositor from
# fighting the sampler for the last few hundred MB. The API nodes never touch
# the GPU, so they get no flags.
$vramFlag = ""
if (-not $ApiOnly -and (Get-Command nvidia-smi -ErrorAction SilentlyContinue)) {
    $vramMb = [int]((nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | Select-Object -First 1).Trim())
    if ($vramMb -lt 34000) { $vramFlag = "--reserve-vram 1.0" }
    Info "Detected ${vramMb}MB VRAM -> launch flags: '$vramFlag'"
}

# The .bat lives in $InstallDir, so it locates itself with %~dp0 rather than
# hardcoding the path - that keeps the file pure ASCII even when ComfyUI is
# installed under a non-ASCII path (e.g. C:\Users\<日本語>\ComfyUI), which cmd.exe
# would otherwise mis-decode.
$bat = @"
@echo off
rem Generated by install.ps1 - starts ComfyUI with the MiniMax H3 setup.
cd /d "%~dp0"
set HF_HUB_ENABLE_HF_TRANSFER=1
"%~dp0venv\Scripts\python.exe" main.py --auto-launch $vramFlag %*
pause
"@
$batPath = Join-Path $InstallDir "run_comfyui.bat"
Set-Content -Path $batPath -Value $bat -Encoding ASCII

Write-Host ""
Info "Done."
Write-Host "  Start ComfyUI : $batPath"
Write-Host "  Then open     : http://127.0.0.1:8188"

if ($ApiOnly) {
    Write-Host "  Node search   : type 'MiniMax H3' (category partner/video/MiniMax)"
    Write-Host "  Workflows     : Workflow -> Open -> $wfDest"
    Write-Host ""
    Warn "Sign in before generating: open the user menu at the top right of the ComfyUI window."
    Warn "The API nodes bill your Comfy account - roughly `$0.13 per second of 768P video,"
    Warn "so a 5 second clip is about `$0.64. Nothing is charged until you actually run one."
} else {
    Write-Host "  Workflow menu : Workflow -> Browse Templates -> Video -> MiniMax H3"
    Write-Host ""
    Warn "Set your Windows pagefile to 64GB+ if you have under 64GB RAM - H3 streams DiT layers through system memory."
}
