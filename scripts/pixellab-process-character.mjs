// Turns an unzipped PixelLab character export into this project's asset layout:
//   public/assets/characters/<id>/full/<id>_<state>_<direction>.png   (composited spritesheet)
//   public/assets/characters/<id>/previews/<id>_preview.png
//   public/assets/characters/<id>/metadata/manifest.json
//
// Usage: node scripts/process-character.mjs <unzippedWorkDir> <id> <displayName>

import { Jimp } from 'jimp';
import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(__dirname, '..');

const [, , workDir, id, displayName] = process.argv;
if (!workDir || !id || !displayName) {
  console.error('Usage: node process-character.mjs <unzippedWorkDir> <id> <displayName>');
  process.exit(1);
}

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
const animations = state0.frames.animations;

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
