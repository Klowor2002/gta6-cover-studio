# Vice City Nights — Leonida Cover Studio

Turn any photo and a caption into multi-panel GTA 6-style poster cover art,
exported as a PNG ready to post. Built for the make.fun bounty
`gta6-cover-art-01`. All original art — no Rockstar Games logo, artwork or
fonts.

## What it does

- **Two style presets in one app.** *Vice Sunset* (default): warm
  orange → pink → purple grade, 3-panel diagonal collage with a hero panel,
  white gutters, big Anton caption band. *Neon Nights*: teal/magenta neon
  grade, 4-panel grid, glowing caption. Switching presets re-renders live.
- **Any photo.** Upload 1–3 photos from your machine (never uploaded) or
  try the two free sample photos. Click a panel to select it, drag to pan,
  use the zoom slider to crop. One photo can fill several panels, each with
  its own crop.
- **Caption.** Edit the caption and subtitle live; caption size slider.
- **Fast export.** One click per size: 1080 × 1080, 1080 × 1350,
  1920 × 1080 — exact-size PNG downloads.

## How to run

Static files, no build step, no network:

```sh
node serve.ts
# open http://localhost:8080
```

Or open `app/index.html` directly from any static file server. The caption
lettering is Anton (SIL Open Font License, vendored under `app/fonts/` with
its `OFL.txt`).

## Deterministic staging

`?shot=cover|editor&photo=boulevard|pier&caption=...&preset=sunset|neon&size=...`
auto-loads a sample photo, sets the caption and preset, and `shot=cover`
renders the cover full-viewport with no editor chrome.

## Files

- `app/index.html`, `app/style.css`, `app/src/app.js` — the app
- `app/fonts/Anton-Regular.woff2` — caption font (OFL)
- `app/samples/` — two free sample photos
- `main.ts` — the entry program (copies `app/` + `screenshots/` to
  `/output` and writes `dossier.json` via `vendor/makefun-app.ts`)
- `screenshots/` — the four entry screenshots
