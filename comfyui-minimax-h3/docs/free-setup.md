# 無料でできる範囲の最高構築

「無料」＝ **クラウド課金も API 課金も一切なし**、つまり手持ちのマシンだけで回す構成です。
このドキュメントは、その条件下で到達できる上限と、そこに至る手順をまとめたものです。

まず 1 コマンドで現状を判定できます（ComfyUI や PyTorch を入れる前でも動きます）。

```bash
python scripts/check_hardware.py
```

GPU・VRAM・compute capability・PyTorch のビルド・RAM・空き容量を見て、
使うべき profile と起動フラグ、最初に試すべき解像度まで出します。

---

## 結論から

| 手持ち環境 | 無料で H3 を動かせるか |
|---|---|
| NVIDIA GPU（Ampere 世代以降・24GB 以上） | **できる**。これが本命 |
| NVIDIA GPU（Ampere 以降・12〜16GB） | 条件付き。832×480 で「動けば儲けもの」 |
| NVIDIA GPU（Turing 以前 = RTX 20xx / GTX 10xx） | **できない**（bf16 非対応） |
| Mac | **できない**（[mac-setup.md](mac-setup.md)） |
| Google Colab 無料枠 / Kaggle 無料枠 | **できない**（下記） |
| GPU なし | できない |

---

## ハードウェアの線引きはどこから来ているか

推測ではなく ComfyUI 本体のコードで決まっています。

**1. bf16 が使えること（compute capability 8.0 以上）**
`comfy/supported_models.py` の `MiniMaxH3.supported_inference_dtypes` は
`[torch.bfloat16, torch.float32]` だけです。そして
`model_management.should_use_bf16()` は `props.major >= 8` で判定します。
Ampere（RTX 30xx / A100）より前の世代は bf16 を選べず fp32 に落ちるため、
ただでさえ載らないモデルが倍のメモリを要求することになります。

**2. NVFP4 は compute capability 10.0 以上**
`model_management.supports_nvfp4_compute()` が `props.major < 10` で `False` を返します。
つまり **Blackwell 世代（RTX 50xx / RTX PRO 6000 / B200）専用**です。

**3. INT8 / NVFP4 のカーネルには PyTorch cu130 以上が必要**
`comfy/quant_ops.py` は torch のビルドが CUDA 13 未満だと comfy-kitchen の
CUDA バックエンドを無効化します。

```
WARNING: You need pytorch with cu130 or higher to use optimized CUDA operations.
```

**cu128 で入れると量子化版が最適化パスに乗りません。** 必ず cu130 を使ってください。

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130
```

世代ごとにまとめるとこうなります。

| 世代 | 例 | cc | bf16 | fp8 | NVFP4 |
|---|---|---|---|---|---|
| Pascal / Turing | GTX 10xx, RTX 20xx, T4 | 6.x / 7.5 | ✗ | ✗ | ✗ |
| Ampere | RTX 3090, A100 | 8.0 / 8.6 | ✓ | ✗ | ✗ |
| Ada | RTX 4090, L40S | 8.9 | ✓ | ✓ | ✗ |
| Hopper | H100 | 9.0 | ✓ | ✓ | ✗ |
| Blackwell | RTX 5090, B200 | 10.0 / 12.0 | ✓ | ✓ | ✓ |

---

## 無料クラウド（Colab / Kaggle）が使えない理由

期待させておいてなんですが、**現状どちらも無理**です。理由は VRAM ではなく世代です。

| | GPU | cc | bf16 | 判定 |
|---|---|---|---|---|
| Colab 無料枠 | T4 16GB | 7.5 | ✗ | 不可 |
| Kaggle 無料枠 | P100 16GB / T4×2 | 6.0 / 7.5 | ✗ | 不可 |

T4 も P100 も compute capability が 8.0 未満なので、上記「線引き 1」に引っかかります。
fp32 に落ちた場合に必要なメモリは pruned INT8 版でも 16GB にまったく収まりません。
また Colab は 2 枚差しでも VRAM を合算できないため、Kaggle の T4×2 も解決になりません。

**結論：無料の GPU ノートブックで MiniMax H3 は動きません。** 別の軽量な動画モデルを
探すか、手持ちの GPU を使うか、課金するかの三択です。

---

## 手持ち GPU での最高構築

### 手順

```bash
# 1. まず判定
python scripts/check_hardware.py

# 2. 出力された profile でインストール（Windows）
cd windows
.\install.ps1 -InstallDir D:\AI\ComfyUI -Quant <出力された profile>
```

`install.ps1` は cu130 を入れ、インストール後に torch のビルドを検証して、
cu130 未満なら警告を出します。

### profile の選び分け

| VRAM | 世代 | profile | 備考 |
|---|---|---|---|
| 80GB 以上 | 何でも | `bf16` | 参照品質 |
| 32GB | Blackwell | `nvfp4` | テキストエンコーダが約 15GB まで縮む |
| 40GB 以上 | Ampere / Ada | `int8` | |
| 24GB | Ada（RTX 4090） | `fp8` | fp8 は cc 8.9 以上 |
| 24GB | Ampere（RTX 3090） | `int8` | エンコーダは RAM へ退避される |

ComfyUI はテキストエンコーダと DiT を**順番にロードして片方を退避する**ので、
「エンコーダ＋DiT の合計」ではなく「大きいほうが載るか」が効きます。

### 起動フラグ

| VRAM | フラグ |
|---|---|
| 34GB 以上 | なし |
| 24〜34GB | `--reserve-vram 1.0` |
| 24GB 未満 | `--reserve-vram 0.5 --cache-none` |

`--cache-none` はノード結果をキャッシュしないので毎回テキストエンコードからやり直しますが、
そのぶん VRAM と RAM が空きます。

### システム RAM とページファイル（ここが効きます）

H3 は DiT のブロックをホストメモリから 1 層ずつ GPU に流し込みます。
つまり **RAM の量と速度が体感速度に直結**します。

- 64GB あると快適
- 32GB は動くが遅い
- 32GB 未満ならページファイル / スワップを 64GB 以上に広げる（必須）
- モデルは必ず NVMe SSD に置く（HDD だと桁で遅くなります）

RAM の増設は、GPU を買い替えるより圧倒的に安い高速化です。

---

## 無料で画質を上げる

お金をかけずに効くものだけを挙げます。

**設定はデフォルトから動かさない**
`cfg` は 1.0、`shift_video` / `shift_audio` は 12.0 / 3.0、sampler は
`res_multistep` + `simple`。これらは学習時の前提に合わせてあるので、
動かすと素直に壊れます。

**steps は 50 が基準、下げるなら 30 まで**
プロンプトを詰めている間は 30 で回して、決まったら 50 で本番を撮る、が効率的です。

**解像度は「短辺 768」を意識する**
H3 の基準は短辺 768・面積上限 768×1344 です。それを超える指定をしても内部で
縮小されるだけなので、1344×768 より上げても意味がありません。
逆に 832×480 まで落とすと大幅に速くなります。

**length は 17k+5 のグリッドに乗る値を使う**
124（約 5 秒）、141、158 … 中途半端な値を入れても切り上げられるだけです。
学習範囲はおよそ 124〜362。

**プロンプトに音を書く**
H3 は映像と音声を同時に生成します。環境音・効果音・セリフを書かないと
音の情報がないまま生成されます。セリフは引用符で指定します。

```
A woman on a rainy Tokyo street at night. She turns to the camera
and says "welcome back". Rain on asphalt, distant traffic, no music.
```

11 言語に対応しているので日本語のセリフも指定できます。

**シードを変えて数を撮る**
同じプロンプトでシードだけ振るのが、無料でいちばん品質が上がる手です。
電気代以外かからないので、下のバッチ実行で寝ている間に回してください。

---

## 無料でスループットを上げる

`client/batch_local.py` は、プロンプトをまとめて ComfyUI のキューに投入します。
**モデルのロードが 1 回で済む**ため、1 本ずつ手で回すより大幅に速くなります。

```bash
# prompts.txt に 1 行 1 プロンプト（# はコメント、空行は無視）
python client/batch_local.py prompts.txt --out-dir renders

# 探索用に低解像度・低ステップで大量に回す
python client/batch_local.py prompts.txt --out-dir drafts \
  --width 832 --height 480 --steps 30

# 個別に条件を変えたいときは JSON
# [{"prompt": "...", "seed": 7, "length": 141},
#  {"prompt": "...", "width": 832, "height": 480}]
python client/batch_local.py prompts.json --out-dir renders
```

- 出力済みのファイルがあるものは自動でスキップするので、**中断しても再開できます**
- シードは `--seed` を基準に 1 本ずつずらして振られます
- 最後に 1 本あたりの平均所要時間が出るので、次回の計画が立てられます

運用としては「低解像度でたくさん撮る → 良かったプロンプトだけ 1344×768・steps 50 で撮り直す」
が、無料枠での費用対効果が最も高いやり方です。

---

## GPU が無い場合

無料では H3 は動きません。近い順に挙げると：

1. **ホスト API ノード**（[mac-setup.md](mac-setup.md)）— 768P で約 $0.13/秒。
   環境構築は一番楽ですが 1 本ごとに課金されます。
2. **RunPod Serverless**（[runpod-serverless.md](runpod-serverless.md)）— 大量に回すなら
   API より安くなります。使っていない間は課金されません。

どちらも「無料」ではないので、このドキュメントの範囲外です。
