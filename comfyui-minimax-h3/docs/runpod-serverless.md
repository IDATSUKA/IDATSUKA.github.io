# RunPod Serverless で MiniMax H3 を動かす

重みは Docker イメージに焼かず、**Network Volume** に置きます。40〜120GB のレイヤーを
持つイメージはビルドも pull も遅く、コールドスタートが実用にならないためです。

構成はこうなります。

```
[あなたのコード] ──HTTPS──► RunPod Endpoint ──► Worker コンテナ
                                                  ├─ handler.py（RunPod SDK）
                                                  ├─ ComfyUI（127.0.0.1:8188 で常駐）
                                                  └─ /runpod-volume（重み・読み取り）
```

`handler.py` はワーカー起動時に ComfyUI を 1 回だけ立ち上げ、以降のジョブでは
そのプロセスを使い回します。2 回目以降のリクエストはモデルロードを払いません。

---

## 1. Network Volume を作って重みを入れる

1. RunPod のコンソールで **Storage → Network Volume** を作成します。
   - リージョンは、後で使う GPU の在庫があるところを選ぶこと（volume はリージョン固定）。
   - 容量は profile 次第：`int8` なら **100GB**、`bf16` なら **200GB** 程度みておく。
2. その volume を付けた **Pod**（安い GPU で可、CPU pod でも可）を一時的に起動します。
   Pod では volume は `/workspace` にマウントされます。
3. Pod のターミナルで重みを取得します。

```bash
pip install huggingface_hub hf_transfer
# ライセンス同意が要る場合: export HF_TOKEN=hf_xxx

# このリポジトリから download_models.py を持ってくる
git clone --depth 1 https://github.com/IDATSUKA/IDATSUKA.github.io.git /tmp/kit
cd /tmp/kit/comfyui-minimax-h3/scripts

# まず何が公開されているか確認（ファイル名が変わっていないかの確認になる）
python download_models.py --list

python download_models.py \
  --models-dir /workspace/ComfyUI/models \
  --profile int8 \
  --ref2va          # ref2v ワークフローも使うなら
```

最終的に volume の中はこうなっていれば OK です。

```
/workspace/ComfyUI/models/
├── diffusion_models/minimax_h3_fl2va_pruned_int8_convrot.safetensors
├── text_encoders/qwen3vl_32b_minimax_h3_int8_convrot.safetensors
└── vae/
    ├── minimax_h3_video_vae_fp16.safetensors
    └── minimax_h3_audio_vae_fp32.safetensors
```

4. Pod は終了して構いません（volume は残ります）。

> Serverless のワーカーでは同じ volume が `/runpod-volume` にマウントされます。
> `extra_model_paths.yaml` は `/runpod-volume/ComfyUI/` と `/workspace/ComfyUI/` の
> 両方を見るようにしてあるので、Pod でも Serverless でも同じ volume が使えます。

---

## 2. イメージをビルドして push

ビルドコンテキストは `comfyui-minimax-h3/` です（`workflows/` と `scripts/` を
イメージに入れるため）。

```bash
cd /path/to/IDATSUKA.github.io

docker build \
  -f comfyui-minimax-h3/runpod/Dockerfile \
  -t <dockerhub-user>/comfyui-minimax-h3:1.0.0 \
  comfyui-minimax-h3

docker push <dockerhub-user>/comfyui-minimax-h3:1.0.0
```

GPU のないマシンからでもビルドできます（実行時にしか CUDA を使わないため）。
イメージは PyTorch 込みでおよそ 8〜10GB になります。

---

## 3. Endpoint を作る

**Serverless → New Endpoint** で以下を設定します。

| 項目 | 値 |
|---|---|
| Container Image | `<dockerhub-user>/comfyui-minimax-h3:1.0.0` |
| Container Disk | 20 GB（重みは volume 側なので小さくてよい） |
| Network Volume | 手順 1 で作ったもの |
| GPU | profile に合わせる（下表） |
| Max Workers | 最初は 1〜2 |
| Idle Timeout | 60〜300 秒（長いほど再ロードが減るが課金される） |
| Execution Timeout | 1800 秒以上（15 秒クリップは数分かかる） |
| FlashBoot | 有効推奨 |

GPU の選び方：

| profile | RunPod の GPU |
|---|---|
| `int8` | L40S 48GB / A6000 Ada 48GB / A100 80GB |
| `bf16` | H100 80GB / H200 / B200 |
| `nvfp4` | RTX 5090 / RTX PRO 6000 (Blackwell) / B200 |
| `fp8` | L40S / A100（INT8 convrot が通らない場合の代替） |

### 環境変数

| 変数 | 既定 | 用途 |
|---|---|---|
| `MINIMAX_H3_UNET` | ワークフロー JSON の値 | DiT のファイル名を上書き |
| `MINIMAX_H3_REF_UNET` | 〃 | ref2v 用 DiT のファイル名 |
| `MINIMAX_H3_CLIP` | 〃 | テキストエンコーダのファイル名 |
| `JOB_TIMEOUT` | `3600` | 1 ジョブの上限秒数 |
| `STARTUP_TIMEOUT` | `900` | ComfyUI 起動待ちの上限秒数 |
| `MAX_INLINE_BYTES` | `8388608` | これを超える動画は base64 で返さない |
| `COMFY_EXTRA_ARGS` | 空 | ComfyUI への追加フラグ（例 `--reserve-vram 2.0`） |
| `BUCKET_ENDPOINT_URL` ほか | 未設定 | 設定すると mp4 を S3 に上げて URL を返す |

profile を変えたら `MINIMAX_H3_UNET` / `MINIMAX_H3_CLIP` を書き換えるだけで、
イメージを再ビルドせずに切り替えられます。

### 大きい動画を返す場合（推奨）

15 秒 768p の mp4 は 8MB を超えることがあり、その場合 base64 では返せません。
RunPod の S3 連携を使ってください。

```
BUCKET_ENDPOINT_URL = https://<account>.r2.cloudflarestorage.com/<bucket>
BUCKET_ACCESS_KEY_ID = ...
BUCKET_SECRET_ACCESS_KEY = ...
```

設定するとレスポンスの `files[].url` に署名付き URL が入ります。

---

## 4. 呼び出す

### 付属クライアント

```bash
export RUNPOD_API_KEY=...
export RUNPOD_ENDPOINT_ID=...

# テキスト → 動画
python comfyui-minimax-h3/client/call_runpod.py \
  --prompt 'A cinematic close-up of a woman on a rainy Tokyo street, she says "hello", ambient rain' \
  --length 124 --out out.mp4

# 最初のフレームを指定
python comfyui-minimax-h3/client/call_runpod.py \
  --mode flf2v --first-frame start.png \
  --prompt "the camera slowly pushes in, wind rustling the leaves" --out out.mp4

# 参照画像（プロンプト中で <Picture 1> と書く）
python comfyui-minimax-h3/client/call_runpod.py \
  --mode ref2v --ref-image character.png \
  --prompt "<Picture 1> walks through a sunlit forest, birdsong" --out out.mp4
```

### 生の HTTP

```bash
curl -X POST "https://api.runpod.ai/v2/$RUNPOD_ENDPOINT_ID/run" \
  -H "Authorization: Bearer $RUNPOD_API_KEY" \
  -H "Content-Type: application/json" \
  -d @comfyui-minimax-h3/runpod/test_input.json
```

### 入力スキーマ

```jsonc
{
  "input": {
    "mode": "t2v",              // t2v | flf2v | ref2v
    "prompt": "...",
    "width": 1344,              // 32 の倍数
    "height": 768,
    "length": 124,              // 24fps のフレーム数。124 ≒ 5 秒
    "steps": 50,
    "cfg": 1.0,
    "seed": 42,
    "sampler_name": "res_multistep",
    "scheduler": "simple",
    "shift_video": 12.0,
    "shift_audio": 3.0,
    "fps": 24.0,
    "ref_image_size": "match",  // ref2v のみ。"max" は精度重視・かなり遅い
    "images": {                 // base64 / data URI / http(s) URL
      "first_frame": "...",
      "last_frame": "...",
      "ref_image_0": "..."
    }
  }
}
```

プリセットで足りないことをしたいときは、ComfyUI の
「Workflow → Export (API)」で書き出した JSON をそのまま投げられます。

```jsonc
{
  "input": {
    "workflow": { /* API フォーマットのグラフ全体 */ },
    "overrides": { "8": { "seed": 12345 } }   // ノード ID 指定で部分上書き
  }
}
```

### 出力

```jsonc
{
  "prompt_id": "…",
  "seconds": 214.7,
  "files": [
    {
      "node_id": "13",
      "filename": "t2v_00001_.mp4",
      "size": 4210233,
      "encoding": "base64",
      "data": "AAAAIGZ0eXBpc29t…"     // S3 設定時は "url" になる
    }
  ]
}
```

---

## コストとコールドスタートの現実的な話

- **コールドスタート**：ワーカーが新規に立つと ComfyUI の起動＋初回のモデルロードが
  走ります。Network Volume からの読み込みなので、`int8` profile（約 46GB）で
  数分かかることを見込んでください。FlashBoot と Idle Timeout を長めにするのが効きます。
- **Active Worker を 1 にする**と常に温まった状態になりますが、常時課金です。
  バッチ的に使うなら Idle Timeout を伸ばすほうが安く済むことが多いです。
- **1 リクエストの実行時間**は解像度・長さ・steps で大きく変わります。
  まず `length: 124`・`steps: 50` で 1 本流して実測し、そこから調整してください。
- `Execution Timeout` を短くしすぎると、生成が終わる前にジョブが殺されます。

---

## ローカルでの動作確認

GPU のあるマシンなら、Serverless に上げる前に同じイメージで検証できます。

```bash
docker run --rm --gpus all \
  -v /path/to/models:/runpod-volume/ComfyUI/models:ro \
  -e RUNPOD_TEST_INPUT="$(cat comfyui-minimax-h3/runpod/test_input.json)" \
  <dockerhub-user>/comfyui-minimax-h3:1.0.0
```

RunPod SDK はテスト入力があると 1 ジョブだけ処理して終了します。
ComfyUI の Web UI を直接見たい場合は次のようにします。

```bash
docker run --rm --gpus all -p 8188:8188 \
  -v /path/to/models:/runpod-volume/ComfyUI/models \
  --entrypoint python \
  <dockerhub-user>/comfyui-minimax-h3:1.0.0 \
  /comfyui/main.py --listen 0.0.0.0 --port 8188 \
  --extra-model-paths-config /extra_model_paths.yaml
```
