#!/usr/bin/env python3
"""Drive a local ComfyUI through the MiniMax H3 *hosted API* nodes.

For Macs (and any machine without a big NVIDIA GPU): ComfyUI runs locally but
the generation happens on MiniMax's servers, billed to your Comfy account.

    export COMFY_API_KEY=comfyui-xxxxxxxx       # https://platform.comfy.org/
    python call_local_api.py --prompt "a cat DJing on a rooftop at sunset"
    python call_local_api.py --mode flf2v --first-frame start.png --prompt "camera pushes in"
    python call_local_api.py --mode ref2v --ref-image hero.png --prompt "Image 1 walks away"

If you are signed in through the ComfyUI web UI, requests made *from that UI*
already carry your session - COMFY_API_KEY is only needed for this script.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import sys
import time
import urllib.parse
import uuid

import requests

WORKFLOWS = pathlib.Path(__file__).resolve().parent.parent / "workflows" / "api"
MODES = {"t2v": "api_t2v.json", "flf2v": "api_flf2v.json", "ref2v": "api_ref2v.json"}

# Hosted pricing, from the nodes' own price badge (USD per second of video).
RATE_USD = {"768P": 0.1287, "2K": 0.1859}


def nodes_of(prompt: dict, class_type_prefix: str) -> list[str]:
    return [n for n, node in prompt.items() if node["class_type"].startswith(class_type_prefix)]


def upload_image(base: str, path: str) -> str:
    raw = pathlib.Path(path).read_bytes()
    name = f"{uuid.uuid4().hex}_{pathlib.Path(path).name}"
    r = requests.post(f"{base}/upload/image",
                      files={"image": (name, raw, "application/octet-stream")},
                      data={"overwrite": "true", "type": "input"}, timeout=120)
    r.raise_for_status()
    info = r.json()
    sub = info.get("subfolder") or ""
    return f"{sub}/{info['name']}" if sub else info["name"]


def build(args) -> dict:
    prompt = json.loads((WORKFLOWS / MODES[args.mode]).read_text())

    api_node = nodes_of(prompt, "MinimaxHailuo03")[0]
    inputs = prompt[api_node]["inputs"]
    inputs["model.prompt"] = args.prompt
    inputs["model.resolution"] = args.resolution
    inputs["model.duration"] = args.duration
    inputs["seed"] = args.seed
    inputs["watermark"] = args.watermark
    # flf2v takes its aspect ratio from the supplied images, so it has no ratio input.
    if "model.ratio" in inputs and args.ratio:
        inputs["model.ratio"] = args.ratio

    supplied = {"first_frame": args.first_frame, "last_frame": args.last_frame,
                "image_1": args.ref_image}
    for nid in nodes_of(prompt, "LoadImage"):
        key = prompt[nid].get("_meta", {}).get("title", "").split(" ")[0]
        path = supplied.get(key)
        if path:
            prompt[nid]["inputs"]["image"] = upload_image(args.server, path)

    # Drop any LoadImage the user did not feed, along with the link into the API node.
    for nid in nodes_of(prompt, "LoadImage"):
        if prompt[nid]["inputs"]["image"] != "example.png":
            continue
        del prompt[nid]
        for node in prompt.values():
            for k, v in list(node["inputs"].items()):
                if isinstance(v, list) and len(v) == 2 and v[0] == nid:
                    del node["inputs"][k]

    if args.mode == "flf2v" and not args.first_frame:
        sys.exit("--mode flf2v requires --first-frame")
    if args.mode == "ref2v" and not args.ref_image:
        sys.exit("--mode ref2v requires --ref-image")
    return prompt


def run(args, prompt: dict) -> list[pathlib.Path]:
    body: dict = {"prompt": prompt, "client_id": uuid.uuid4().hex}
    key = os.environ.get("COMFY_API_KEY")
    if key:
        body["extra_data"] = {"api_key_comfy_org": key}

    r = requests.post(f"{args.server}/prompt", json=body, timeout=60)
    if r.status_code != 200:
        try:
            sys.exit(f"ComfyUI rejected the prompt:\n{json.dumps(r.json(), indent=2, ensure_ascii=False)}")
        except ValueError:
            sys.exit(f"ComfyUI rejected the prompt: HTTP {r.status_code} {r.text[:2000]}")
    prompt_id = r.json()["prompt_id"]
    print(f"prompt_id: {prompt_id}", file=sys.stderr)

    deadline = time.time() + args.timeout
    while time.time() < deadline:
        h = requests.get(f"{args.server}/history/{prompt_id}", timeout=30)
        h.raise_for_status()
        history = h.json()
        if prompt_id in history:
            entry = history[prompt_id]
            status = entry.get("status", {})
            if status.get("status_str") == "error" or not status.get("completed", True):
                sys.exit("execution failed:\n" +
                         json.dumps(status.get("messages", []), indent=2, ensure_ascii=False)[:4000])
            break
        time.sleep(3)
    else:
        sys.exit(f"timed out after {args.timeout}s")

    saved = []
    for out in entry.get("outputs", {}).values():
        for values in out.values():
            if not isinstance(values, list):
                continue
            for item in values:
                if not isinstance(item, dict) or "filename" not in item:
                    continue
                q = urllib.parse.urlencode({"filename": item["filename"],
                                            "subfolder": item.get("subfolder", ""),
                                            "type": item.get("type", "output")})
                v = requests.get(f"{args.server}/view?{q}", timeout=600)
                v.raise_for_status()
                dest = pathlib.Path(args.out if len(saved) == 0 else
                                    f"{pathlib.Path(args.out).stem}_{len(saved)}{pathlib.Path(args.out).suffix}")
                dest.write_bytes(v.content)
                saved.append(dest)
    return saved


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--server", default=os.environ.get("COMFY_SERVER", "http://127.0.0.1:8188"))
    ap.add_argument("--mode", default="t2v", choices=sorted(MODES))
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--resolution", default="768P", choices=["768P", "2K"])
    ap.add_argument("--duration", type=int, default=5, choices=range(5, 16), metavar="5-15")
    ap.add_argument("--ratio", default=None,
                    help="16:9 4:3 1:1 3:4 9:16 21:9 (ref2v also accepts 'adaptive'); ignored for flf2v")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--watermark", action="store_true", help="add MiniMax's AIGC watermark")
    ap.add_argument("--first-frame")
    ap.add_argument("--last-frame")
    ap.add_argument("--ref-image")
    ap.add_argument("--out", default="output.mp4")
    ap.add_argument("--timeout", type=int, default=1800)
    ap.add_argument("--yes", action="store_true", help="skip the cost confirmation")
    args = ap.parse_args()

    cost = RATE_USD[args.resolution] * args.duration
    print(f"{args.mode}  {args.resolution}  {args.duration}s  ->  about ${cost:.2f} "
          f"in Comfy credits", file=sys.stderr)
    if not args.yes and sys.stdin.isatty():
        if input("proceed? [y/N] ").strip().lower() not in ("y", "yes"):
            return 1

    if not os.environ.get("COMFY_API_KEY"):
        print("warning: COMFY_API_KEY is not set - this only works if the ComfyUI "
              "process is already signed in.", file=sys.stderr)

    saved = run(args, build(args))
    if not saved:
        sys.exit("no output files returned")
    for p in saved:
        print(f"wrote {p} ({p.stat().st_size / 1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
