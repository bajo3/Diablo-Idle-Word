/**
 * Builds every (animation x layer) sheet for one direction of a rig and reports timing.
 *
 * Output lands in `scripts/aseprite-gen/out/` rather than in `apps/web/public/assets/` on purpose:
 * these sheets are not approved art yet, and `pnpm validate:assets` enforces provenance, licence
 * and a byte budget on anything that lives under the served asset tree.
 */
import { mkdir } from 'node:fs/promises';
import { PixelMcp } from '../mcp-client.mjs';
import { renderSheet, LAYERS } from './rig.mjs';
import { hunterRig } from './hunter.mjs';

const rig = hunterRig;
const direction = process.argv[2] ?? 'south';
const outDir = new URL(`../out/${rig.id}/`, import.meta.url).pathname.replace(/^\//, '');

await mkdir(outDir, { recursive: true });

const mcp = new PixelMcp();
await mcp.start();

const started = Date.now();
const rows = [];
for (const animation of Object.keys(rig.animations)) {
  for (const layer of LAYERS) {
    const outputPath = `${outDir}${rig.id}_${layer}_${animation}_${direction}.png`;
    const at = Date.now();
    const result = await renderSheet(mcp, rig, { animation, direction, layer, outputPath });
    if (result.exported === undefined) continue; // layer contributes nothing to this animation
    rows.push({
      sheet: `${layer}/${animation}`,
      frames: rig.animations[animation].poses.length,
      pixels: result.pixels,
      seconds: ((Date.now() - at) / 1000).toFixed(1),
    });
  }
}

console.table(rows);
console.log(`${rows.length} sheets in ${((Date.now() - started) / 1000).toFixed(1)}s -> ${outDir}`);
mcp.stop();
