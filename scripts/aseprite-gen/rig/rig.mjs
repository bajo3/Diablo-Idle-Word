/**
 * Parts-based sprite rig.
 *
 * Why this exists instead of drawing whole frames: a character needs 96 frames (idle 4 + walk 8 +
 * basic_attack 7 + hit 6 + death 7, times three generated directions), and equipment has to be
 * visible. Authoring 96 flat frames by hand is not viable, and a flat frame can never show a real
 * helmet — `runtime.ts` currently falls back to translucent rarity-tinted vector shapes precisely
 * because the generated art is merged (see `renderEquipmentVisuals`).
 *
 * So parts are drawn once, then posed per frame, and each part declares which LAYER it belongs to.
 * The same rig therefore emits `body`, `armor` and `weapon` sheets that align pixel-for-pixel,
 * which is the layered contract `assets.ts` described before merged art arrived.
 */

export const LAYERS = ['shadow', 'body', 'armor', 'weapon'];

/**
 * Builds a part from an ASCII map. Small parts (a head is 13x12, an arm 3x15) stay far more
 * readable and editable as text than as coordinate lists, and a mis-typed row is caught here
 * rather than showing up as a silently deformed sprite.
 *
 * `.` and space are transparent; every other glyph must exist in `legend`.
 */
export function part({ rows, legend, anchor, layer, parent }) {
  const width = rows[0]?.length ?? 0;
  const pixels = [];
  rows.forEach((row, y) => {
    if (row.length !== width)
      throw new Error(`Ragged part row ${y}: expected width ${width}, got ${row.length}`);
    [...row].forEach((glyph, x) => {
      if (glyph === '.' || glyph === ' ') return;
      const color = legend[glyph];
      if (color === undefined) throw new Error(`Unknown glyph "${glyph}" at row ${y}, col ${x}`);
      pixels.push({ x, y, color });
    });
  });
  return { pixels, width, height: rows.length, anchor, layer, parent };
}

/**
 * Sums a part's own frame offset with every ancestor's.
 *
 * Without this, moving an arm means also listing its bracer and its hand in the same pose, in every
 * frame — which is both verbose and the kind of thing that silently desynchronises when one entry
 * is edited and the others are not. Declaring the bracer a child of the arm makes it follow.
 */
function resolveOffset(parts, pose, id, seen = new Set()) {
  if (seen.has(id)) throw new Error(`Cyclic part parenting at "${id}"`);
  seen.add(id);
  const [dx, dy] = pose[id] ?? [0, 0];
  const parent = parts[id]?.parent;
  if (parent === undefined) return [dx, dy];
  const [px, py] = resolveOffset(parts, pose, parent, seen);
  return [dx + px, dy + py];
}

/**
 * Composites one frame of one layer into a pixel map.
 *
 * Parts are stamped in `drawOrder`, so a later part overwrites an earlier one — that ordering is
 * what makes an arm read as being in front of the torso. Rendering a single layer keeps every
 * other layer's parts out entirely, leaving transparent pixels the runtime can see through.
 */
export function composeLayer(rig, { direction, pose, layer }) {
  const canvas = new Map();
  const parts = rig.parts[direction] ?? rig.parts.south;
  // Rest positions are per-direction too: turning a character around moves the quiver onto its
  // back and the bow to the other hand, which is a placement change, not just a redraw.
  const restTable = rig.rest[direction] ?? rig.rest.south ?? rig.rest;
  for (const id of rig.drawOrder) {
    const definition = parts[id];
    if (definition === undefined || definition.layer !== layer) continue;
    const rest = restTable[id];
    if (rest === undefined) throw new Error(`Part "${id}" has no rest position`);
    const [dx, dy] = resolveOffset(parts, pose, id);
    const originX = rest.x + dx - definition.anchor.x;
    const originY = rest.y + dy - definition.anchor.y;
    for (const pixel of definition.pixels) {
      const x = originX + pixel.x;
      const y = originY + pixel.y;
      if (x < 0 || y < 0 || x >= rig.frame.width || y >= rig.frame.height) continue;
      canvas.set(`${x},${y}`, pixel.color);
    }
  }
  return canvas;
}

/**
 * Adds the key line around whatever is already drawn.
 *
 * Applied per layer rather than to the flattened character on purpose: an armor piece needs its
 * own silhouette so it still reads when composited over a body it does not fully cover.
 */
export function outline(canvas, color) {
  const edges = [];
  for (const key of canvas.keys()) {
    const [x, y] = key.split(',').map(Number);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const neighbour = `${x + dx},${y + dy}`;
      if (!canvas.has(neighbour)) edges.push(neighbour);
    }
  }
  for (const key of edges) canvas.set(key, color);
  return canvas;
}

/** Turns a composited map into the `draw_pixels` payload the MCP server expects. */
export function toPixels(canvas) {
  return [...canvas.entries()].map(([key, color]) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y, color };
  });
}

/**
 * Renders one (animation, direction, layer) into a real Aseprite sprite — frames, per-frame
 * durations and a named tag — then exports it as a horizontal strip.
 *
 * The frames/tag round-trip is deliberate rather than pasting frames side by side on one wide
 * canvas: it keeps the .aseprite source editable by hand afterwards, which is the whole point of
 * generating through Aseprite instead of writing PNGs directly.
 */
export async function renderSheet(mcp, rig, { animation, direction, layer, outputPath }) {
  const spec = rig.animations[animation];
  if (spec === undefined) throw new Error(`Unknown animation "${animation}"`);

  const { file_path: sprite } = await mcp.call('create_canvas', {
    width: rig.frame.width,
    height: rig.frame.height,
    color_mode: 'rgb',
  });
  await mcp.call('set_frame_duration', {
    sprite_path: sprite,
    frame_number: 1,
    duration_ms: spec.durationMs,
  });
  for (let i = 1; i < spec.poses.length; i += 1)
    await mcp.call('add_frame', { sprite_path: sprite, duration_ms: spec.durationMs });

  let drawn = 0;
  for (const [index, pose] of spec.poses.entries()) {
    const canvas = composeLayer(rig, { direction, pose, layer });
    if (canvas.size === 0) continue; // e.g. an armor layer on a frame with no armor equipped
    outline(canvas, rig.outlineColor);
    const pixels = toPixels(canvas);
    drawn += pixels.length;
    await mcp.call('draw_pixels', {
      sprite_path: sprite,
      layer_name: 'Layer 1',
      frame_number: index + 1,
      pixels,
      use_palette: false,
    });
  }
  if (drawn === 0) return { sprite, exported: undefined, pixels: 0 };

  await mcp.call('create_tag', {
    sprite_path: sprite,
    tag_name: animation,
    from_frame: 1,
    to_frame: spec.poses.length,
    direction: 'forward',
  });
  await mcp.call('export_spritesheet', {
    sprite_path: sprite,
    output_path: outputPath,
    layout: 'horizontal',
    padding: 0,
    include_json: false,
  });
  return { sprite, exported: outputPath, pixels: drawn };
}
