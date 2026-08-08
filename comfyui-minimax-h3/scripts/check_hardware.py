#!/usr/bin/env python3
"""Tell you whether this machine can run MiniMax H3 locally, and how.

Run it before installing anything - it works with or without torch. It reports
the three gates that actually decide the outcome (all read out of ComfyUI's own
source), then prints the exact profile, launch flags and download command to use.

    python check_hardware.py

Gates, and where they come from in ComfyUI:
  * bf16          compute capability >= 8.0   (model_management.should_use_bf16)
                  MiniMaxH3.supported_inference_dtypes is [bfloat16, float32],
                  so a card below Ampere has to fall back to fp32 - double the
                  memory for a model that already does not fit.
  * NVFP4         compute capability >= 10.0  (model_management.supports_nvfp4_compute)
  * INT8 / NVFP4  torch built against CUDA 13+ (quant_ops.py disables the
    kernels     comfy-kitchen CUDA backend below cu130)
"""

from __future__ import annotations

import argparse
import platform
import re
import shutil
import subprocess
import sys

# Approximate on-disk footprint per profile, in GiB, for the sizing advice.
PROFILE_DISK = {"bf16": 124, "int8": 50, "nvfp4": 40, "fp8": 45}

RESET, BOLD = "\033[0m", "\033[1m"
RED, YELLOW, GREEN, CYAN, DIM = "\033[31m", "\033[33m", "\033[32m", "\033[36m", "\033[2m"


def color(s: str, c: str) -> str:
    return s if not sys.stdout.isatty() else f"{c}{s}{RESET}"


def head(s: str) -> None:
    print(f"\n{color(s, BOLD)}")
    print(color("-" * len(s), DIM))


def row(label: str, value: str, note: str = "") -> None:
    print(f"  {label:<24}{value}{('  ' + color(note, DIM)) if note else ''}")


# --------------------------------------------------------------------------- #
# Probing
# --------------------------------------------------------------------------- #
def probe_torch() -> dict:
    try:
        import torch
    except ImportError:
        return {"available": False}

    info = {
        "available": True,
        "version": torch.__version__,
        "cuda_build": torch.version.cuda,
        "cuda_runtime_ok": bool(torch.cuda.is_available()),
        "mps": bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available()),
        "gpus": [],
    }
    if info["cuda_runtime_ok"]:
        for i in range(torch.cuda.device_count()):
            p = torch.cuda.get_device_properties(i)
            info["gpus"].append({
                "name": p.name,
                "vram_gib": p.total_memory / 2**30,
                "cc": (p.major, p.minor),
            })
    return info


def probe_nvidia_smi() -> list[dict]:
    """Fallback when torch is not installed yet."""
    if not shutil.which("nvidia-smi"):
        return []
    try:
        out = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,compute_cap", "--format=csv,noheader,nounits"],
            capture_output=True, text=True, timeout=30, check=True,
        ).stdout
    except (subprocess.SubprocessError, OSError):
        return []

    gpus = []
    for line in out.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 2:
            continue
        try:
            vram = float(parts[1]) / 1024
        except ValueError:
            continue
        cc = None
        if len(parts) > 2 and re.match(r"^\d+\.\d+$", parts[2]):
            major, minor = parts[2].split(".")
            cc = (int(major), int(minor))
        gpus.append({"name": parts[0], "vram_gib": vram, "cc": cc})
    return gpus


def probe_ram_gib() -> float | None:
    try:
        if platform.system() == "Linux":
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        return int(line.split()[1]) / 2**20
        elif platform.system() == "Darwin":
            out = subprocess.run(["sysctl", "-n", "hw.memsize"], capture_output=True, text=True, check=True)
            return int(out.stdout.strip()) / 2**30
        elif platform.system() == "Windows":
            out = subprocess.run(
                ["powershell", "-NoProfile", "-Command",
                 "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory"],
                capture_output=True, text=True, check=True, timeout=60)
            return int(out.stdout.strip()) / 2**30
    except (OSError, ValueError, subprocess.SubprocessError):
        return None
    return None


def probe_disk_gib(path: str = ".") -> float | None:
    try:
        return shutil.disk_usage(path).free / 2**30
    except OSError:
        return None


# --------------------------------------------------------------------------- #
# Verdict
# --------------------------------------------------------------------------- #
def decide(gpu: dict | None, torch_info: dict, ram: float | None) -> tuple[str | None, list[str], list[str]]:
    """Returns (profile or None, blockers, warnings)."""
    blockers: list[str] = []
    warnings: list[str] = []

    if platform.system() == "Darwin":
        blockers.append(
            "macOS: the INT8/NVFP4 kernels only register on CUDA/ROCm/Triton, and the bf16 "
            "fallback needs ~118GB of weights. Local H3 is not possible - use the hosted API "
            "nodes (docs/mac-setup.md) or a remote GPU.")
        return None, blockers, warnings

    if gpu is None:
        blockers.append("No NVIDIA GPU detected. Local H3 needs one (see docs/free-setup.md).")
        return None, blockers, warnings

    cc = gpu.get("cc")
    vram = gpu["vram_gib"]

    if cc is None:
        warnings.append("Could not read compute capability; assuming it meets the bf16 bar. "
                        "Install torch and re-run for a definitive answer.")
    elif cc < (8, 0):
        blockers.append(
            f"{gpu['name']} is compute capability {cc[0]}.{cc[1]}; bf16 needs 8.0+ (Ampere or newer). "
            "MiniMax H3 only supports bfloat16/float32, so this card would fall back to fp32 - "
            "twice the memory for a model that already does not fit.")
        return None, blockers, warnings

    cuda_build = torch_info.get("cuda_build")
    kernels_ok = True
    if torch_info.get("available"):
        if not cuda_build:
            blockers.append("torch has no CUDA build (CPU-only wheel). Reinstall from "
                            "https://download.pytorch.org/whl/cu130")
            kernels_ok = False
        else:
            try:
                kernels_ok = tuple(map(int, cuda_build.split("."))) >= (13, 0)
            except ValueError:
                kernels_ok = False
            if not kernels_ok:
                warnings.append(
                    f"torch is built for CUDA {cuda_build}. ComfyUI disables the comfy-kitchen CUDA "
                    "backend below cu130, so the INT8/NVFP4 kernels will not run and the quantized "
                    "profiles get much slower. Reinstall with --index-url "
                    "https://download.pytorch.org/whl/cu130")
    else:
        warnings.append("torch is not installed yet - install it from the cu130 index "
                        "(https://download.pytorch.org/whl/cu130), not cu128.")

    # The smallest H3 checkpoint (pruned INT8 DiT) is ~19.5GB. Below roughly that,
    # there is no arrangement of offloading that makes local generation practical.
    if vram < 20:
        blockers.append(
            f"{gpu['name']} has {vram:.0f}GB of VRAM. The smallest MiniMax H3 checkpoint is about "
            "19.5GB and 24GB is the practical floor, so local generation is not realistic here. "
            "The generation itself is the problem, not the setup - use the hosted API nodes "
            "(install.ps1 -ApiOnly) or rent a GPU.")
        return None, blockers, warnings

    blackwell = cc is not None and cc >= (10, 0)
    ada_plus = cc is not None and cc >= (8, 9)

    # Text encoder choice drives the peak: NVFP4 is ~15GB, INT8 ~26GB, bf16 ~52GB.
    if vram >= 78:
        profile = "bf16"
    elif blackwell:
        profile = "nvfp4"
    elif vram >= 40:
        profile = "int8"
    elif ada_plus:
        profile = "fp8"
    else:
        profile = "int8"

    if vram < 24:
        warnings.append(
            f"{vram:.0f}GB VRAM is right at the edge. Expect heavy layer streaming; start at "
            "832x480 with length 124 and be ready for it to be very slow or OOM.")
    elif vram < 32:
        warnings.append(
            f"{vram:.0f}GB VRAM works but the text encoder will not sit alongside the DiT. "
            "ComfyUI loads them sequentially, so this is mostly a speed cost.")

    if not blackwell and profile == "nvfp4":
        warnings.append("NVFP4 needs compute capability 10.0+ (Blackwell); falling back.")

    if ram is not None and ram < 32:
        warnings.append(
            f"{ram:.0f}GB system RAM is tight. H3 streams DiT blocks through host memory - "
            "64GB is the comfortable number, and a large pagefile/swap is essential below that.")

    return profile, blockers, warnings


def launch_flags(gpu: dict | None) -> str:
    if gpu is None:
        return ""
    if gpu["vram_gib"] < 24:
        return "--reserve-vram 0.5 --cache-none"
    if gpu["vram_gib"] < 34:
        return "--reserve-vram 1.0"
    return ""


def presets(gpu: dict | None) -> list[tuple[str, str]]:
    vram = gpu["vram_gib"] if gpu else 0
    if vram < 24:
        return [("832x480, length 124 (~5s), steps 30", "the only setting likely to complete")]
    if vram < 34:
        return [("832x480, length 124, steps 50", "safe starting point"),
                ("1344x768, length 124, steps 50", "standard quality, slower")]
    return [("1344x768, length 124, steps 50", "standard"),
            ("1344x768, length 362 (~15s), steps 50", "long clip, needs patience"),
            ("832x480, length 124, steps 30", "fast iteration while writing prompts")]


def main() -> int:
    ap = argparse.ArgumentParser(description="Check whether this machine can run MiniMax H3 locally.")
    ap.add_argument("--models-dir", default=".", help="path to check free disk space against")
    args = ap.parse_args()

    print(color("\nMiniMax H3 - local capability check", BOLD))

    torch_info = probe_torch()
    gpus = torch_info.get("gpus") or probe_nvidia_smi()
    gpu = max(gpus, key=lambda g: g["vram_gib"]) if gpus else None
    ram = probe_ram_gib()
    disk = probe_disk_gib(args.models_dir)

    head("System")
    row("OS", f"{platform.system()} {platform.release()} ({platform.machine()})")
    row("Python", platform.python_version())
    row("System RAM", f"{ram:.0f} GiB" if ram else "unknown")
    row("Free disk", f"{disk:.0f} GiB" if disk else "unknown", f"at {args.models_dir}")

    head("PyTorch")
    if torch_info.get("available"):
        row("version", torch_info["version"])
        cb = torch_info.get("cuda_build") or "none (CPU-only build)"
        ok = torch_info.get("cuda_build") and tuple(
            map(int, torch_info["cuda_build"].split("."))) >= (13, 0)
        row("CUDA build", color(cb, GREEN if ok else YELLOW),
            "cu130+ required for the INT8/NVFP4 kernels")
        row("CUDA usable", "yes" if torch_info["cuda_runtime_ok"] else "no")
        if torch_info.get("mps"):
            row("MPS (Apple)", "available", "cannot run H3 weights - API nodes only")
    else:
        row("version", color("not installed", YELLOW), "install from the cu130 index")

    head("GPU")
    if not gpus:
        row("detected", color("none", RED))
    for g in gpus:
        cc = g.get("cc")
        cc_s = f"{cc[0]}.{cc[1]}" if cc else "unknown"
        caps = []
        if cc:
            caps.append("bf16" if cc >= (8, 0) else color("no bf16", RED))
            if cc >= (8, 9):
                caps.append("fp8")
            if cc >= (10, 0):
                caps.append("nvfp4")
        row(g["name"][:24], f"{g['vram_gib']:.0f} GiB  cc {cc_s}", " / ".join(caps))

    profile, blockers, warnings = decide(gpu, torch_info, ram)

    head("Verdict")
    if blockers:
        for b in blockers:
            print(f"  {color('BLOCKED', RED)}  {b}")
    if warnings:
        for w in warnings:
            print(f"  {color('NOTE', YELLOW)}     {w}")
    if not blockers and not warnings:
        print(f"  {color('All clear.', GREEN)}")

    if profile:
        need = PROFILE_DISK[profile]
        head("Recommended setup")
        row("profile", color(profile, GREEN), f"about {need} GiB on disk")
        if disk and disk < need:
            row("", color(f"only {disk:.0f} GiB free - not enough", RED))
        flags = launch_flags(gpu)
        row("launch flags", flags or "(none needed)")
        print()
        print("  download:")
        print(color(f"    python download_models.py --models-dir <ComfyUI>/models --profile {profile}", CYAN))
        print("\n  start with:")
        for setting, why in presets(gpu):
            row("", setting, why)
    else:
        head("What you can still do")
        print("  This machine can run ComfyUI with the hosted MiniMax H3 API nodes - the")
        print("  generation happens on MiniMax's servers, so no GPU is involved.")
        print()
        print(color("    .\\install.ps1 -InstallDir D:\\AI\\ComfyUI -ApiOnly      (Windows)", CYAN))
        print(color("    ./install.sh -d ~/ComfyUI                             (macOS)", CYAN))
        print()
        print("  Billed per clip: about $0.13 per second of 768P video (~$0.64 for 5s).")
        print("  Renting a GPU instead -> docs/runpod-serverless.md")
        print("  Why free notebook tiers cannot run it -> docs/free-setup.md")

    print()
    return 0 if profile else 1


if __name__ == "__main__":
    raise SystemExit(main())
