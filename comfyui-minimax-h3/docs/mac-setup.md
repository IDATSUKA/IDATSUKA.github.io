# MacBook に ComfyUI + MiniMax H3（API ノード）を構築する

MacBook では **H3 の重みをローカルで回すことはできません**。代わりに ComfyUI 同梱の
**API ノード**を使い、生成は MiniMax のサーバ側で行います。ComfyUI と UI は手元、
GPU 処理は向こう側、という分担です。

---

## なぜローカル実行が無理なのか

ComfyUI 本体のソースを確認した結果、壁が 2 つあります。

**1. 量子化版のカーネルが Mac に無い**
INT8 convrot / NVFP4 の実行は comfy-kitchen の CUDA / ROCm / Triton バックエンド経由でのみ
有効になります。`comfy/quant_ops.py` は `torch.version.cuda` が `None` の環境で
CUDA バックエンドを無効化し、Triton も入らないため、Apple Silicon では
量子化済みチェックポイントを実行する手段が残りません。

**2. bf16 版はメモリに載らない**
量子化を諦めて bf16 にすると DiT が約 66GB、テキストエンコーダ（Qwen3-VL-32B）が
約 52GB で、重みだけで **約 118GB**。MacBook Pro の上限は M5 Max の 128GB なので、
OS と推論中のアクティベーションを足すと最上位構成でも足りません。

つまり「Mac に H3 の重みを入れる」構成は、機材の問題ではなく現状の実装として成立しません。
ローカルで重みを回したい場合は Windows 機（`../docs/windows-setup.md`）か
RunPod（`../docs/runpod-serverless.md`）を使ってください。

---

## API ノードで何ができるか

ComfyUI には MiniMax のホスト API を叩くノードが 3 つ入っています
（カテゴリ `partner/video/MiniMax`）。

| ノード | できること |
|---|---|
| MiniMax H3 Text to Video | テキスト → 動画 |
| MiniMax H3 First-Last-Frame to Video | 最初（＋任意で最後）のフレーム → 動画 |
| MiniMax H3 Reference to Video | 参照画像/動画/音声 → 動画 |

いずれも 768P / 2K、5〜15 秒。ローカル GPU は一切使いません。

### 料金

ノード自身が持っている料金式によると、**秒あたり**でかかります。

| 解像度 | 単価 | 5 秒 | 15 秒 |
|---|---|---|---|
| 768P | $0.1287 / 秒 | 約 $0.64 | 約 $1.93 |
| 2K | $0.1859 / 秒 | 約 $0.93 | 約 $2.79 |

支払いは Comfy アカウントのクレジットです。ローカル実行と違って
**1 本ごとに課金される**ので、試行錯誤する場合はまず 768P・5 秒で回してください。

---

## インストール

```bash
cd <このリポジトリ>/comfyui-minimax-h3/mac
chmod +x install.sh
./install.sh -d ~/ComfyUI
```

やること：

1. git / Python 3.12・3.13 の確認
2. ComfyUI を固定コミットで clone（API ノードが入っている版）
3. `venv` を作って PyTorch と ComfyUI の依存を導入（**重みのダウンロードは無し**）
4. `workflows/api/*.json` を ComfyUI の workflows にコピー
5. `run_comfyui.command` を生成（Finder からダブルクリックで起動できます）

Intel Mac でも動きます。API ノードは生成をサーバ側でやるので、
ローカルの GPU 性能は関係ありません。

> 依存のビルドで失敗する場合は、公式の **ComfyUI Desktop**（<https://www.comfy.org/download>）を
> 使うのが手っ取り早いです。全部同梱された .dmg で、同じ API ノードが使えます。

---

## サインイン（必須）

API ノードは Comfy アカウントに課金されるため、認証しないと動きません。

**GUI で使う場合**
ComfyUI を起動 → 右上のユーザーメニューからログイン。以降はそのセッションで課金されます。

**スクリプトから使う場合**
<https://platform.comfy.org/> で API キー（`comfyui-` で始まる文字列）を発行し、
環境変数に入れます。

```bash
export COMFY_API_KEY=comfyui-xxxxxxxxxxxxxxxx
```

キーはリクエストの `extra_data.api_key_comfy_org` として送られます。
リポジトリにコミットしないよう注意してください。

---

## 使う

### GUI

`~/ComfyUI/run_comfyui.command` を起動して <http://127.0.0.1:8188> を開き、
ノード検索で "MiniMax H3" と打つと 3 つのノードが出ます。

同梱ワークフローは `Workflow → Open` から
`user/default/workflows/minimax_h3_api/` の JSON を開いてください。

### コマンドライン

```bash
export COMFY_API_KEY=comfyui-xxxxxxxx

# テキスト → 動画
python ../client/call_local_api.py \
  --prompt 'A cat DJing on a rooftop at sunset, crowd cheering' \
  --resolution 768P --duration 5 --out cat.mp4

# 最初のフレーム指定（アスペクト比は画像に従うので --ratio は無視されます）
python ../client/call_local_api.py --mode flf2v \
  --first-frame start.png --prompt "the camera slowly pushes in" --out push.mp4

# 参照画像（プロンプトでは "Image 1" と書く）
python ../client/call_local_api.py --mode ref2v \
  --ref-image hero.png --prompt "Image 1 walks through a sunlit forest" --out hero.mp4
```

実行前に概算コストを表示して確認を求めます（`--yes` で省略）。

---

## ローカル版とのプロンプト記法の違い

**参照物の指し方が違います。**

| | 記法 |
|---|---|
| ローカル版（`MiniMaxH3ReferenceToVideo`） | `<Picture 1>` / `<Video 1>` / `<Audio 1>` |
| API 版（`MinimaxHailuo03ReferenceNode`） | `Image 1` / `Video 1` / `Audio 1` |

`workflows/` と `workflows/api/` のワークフローに互換性はありません。用途で使い分けてください。

## 参照素材の制約（API 版）

ノード側でバリデーションされます。

- **画像**：最小 256×256、アスペクト比 0.4〜2.5、最大 9 枚
- **動画**：23.976〜60 FPS、1 本 2 秒以上、合計 15 秒以内、最大 3 本
- **音声**：1 本 2 秒以上、合計 15 秒以内、最大 3 本。
  画像か動画が 1 つも無い状態では使えません
- 画像・動画のどちらか一方は必須

---

## Mac から RunPod を使いたくなったら

課金単価やレイテンシの都合で自前 GPU に切り替えたくなった場合、
`client/call_runpod.py` は純 Python なので macOS でそのまま動きます。

```bash
export RUNPOD_API_KEY=... RUNPOD_ENDPOINT_ID=...
python ../client/call_runpod.py --prompt "..." --out out.mp4
```
