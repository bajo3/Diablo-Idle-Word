/**
 * Publishes generated rig sheets into the served asset tree.
 *
 * Kept separate from `rig/build.mjs` on purpose: building is cheap and repeatable, but publishing
 * puts files under `apps/web/public/assets/`, where `pnpm validate:assets` enforces provenance,
 * licence, frame geometry and a 1.5 MB budget on the whole pack. Nothing lands there until the art
 * is actually wanted.
 *
 * Each layer is published as its own character id (`hunter_body`, `hunter_armor`, `hunter_weapon`).
 * That is what lets the runtime reuse the existing per-character loader and animation registration
 * unchanged — three ordinary characters that happen to be drawn from the same rig and therefore
 * register pixel-for-pixel.
 */
import { copyFile, mkdir, readdir, writeFile } from 'node:fs/promises';

const CHARACTER = process.argv[2] ?? 'hunter';
const LAYERS = ['body', 'armor', 'weapon'];
const DIRECTIONS = ['north', 'east', 'south'];

/** Mirrors the shipped `ranger` manifest so both describe animations the same way. */
const ANIMATIONS = {
  idle: { frameRate: 6, repeat: -1, frameCount: 4 },
  walk: { frameRate: 10, repeat: -1, frameCount: 8 },
  basic_attack: { frameRate: 12, repeat: 0, frameCount: 7 },
  hit: { frameRate: 10, repeat: 0, frameCount: 6 },
  death: { frameRate: 8, repeat: 0, frameCount: 7 },
};

const root = new URL('../../', import.meta.url).pathname.replace(/^\//, '');
const source = `${root}scripts/aseprite-gen/out/${CHARACTER}/`;
const assetRoot = `${root}apps/web/public/assets/`;
const destination = `${assetRoot}characters/${CHARACTER}/`;

await mkdir(`${destination}layers/`, { recursive: true });
await mkdir(`${destination}metadata/`, { recursive: true });

const available = new Set(await readdir(source));
let copied = 0;
for (const layer of LAYERS) {
  for (const animation of Object.keys(ANIMATIONS)) {
    for (const direction of DIRECTIONS) {
      const file = `${CHARACTER}_${layer}_${animation}_${direction}.png`;
      if (!available.has(file)) throw new Error(`Missing generated sheet: ${file}`);
      await copyFile(`${source}${file}`, `${destination}layers/${file}`);
      copied += 1;
    }
  }
}

for (const layer of LAYERS) {
  const id = `${CHARACTER}_${layer}`;
  const manifest = {
    id,
    provenance: {
      source: 'Aseprite MCP rig (scripts/aseprite-gen)',
      author: 'La Brecha Oscura',
      license: 'CC0-1.0',
      addedAt: '2026-08-06',
      status: 'generated',
    },
    displayName: `Cazadora (${layer})`,
    frameSize: { width: 92, height: 92 },
    generatedDirections: DIRECTIONS,
    mirroredDirections: [{ direction: 'left', mirrorsFrom: 'east' }],
    animations: Object.fromEntries(
      Object.entries(ANIMATIONS).map(([name, spec]) => [
        name,
        {
          id: `${id}_${name}`,
          state: name,
          frameRate: spec.frameRate,
          repeat: spec.repeat,
          frames: Object.fromEntries(
            DIRECTIONS.map((direction) => [
              direction,
              {
                sheetPath: `characters/${CHARACTER}/layers/${CHARACTER}_${layer}_${name}_${direction}.png`,
                frameWidth: 92,
                frameHeight: 92,
                frameCount: spec.frameCount,
              },
            ]),
          ),
        },
      ]),
    ),
  };
  await writeFile(`${destination}metadata/${id}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(`copied ${copied} sheets and wrote ${LAYERS.length} manifests to ${destination}`);
