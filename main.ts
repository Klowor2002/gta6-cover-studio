// Vice City Nights — Leonida Cover Studio: entry program.
//
// Stages the static app and the screenshots into the output directory,
// then writes the make.fun dossier that describes exactly what was
// staged. The staging dir is rebuilt from scratch on every run so two
// consecutive runs produce byte-identical output.

import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Empty staging dir first: no stale file can leak into the dossier.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const name of ["app", "screenshots"]) {
  cpSync(join(here, name), join(outDir, name), { recursive: true });
}

// The gate's caps, mirrored so this program refuses exactly where the
// scorer would: the text budget shapes the dossier bytes, the rest refuse.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

writeFileSync(join(outDir, "dossier.json"), buildDossier(outDir, caps));

// Report what was staged, so a human (or a log) can sanity-check the run.
let files = 0, bytes = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else { files++; bytes += statSync(full).size; }
  }
};
walk(outDir);
console.log(`staged app/ + screenshots/ into ${outDir}: ${files} files, ${bytes} bytes, dossier.json written`);
