#!/usr/bin/env python3
"""Download MiniMax H3 weights from the Comfy-Org repack into a ComfyUI models tree.

The repack's directory layout on the Hub has changed before (files have lived at
the repo root and under ``split_files/``), so this script never hardcodes a path:
it lists the repo, matches wanted weights by *basename*, and drops each file into
the right ``models/<kind>/`` folder under whatever name ComfyUI expects.

Usage:
    python download_models.py --models-dir /runpod-volume/ComfyUI/models --profile int8
    python download_models.py --list          # show every file in the repo and exit
"""

from __future__ import annotations

import argparse
import os
import shutil
import sys
from pathlib import Path

REPO_ID = os.environ.get("MINIMAX_H3_REPO", "Comfy-Org/MiniMax-H3")

# Kind -> ComfyUI models subfolder.
KIND_DIRS = {
    "unet": "diffusion_models",
    "clip": "text_encoders",
    "vae": "vae",
}

# Both VAEs are always needed: H3 generates video and audio jointly.
VAES = [
    ("vae", "minimax_h3_video_vae_fp16.safetensors"),
    ("vae", "minimax_h3_audio_vae_fp32.safetensors"),
]

PROFILES: dict[str, dict] = {
    "bf16": {
        "blurb": "Reference quality. 80GB+ VRAM (H100/H200/B200) and ~124GB disk.",
        "files": [
            ("unet", "minimax_h3_fl2va_bf16.safetensors"),
            ("clip", "qwen3vl_32b_minimax_h3_bf16.safetensors"),
        ],
    },
    "int8": {
        "blurb": "Balanced default. 48GB VRAM (L40S/A6000 Ada) and ~50GB disk.",
        "files": [
            ("unet", "minimax_h3_fl2va_pruned_int8_convrot.safetensors"),
            ("clip", "qwen3vl_32b_minimax_h3_int8_convrot.safetensors"),
        ],
    },
    "nvfp4": {
        "blurb": "Blackwell only (RTX 5090/PRO 6000/B200). 24-32GB VRAM, ~40GB disk.",
        "files": [
            ("unet", "minimax_h3_fl2va_pruned_int8_convrot.safetensors"),
            ("clip", "qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors"),
        ],
    },
    "fp8": {
        "blurb": "Ada/Hopper fallback when INT8 convrot kernels are unavailable.",
        "files": [
            ("unet", "minimax_h3_fl2va_pruned_fp8_scaled.safetensors"),
            ("clip", "qwen3vl_32b_minimax_h3_int8_convrot.safetensors"),
        ],
    },
}

# ref2va is a second DiT checkpoint; pulled only with --ref2va.
REF2VA_BY_PROFILE = {
    "bf16": "minimax_h3_ref2va_bf16.safetensors",
    "int8": "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
    "nvfp4": "minimax_h3_ref2va_pruned_int8_convrot.safetensors",
    "fp8": "minimax_h3_ref2va_pruned_fp8_scaled.safetensors",
}


def require_hf():
    try:
        from huggingface_hub import HfApi, hf_hub_download  # noqa: F401
    except ImportError:
        sys.exit("huggingface_hub is missing. Install it with:\n    pip install huggingface_hub hf_transfer")
    from huggingface_hub import HfApi, hf_hub_download

    return HfApi, hf_hub_download


def repo_index(api) -> dict[str, list[str]]:
    """basename -> [repo paths]. Lets us find a file wherever it lives."""
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    paths = api.list_repo_files(REPO_ID, token=token)
    index: dict[str, list[str]] = {}
    for p in paths:
        index.setdefault(Path(p).name, []).append(p)
    return index


def fetch(hf_hub_download, repo_path: str, dest: Path) -> Path:
    """Download repo_path and place it at dest (real file, no symlink)."""
    if dest.exists() and dest.stat().st_size > 0:
        print(f"  = {dest.name} already present, skipping")
        return dest

    dest.parent.mkdir(parents=True, exist_ok=True)
    staging = dest.parent / ".hf-staging"
    token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")

    print(f"  + {repo_path} -> {dest}")
    got = hf_hub_download(
        repo_id=REPO_ID,
        filename=repo_path,
        local_dir=str(staging),
        token=token,
    )
    # Move into place under the flat basename ComfyUI lists in its dropdowns.
    shutil.move(got, dest)
    shutil.rmtree(staging, ignore_errors=True)
    return dest


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--models-dir", default=os.environ.get("COMFY_MODELS_DIR", "./models"),
                    help="ComfyUI models/ directory (contains diffusion_models/, text_encoders/, vae/)")
    ap.add_argument("--profile", default=os.environ.get("MINIMAX_H3_PROFILE", "int8"),
                    choices=sorted(PROFILES), help="quantization profile to download")
    ap.add_argument("--ref2va", action="store_true", help="also download the reference-to-video DiT")
    ap.add_argument("--list", action="store_true", help="list every file in the repo and exit")
    args = ap.parse_args()

    os.environ.setdefault("HF_HUB_ENABLE_HF_TRANSFER", "1")
    HfApi, hf_hub_download = require_hf()
    api = HfApi()

    try:
        index = repo_index(api)
    except Exception as exc:  # network, auth, gated repo
        sys.exit(f"Could not list {REPO_ID}: {exc}\n"
                 f"If the repo is gated, accept the license on the Hub and set HF_TOKEN.")

    if args.list:
        for name in sorted(index):
            for p in index[name]:
                print(p)
        return 0

    profile = PROFILES[args.profile]
    wanted = list(profile["files"]) + VAES
    if args.ref2va:
        wanted.append(("unet", REF2VA_BY_PROFILE[args.profile]))

    print(f"repo    : {REPO_ID}")
    print(f"profile : {args.profile} - {profile['blurb']}")
    print(f"target  : {args.models_dir}\n")

    models_dir = Path(args.models_dir).expanduser().resolve()
    missing = [n for _, n in wanted if n not in index]
    if missing:
        print("These filenames are not in the repo:", file=sys.stderr)
        for n in missing:
            print(f"  - {n}", file=sys.stderr)
        print("\nThe repack may have been renamed. Run with --list to see what is "
              "actually published, then adjust PROFILES in this script.", file=sys.stderr)
        return 1

    for kind, name in wanted:
        dest = models_dir / KIND_DIRS[kind] / name
        repo_path = sorted(index[name], key=len)[0]
        fetch(hf_hub_download, repo_path, dest)

    print("\nDone. Files on disk:")
    for kind in KIND_DIRS.values():
        d = models_dir / kind
        if not d.is_dir():
            continue
        for f in sorted(d.glob("*.safetensors")):
            print(f"  {f.relative_to(models_dir)}  {f.stat().st_size / 2**30:.1f} GiB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
