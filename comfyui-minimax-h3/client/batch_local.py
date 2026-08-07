#!/usr/bin/env python3
"""Queue a whole batch of prompts against a local ComfyUI and collect the videos.

This is the cheapest way to get throughput out of a GPU you already own: every
item is pushed onto ComfyUI's own queue in one go, so the DiT and text encoder
are loaded once and reused for the entire run instead of once per clip. Leave it
going overnight.

    # prompts.txt: one prompt per line, blank lines and # comments ignored
    python batch_local.py prompts.txt --out-dir renders

    # or a JSON list, with per-item overrides
    # [{"prompt": "...", "seed": 7, "length": 141}, {"prompt": "...", "width": 832}]
    python batch_local.py prompts.json --out-dir renders --steps 30

Re-running skips items whose output file already exists, so an interrupted batch
resumes where it stopped.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys
import time
import urllib.parse
import uuid

import requests

WORKFLOWS = pathlib.Path(__file__).resolve().parent.parent / "workflows"
MODES = {"t2v": "t2v.json", "flf2v": "flf2v.json", "ref2v": "ref2v.json"}


def slug(text: str, index: int) -> str:
    s = re.sub(r"[^a-zA-Z0-9]+", "_", text.lower()).strip("_")[:48]
    return f"{index:03d}_{s or 'clip'}"


def load_items(path: pathlib.Path) -> list[dict]:
    raw = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        data = json.loads(raw)
        if not isinstance(data, list):
            sys.exit(f"{path}: expected a JSON list of objects")
        return [x if isinstance(x, dict) else {"prompt": str(x)} for x in data]
    return [{"prompt": line.strip()} for line in raw.splitlines()
            if line.strip() and not line.lstrip().startswith("#")]


def node_id(prompt: dict, class_type: str) -> str | None:
    for nid, node in prompt.items():
        if node["class_type"] == class_type:
            return nid
    return None


def build(template: dict, item: dict, args, index: int) -> dict:
    graph = json.loads(json.dumps(template))  # deep copy

    cond = node_id(graph, "MiniMaxH3ImageToVideo") or node_id(graph, "MiniMaxH3ReferenceToVideo")
    ks = node_id(graph, "KSampler")
    save = node_id(graph, "SaveVideo")

    def pick(key, default):
        return item.get(key, default)

    graph[cond]["inputs"]["prompt"] = item["prompt"]
    graph[cond]["inputs"]["width"] = pick("width", args.width)
    graph[cond]["inputs"]["height"] = pick("height", args.height)
    graph[cond]["inputs"]["length"] = pick("length", args.length)

    graph[ks]["inputs"]["steps"] = pick("steps", args.steps)
    graph[ks]["inputs"]["seed"] = pick("seed", args.seed + index)

    # Give every clip its own prefix so outputs are identifiable on disk.
    graph[save]["inputs"]["filename_prefix"] = f"minimax_h3_batch/{slug(item['prompt'], index)}"

    for nid, inputs in (item.get("overrides") or {}).items():
        graph[nid]["inputs"].update(inputs)
    return graph


def queue(server: str, graph: dict, client_id: str) -> str:
    r = requests.post(f"{server}/prompt", json={"prompt": graph, "client_id": client_id}, timeout=60)
    if r.status_code != 200:
        try:
            raise SystemExit(f"ComfyUI rejected a prompt:\n{json.dumps(r.json(), indent=2, ensure_ascii=False)}")
        except ValueError:
            raise SystemExit(f"ComfyUI rejected a prompt: HTTP {r.status_code} {r.text[:1500]}")
    return r.json()["prompt_id"]


def explain_failure(status: dict) -> str:
    """ComfyUI's message log also holds execution_start / execution_cached noise;
    surface only the exception so a long batch log stays readable."""
    for entry in status.get("messages", []):
        if not (isinstance(entry, (list, tuple)) and len(entry) == 2):
            continue
        name, data = entry
        if name != "execution_error" or not isinstance(data, dict):
            continue
        return (f"node {data.get('node_id', '?')} ({data.get('node_type', '?')}): "
                f"{data.get('exception_type', '')}: {data.get('exception_message', '')}")
    return json.dumps(status.get("messages", []), ensure_ascii=False)[:300]


def collect(server: str, entry: dict, dest: pathlib.Path) -> pathlib.Path | None:
    for out in entry.get("outputs", {}).values():
        for values in out.values():
            if not isinstance(values, list):
                continue
            for f in values:
                if not isinstance(f, dict) or "filename" not in f:
                    continue
                q = urllib.parse.urlencode({"filename": f["filename"],
                                            "subfolder": f.get("subfolder", ""),
                                            "type": f.get("type", "output")})
                v = requests.get(f"{server}/view?{q}", timeout=600)
                v.raise_for_status()
                dest.write_bytes(v.content)
                return dest
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("prompts", type=pathlib.Path, help=".txt (one prompt per line) or .json list")
    ap.add_argument("--server", default="http://127.0.0.1:8188")
    ap.add_argument("--mode", default="t2v", choices=sorted(MODES))
    ap.add_argument("--out-dir", type=pathlib.Path, default=pathlib.Path("renders"))
    ap.add_argument("--width", type=int, default=1344)
    ap.add_argument("--height", type=int, default=768)
    ap.add_argument("--length", type=int, default=124, help="frames at 24fps; 124 = ~5s")
    ap.add_argument("--steps", type=int, default=50)
    ap.add_argument("--seed", type=int, default=0, help="base seed; item N uses seed+N")
    ap.add_argument("--timeout", type=int, default=7200, help="per-clip wait, seconds")
    args = ap.parse_args()

    items = load_items(args.prompts)
    if not items:
        sys.exit(f"{args.prompts}: no prompts found")
    template = json.loads((WORKFLOWS / MODES[args.mode]).read_text())
    args.out_dir.mkdir(parents=True, exist_ok=True)

    try:
        requests.get(f"{args.server}/system_stats", timeout=10).raise_for_status()
    except requests.RequestException as exc:
        sys.exit(f"Cannot reach ComfyUI at {args.server}: {exc}\nStart it first (run_comfyui.bat).")

    client_id = uuid.uuid4().hex
    pending: list[tuple[str, pathlib.Path, str]] = []
    skipped = 0

    for i, item in enumerate(items):
        dest = args.out_dir / f"{slug(item['prompt'], i)}.mp4"
        if dest.exists():
            skipped += 1
            continue
        pid = queue(args.server, build(template, item, args, i), client_id)
        pending.append((pid, dest, item["prompt"]))

    print(f"queued {len(pending)} clip(s)" + (f", skipped {skipped} already rendered" if skipped else ""),
          file=sys.stderr)
    if not pending:
        return 0

    started = time.time()
    done = failed = 0
    for pid, dest, prompt in pending:
        deadline = time.time() + args.timeout
        entry = None
        while time.time() < deadline:
            r = requests.get(f"{args.server}/history/{pid}", timeout=30)
            r.raise_for_status()
            history = r.json()
            if pid in history:
                entry = history[pid]
                break
            time.sleep(3)

        label = prompt[:52].replace("\n", " ")
        if entry is None:
            print(f"[timeout] {label}", file=sys.stderr)
            failed += 1
            continue

        status = entry.get("status", {})
        if status.get("status_str") == "error" or not status.get("completed", True):
            print(f"[failed]  {label}\n           {explain_failure(status)}", file=sys.stderr)
            failed += 1
            continue

        saved = collect(args.server, entry, dest)
        if saved:
            done += 1
            print(f"[{done}/{len(pending)}] {saved}  ({saved.stat().st_size / 1e6:.1f} MB)  {label}")
        else:
            failed += 1
            print(f"[no file] {label}", file=sys.stderr)

    mins = (time.time() - started) / 60
    print(f"\n{done} rendered, {failed} failed, {mins:.1f} min total", file=sys.stderr)
    if done:
        print(f"average {mins / done:.1f} min per clip", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
