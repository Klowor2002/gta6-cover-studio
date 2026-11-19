// Vice City Nights — Leonida Cover Studio, gta6-cover-art-01 entry (Node 22,
// standard library only). The program hands the entry in: it copies this
// repository's app/ (the offline cover maker) and screenshots/ (the four
// screenshots the maker took) beside this file into /output, then writes
// /output/dossier.json with the vendored make.fun library, which is the
// summary the judge reads. Outside the grader's container,
// MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly, before writing anything, if the app entry point is missing:
// a dossier built from a broken app would only fail later at the gate.
if (!existsSync(join(here, 'app', 'index.html'))) {
  throw new Error('app/index.html is missing — the cover maker was not built');
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the
// dossier text; the other caps refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; more than 993 files in app/
// or 48 MiB of app files in all, or a path under app/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
