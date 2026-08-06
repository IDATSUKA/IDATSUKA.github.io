# Windows に ComfyUI + MiniMax H3 を構築する

## 必要なもの

| | 最低ライン | 快適 |
|---|---|---|
| OS | Windows 10 22H2 / 11（64bit） | Windows 11 |
| GPU | NVIDIA 24GB・**Ampere 世代以降**（RTX 4090 / 3090） | 32GB 以上（RTX 5090 / RTX PRO 6000） |
| ドライバ | CUDA 13.0 対応の最新版 | 〃 |
| システム RAM | 32GB | **64GB 以上** |
| ストレージ | NVMe SSD に 60GB 空き | 150GB 空き |
| Python | 3.12 または 3.13 | 3.12 |

**RAM が効きます。** H3 は DiT のブロックをシステムメモリから 1 層ずつ GPU に
流し込みながら動くので、RAM が細いとページングで極端に遅くなります。
64GB 未満ならページファイルを 64GB 以上に広げておいてください
（設定 → システム → バージョン情報 → システムの詳細設定 → パフォーマンス → 詳細設定 → 仮想メモリ）。

---

## まず自分のマシンを判定する

インストール前に、どの profile が使えるかを判定できます（PyTorch 未導入でも動きます）。

```powershell
python ..\scripts\check_hardware.py
```

GPU の世代・VRAM・RAM・空き容量から、使うべき profile、起動フラグ、
最初に試すべき解像度まで出力します。「そもそも動くのか」は
[free-setup.md](free-setup.md) にハードウェアの線引きをまとめてあります。

## インストール

事前に Git と Python を入れておきます。

```powershell
winget install --id Git.Git -e
winget install --id Python.Python.3.12 -e   # 「Add to PATH」を有効に
```

PowerShell を開き直してから：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd <このリポジトリ>\comfyui-minimax-h3\windows

# RTX 4090 / 3090 など Ada 世代以前
.\install.ps1 -InstallDir D:\AI\ComfyUI -Quant int8

# RTX 5090 など Blackwell 世代
.\install.ps1 -InstallDir D:\AI\ComfyUI -Quant nvfp4

# ref2v（参照画像）も使うなら
.\install.ps1 -InstallDir D:\AI\ComfyUI -Quant int8 -Ref2va
```

スクリプトがやること：

1. Git / Python / NVIDIA ドライバの確認
2. ComfyUI を固定コミットで clone（H3 ノードが入っている版）
3. `venv` を作り、**CUDA 13.0 版**の PyTorch と ComfyUI の依存を導入
4. 選んだ profile の重みを Hugging Face から取得
5. `workflows/*.json` を ComfyUI の workflows フォルダにコピー
6. `run_comfyui.bat` を生成

重みのダウンロードだけで数十 GB あるので、回線次第では 1〜3 時間かかります。
中断しても再実行すれば続きから進みます（既にあるファイルはスキップ）。

> ライセンス同意が必要な場合は、先に `setx HF_TOKEN hf_xxxxx` を実行して
> PowerShell を開き直してください。

---

## 起動と使い方

```
D:\AI\ComfyUI\run_comfyui.bat
```

ブラウザで <http://127.0.0.1:8188> を開きます。

**公式テンプレートを使う場合**（推奨）
`Workflow → Browse Templates → Video → MiniMax H3` に 6 種類のテンプレートが入っています。
ComfyUI 本体が配布しているものなので、まずはこれで 1 本出してみてください。

**同梱ワークフローを使う場合**
`workflows/t2v.json` などは **API フォーマット**です。UI にドラッグしても開けますが、
編集しやすいのは公式テンプレートのほうです。API フォーマットは
RunPod ハンドラや `/prompt` エンドポイントに投げる用と考えてください。

### 最初の 1 本の設定

| 項目 | 値 |
|---|---|
| 解像度 | 832×480（お試し）→ 1344×768（標準） |
| length | 124（約 5 秒） |
| steps | 50 |
| cfg | 1.0 |
| sampler / scheduler | `res_multistep` / `simple` |
| shift_video / shift_audio | 12.0 / 3.0 |

`length` は 24fps のフレーム数で、内部的に `17k+5` のグリッド（5, 22, 39, …, 124, 141, …）
へ切り上げられます。学習された範囲はおよそ 124〜362 フレーム（5〜15 秒）です。

解像度は 32 の倍数である必要があり、短辺 768・面積 768×1344 が基準です。
極端なアスペクト比を指定すると内部で面積上限に合わせて縮小されます。

---

## 重みだけ入れ直す / profile を変える

```powershell
# 公開されているファイル一覧を確認
.\download_models.ps1 -InstallDir D:\AI\ComfyUI -ListOnly

# 別の profile を追加で取得
.\download_models.ps1 -InstallDir D:\AI\ComfyUI -Quant bf16
```

ファイルは `D:\AI\ComfyUI\models\{diffusion_models,text_encoders,vae}\` に置かれます。
既に別の場所に大きなモデル置き場がある人は、ComfyUI の
`extra_model_paths.yaml` でそちらを指すほうが二重持ちを避けられます。

---

## ComfyUI を更新するとき

同梱スクリプトはコミットを固定しています。更新したい場合：

```powershell
cd D:\AI\ComfyUI
git fetch origin
git checkout master
git pull
.\venv\Scripts\python.exe -m pip install -r requirements.txt
```

H3 対応は入ったばかりなので、更新でノードの入出力名が変わる可能性があります。
同梱の API ワークフローが通らなくなったら、UI 側のテンプレートを開いて
`Workflow → Export (API)` で書き出し直すのが確実です。

---

## VRAM が足りないとき

`run_comfyui.bat` の `main.py` の後ろにフラグを足します。

| フラグ | 効果 |
|---|---|
| `--reserve-vram 2.0` | OS/ブラウザ用に 2GB 空ける。24GB カードでまず試す値 |
| `--cache-none` | ノード結果をキャッシュしない。RAM/VRAM は減るが毎回再実行になる |
| `--novram` | 最終手段。極端に遅くなる |

それでも落ちる場合は、解像度を 832×480 に、`length` を 124 に、
テキストエンコーダをより小さい量子化（`nvfp4`、Blackwell のみ）に下げてください。

その他の症状は [troubleshooting.md](troubleshooting.md) を参照。
