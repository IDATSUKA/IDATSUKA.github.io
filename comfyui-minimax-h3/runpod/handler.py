"""RunPod serverless handler for ComfyUI + MiniMax H3.

One ComfyUI process is started when the worker boots and kept alive across jobs,
so model weights stay resident in VRAM and only the first request pays the load
cost. Each job is translated into a ComfyUI API-format prompt, queued over the
local HTTP API, and the resulting mp4 (video + native audio, muxed) is returned
as base64 or an S3 URL.

Job input, either:

    {"input": {"mode": "t2v", "prompt": "...", "length": 124, "seed": 42}}

or a full API-format graph for anything the presets don't cover:

    {"input": {"workflow": { ... }, "overrides": {"8": {"seed": 7}}}}
"""

from __future__ import annotations

import base64
import binascii
import copy
import json
import os
import pathlib
import subprocess
import sys
import time
import urllib.parse
import uuid

import requests
import runpod
from runpod.serverless.utils import rp_upload

COMFY_ROOT = pathlib.Path(os.environ.get("COMFY_ROOT", "/comfyui"))
COMFY_HOST = os.environ.get("COMFY_HOST", "127.0.0.1")
COMFY_PORT = int(os.environ.get("COMFY_PORT", "8188"))
COMFY_URL = f"http://{COMFY_HOST}:{COMFY_PORT}"
WORKFLOW_DIR = pathlib.Path(os.environ.get("WORKFLOW_DIR", "/workflows"))
EXTRA_MODEL_PATHS = os.environ.get("EXTRA_MODEL_PATHS", "/extra_model_paths.yaml")

STARTUP_TIMEOUT = int(os.environ.get("STARTUP_TIMEOUT", "900"))
JOB_TIMEOUT = int(os.environ.get("JOB_TIMEOUT", "3600"))
POLL_INTERVAL = float(os.environ.get("POLL_INTERVAL", "1.0"))

# Model filenames, overridable per deployment so the same image serves any profile.
DEFAULT_UNET = os.environ.get("MINIMAX_H3_UNET", "")
DEFAULT_REF_UNET = os.environ.get("MINIMAX_H3_REF_UNET", "")
DEFAULT_CLIP = os.environ.get("MINIMAX_H3_CLIP", "")

# RunPod caps /runsync responses; anything larger has to go to S3.
MAX_INLINE_BYTES = int(os.environ.get("MAX_INLINE_BYTES", str(8 * 1024 * 1024)))

MODES = {"t2v": "t2v.json", "flf2v": "flf2v.json", "ref2v": "ref2v.json"}

_session = requests.Session()
_comfy_proc: subprocess.Popen | None = None


# --------------------------------------------------------------------------- #
# ComfyUI process
# --------------------------------------------------------------------------- #
def start_comfyui() -> subprocess.Popen:
    cmd = [
        sys.executable, "-u", "main.py",
        "--listen", COMFY_HOST,
        "--port", str(COMFY_PORT),
        "--disable-auto-launch",
        "--disable-metadata",
    ]
    if os.path.exists(EXTRA_MODEL_PATHS):
        cmd += ["--extra-model-paths-config", EXTRA_MODEL_PATHS]
    extra = os.environ.get("COMFY_EXTRA_ARGS", "").split()
    cmd += extra

    print(f"[worker] launching ComfyUI: {' '.join(cmd)}", flush=True)
    return subprocess.Popen(cmd, cwd=str(COMFY_ROOT), stdout=sys.stdout, stderr=sys.stderr)


def wait_for_comfyui(proc: subprocess.Popen, timeout: int = STARTUP_TIMEOUT) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if proc.poll() is not None:
            raise RuntimeError(f"ComfyUI exited during startup with code {proc.returncode}")
        try:
            r = _session.get(f"{COMFY_URL}/system_stats", timeout=5)
            if r.ok:
                print("[worker] ComfyUI is up", flush=True)
                return
        except requests.RequestException:
            pass
        time.sleep(1.0)
    raise RuntimeError(f"ComfyUI did not become ready within {timeout}s")


def ensure_comfyui() -> None:
    """Start ComfyUI, or restart it if it died since the last job."""
    global _comfy_proc
    if _comfy_proc is None or _comfy_proc.poll() is not None:
        if _comfy_proc is not None:
            print(f"[worker] ComfyUI died (code {_comfy_proc.returncode}), restarting", flush=True)
        _comfy_proc = start_comfyui()
        wait_for_comfyui(_comfy_proc)


# --------------------------------------------------------------------------- #
# Prompt construction
# --------------------------------------------------------------------------- #
def load_template(mode: str) -> dict:
    if mode not in MODES:
        raise ValueError(f"unknown mode {mode!r}; expected one of {sorted(MODES)}")
    path = WORKFLOW_DIR / MODES[mode]
    if not path.is_file():
        raise FileNotFoundError(f"workflow template missing: {path}")
    return json.loads(path.read_text())


def nodes_of(prompt: dict, class_type: str) -> list[str]:
    return [nid for nid, node in prompt.items() if node.get("class_type") == class_type]


def first_node(prompt: dict, class_type: str) -> str | None:
    found = nodes_of(prompt, class_type)
    return found[0] if found else None


def set_if(prompt: dict, node_id: str | None, key: str, value) -> None:
    """Assign an input only when the caller actually supplied a value."""
    if node_id is None or value is None:
        return
    prompt[node_id]["inputs"][key] = value


def decode_image(data: str) -> bytes:
    """Accept a data: URI, a bare base64 string, or an http(s) URL."""
    if data.startswith(("http://", "https://")):
        r = _session.get(data, timeout=120)
        r.raise_for_status()
        return r.content
    if data.startswith("data:"):
        data = data.split(",", 1)[1]
    try:
        return base64.b64decode(data, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("image must be a base64 string, data: URI, or http(s) URL") from exc


def upload_image(raw: bytes, name: str) -> str:
    """Push an image into ComfyUI's input dir; returns the name LoadImage needs."""
    files = {"image": (name, raw, "application/octet-stream")}
    r = _session.post(f"{COMFY_URL}/upload/image", files=files,
                      data={"overwrite": "true", "type": "input"}, timeout=120)
    r.raise_for_status()
    info = r.json()
    subfolder = info.get("subfolder") or ""
    return f"{subfolder}/{info['name']}" if subfolder else info["name"]


def apply_inputs(prompt: dict, job: dict) -> dict:
    """Map the flat job payload onto whichever nodes the template happens to use."""
    cond_id = first_node(prompt, "MiniMaxH3ImageToVideo") or first_node(prompt, "MiniMaxH3ReferenceToVideo")
    sampler_id = first_node(prompt, "KSampler")
    shift_id = first_node(prompt, "MiniMaxH3SigmaShift")
    unet_id = first_node(prompt, "UNETLoader")
    clip_id = first_node(prompt, "CLIPLoader")
    video_id = first_node(prompt, "CreateVideo")

    set_if(prompt, cond_id, "prompt", job.get("prompt"))
    set_if(prompt, cond_id, "width", job.get("width"))
    set_if(prompt, cond_id, "height", job.get("height"))
    set_if(prompt, cond_id, "length", job.get("length"))
    set_if(prompt, cond_id, "ref_image_size", job.get("ref_image_size"))

    set_if(prompt, sampler_id, "seed", job.get("seed"))
    set_if(prompt, sampler_id, "steps", job.get("steps"))
    set_if(prompt, sampler_id, "cfg", job.get("cfg"))
    set_if(prompt, sampler_id, "sampler_name", job.get("sampler_name"))
    set_if(prompt, sampler_id, "scheduler", job.get("scheduler"))

    set_if(prompt, shift_id, "shift_video", job.get("shift_video"))
    set_if(prompt, shift_id, "shift_audio", job.get("shift_audio"))

    set_if(prompt, video_id, "fps", job.get("fps"))

    # Model overrides: request value wins, else the deployment's env default.
    is_ref = first_node(prompt, "MiniMaxH3ReferenceToVideo") is not None
    unet = job.get("unet_name") or (DEFAULT_REF_UNET if is_ref else DEFAULT_UNET)
    set_if(prompt, unet_id, "unet_name", unet or None)
    set_if(prompt, clip_id, "clip_name", job.get("clip_name") or DEFAULT_CLIP or None)

    # LoadImage nodes are matched by their _meta title, so a template can carry
    # several of them (first_frame, last_frame, ref_image_0, ...).
    supplied = job.get("images") or {}
    for nid in nodes_of(prompt, "LoadImage"):
        title = prompt[nid].get("_meta", {}).get("title", "")
        key = title.split(" ")[0].strip()
        if key in supplied and supplied[key]:
            raw = decode_image(supplied[key])
            prompt[nid]["inputs"]["image"] = upload_image(raw, f"{uuid.uuid4().hex}_{key}.png")

    # An unfed optional LoadImage would fail validation - drop it and its link.
    for nid in nodes_of(prompt, "LoadImage"):
        if prompt[nid]["inputs"].get("image") not in ("example.png", "", None):
            continue
        del prompt[nid]
        for node in prompt.values():
            for key, val in list(node.get("inputs", {}).items()):
                if isinstance(val, list) and len(val) == 2 and val[0] == nid:
                    del node["inputs"][key]

    return prompt


def build_prompt(job: dict) -> dict:
    if job.get("workflow"):
        prompt = copy.deepcopy(job["workflow"])
    else:
        prompt = apply_inputs(load_template(job.get("mode", "t2v")), job)

    for nid, inputs in (job.get("overrides") or {}).items():
        if nid not in prompt:
            raise ValueError(f"override targets unknown node {nid!r}")
        prompt[nid]["inputs"].update(inputs)

    return prompt


# --------------------------------------------------------------------------- #
# Queue / poll / collect
# --------------------------------------------------------------------------- #
def queue_prompt(prompt: dict, client_id: str) -> str:
    r = _session.post(f"{COMFY_URL}/prompt", json={"prompt": prompt, "client_id": client_id}, timeout=60)
    if r.status_code != 200:
        # ComfyUI reports validation failures as structured JSON; surface them intact.
        try:
            raise RuntimeError(f"ComfyUI rejected the prompt: {json.dumps(r.json(), ensure_ascii=False)}")
        except ValueError:
            raise RuntimeError(f"ComfyUI rejected the prompt: HTTP {r.status_code} {r.text[:2000]}")
    return r.json()["prompt_id"]


def await_result(prompt_id: str, job_id: str) -> dict:
    deadline = time.time() + JOB_TIMEOUT
    last_report = 0.0
    while time.time() < deadline:
        if _comfy_proc is not None and _comfy_proc.poll() is not None:
            raise RuntimeError("ComfyUI crashed while running the job (likely OOM)")

        r = _session.get(f"{COMFY_URL}/history/{prompt_id}", timeout=30)
        r.raise_for_status()
        history = r.json()
        if prompt_id in history:
            entry = history[prompt_id]
            status = entry.get("status", {})
            if status.get("status_str") == "error" or not status.get("completed", True):
                messages = status.get("messages", [])
                raise RuntimeError(f"execution failed: {json.dumps(messages, ensure_ascii=False)[:4000]}")
            return entry

        now = time.time()
        if now - last_report > 15:
            last_report = now
            try:
                runpod.serverless.progress_update({"status": "running", "prompt_id": prompt_id}, job_id)
            except Exception:
                pass
        time.sleep(POLL_INTERVAL)

    raise TimeoutError(f"job exceeded JOB_TIMEOUT of {JOB_TIMEOUT}s")


def fetch_output(entry: dict) -> list[dict]:
    """Pull every saved file referenced by the history entry."""
    results = []
    for node_id, out in entry.get("outputs", {}).items():
        for values in out.values():
            if not isinstance(values, list):
                continue
            for item in values:
                if not isinstance(item, dict) or "filename" not in item:
                    continue
                params = urllib.parse.urlencode({
                    "filename": item["filename"],
                    "subfolder": item.get("subfolder", ""),
                    "type": item.get("type", "output"),
                })
                r = _session.get(f"{COMFY_URL}/view?{params}", timeout=600)
                r.raise_for_status()
                results.append({"node_id": node_id, "filename": item["filename"], "data": r.content})
    return results


def deliver(files: list[dict], job_id: str) -> list[dict]:
    use_s3 = bool(os.environ.get("BUCKET_ENDPOINT_URL"))
    out = []
    for f in files:
        record = {"node_id": f["node_id"], "filename": f["filename"], "size": len(f["data"])}
        uploaded = False

        if use_s3:
            # Prefix with the job id so concurrent jobs cannot collide in the bucket.
            key = f"{job_id}_{f['filename']}"
            tmp = pathlib.Path("/tmp") / key
            tmp.parent.mkdir(parents=True, exist_ok=True)
            tmp.write_bytes(f["data"])
            try:
                record["url"] = rp_upload.upload_file_to_bucket(key, str(tmp))
                uploaded = True
            except Exception as exc:
                record["upload_error"] = str(exc)
            finally:
                tmp.unlink(missing_ok=True)

        if not uploaded:
            # base64 inflates by 4/3, and it is the encoded blob that has to fit
            # in the RunPod response - so budget against the encoded size.
            encoded = base64.b64encode(f["data"]).decode()
            if len(encoded) > MAX_INLINE_BYTES:
                record["error"] = (
                    f"{len(encoded)} base64 bytes exceeds MAX_INLINE_BYTES ({MAX_INLINE_BYTES}). "
                    "Configure S3 (BUCKET_ENDPOINT_URL etc.) or shorten the clip."
                )
            else:
                record["data"] = encoded
                record["encoding"] = "base64"
        out.append(record)
    return out


# --------------------------------------------------------------------------- #
# Entrypoint
# --------------------------------------------------------------------------- #
def handler(job: dict) -> dict:
    job_input = job.get("input") or {}
    job_id = job.get("id", "local")
    started = time.time()

    try:
        ensure_comfyui()
        prompt = build_prompt(job_input)
        prompt_id = queue_prompt(prompt, client_id=job_id)
        print(f"[worker] queued prompt {prompt_id}", flush=True)
        entry = await_result(prompt_id, job_id)
        files = fetch_output(entry)
    except Exception as exc:
        print(f"[worker] job failed: {exc}", flush=True)
        result = {"error": str(exc)}
        # A dead ComfyUI means this worker cannot serve the next job either.
        if _comfy_proc is not None and _comfy_proc.poll() is not None:
            result["refresh_worker"] = True
        return result

    if not files:
        return {"error": "workflow produced no output files - is there a SaveVideo node?"}

    return {
        "prompt_id": prompt_id,
        "seconds": round(time.time() - started, 1),
        "files": deliver(files, job_id),
    }


if __name__ == "__main__":
    ensure_comfyui()
    runpod.serverless.start({"handler": handler})
