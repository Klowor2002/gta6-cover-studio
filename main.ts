/* Leonida Cover Studio — entrypoint.
   Stages app/ and screenshots/ from this repository into the output
   directory, then writes /output/dossier.json through buildDossier from
   the kit's vendor/makefun-app.ts. Standard library only, fully
   deterministic: the same repository always produces identical bytes. */

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDossier } from "./vendor/makefun-app.ts";

const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function stageDir(src: string, dst: string): void {
  mkdirSync(dst, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    cpSync(join(src, name), join(dst, name), { recursive: true, dereference: false });
  }
}

function run(): void {
  const root = dirname(fileURLToPath(import.meta.url));
  const out = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? "/output");
  const appSrc = join(root, "app");
  const shotsSrc = join(root, "screenshots");
  if (!existsSync(appSrc)) throw new Error("app/ is missing from the repository");
  if (!existsSync(shotsSrc)) throw new Error("screenshots/ is missing from the repository");
  const shotFiles = readdirSync(shotsSrc).filter((n) => n.endsWith(".jpg") || n.endsWith(".png"));
  if (shotFiles.length !== 4) throw new Error(`expected exactly 4 screenshots, found ${shotFiles.length}`);

  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  stageDir(appSrc, join(out, "app"));
  stageDir(shotsSrc, join(out, "screenshots"));

  const dossier = buildDossier(out, LIMITS);
  if (dossier.byteLength === 0) throw new Error("dossier.json came out empty");
  const dossierPath = join(out, "dossier.json");
  writeFileSync(dossierPath, dossier);
  // Guard against a truncated write: read it back and parse it.
  const roundTrip = JSON.parse(readFileSync(dossierPath, "utf8"));
  if (typeof roundTrip !== "object" || roundTrip === null) {
    throw new Error("dossier.json did not parse back as an object");
  }
  const appCount = readdirSync(join(out, "app"), { recursive: true }).length;
  const shotCount = readdirSync(join(out, "screenshots")).length;
  console.log(`wrote ${dossierPath} (${dossier.byteLength} bytes; app entries: ${appCount}, screenshots: ${shotCount})`);
}

run();
