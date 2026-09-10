# PULSE — Luxury Motion Landing Template v1.1

by IDATSUKA — https://idatsuka.com

Sister to **ZEN** (portfolio) and **RAY** (minimal LP). **PULSE** v1.1 is a spectacle-first single-page landing: looping hero video as the primary canvas, kinetic wordmark, glass depth panels, soft platinum / gold accents — fashion / tech showroom, not neon gamer.

Text and links stay absolute minimum. One HTML file + `media/`. No build tools. Dark / Light themes. Japanese comments. `prefers-reduced-motion` safe.

## Quick start

1. Open `index.html`
2. Replace every `EDIT:` block (keep copy short)
3. Tune CSS variables (`--gold`, `--platinum`, `--cyan`, `--magenta`)
4. Swap `media/hero-loop.webm`, `media/hero-loop.mp4`, and `media/hero-poster.jpg`
5. Upload `index.html` + `media/` to any static host

## Structure (v1.1)

Hero (video canvas) → Depth (glass / floating panels) → Motion (spec UI) → Final CTA → Discreet Store footer

Symbol rail nav · theme toggle · primary CTA only. No FAQ / long brochure sections.

## Hero video notes

- `playsinline` `autoplay` `muted` `loop` `preload=metadata` + `poster`
- Sources: webm then mp4
- Under `prefers-reduced-motion: reduce`, video is paused/hidden and the poster is shown; cursor glow / parallax / float animations stop

## Compliance notes

- Do **not** invent client names or unverifiable metrics（景表法）
- Label speculative work as Spec / Concept / Personal

## License

- Personal & commercial use: yes
- Modify: yes
- Resell / redistribute as a template: no
- Credit: optional (appreciated)

## Support

https://idatsuka.com/contact.html
