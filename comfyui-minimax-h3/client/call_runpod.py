#!/usr/bin/env python3
"""Call the MiniMax H3 serverless endpoint and save the returned mp4.

    export RUNPOD_API_KEY=...
    export RUNPOD_ENDPOINT_ID=...
    python call_runpod.py --prompt "a cat DJing at a rooftop party" --out cat.mp4
    python call_runpod.py --mode flf2v --first-frame start.png --prompt "camera pushes in"
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import sys
import time

import requests

BASE = "https://api.runpod.ai/v2"


def b64_file(path: str) -> str:
    return base64.b64encode(pathlib.Path(path).read_bytes()).decode()


def submit(endpoint: str, key: str, payload: dict) -> str:
    r = requests.post(f"{BASE}/{endpoint}/run", json=payload,
                      headers={"Authorization": f"Bearer {key}"}, timeout=120)
    r.raise_for_status()
    return r.json()["id"]


def poll(endpoint: str, key: str, job_id: str, timeout: int) -> dict:
    headers = {"Authorization": f"Bearer {key}"}
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        r = requests.get(f"{BASE}/{endpoint}/status/{job_id}", headers=headers, timeout=60)
        r.raise_for_status()
        body = r.json()
        status = body.get("status")
        if status != last:
            print(f"[{time.strftime('%H:%M:%S')}] {status}", file=sys.stderr)
            last = status
        if status == "COMPLETED":
            return body.get("output") or {}
        if status in ("FAILED", "CANCELLED", "TIMED_OUT"):
            raise SystemExit(f"job {status}: {json.dumps(body, ensure_ascii=False)[:2000]}")
        time.sleep(3)
    raise SystemExit(f"timed out after {timeout}s (job {job_id} may still be running)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--endpoint", default=os.environ.get("RUNPOD_ENDPOINT_ID"))
    ap.add_argument("--api-key", default=os.environ.get("RUNPOD_API_KEY"))
    ap.add_argument("--mode", default="t2v", choices=["t2v", "flf2v", "ref2v"])
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--width", type=int, default=1344)
    ap.add_argument("--height", type=int, default=768)
    ap.add_argument("--length", type=int, default=124, help="frames at 24fps; 124 = ~5s")
    ap.add_argument("--steps", type=int, default=50)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--first-frame", help="image file for flf2v")
    ap.add_argument("--last-frame", help="image file for flf2v")
    ap.add_argument("--ref-image", help="image file for ref2v (referenced as <Picture 1>)")
    ap.add_argument("--workflow", help="path to a full API-format workflow JSON (overrides --mode)")
    ap.add_argument("--out", default="output.mp4")
    ap.add_argument("--timeout", type=int, default=3600)
    args = ap.parse_args()

    if not args.endpoint or not args.api_key:
        return ap.error("set RUNPOD_ENDPOINT_ID and RUNPOD_API_KEY (or pass --endpoint/--api-key)")

    job_input: dict = {
        "prompt": args.prompt,
        "width": args.width,
        "height": args.height,
        "length": args.length,
        "steps": args.steps,
        "seed": args.seed,
    }
    if args.workflow:
        job_input["workflow"] = json.loads(pathlib.Path(args.workflow).read_text())
    else:
        job_input["mode"] = args.mode

    images = {}
    if args.first_frame:
        images["first_frame"] = b64_file(args.first_frame)
    if args.last_frame:
        images["last_frame"] = b64_file(args.last_frame)
    if args.ref_image:
        images["ref_image_0"] = b64_file(args.ref_image)
    if images:
        job_input["images"] = images

    job_id = submit(args.endpoint, args.api_key, {"input": job_input})
    print(f"job id: {job_id}", file=sys.stderr)
    output = poll(args.endpoint, args.api_key, job_id, args.timeout)

    if "error" in output:
        raise SystemExit(f"worker error: {output['error']}")

    files = output.get("files") or []
    if not files:
        raise SystemExit(f"no files in output: {json.dumps(output, ensure_ascii=False)[:2000]}")

    out = pathlib.Path(args.out)
    for i, f in enumerate(files):
        dest = out if i == 0 else out.with_name(f"{out.stem}_{i}{out.suffix}")
        if f.get("url"):
            print(f"{f['filename']}: {f['url']}")
            continue
        if not f.get("data"):
            print(f"{f['filename']}: {f.get('error', 'no data returned')}", file=sys.stderr)
            continue
        dest.write_bytes(base64.b64decode(f["data"]))
        print(f"wrote {dest} ({dest.stat().st_size / 1e6:.1f} MB) in {output.get('seconds')}s")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
