/**
 * Renders one frame of a rig three ways — body only, body+armor, body+armor+weapon — so the
 * layering can be judged before committing to a full 45-sheet build. This is the whole point of
 * the rig: those three images must line up pixel-for-pixel, because at runtime they are three
 * sprites stacked on the same origin rather than one baked image.
 */
import { PixelMcp } from '../mcp-client.mjs';
import { composeLayer, outline, toPixels, LAYERS } from './rig.mjs';
import { hunterRig } from './hunter.mjs';

const rig = hunterRig;
const animation = process.argv[2] ?? 'idle';
const frameIndex = Number(process.argv[3] ?? 0);
const direction = process.argv[4] ?? 'south';
const outDir = 'C:/Users/felip/AppData/Local/Temp';

const pose = rig.animations[animation].poses[frameIndex] ?? {};

/** Stacks the given layers in render order, each outlined on its own, into one pixel map. */
function stack(layers) {
  const merged = new Map();
  for (const layer of LAYERS) {
    if (!layers.includes(layer)) continue;
    const canvas = composeLayer(rig, { direction, pose, layer });
    if (canvas.size === 0) continue;
    outline(canvas, rig.outlineColor);
    for (const [key, color] of canvas) merged.set(key, color);
  }
  return merged;
}

const mcp = new PixelMcp();
await mcp.start();

const variants = [
  ['body', ['body']],
  ['armor', ['body', 'armor']],
  ['full', ['body', 'armor', 'weapon']],
];

const written = [];
for (const [name, layers] of variants) {
  const canvas = stack(layers);
  const { file_path: sprite } = await mcp.call('create_canvas', {
    width: rig.frame.width,
    height: rig.frame.height,
    color_mode: 'rgb',
  });
  await mcp.call('draw_pixels', {
    sprite_path: sprite,
    layer_name: 'Layer 1',
    frame_number: 1,
    pixels: toPixels(canvas),
    use_palette: false,
  });
  const output = `${outDir}/rig-${rig.id}-${name}.png`;
  await mcp.call('export_sprite', {
    sprite_path: sprite,
    output_path: output,
    format: 'png',
    frame_number: 1,
  });
  written.push(`${name}: ${canvas.size}px -> ${output}`);
}

console.log(written.join('\n'));
mcp.stop();
