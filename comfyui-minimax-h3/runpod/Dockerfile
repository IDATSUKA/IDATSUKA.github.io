# ComfyUI + MiniMax H3 worker for RunPod Serverless.
#
# Weights are NOT baked in - they live on a RunPod Network Volume mounted at
# /runpod-volume, so the image stays small and cold starts stay reasonable.
#
# Plain Ubuntu, not an nvidia/cuda image: the PyTorch cu130 wheels pull their own
# CUDA runtime and cuDNN as nvidia-*-cu13 pip packages, and the host driver is
# injected by the container runtime. One less version to keep in sync.
FROM ubuntu:24.04

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

# cu130, NOT cu128. comfy/quant_ops.py disables the comfy-kitchen CUDA backend
# when torch.version.cuda < 13 ("You need pytorch with cu130 or higher to use
# optimized CUDA operations"), and that backend is what runs the INT8 convrot and
# NVFP4 kernels every quantized H3 profile depends on.
RUN pip install --upgrade pip && \
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130

# Pinned to a revision that contains the native MiniMax H3 nodes
# (comfy_extras/nodes_minimax_h3.py, added 2026-08-03).
ARG COMFYUI_REF=2eb609766a749e3104485979615e062e401bab97
RUN git clone https://github.com/comfyanonymous/ComfyUI.git /comfyui && \
    cd /comfyui && git checkout ${COMFYUI_REF}

RUN pip install -r /comfyui/requirements.txt && \
    pip install runpod requests huggingface_hub hf_transfer

# Fail the build rather than ship an image that silently falls back to the slow
# path at runtime.
RUN python -c "import torch, sys; v = tuple(map(int, torch.version.cuda.split('.'))); \
    sys.exit(0) if v >= (13, 0) else sys.exit('torch is built for CUDA %s; the INT8/NVFP4 kernels need cu130+' % torch.version.cuda)"

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
