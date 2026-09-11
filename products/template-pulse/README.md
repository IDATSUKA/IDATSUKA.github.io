# PULSE — Luxury Motion Landing Template v1.2

by IDATSUKA — https://idatsuka.com

Sister to **ZEN** (portfolio) and **RAY** (minimal LP). **PULSE** is a spectacle-first single-page landing: looping hero video as the primary canvas, kinetic wordmark, glass depth panels, soft platinum / gold accents — fashion / tech showroom, not neon gamer. v1.2 is the "finish" release: scroll choreography, pointer-aware glass, magnetic CTA, per-word reveals, film grain.

Text and links stay absolute minimum. One HTML file + `media/`. No build tools, no JS libraries. Dark / Light themes. Japanese comments. `prefers-reduced-motion` safe.

## Quick start

1. Open `index.html`
2. Replace every `EDIT:` block (keep copy short) — includes `<title>`, `og:*`, `theme-color`, favicon
3. Tune CSS variables (`--gold`, `--platinum`, `--cyan`, `--magenta`, `--specular`)
4. Swap `media/hero-loop.webm`, `media/hero-loop.mp4`, and `media/hero-poster.jpg`
5. Upload `index.html` + `media/` to any static host

## Structure (v1.2)

Hero (video canvas) → Depth (glass / floating panels) → Motion (spec UI) → Final CTA → Discreet Store footer

Symbol rail nav (hover / focus shows a mono label) · gold scroll-progress hairline · theme toggle · primary CTA only. No FAQ / long brochure sections.

## Motion layer (all disabled under `prefers-reduced-motion`)

- **Hero scroll choreography** — content scales 1 → .92 and fades while the video darkens and blurs slightly across the first viewport (rAF, `--hp` custom property)
- **Kinetic wordmark** — letters are wrapped in spans at load and rise with a per-letter stagger; gradient is sliced per letter so it stays continuous
- **Glass / panels** — pointer-following 3D tilt (≤ 5°) + moving specular highlight on `.float-card` and `.spec-frame` (desktop, `pointer: fine` only)
- **Magnetic CTA** — `.cta` pulls up to 8px toward the cursor within ~80px and springs back (desktop only)
- **Chapter reveals** — headings split into words (Intl.Segmenter for Japanese) with a masked, staggered rise; chapter labels draw a thin gold rule 0 → 100%
- **Finish** — animated film grain (SVG feTurbulence, ~3%), refined vignette, custom `::selection`, `:focus-visible` outlines on every interactive element

## Hero video notes

- `playsinline` `autoplay` `muted` `loop` `preload=metadata` + `poster`
- Sources: webm then mp4
- A soft shimmer runs on the stage until `canplay`; if every source fails (`error`), the poster image is shown instead
- Under `prefers-reduced-motion: reduce`, video is paused/hidden and the poster is shown; cursor glow / parallax / float / tilt / grain all stop

## Compliance notes

- Do **not** invent client names or unverifiable metrics（景表法）
- Label speculative work as Spec / Concept / Personal

## v1.2 changelog（日本語）

- ヒーロー: スクロールでステージが縮小（1 → .92）・フェードし、映像が少し暗く・ぼける演出を追加
- ワードマーク: 1文字ずつ時差で立ち上がるキネティックに変更（JS が span 分割。JS なしでも v1.1 の動きで表示）
- ガラス／フロートパネル・Spec フレーム: ポインタ追従の 3D チルト（≤5°）と移動するスペキュラハイライトを追加（PC のみ）
- CTA: カーソルに軽く吸い寄せられる磁力ボタン（≤8px、離すとスプリングバック。PC のみ）
- レールナビ: ホバー／フォーカスで mono ラベルを表示（sr-only は維持）。アクティブドットに柔らかいリングアニメーション
- チャプター: 見出しを語ごとにマスクリビール（日本語は Intl.Segmenter で自然に分割）。ラベル横の罫線が 0 → 100% で引かれる
- 仕上げ: フィルムグレイン（SVG feTurbulence・約3%）、ビネット調整、上部にゴールドの進捗ヘアライン、`::selection`、全操作要素の `:focus-visible`
- 動画: `canplay` までシマー表示、読み込み失敗時は poster 画像へ自動フォールバック
- メタ: `og:title` / `og:description` / `og:image` / `theme-color`（テーマ切替で同期）/ インライン SVG ファビコンを EDIT コメント付きで追加
- モバイル（390px）: レールと本文の重なり回避、ワードマーク幅の調整、`prefers-reduced-motion` ブロックを新要素すべてに拡張

## License

- Personal & commercial use: yes
- Modify: yes
- Resell / redistribute as a template: no
- Credit: optional (appreciated)

## Support

https://idatsuka.com/contact.html
