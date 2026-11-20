// Vice City Nights — Leonida Cover Studio: the entry program.
//
// Takes the static app (app/) and its four screenshots (screenshots/),
// stages them into the output directory, and writes the make.fun dossier
// for exactly what was staged. The output directory is wiped and rebuilt
// on every run, so two runs in a row produce byte-identical output.

import { cpSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";

// Start from an empty directory: nothing stale can sneak into the dossier.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });

for (const part of ["app", "screenshots"]) {
  cpSync(join(repoRoot, part), join(outputDir, part), { recursive: true });
}

// The bounty gate's caps, passed through so this program refuses exactly
// where the scorer would refuse. Only text_max_bytes shapes the dossier
// bytes; the rest are hard limits on what may be staged.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

writeFileSync(join(outputDir, "dossier.json"), buildDossier(outputDir, dossierCaps));

// The dossier is the handoff the scorer re-derives: confirm it landed.
const dossierBytes = statSync(join(outputDir, "dossier.json")).size;
if (dossierBytes === 0) throw new Error("dossier.json came out empty");
console.log(`dossier.json: ${dossierBytes} bytes`);

// Summarize the staging so a log line can be eyeballed after a run.
let stagedFiles = 0;
let stagedBytes = 0;
const countTree = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) countTree(full);
    else {
      stagedFiles++;
      stagedBytes += statSync(full).size;
    }
  }
};
countTree(outputDir);
console.log(`staged app/ + screenshots/ into ${outputDir}: ${stagedFiles} files, ${stagedBytes} bytes, dossier.json written`);
