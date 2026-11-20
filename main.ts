/* Leonida Cover Studio — entrypoint.
   Copies app/ and screenshots/ from this repository into the output
   directory and writes /output/dossier.json with buildDossier from the
   kit's vendor/makefun-app.ts. Standard library only, deterministic:
   the same repository always produces the same bytes. */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function copyTree(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    const from = join(src, name);
    const to = join(dst, name);
    cpSync(from, to, { recursive: true, dereference: false });
  }
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
  const appDir = join(here, "app");
  const shotsDir = join(here, "screenshots");
  if (!existsSync(appDir)) throw new Error("app/ is missing from the repository");
  if (!existsSync(shotsDir)) throw new Error("screenshots/ is missing from the repository");

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  copyTree(appDir, join(outDir, "app"));
  copyTree(shotsDir, join(outDir, "screenshots"));

  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, "dossier.json"), dossier);
  if (dossier.byteLength === 0) throw new Error("dossier.json came out empty");
  const appEntries = readdirSync(join(outDir, "app"), { recursive: true }).length;
  const shotEntries = readdirSync(join(outDir, "screenshots")).length;
  console.log(`wrote ${outDir}/dossier.json (${dossier.byteLength} bytes; app entries: ${appEntries}, screenshots: ${shotEntries})`);
}

main();
