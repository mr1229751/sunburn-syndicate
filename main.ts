// SUNBURN SYNDICATE — make.fun gta6-01 entry program.
//
// Copies the playable game (game/) and its screenshots (screenshots/) from
// beside this file into the output directory, verifies the entry against the
// bounty's size caps, and writes dossier.json with the kit's buildDossier so
// the handed-in dossier is byte-identical to what the scorer recomputes.
// Node standard library only; deterministic: same input tree, same output.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const GAME_MAX_FILES = 993;
const GAME_MAX_BYTES = 48 * 1024 * 1024;
const INDEX_MAX_BYTES = 1024 * 1024;
const SHOT_MAX_COUNT = 4;
const SHOT_MIN_COUNT = 3;
const SHOT_MAX_BYTES = 256 * 1024;
const OUTPUT_MAX_ENTRIES = 1000;
const OUTPUT_MAX_BYTES = 64 * 1024 * 1024;

interface TreeStats {
  files: number;
  bytes: number;
  entries: number;
}

// Walk a directory tree once and total its files, bytes and entries.
function measureTree(root: string): TreeStats {
  const stats: TreeStats = { files: 0, bytes: 0, entries: 0 };
  const pending: string[] = [root];
  while (pending.length > 0) {
    const dir = pending.pop() as string;
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const info = statSync(full);
      stats.entries += 1;
      if (info.isDirectory()) {
        pending.push(full);
      } else {
        stats.files += 1;
        stats.bytes += info.size;
      }
    }
  }
  return stats;
}

// Refuse early, with a named cap, when a tree breaks the bounty's limits.
function checkTree(label: string, root: string, maxFiles: number, maxBytes: number): TreeStats {
  const stats = measureTree(root);
  if (stats.files > maxFiles) {
    throw new Error(`${label}: ${stats.files} files exceeds the cap of ${maxFiles}`);
  }
  if (stats.bytes > maxBytes) {
    throw new Error(`${label}: ${stats.bytes} bytes exceeds the cap of ${maxBytes}`);
  }
  return stats;
}

// Screenshots must be 3-4 whole JPEG/PNG renders, each under the byte cap.
function checkScreenshots(root: string): void {
  const names = readdirSync(root).filter((name) => /\.(jpe?g|png)$/i.test(name)).sort();
  if (names.length < SHOT_MIN_COUNT || names.length > SHOT_MAX_COUNT) {
    throw new Error(`screenshots: expected ${SHOT_MIN_COUNT}-${SHOT_MAX_COUNT} images, found ${names.length}`);
  }
  for (const name of names) {
    const size = statSync(join(root, name)).size;
    if (size > SHOT_MAX_BYTES) {
      throw new Error(`screenshots: ${name} is ${size} bytes, over the ${SHOT_MAX_BYTES} cap`);
    }
  }
}

function main(): void {
  const here = dirname(fileURLToPath(import.meta.url));
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('game/index.html is missing: the entry has no playable page');
  }
  const indexBytes = statSync(join(gameDir, 'index.html')).size;
  if (indexBytes > INDEX_MAX_BYTES) {
    throw new Error(`game/index.html is ${indexBytes} bytes, over the ${INDEX_MAX_BYTES} cap`);
  }
  const gameStats = checkTree('game', gameDir, GAME_MAX_FILES, GAME_MAX_BYTES);
  checkScreenshots(shotsDir);

  mkdirSync(outDir, { recursive: true });
  cpSync(gameDir, join(outDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: SHOT_MAX_COUNT, max_bytes: SHOT_MAX_BYTES },
    game_max_files: GAME_MAX_FILES,
    game_max_bytes: GAME_MAX_BYTES,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  const outStats = measureTree(outDir);
  if (outStats.entries > OUTPUT_MAX_ENTRIES) {
    throw new Error(`output: ${outStats.entries} entries exceeds the cap of ${OUTPUT_MAX_ENTRIES}`);
  }
  if (outStats.bytes > OUTPUT_MAX_BYTES) {
    throw new Error(`output: ${outStats.bytes} bytes exceeds the cap of ${OUTPUT_MAX_BYTES}`);
  }
  console.log(
    `sunburn-syndicate: game ${gameStats.files} files / ${gameStats.bytes} bytes, ` +
      `output ${outStats.entries} entries / ${outStats.bytes} bytes, dossier ${dossier.length} bytes`,
  );
}

main();
