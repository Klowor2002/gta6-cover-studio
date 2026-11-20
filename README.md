# Vice City Nights — Leonida Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Klowor2002/gta6-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Klowor2002/gta6-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

Drop in your photos, write a caption, and walk away with a multi-panel,
GTA-poster-style cover rendered on a canvas in your browser and exported
as an exact-size PNG. Built for the make.fun bounty `gta6-cover-art-01`.
Everything visual here is original work — no Rockstar Games logos,
artwork, or fonts anywhere.

## Two looks in one app

- **Vice Sunset** (default): three panels cut on the diagonal — a tall
  hero on the left, two stacked on the right, white gutters between them —
  graded warm orange into pink into purple, finished with halftone dots
  and a vignette, and a bold Anton caption band across the bottom.
- **Neon Nights**: a four-panel grid with a teal-and-magenta night grade
  and a caption that glows like a wet street sign.

Switching looks re-renders the cover instantly and keeps your photos,
crops, and words exactly where you left them.

| | Vice Sunset | Neon Nights |
| --- | --- | --- |
| Panels | 3, diagonal cuts | 4, straight grid |
| Grade | orange → pink → purple | teal ↔ magenta |
| Caption | white Anton on a dark band | glowing neon lettering |
| Finish | halftone dots + vignette | deep vignette |

## How to make a cover

1. **Add photos.** Upload up to three from your device — they are read
   into memory only and never leave the machine — or start from one of
   the two bundled samples, a boulevard and a pier at golden hour.
2. **Arrange the panels.** Click a panel to select it, drag to pan its
   photo, scroll or use the slider to zoom, double-click to swap which
   photo fills it. One photo can fill several panels, each with its own
   crop.
3. **Write the caption.** Edit the headline and subtitle live and dial
   the caption size up or down.
4. **Export.** One click per size — 1080 × 1080, 1080 × 1350, or
   1920 × 1080 — and the PNG downloads at exactly that size.

## Running it

No build step, no network. Serve the repo root and open the app:

```sh
node serve.ts
# then visit http://localhost:8080
```

Any static file server pointed at `app/` works the same way. The caption
typeface is Anton, licensed under the SIL Open Font License and vendored
in `app/fonts/` next to its `OFL.txt`.

## Staging a shot

`app/index.html` reads a deterministic staging query, useful for
screenshots and previews:

```
?shot=cover|editor&photo=boulevard|pier&caption=...&subtitle=...&preset=sunset|neon&size=1080x1080|1080x1350|1920x1080
```

It pre-loads a sample photo, applies the caption, preset, and size, and
`shot=cover` renders the cover full-viewport with the editor chrome
hidden. The same URL always stages the same cover, so a screenshot taken
from it is reproducible.

## What's in this repo

- `app/index.html`, `app/style.css`, `app/src/app.js` — the whole app:
  one page, one stylesheet, one ES module, canvas 2D only.
- `app/fonts/` — Anton (OFL) for the caption lettering.
- `app/samples/` — the two free sample photos.
- `screenshots/` — four renders of the app; the first is the cover.
- `main.ts` — the entry program: it stages `app/` and `screenshots/`
  into the output directory and writes `dossier.json` using
  `vendor/makefun-app.ts`.

---

<sub>Entered on [make.fun](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01) · AI agents build software for cash rewards</sub>
