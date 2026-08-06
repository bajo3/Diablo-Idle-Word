// Turns an unzipped PixelLab character export into this project's asset layout:
//   public/assets/characters/<id>/full/<id>_<state>_<direction>.png   (composited spritesheet)
//   public/assets/characters/<id>/previews/<id>_preview.png
//   public/assets/characters/<id>/metadata/manifest.json
//
// Usage: node process-character.mjs <unzippedWorkDir> <id> <displayName> [options]
//
// Options (flags, order-independent, all optional):
//   --three-dir            Reduce 8 PixelLab directions to the project's 3-sheet contract
//                          (north/south/east; west mirrors east at runtime). Diagonals are
//                          dropped. Default keeps every direction present in the export.
//   --state-map=A=B,C=D    Rename ZIP state/animation keys to the project's contract names
//                          before processing. Example for a v3 character whose base idle comes
//                          as rotations and whose animations are named walking/cross_punch_attack:
//                          --state-map=walking=walk,cross_punch_attack=basic_attack
//
// The base character created by /v2/create-character-v3 ships idle as a single frame per
// direction under `frames.rotations` (NOT as an entry in `frames.animations`). This script
// synthesizes an `idle` animation entry from those rotations so the output manifest always has
// one, matching the `dark_knight` contract in apps/web/src/game/pixellab-characters.ts.

import { Jimp } from 'jimp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Default to the repo root (one level up from scripts/), but allow an explicit --web-root=<dir>
// override so this script can run from a directory that has `jimp` installed (e.g. a temp dir
// outside the pnpm workspace) while still writing into the project's public/assets tree.
const webRoot = optionsFromArgv().webRoot ?? path.resolve(__dirname, '..');

function optionsFromArgv() {
  const out = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq === -1) out[arg.slice(2)] = true;
    else out[arg.slice(2, eq)] = arg.slice(eq + 1);
  }
  return out;
}

// Positional args are the non-flag argv entries after the script path.
const positional = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const [workDir, id, displayName] = positional;
if (!workDir || !id || !displayName) {
  console.error('Usage: node process-character.mjs <unzippedWorkDir> <id> <displayName> [options]');
  console.error('Options: --three-dir  --state-map=A=B,C=D  --web-root=<dir>');
  process.exit(1);
}

const options = optionsFromArgv();

const THREE_DIR = options['three-dir'] === true;
const STATE_MAP = Object.fromEntries(
  typeof options['state-map'] === 'string'
    ? options['state-map'].split(',').map((pair) => {
        const [from, to] = pair.split('=');
        return [from, to];
      })
    : [],
);
// Project contract directions (west mirrors east — see pixellab-characters.ts mapDirection).
const KEEP_DIRS = new Set(['north', 'south', 'east']);

const ANIM_CONFIG = {
  idle: { frameRate: 6, repeat: -1 },
  walk: { frameRate: 10, repeat: -1 },
  basic_attack: { frameRate: 12, repeat: 0 },
  hit: { frameRate: 10, repeat: 0 },
  death: { frameRate: 8, repeat: 0 },
};

const metadata = JSON.parse(await readFile(path.join(workDir, 'metadata.json'), 'utf-8'));
const state0 = metadata.states[0];
const rotations = state0.frames.rotations;
// Build the effective animations map: start from the export's named animations, apply the
// optional state rename, and synthesize `idle` from rotations if no idle was provided.
const animations = {};
for (const [state, dirs] of Object.entries(state0.frames.animations)) {
  const target = STATE_MAP[state] ?? state;
  animations[target] = dirs;
}
if (rotations && !('idle' in animations)) {
  // Rotations is { dir: "single.png" } — wrap each path in an array so it shares the
  // frame-list shape that named animations use, and it reads as a 1-frame idle.
  animations.idle = Object.fromEntries(Object.entries(rotations).map(([dir, p]) => [dir, [p]]));
}

const outFullDir = path.join(webRoot, 'public', 'assets', 'characters', id, 'full');
const outPreviewDir = path.join(webRoot, 'public', 'assets', 'characters', id, 'previews');
const outMetaDir = path.join(webRoot, 'public', 'assets', 'characters', id, 'metadata');
await mkdir(outFullDir, { recursive: true });
await mkdir(outPreviewDir, { recursive: true });
await mkdir(outMetaDir, { recursive: true });

const manifestAnimations = {};
let frameSize = null;
const generatedDirectionsSet = new Set();

for (const [state, dirs] of Object.entries(animations)) {
  const cfg = ANIM_CONFIG[state] ?? { frameRate: 8, repeat: 0 };
  manifestAnimations[state] = {
    id: `${id}_${state}`,
    state,
    frameRate: cfg.frameRate,
    repeat: cfg.repeat,
    frames: {},
  };

  for (const [dir, framePaths] of Object.entries(dirs)) {
    if (THREE_DIR && !KEEP_DIRS.has(dir)) continue;
    generatedDirectionsSet.add(dir);
    const images = await Promise.all(framePaths.map((p) => Jimp.read(path.join(workDir, p))));
    const w = images[0].bitmap.width;
    const h = images[0].bitmap.height;
    if (!frameSize) frameSize = { width: w, height: h };

    const sheet = new Jimp({ width: w * images.length, height: h });
    images.forEach((img, i) => sheet.composite(img, i * w, 0));

    const fileName = `${id}_${state}_${dir}.png`;
    await sheet.write(path.join(outFullDir, fileName));

    manifestAnimations[state].frames[dir] = {
      sheetPath: `characters/${id}/full/${fileName}`,
      frameWidth: w,
      frameHeight: h,
      frameCount: images.length,
    };
    console.log(`  wrote ${fileName} (${images.length} frames, ${w}x${h})`);
  }
}

if (rotations?.south) {
  await copyFile(
    path.join(workDir, rotations.south),
    path.join(outPreviewDir, `${id}_preview.png`),
  );
}

const manifest = {
  id,
  displayName,
  frameSize: frameSize ?? { width: 0, height: 0 },
  generatedDirections: Array.from(generatedDirectionsSet),
  mirroredDirections: [{ direction: 'left', mirrorsFrom: 'east' }],
  animations: manifestAnimations,
};

await writeFile(path.join(outMetaDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`manifest written for ${id}`);
