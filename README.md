# Leonida Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Klowor2002/gta6-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Klowor2002/gta6-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

**Vice City Nights — Leonida Cover Studio** turns your own photos and a caption into
GTA-style poster cover art and exports it as an exact-size PNG, ready to post.

## What it does

- Upload 1–3 photos from your machine (nothing is ever uploaded anywhere), or try
  one of the two bundled sample photos.
- Two style presets, both live-switchable:
  - **Vice Sunset** — warm orange → pink → purple grade, full-width hero panel on
    top, two panels below, big caption band along the bottom.
  - **Neon Nights** — teal/magenta neon grade, tall panel on the left, three stacked
    panels on the right, glowing caption strip on top.
- Per-panel control: click a panel to select it, drag it to pan, zoom slider.
- Editable caption (Anton condensed lettering) and subtitle, with a caption-size slider.
- One-click PNG export in the three common post sizes: **1080×1080**, **1080×1350**,
  **1920×1080** — rendered on canvas at the exact pixel size.

## How to run

No build step, no network needed at run time. Serve the `app/` folder with any
static server and open `index.html` in desktop Chrome:

```sh
node serve.ts
# open http://localhost:8080
```

Or: `npx serve app`, `python3 -m http.server --directory app`, any static host.

## How to use it

1. Upload photos, or click **Try boulevard** / **Try pier**.
2. Pick **Vice Sunset** or **Neon Nights**.
3. Click a panel, drag to reposition the photo inside it, zoom if you like.
4. Type your caption and subtitle; adjust the caption size.
5. Click **Square**, **Portrait** or **Wide** — the PNG downloads.

## Deterministic staging

The app accepts URL parameters for reproducible shots:

```
?shot=cover|editor&photo=boulevard|pier&caption=...&subtitle=...&preset=sunset|neon&size=1080x1080|1080x1350|1920x1080
```

With `shot=cover` the cover renders full-viewport with no editor chrome.

## Screenshots

The four entry screenshots in `screenshots/`:

1. `1-cover.png` — a wide 1920×1080 cover the app exported, scaled to 1280×720.
2. `2-editor.png` — the editor in the browser with a sample photo loaded, 1280×800.
3. `3-portrait.png` — a portrait 1080×1350 cover the app exported, scaled to 1024×1280.
4. `4-square.png` — a square 1080×1080 cover the app exported, at 1024×1024.

## Files

- `app/index.html`, `app/style.css`, `app/src/app.js` — the app (ES module, canvas 2D).
- `app/fonts/Anton-Regular.woff2` + `OFL.txt` — Anton under the SIL Open Font License.
- `app/samples/` — two bundled sample photos, free to use.
- `main.ts` — entrypoint: copies `app/` + `screenshots/` to the output dir and
  writes `dossier.json` via the kit's `vendor/makefun-app.ts`.
- `screenshots/` — the four entry screenshots.
- `serve.ts` — tiny static server for local testing.

Original art only: no Rockstar logos, artwork, characters or fonts anywhere.

<sub>Entered on [make.fun](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
