# Vice City Nights — Leonida Cover Studio

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/Klowor2002/gta6-cover-studio/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/Klowor2002/gta6-cover-studio/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

A tiny studio that turns your photos and a caption into multi-panel,
GTA-poster-style cover art — rendered on a canvas in your browser and
exported as an exact-size PNG, ready to post. Made for the make.fun
bounty `gta6-cover-art-01`. Every visual here is original work; no
Rockstar Games logos, artwork, or fonts are used.

## The two looks

- **Vice Sunset** (the default) lays three panels on diagonal cuts — a
  tall hero panel on the left, two stacked panels on the right, paper
  gutters between them — and grades everything warm: orange melting
  into pink into purple, a halftone-dot finish, and a bold caption band
  along the bottom set in Anton.
- **Neon Nights** switches to a four-panel grid with a teal-and-magenta
  night grade and a caption that glows like a wet street sign.

Flip between them with the buttons at the top; the cover re-renders on
the spot, keeping your photos, crops, and words.

| | Vice Sunset | Neon Nights |
| --- | --- | --- |
| Panels | 3, diagonal cuts | 4, straight grid |
| Grade | orange → pink → purple | teal ↔ magenta |
| Caption | white Anton on a dark band | glowing neon lettering |
| Finish | halftone dots + vignette | deep vignette |

## Making a cover

1. **Add photos.** Upload up to three from your device — they are read
   into memory only and never leave the machine — or start from one of
   the two bundled samples (a boulevard and a pier at golden hour).
2. **Arrange the panels.** Click a panel to select it, drag to pan its
   photo, scroll or use the slider to zoom, double-click to swap which
   photo fills it. A single photo may fill several panels, each with
   its own crop.
3. **Write the caption.** Edit the headline and subtitle live and dial
   the caption size to taste.
4. **Export.** One click per size — 1080 × 1080, 1080 × 1350, or
   1920 × 1080 — and the PNG downloads at exactly that size.

## Running it

There is no build step and the app needs no network. Either serve the
repo root and open the app:

```sh
node serve.ts
# then visit http://localhost:8080
```

…or point any static file server at `app/`. The caption typeface is
Anton, licensed under the SIL Open Font License and vendored in
`app/fonts/` next to its `OFL.txt`.

## Staging a shot

`app/index.html` understands a deterministic staging query, handy for
screenshots and previews:

```
?shot=cover|editor&photo=boulevard|pier&caption=...&subtitle=...&preset=sunset|neon&size=1080x1080|1080x1350|1920x1080
```

It pre-loads a sample photo, applies the caption, preset, and size,
and `shot=cover` renders the cover full-viewport with the editor
chrome hidden.

## Layout of this repo

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
