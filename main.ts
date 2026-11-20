// Vice City Nights — Leonida Cover Studio: the entry program.
//
// Stages the static app (app/) and its four screenshots (screenshots/)
// into the output directory and writes the make.fun dossier for exactly
// what was staged. The output directory is wiped and rebuilt on every
// run, so two runs back to back produce byte-identical output.

import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Wipe first: nothing stale may leak into the dossier or the staging.
rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

for (const folder of ["app", "screenshots"]) {
  cpSync(join(repoRoot, folder), join(outDir, folder), { recursive: true });
}

// The bounty gate's limits, handed through so this program refuses exactly
// where the scorer would refuse. Only text_max_bytes shapes the dossier
// bytes; the other entries are hard limits on what may be staged.
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

writeFileSync(join(outDir, "dossier.json"), buildDossier(outDir, caps));

// The dossier is the handoff the scorer re-derives: refuse an empty one,
// and refuse one that is not valid JSON — a corrupt dossier is worse
// than a missing one, because it looks finished.
const dossierSize = statSync(join(outDir, "dossier.json")).size;
if (dossierSize === 0) throw new Error("dossier.json came out empty");
JSON.parse(readFileSync(join(outDir, "dossier.json"), "utf8"));
console.log(`dossier.json: ${dossierSize} bytes`);

// Walk the staged tree so the log line shows what actually landed.
function tally(dir, acc) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) tally(full, acc);
    else {
      acc.files += 1;
      acc.bytes += statSync(full).size;
    }
  }
  return acc;
}
const total = tally(outDir, { files: 0, bytes: 0 });
console.log(`staged app/ + screenshots/ into ${outDir}: ${total.files} files, ${total.bytes} bytes, dossier.json written`);
