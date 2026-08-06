# トラブルシューティング

## モデル・ノードが見つからない

**`Node type not found: MiniMaxH3ImageToVideo`**
ComfyUI が古いです。H3 のネイティブノードは 2026-08-03 に入りました。
`comfy_extras/nodes_minimax_h3.py` が存在するか確認してください。無ければ更新します。

```powershell
cd D:\AI\ComfyUI
git fetch origin && git checkout master && git pull
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

**`Value not in list: unet_name` / `clip_name`**
ファイル名が実際に置いてあるものと違います。ComfyUI 起動後に確認できます。

```bash
curl -s http://127.0.0.1:8188/object_info/UNETLoader | python -m json.tool | head -40
```

RunPod なら `MINIMAX_H3_UNET` / `MINIMAX_H3_CLIP` の環境変数で合わせるのが早いです。

**`download_models.py` が「repo にそのファイル名が無い」と言う**
リパックのファイル名が変わった可能性があります。まず一覧を見てください。

```bash
python download_models.py --list
```

出てきた実名に合わせて、スクリプト内の `PROFILES` とワークフロー JSON を直します。

**Hugging Face で 401 / 403**
ライセンス同意が必要なリポジトリです。Hub 上で規約に同意し、
`HF_TOKEN`（または `HUGGING_FACE_HUB_TOKEN`）を設定してください。

---

## メモリ・パフォーマンス

**`CUDA out of memory`**

順番に試します。

1. 解像度を下げる（1344×768 → 832×480）
2. `length` を 124（約 5 秒）に戻す
3. `--reserve-vram 2.0` を付ける
4. テキストエンコーダを小さい量子化に変える（Blackwell なら `nvfp4`、約 15GB）
5. DiT を pruned INT8 に変える
6. `--cache-none` を付ける

**生成が異常に遅い / ディスクがずっと唸っている**
システム RAM が足りず、DiT のレイヤーストリーミングがページファイル経由に
なっています。RAM を増やすか、ページファイルを 64GB 以上に設定してください。
モデルを HDD ではなく NVMe SSD に置くことも効きます。

**ワーカーが無言で死ぬ（RunPod）**
ほぼ OOM です。`handler.py` は ComfyUI の死亡を検知して
`refresh_worker: true` を返すので、レスポンスの `error` を確認してください。
GPU を 1 段上（48GB → 80GB）にするか、profile を下げます。

---

## RunPod 固有

**コールドスタートが毎回数分かかる**
Network Volume からの初回ロードです。対策は次のとおり。

- Idle Timeout を伸ばす（ワーカーが生き残る＝モデルが載ったまま）
- FlashBoot を有効にする
- 常時使うなら Active Worker を 1 にする（そのぶん常時課金）

**`files[].error` に「exceeds MAX_INLINE_BYTES」と出る**
mp4 が base64 で返すには大きすぎます。S3 を設定してください
（`BUCKET_ENDPOINT_URL`、`BUCKET_ACCESS_KEY_ID`、`BUCKET_SECRET_ACCESS_KEY`）。
設定すると `files[].url` で返ります。応急処置としては `length` を短くします。

**ジョブが `TIMED_OUT` になる**
Endpoint の Execution Timeout が短すぎます。1800 秒以上にしてください。
ハンドラ側の上限は `JOB_TIMEOUT` 環境変数です（既定 3600 秒）。

**Network Volume が見えない**
Serverless のワーカーでは `/runpod-volume`、Pod では `/workspace` にマウントされます。
同梱の `extra_model_paths.yaml` は両方を見るようにしてあります。ワーカーで確認するには：

```bash
ls -la /runpod-volume/ComfyUI/models/diffusion_models/
```

**`ComfyUI did not become ready within 900s`**
起動時に例外で落ちています。ワーカーのログに ComfyUI の stdout がそのまま
流れているので、そこにトレースバックが出ているはずです。
volume 未マウント、CUDA とドライバの不一致がよくある原因です。

---

## macOS / API ノード固有

**ノード検索に "MiniMax H3" が出てこない**
ComfyUI が古いか、API ノードが読み込まれていません。
`comfy_api_nodes/nodes_minimax.py` に `MinimaxHailuo03TextToVideoNode` があるか確認してください。
無ければ更新します（`mac/install.sh -r master`）。

**401 / 認証エラー、または「credits」関連のエラー**
API ノードは Comfy アカウントに課金される仕組みです。GUI なら右上からログイン、
スクリプトなら <https://platform.comfy.org/> で発行した `comfyui-` で始まるキーを
`COMFY_API_KEY` に設定してください。残高不足でも失敗します。

**`At least one reference image or video is required.`**
ref2v は参照画像か参照動画が最低 1 つ必要です。音声だけでは実行できません。

**参照画像が弾かれる**
最小 256×256、アスペクト比 0.4〜2.5 の制約があります。極端に細長い画像は通りません。

**参照動画が弾かれる**
23.976〜60 FPS、1 本 2 秒以上、合計 15 秒以内です。

**Mac で重みを使うローカル版ワークフロー（`workflows/*.json`）を開いたらエラーになる**
仕様です。Apple Silicon では H3 の重みを実行できません
（[mac-setup.md](mac-setup.md) に理由を書いています）。`workflows/api/` のほうを使ってください。

**依存のインストールが失敗する**
公式の ComfyUI Desktop（<https://www.comfy.org/download>）を使うのが早いです。
同じ API ノードが最初から入っています。

---

## 出力の品質

**音声が出ない / 無音**
`VAEDecodeAudio` と `CreateVideo` の `audio` 入力が繋がっているか確認してください。
音声 VAE（`minimax_h3_audio_vae_fp32.safetensors`）は映像 VAE とは別ファイルで、
両方必要です。プロンプトに音（環境音・セリフ）を書くと出やすくなります。

**セリフを喋らせたい**
プロンプト中に発話内容を引用符で書きます。
例：`she turns to the camera and says "welcome back"`。
H3 は 11 言語に対応しています。

**参照画像が効かない（ref2v）**
プロンプト側で `<Picture 1>` のようにタグで参照する必要があります。
番号は種類ごとの 1 始まりで、接続順に決まります
（画像 → 動画 → 単独音声の順、`ref_image_0` が `<Picture 1>`）。
`ref_image_size` を `max` にすると同一性は上がりますが、参照トークンが
毎ステップ乗るので数倍遅くなります。

**動画の長さが指定と違う**
仕様です。`length` は `17k+5` のグリッド（5, 22, 39, 56, …, 124, 141, …）に
切り上げられます。124 フレーム ≒ 5.17 秒 になります。

**ノイズだらけ / 崩壊する**
`shift_video` と `shift_audio` は 12.0 / 3.0 が既定値です。大きく動かすと壊れます。
`cfg` も 1.0 のままにしてください。sampler は `res_multistep` + `simple` が推奨です。
