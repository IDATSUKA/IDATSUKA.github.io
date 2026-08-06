# ComfyUI + MiniMax H3 worker for RunPod Serverless.
#
# Weights are NOT baked in - they live on a RunPod Network Volume mounted at
# /runpod-volume, so the image stays small and cold starts stay reasonable.
FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HUB_ENABLE_HF_TRANSFER=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        python3.12 python3.12-venv python3-pip \
        git curl ca-certificates \
        libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

RUN python3.12 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# CUDA 12.8 wheels: required for Blackwell (RTX 50xx / B200), fine on Ada/Hopper.
RUN pip install --upgrade pip && \
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128

# Pinned to a revision that contains the native MiniMax H3 nodes
# (comfy_extras/nodes_minimax_h3.py, added 2026-08-03).
ARG COMFYUI_REF=2eb609766a749e3104485979615e062e401bab97
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /comfyui && \
    cd /comfyui && git checkout ${COMFYUI_REF}

RUN pip install -r /comfyui/requirements.txt && \
    pip install runpod requests huggingface_hub hf_transfer

COPY runpod/handler.py /handler.py
COPY runpod/extra_model_paths.yaml /extra_model_paths.yaml
COPY workflows/ /workflows/
COPY scripts/download_models.py /download_models.py

ENV COMFY_ROOT=/comfyui \
    COMFY_HOST=127.0.0.1 \
    COMFY_PORT=8188 \
    WORKFLOW_DIR=/workflows \
    EXTRA_MODEL_PATHS=/extra_model_paths.yaml

CMD ["python", "-u", "/handler.py"]
