# リンクカードの作り直し（`og-cards.js`）

X・Slack・LINE・Discord に URL を貼ったとき出る 1200×630 の画像を、
全ページ分まとめて作り直します。出力は `img/og/<ページ名>.jpg`。

見出しを変えたとき、ページの見た目を大きく変えたとき、ページを増やしたときに走らせます。

---

## 走らせ方

**1. サイトを配信する**（リポジトリのルートで）

```
python3 -m http.server 8899
```

**2. 書体を用意して配信する**

ページは Space Grotesk / Space Mono / Zen Kaku Gothic New を Google Fonts から
読みます。**この3書体が無いまま作ると、カードだけ別の書体で世に出ます。**
いちばん人目に触れる画像が別ブランドになるので、ここは省略しないでください。

```
mkdir -p /tmp/fontserve && cd /tmp/fontserve
npm pack @fontsource/space-grotesk @fontsource/space-mono @fontsource/zen-kaku-gothic-new
for t in *.tgz; do tar xzf "$t" && mv package "${t%.tgz}"; done
cp */files/space-grotesk-latin-{300,400,500,600}-normal.woff2 .
cp */files/space-mono-latin-{400,700}-normal.woff2 .
cp */files/zen-kaku-gothic-new-{japanese,latin}-{300,400,500}-normal.woff2 .
```

`fonts.css` を同じ場所に置きます（`@font-face` を12個。src は
`http://127.0.0.1:8897/<ファイル名>`）。

**書体には CORS ヘッダが要ります。** サイトは 8899、書体は 8897 で別オリジンなので、
`Access-Control-Allow-Origin: *` を返さないと読み込みに失敗し、黙って代替書体になります。
`python3 -m http.server` はこのヘッダを返しません。数行のサーバーを置いてください。

```python
import http.server
class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw): super().__init__(*a, directory='/tmp/fontserve', **kw)
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*'); super().end_headers()
http.server.HTTPServer(('127.0.0.1', 8897), H).serve_forever()
```

**3. 作る**

```
node tools/og-cards.js           # 全29ページ
node tools/og-cards.js store biz # 一部だけ
```

書体が効いているかは、出来上がったカードの `IDATSUKA` の字面で分かります。
Space Grotesk は `A` の頂点が平らで、`S` の終筆が水平に切られています。

---

## 中身

ページごとに2回撮ります。1回目はページそのもの。2回目はそれを右の枠に嵌めて、
左に見出しを組んだカード。**ページを薄く敷くだけの構成は、この暗いサイトでは
何も見えません**（試して捨てました）。枠で立てると、小さく表示されても形が残ります。

`PAGES` の各行は `[ページ名, ラベル, 見出し, スクロール量]` です。

- **ラベルと見出しはここに持っています。** ページから読み取ると、見出しを直した
  拍子にカードが黙って変わります。変えるときは両方を意識して変えてください。
- **スクロール量**は「ページのどこを撮るか」。0 は最上部。トップが暗いだけの
  ページ（Store、Works など）は、中身のある位置まで送っています。

## 変更したら

1. カードを作り直す
2. ページ数を増やしたなら `PAGES` に足し、`sitemap.xml` にも足す
3. 実際の見え方は X の Card Validator か Slack に貼って確認する
   （キャッシュが残るので、差し替え直後は古い画像が出ることがあります）
