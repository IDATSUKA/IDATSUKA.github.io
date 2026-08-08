# ComfyUI + MiniMax H3 構築キット

MiniMax H3（Hailuo 3.0 系のオープンウェイト版・2026-08-03 公開）を ComfyUI で動かすための一式です。

- **RunPod Serverless** — Docker イメージ + ハンドラで、API を叩くと mp4（映像＋音声）が返る構成
- **Windows ローカル** — PowerShell 一発で ComfyUI・PyTorch・重みを揃える構成
- **macOS** — ComfyUI 同梱の **API ノード**で使う構成（Mac ではローカル実行不可。理由は
  [docs/mac-setup.md](docs/mac-setup.md)）

H3 は映像と 32kHz ステレオ音声を**同時に**生成するモデルなので、ワークフローは
「映像 latent と音声 latent が組になった AV latent を 1 回のサンプリングで解いて、
最後に分離してから mux する」形になります。普通の動画モデルとはグラフの形が違います。

---

## 中身

```
comfyui-minimax-h3/
├── workflows/              ローカル実行用（重みを使う）
│   ├── t2v.json            テキスト → 動画＋音声
│   ├── flf2v.json          最初/最後のフレーム指定 → 動画＋音声
│   ├── ref2v.json          参照画像 → 動画＋音声
│   └── api/                ホスト API 用（重み不要・Mac 向け）
│       ├── api_t2v.json
│       ├── api_flf2v.json
│       └── api_ref2v.json
├── scripts/
│   ├── check_hardware.py   このマシンで動くか判定して profile を提案
│   └── download_models.py  Hugging Face から重みを取得（Windows/RunPod 共通）
├── runpod/
│   ├── Dockerfile          ワーカーのイメージ
│   ├── handler.py          Serverless ハンドラ
│   ├── extra_model_paths.yaml
│   └── test_input.json
├── windows/
│   ├── install.ps1         Windows 用インストーラ
│   └── download_models.ps1
├── mac/
│   └── install.sh          macOS 用インストーラ（重みは落とさない）
├── client/
│   ├── call_runpod.py      RunPod エンドポイント呼び出し
│   ├── call_local_api.py   ローカル ComfyUI 経由で API ノードを実行
│   └── batch_local.py      プロンプトをまとめてローカル GPU で消化
└── docs/
    ├── free-setup.md       ★ 無料でできる範囲の最高構築
    ├── runpod-serverless.md
    ├── windows-setup.md
    ├── mac-setup.md
    └── troubleshooting.md
```

## どれを使うか

まず判定してください（何も入れていない状態でも動きます）。

```bash
python scripts/check_hardware.py
```

| | 生成する場所 | GPU 要件 | 重み | 課金 |
|---|---|---|---|---|
| Windows ローカル | 手元の NVIDIA GPU | **24GB 以上・Ampere 以降** | 必要 | **無料**（電気代のみ） |
| Windows / macOS（API ノード） | MiniMax のサーバ | **不要** | 不要 | 1 本ごと（768P で約 $0.13/秒） |
| RunPod Serverless | RunPod の GPU | 不要（借りる） | 必要（Network Volume） | GPU 秒課金 |

GPU が条件を満たさない場合、Windows でも `install.ps1 -ApiOnly` で API ノード構成が入ります。

無料で完結させたい場合は **[docs/free-setup.md](docs/free-setup.md)** を読んでください。
動かせる GPU の条件（bf16 対応 = Ampere 世代以降）と、Colab / Kaggle の無料枠が
使えない理由をソース根拠つきでまとめています。

---

## モデルと VRAM の目安

H3 は DiT 本体・テキストエンコーダ（Qwen3-VL-32B）・映像 VAE・音声 VAE の 4 点構成です。
量子化の組み合わせを `--profile` で切り替えます。

| profile | DiT | テキストエンコーダ | 想定 GPU | ディスク |
|---|---|---|---|---|
| `bf16` | bf16（約 66GB） | bf16（約 52GB） | H100 / H200 / B200（80GB 超） | 約 124GB |
| `int8` | pruned INT8 convrot（約 20GB） | INT8 convrot | L40S / A6000 Ada（48GB） | 約 50GB |
| `nvfp4` | pruned INT8 convrot | NVFP4 AWQ（約 15GB） | **Blackwell 専用** RTX 5090 / RTX PRO 6000 / B200（24〜32GB） | 約 40GB |
| `fp8` | pruned fp8 scaled | INT8 convrot | Ada / Hopper で INT8 が通らない時の代替 | 約 45GB |

- **NVFP4 は Blackwell 世代の GPU でしか動きません。** RTX 4090 などでは `int8` を使ってください。
- **PyTorch は cu130 以上が必須です。** cu128 以下だと ComfyUI が INT8 / NVFP4 の
  カーネルを無効化してしまい、量子化 profile が最適化パスに乗りません
  （`comfy/quant_ops.py`）。
- **Ampere 世代（RTX 30xx / A100）より前の GPU では動きません。** H3 は bf16 / fp32 しか
  サポートせず、bf16 は compute capability 8.0 以上が条件のためです。
- どの profile でも映像 VAE（fp16）と音声 VAE（fp32）は必ず両方必要です。
- 上のサイズは公開情報ベースの概算です。実際のファイルサイズはダウンロード後に
  `download_models.py` が実測値を出力します。

---

## クイックスタート

### RunPod Serverless

```bash
# 1. イメージをビルドして push（リポジトリのルートから）
docker build -f comfyui-minimax-h3/runpod/Dockerfile -t <user>/comfyui-minimax-h3:latest comfyui-minimax-h3
docker push <user>/comfyui-minimax-h3:latest

# 2. Network Volume に重みを入れる（Pod から一度だけ）
python download_models.py --models-dir /workspace/ComfyUI/models --profile int8

# 3. Serverless Endpoint を作成（詳細は docs/runpod-serverless.md）

# 4. 呼び出す
export RUNPOD_API_KEY=... RUNPOD_ENDPOINT_ID=...
python comfyui-minimax-h3/client/call_runpod.py --prompt "夜の渋谷を歩く猫、雨音つき" --out out.mp4
```

→ **[docs/runpod-serverless.md](docs/runpod-serverless.md)**

### Windows

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd comfyui-minimax-h3\windows
.\install.ps1 -InstallDir D:\AI\ComfyUI -Quant int8
```

終わったら `D:\AI\ComfyUI\run_comfyui.bat` を実行して <http://127.0.0.1:8188> を開きます。

→ **[docs/windows-setup.md](docs/windows-setup.md)**

### macOS

重みは落としません（Mac ではローカル実行できないため）。生成は MiniMax のサーバ側です。

```bash
cd comfyui-minimax-h3/mac
chmod +x install.sh && ./install.sh -d ~/ComfyUI

# GUI: ~/ComfyUI/run_comfyui.command を起動し、右上からログイン
# CLI:
export COMFY_API_KEY=comfyui-xxxxxxxx
python ../client/call_local_api.py --prompt "夜の渋谷を歩く猫、雨音つき" --out out.mp4
```

→ **[docs/mac-setup.md](docs/mac-setup.md)**

---

## ワークフローの構造（ローカル実行版）

`workflows/*.json` の 3 つはどれも同じ骨格です（ノード名は ComfyUI 本体のソースに実在するものを使用）。
`workflows/api/*.json` は API ノード 1 個＋ SaveVideo だけの、まったく別の単純な構成です。

```
UNETLoader ─────────────► MiniMaxH3SigmaShift ──┐  (shift_video=12, shift_audio=3)
CLIPLoader (type=minimax) ─┐                    │
VAELoader (video) ─────────┼► MiniMaxH3ImageToVideo ──► positive ──┐
VAELoader (audio) ─────────┘         └─────────────────► AV latent ─┤
                                     ConditioningZeroOut ► negative ─┤
                                                                     ▼
                                                                 KSampler
                                                                     │
                                                       LTXVSeparateAVLatent
                                                          ├─ video → VAEDecode ──┐
                                                          └─ audio → VAEDecodeAudio ─┤
                                                                                 ▼
                                                                    CreateVideo (fps=24)
                                                                                 ▼
                                                                             SaveVideo
```

ポイント：

- **`length` は 24fps のフレーム数**で、内部で `17k+5` のグリッドに切り上げられます。
  `124` が約 5 秒、学習範囲はおおむね `124`〜`362`（約 5〜15 秒）です。
- **解像度は 32 の倍数**。短辺 768 / 面積上限 768×1344 が基準です。
- **`cfg` は 1.0**（negative は `ConditioningZeroOut` のダミー）。cfg=1 のとき ComfyUI は
  uncond を評価しないので、そのぶん速く回ります。
- **`LTXVSeparateAVLatent`** は名前こそ LTXV ですが、ComfyUI 本体で
  「任意の AV モデル（LTXV や MiniMax H3）」用と明記されている汎用ノードです。
- ref2v のプロンプトでは参照物を `<Picture 1>` / `<Video 1>` / `<Audio 1>` というタグで指します。

---

## 検証状況

ワークフローは**実際に起動した ComfyUI（CPU モード）の検証器に通してあります**。

| 対象 | 結果 |
|---|---|
| `workflows/api/*.json` | **検証通過**（HTTP 200）。ノード実行まで到達 |
| `workflows/*.json` | エラーは重みファイル未配置（`value_not_in_list`）のみ。グラフ側の指摘はゼロ |
| ノード 11 種の存在と入力名 | 稼働中サーバの `/object_info` と一致 |
| `runpod/handler.py` | キュー投入 → ポーリング → 取得 → base64 返却まで実サーバで通し確認 |
| `client/batch_local.py` | 投入・回収・再開スキップを実サーバで確認 |

未確認なのは**生成そのもの**（GPU と重みが要るため）と、各 OS のインストーラ実行です。

## ライセンス / 注意

- モデルは **MiniMax H3 Community License** の下で公開されています。商用利用の可否・
  クレジット表記などは配布元の規約を必ず確認してください。
- Hugging Face 側でライセンス同意が必要な場合は `HF_TOKEN` を環境変数に設定してください。
- ComfyUI は 2026-08-03 に H3 対応が入ったばかりです。ノード仕様が動く可能性があるため、
  Dockerfile / install.ps1 ではコミット ID を固定しています（`COMFYUI_REF`）。
