---
name: kinetic-typography
description: Grammar for short (15s) brand films built from kinetic typography + motion graphics — Japanese copy lines that type/wipe in on the beat, diagonal colour wipes, device mockups, handwritten accent words, logo end card. Use when planning, storyboarding, prompting (image-to-video) or rendering a promo/CM/reel for a brand, template or the site (promo/cm/cm.html style Canvas renders included).
---

# Kinetic typography / motion-graphics brand film

Learned from a reference: a 15.08s, 2560×1440, 24fps brand film for a fictional
"GYARU / CREATIVE DIRECTOR" identity (white `#FFFFFF`, black `#111111`, red `#E60012`,
Noto Sans JP Bold + red handwritten script accents). Full shot-by-shot timeline in
`reference-gyaru.md` next to this file. Below is the reusable grammar.

**The whole reference film was generated from ONE image** — a brand board (hero, logo,
palette, typography, phone mockup, service cards 01–03, UI parts, tags, CTA band, footer).
The image-to-video model (Higgsfield) treated each board module as a shot and invented the
motion. So there are two production routes:

- **Route B — one board → i2v.** Fast and photographic, but the model redraws every glyph:
  small Japanese text comes out garbled. Make the board's copy large, few words per module,
  and lay modules out in film order (top-left = opening, bottom = end card).
- **Route A — code-rendered** (Canvas/HTML, deterministic `seek(t)`). Text is always correct.
  Use it for the final, or to patch any i2v shot whose text broke.

Worked example of both routes for this site: `promo/kt/` (`kt.html` = route A, `board.html` → `board.png` = route B).

## 1. Structure (15s = 4 acts)

| Act | Time | Job | Reference |
|---|---|---|---|
| Hook | 0–1.5s | Logo mark → provocation in 1–2 short lines | ロゴ → 「その案、まだ弱い。」 |
| Thesis | 1.5–3.5s | Brand promise, then a handwritten "aside" | 「アイデアで、空気を変える。」→ Think Different. → Insight→Idea→Impact |
| Proof | 3.5–8.1s | Numbered services 01/02/03 + a product (phone UI) shot | 01 ブランド戦略 / 02 キャンペーン / 03 ビジュアル → スマホUI |
| Close | 8.1–15s | Tagline → question to viewer → CTA + logo, hold | 正解より、違和感を。→ 今のままで、いいと思ってる? → 一度、話してみよう。 |

The last ~2s are a **static hold** on the end card (copy + logo + red arrow). Never cut the hold short.

## 2. Timing

- Cut on the music. Reference ≈ 90 BPM → 1 beat = 0.667s = **16 frames @24fps**; secondary cuts on the half beat (8 frames).
- Each shot lives **1–3 beats** (0.6–2s). Hero/question shots get 4+ beats; the end card gets ~3s.
- A copy line must be fully readable for **≥ 0.5s** before it leaves. Short lines (≤ 14 全角 chars) per row, max 2 rows.
- Text enters **≤ 0.3s**, fast-out/slow-in (ease-out expo / `cubic-bezier(.16,1,.3,1)`); exits are cuts or wipes, not fades.

## 3. Type moves (the vocabulary)

1. **Line-by-line pop** — line 1 appears, line 2 on the next half beat (「その案、」→「まだ弱い。」).
2. **Character stagger / tracking settle** — characters arrive with wide tracking and tighten to normal, then a thin red rule draws under the line left→right.
3. **Handwritten write-on** — red script word revealed along its stroke path (Think → Differ → Different. → arrow). Use an SVG path with `stroke-dashoffset`, ~0.6s, then the underline/arrow as a second stroke.
4. **Scale-emphasis inside a phrase** — 「Insight → *Idea* → Impact」: the key word scales up ×2 while neighbours stay small; the pen in frame "writes" it.
5. **Number + label** — big `01` / `02` / `03` (02 in red) above a 2-line bold label; numbers swap on the cut, labels slide/wipe in.
6. **Push-through wipe** — next sentence slides in from the right *through* the previous one, carried by a diagonal colour band (正解より → 考えることを).
7. **Chips/tags stream** — rounded pill tags (戦略・ブランディング・デジタル…) slide horizontally in rows above/below the headline as texture.
8. **Signature + arrow end card** — centred line, small logo lockup beneath, red hand-drawn arrow drawn left→right last.

## 4. Graphic transitions

- **Diagonal slash wipe** (≈ 20–25° from vertical) in black and red, two bands slightly offset in time → the signature transition. Red is the leading colour, black the trailing.
- **Hard cut to a full-bleed colour plate** (white → red → black) for tempo changes.
- **Frame-in-frame**: photo card inset inside a black frame with red corner brackets (camera viewfinder marks) and a small red **REC dot** top-right; the card scales/pushes between shots.
- **Device mockup**: phone frame slides up from bottom, UI inside scrolls, a script accent (Good Idea!) writes on top of the UI.
- Slow push-in (2–5% scale over the shot) on every photo so nothing is fully still except the end card.

## 5. Visual system rules

- 3 colours + 2 greys only. Red is reserved for: accent dot/period (「弱い。」の「。」), rules, numbers (02), script words, arrows, CTA. Never red body copy.
- Bold sans for statements, **script only for 1–3 English words** (Think Different. / Idea / Good Idea! / Let's Talk). Script always overlaps an edge of the photo or headline — it is the "human" layer.
- Photo subject stays on the right half; copy on the left half. On red plates, white copy; on white, black copy.
- One motif repeats across all acts (the logo face / sunglasses) so the film reads as one identity.

## 6. Pitfalls seen in the reference (AI-generated video)

Generated frames garbled Japanese text — 「考えここと」, 「コーンミーション設計」, chips like 「ブランディグ」, 「デンタル」, and type overlapping props (megaphone over 「キャンペーン」).
**Therefore: for the final cut, do not let the video model draw small copy.** Either use route A, or use route B and replace or overlay every shot whose text broke. Generate plates/clips *without text* when compositing, and keep text in a safe area clear of the subject's props.

## 7. How to apply in this repo

1. Write the copy first: hook / promise / 3 proofs / tagline / question / CTA (each ≤ 14 chars per line). `copy-jp` agent for the words.
2. Beat grid: pick BPM (90 → 16f@24 / 20f@30). Lay shots on the grid in a table like `reference-gyaru.md`.
3. Plates: text-free stills or i2v clips (`kv-artist`, `anthropic-skills:cinematographer` for prompts). Leave the left half calm for copy.
4. Render: Canvas 2D + CSS in a single HTML with a deterministic `t` (see `promo/cm/cm.html`), screenshot per frame with Playwright, encode with ffmpeg (`-r 24 -pix_fmt yuv420p -movflags +faststart`). Make a 9:16 **re-layout**, not a crop.
5. QA: extract a contact sheet (`ffmpeg -vf "fps=6,scale=320:-1,tile=6x4"`) and check every line is readable for ≥0.5s and no text collides with the subject.
