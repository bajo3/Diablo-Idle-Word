/**
 * Lays every frame of one animation side by side on a single canvas.
 *
 * A pose table is easy to get subtly wrong — a leg that never returns to rest, an arm that swings
 * the same way as the leg beside it — and none of that is visible one frame at a time. Seeing the
 * whole cycle at once is what catches it.
 */
import { PixelMcp } from '../mcp-client.mjs';
import { composeLayer, outline, LAYERS } from './rig.mjs';
import { hunterRig } from './hunter.mjs';

const rig = hunterRig;
const animation = process.argv[2] ?? 'walk';
const direction = process.argv[3] ?? 'south';
const output = process.argv[4] ?? `C:/Users/felip/AppData/Local/Temp/strip-${animation}.png`;

const spec = rig.animations[animation];
const { width: fw, height: fh } = rig.frame;

const pixels = [];
spec.poses.forEach((pose, index) => {
  const merged = new Map();
  for (const layer of LAYERS) {
    const canvas = composeLayer(rig, { direction, pose, layer });
    if (canvas.size === 0) continue;
    outline(canvas, rig.outlineColor);
    for (const [key, color] of canvas) merged.set(key, color);
  }
  const offset = index * fw;
  for (const [key, color] of merged) {
    const [x, y] = key.split(',').map(Number);
    pixels.push({ x: offset + x, y, color });
  }
});

const mcp = new PixelMcp();
await mcp.start();
const { file_path: sprite } = await mcp.call('create_canvas', {
  width: fw * spec.poses.length,
  height: fh,
  color_mode: 'rgb',
});
await mcp.call('draw_pixels', {
  sprite_path: sprite,
  layer_name: 'Layer 1',
  frame_number: 1,
  pixels,
  use_palette: false,
});
await mcp.call('export_sprite', {
  sprite_path: sprite,
  output_path: output,
  format: 'png',
  frame_number: 1,
});
console.log(
  `${animation}/${direction}: ${spec.poses.length} frames, ${pixels.length}px -> ${output}`,
);
mcp.stop();
