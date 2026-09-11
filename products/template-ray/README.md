# RAY — Minimal Landing Page Template v1.1

by IDATSUKA — https://idatsuka.com

Sister product to **ZEN** (portfolio). **RAY** is a single-page landing template for one offer and one primary action.

One HTML file. No build tools, no external JS or images. Dark / Light themes. Japanese + English comments.

## Quick start

1. Open `index.html`
2. Replace every `EDIT:` block (copy, links, placeholders, OGP / favicon)
3. Change `--accent` in CSS variables (one accent color)
4. Upload to GitHub Pages / Netlify / any static host

## Sections

Nav → Hero → Trust (Spec placeholders) → Features×3 → Sample → How it works → Pricing teaser → FAQ×3 → Final CTA → Footer

## Motion

- Hero: sweeping light beam, masked dot-grid, line-by-line headline reveal, scroll hint
- Reveal-on-scroll with blur-in and per-sibling stagger (auto, capped at 400ms)
- Scroll progress hairline; nav hides on scroll down / returns on scroll up
- Every animation respects `prefers-reduced-motion`

## v1.1 changelog

- Hero "ray": slow diagonal light beam + thin bright line, masked dot-grid, masked line-by-line headline reveal, pulsing scroll indicator
- Showcase frame floats, with a periodic diagonal glare sweep, a "loading" skeleton bar and a pulsing status dot
- FAQ is now a real `<details>` accordion with rotating "+" and smooth height animation (first item open by default; works without JS)
- Features: hover lift + accent border sweep. Steps: animated numbered rail (horizontal on desktop, vertical on mobile)
- Pricing card: ambient accent glow on hover; CTA is the focal point
- Motion system: blur-in reveals with staggered delays, scroll progress hairline, hide/show nav, sliding-fill buttons with accent glow, `:focus-visible` outlines
- Meta: `og:title` / `og:description`, `theme-color` (synced with the theme toggle), inline SVG favicon
- Polish: static film grain overlay (~3%), custom `::selection`, light-theme contrast pass, hero height clamped for very tall screens

## Compliance notes

- Do **not** invent client names or unverifiable metrics
- Trust row items are **Spec placeholders** — replace only with permitted / real brands, or remove the section
- Label speculative work as Spec / Concept / Personal

## License

- Personal & commercial use: yes
- Modify: yes
- Resell / redistribute as a template: no
- Credit: optional (appreciated)

## Support

https://idatsuka.com/contact.html
