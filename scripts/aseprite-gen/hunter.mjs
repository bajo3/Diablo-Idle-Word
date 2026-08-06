/**
 * Generates the `hunter` (Cazadora) idle-south frame through the Aseprite MCP server.
 *
 * Nothing here is guessed. The silhouette envelope, the anatomy breaks and the value range were all
 * measured off the shipped `ranger` sprite with `dump-shape.lua` / `dump-colors.lua` / `ascii-map.lua`,
 * so this character lands in the same 92x92 frame, reads at the same size, and sits in the same very
 * dark, near-monochrome value band. Only the hue family differs — ranger is purple-gray, the huntress
 * is forest green — so the two read as different classes without breaking the established art style.
 *
 * The structural beats that make the ranger read as a person, and that the first attempt missed:
 *   - a narrow head with a recessed face, not a big round ball;
 *   - arms detached from the torso by a gap of transparent pixels on both sides;
 *   - a cinched waist between torso and skirt;
 *   - one fully empty row under the skirt hem, then two separate legs.
 */
import { PixelMcp } from './mcp-client.mjs';

/**
 * Value ramp. Deliberately dark: the ranger's own histogram puts ~30% of its opaque pixels on a
 * near-black key line and keeps the cloth between roughly 0.12 and 0.25 luminance, with a rare
 * highlight around 0.38. The first attempt sat near 0.32-0.40 across the whole body, which is why
 * it read as bright and toy-like next to the shipped art.
 */
const P = {
  line: '#040303',
  deepest: '#0B100D',
  dark: '#141C17',
  mid: '#1E2822',
  light: '#28352C',
  bright: '#334339',
  rim: '#405446',
  leatherDark: '#1E0D07',
  leatherMid: '#382016',
  leatherLight: '#523020',
  skinShadow: '#5A3E32',
  skin: '#8A6A57',
  skinLight: '#A38571',
  goldDark: '#8A6A18',
  gold: '#DBA51E',
  metalDark: '#2B2B33',
  metalMid: '#4A4A54',
  metalLight: '#767280',
};

const canvas = new Map();
const k = (x, y) => `${x},${y}`;
const put = (x, y, c) => {
  if (x >= 0 && y >= 0 && x < 92 && y < 92) canvas.set(k(x, y), c);
};
const get = (x, y) => canvas.get(k(x, y));
const span = (y, x0, x1, c) => {
  for (let x = x0; x <= x1; x += 1) put(x, y, c);
};
const box = (x0, y0, x1, y1, c) => {
  for (let y = y0; y <= y1; y += 1) span(y, x0, x1, c);
};

/** Shades one horizontal run with a top-left key light: bright edge, body, then shadow side. */
function shadedSpan(y, x0, x1, ramp = [P.bright, P.light, P.mid, P.dark, P.deepest]) {
  const w = x1 - x0;
  for (let x = x0; x <= x1; x += 1) {
    const t = w === 0 ? 0 : (x - x0) / w;
    const i = Math.min(ramp.length - 1, Math.floor(t * ramp.length));
    put(x, y, ramp[i]);
  }
}

// ─── Hood ────────────────────────────────────────────────────────────────────────────────────
// Narrow and tapered. The ranger's head is only ~13px at its widest and starts as a 3px point.
const HOOD = [
  [17, 45, 47],
  [18, 44, 48],
  [19, 43, 49],
  [20, 42, 50],
  [21, 41, 51],
  [22, 41, 51],
  [23, 40, 52],
  [24, 40, 52],
  [25, 40, 52],
  [26, 40, 52],
  [27, 41, 51],
  [28, 42, 50],
];
for (const [y, x0, x1] of HOOD) shadedSpan(y, x0, x1);

// Face recess: the hood's inner shadow, so the head reads as cloth wrapped around a hollow.
box(42, 21, 50, 27, P.deepest);
// Face itself — small, low-contrast, mostly in shade. Only the eyes carry any bite.
box(43, 22, 49, 26, P.skinShadow);
box(44, 23, 48, 25, P.skin);
put(45, 23, P.skinLight);
put(47, 23, P.skinLight);
put(44, 24, P.line);
put(48, 24, P.line);
span(26, 44, 48, P.skinShadow);
// Hood brow casts over the eyes
span(21, 42, 50, P.dark);
span(22, 42, 50, P.deepest);

// ─── Shoulders and cape ──────────────────────────────────────────────────────────────────────
const CAPE = [
  [29, 39, 53],
  [30, 38, 55],
  [31, 37, 56],
  [32, 37, 56],
  [33, 37, 56],
  [34, 38, 55],
  [35, 39, 54],
  [36, 40, 53],
];
for (const [y, x0, x1] of CAPE) shadedSpan(y, x0, x1);
// Pauldron caps: a lit ridge on the left shoulder, deep shade on the right.
span(30, 38, 41, P.rim);
span(31, 37, 40, P.bright);
span(31, 54, 56, P.deepest);
span(32, 54, 56, P.deepest);

// ─── Torso ───────────────────────────────────────────────────────────────────────────────────
// Held narrow (11px) so the arms can sit outside it with real gaps between.
for (let y = 34; y <= 49; y += 1) shadedSpan(y, 41, 51, [P.light, P.mid, P.mid, P.dark, P.deepest]);
// Leather jerkin over the chest
box(42, 36, 50, 47, P.leatherMid);
box(42, 36, 44, 47, P.leatherLight);
box(49, 36, 50, 47, P.leatherDark);
// Quiver strap crossing the chest
for (let i = 0; i <= 10; i += 1) put(43 + i, 36 + i, P.leatherDark);

// ─── Arms ────────────────────────────────────────────────────────────────────────────────────
// The critical fix: each arm is its own column, separated from the torso by transparent pixels.
for (let y = 34; y <= 51; y += 1) {
  shadedSpan(y, 36, 38, [P.light, P.mid, P.dark]);
  shadedSpan(y, 54, 56, [P.mid, P.dark, P.deepest]);
}
// Bracers
box(36, 46, 38, 51, P.leatherMid);
box(36, 46, 36, 51, P.leatherLight);
box(54, 46, 56, 51, P.leatherDark);
box(54, 46, 54, 51, P.leatherMid);
// Hands
box(36, 52, 38, 54, P.skinShadow);
put(37, 53, P.skin);
box(54, 52, 56, 54, P.skinShadow);
put(55, 53, P.skinShadow);

// ─── Belt ────────────────────────────────────────────────────────────────────────────────────
box(40, 50, 52, 53, P.leatherDark);
span(50, 40, 52, P.leatherMid);
box(45, 50, 47, 53, P.goldDark);
put(46, 51, P.gold);
put(46, 52, P.gold);

// ─── Skirt / tassets ─────────────────────────────────────────────────────────────────────────
// Flares out below the belt and carries a center fold, exactly like the ranger's.
const SKIRT = [
  [54, 39, 53],
  [55, 39, 53],
  [56, 38, 54],
  [57, 38, 54],
  [58, 37, 55],
  [59, 37, 55],
  [60, 37, 55],
  [61, 37, 55],
  [62, 36, 56],
  [63, 36, 56],
  [64, 37, 55],
  [65, 37, 55],
  [66, 38, 54],
  [67, 39, 53],
];
for (const [y, x0, x1] of SKIRT) {
  shadedSpan(y, x0, x1, [P.light, P.mid, P.mid, P.dark, P.deepest]);
  put(46, y, P.deepest); // center fold
  put(45, y, P.dark);
}

// y=68 is left deliberately empty — the ranger has the same clean break between hem and legs,
// and it is what stops the lower body reading as one solid block.

// ─── Legs ────────────────────────────────────────────────────────────────────────────────────
for (let y = 69; y <= 73; y += 1) {
  shadedSpan(y, 40, 43, [P.mid, P.dark, P.deepest]);
  shadedSpan(y, 49, 52, [P.dark, P.deepest, P.deepest]);
}
// Boots
box(39, 74, 43, 77, P.leatherMid);
box(39, 74, 40, 77, P.leatherLight);
box(49, 74, 53, 77, P.leatherDark);
box(49, 74, 50, 77, P.leatherMid);
span(77, 39, 43, P.deepest);
span(77, 49, 53, P.deepest);

// ─── Bow ─────────────────────────────────────────────────────────────────────────────────────
// Held vertically in her left hand: a recurve limb plus a taut string. This is the class read, so
// it sits clear of the body outline rather than hugging it.
for (let y = 38; y <= 62; y += 1) {
  const t = (y - 38) / 24;
  const bulge = Math.round(3 * Math.sin(Math.PI * t));
  put(33 - bulge, y, P.leatherLight);
  put(34 - bulge, y, P.leatherDark);
}
put(33, 37, P.leatherMid);
put(33, 63, P.leatherMid);
for (let y = 38; y <= 62; y += 1) if (get(33, y) === undefined) put(33, y, P.metalMid);

// ─── Quiver ──────────────────────────────────────────────────────────────────────────────────
box(57, 30, 60, 44, P.leatherDark);
box(57, 30, 58, 44, P.leatherMid);
span(30, 57, 60, P.leatherLight);
// Fletching above the shoulder
put(58, 27, P.gold);
put(58, 28, P.metalLight);
put(58, 29, P.metalMid);
put(60, 27, P.goldDark);
put(60, 28, P.metalLight);
put(60, 29, P.metalMid);

// ─── Key line ────────────────────────────────────────────────────────────────────────────────
// One outline pass over everything at once, so body, bow and quiver share a single silhouette.
const filled = [...canvas.keys()];
const edge = [];
for (const key of filled) {
  const [x, y] = key.split(',').map(Number);
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    if (get(x + dx, y + dy) === undefined) edge.push([x + dx, y + dy]);
  }
}
for (const [x, y] of edge) put(x, y, P.line);

const pixels = [...canvas.entries()].map(([key, color]) => {
  const [x, y] = key.split(',').map(Number);
  return { x, y, color };
});

const mcp = new PixelMcp();
await mcp.start();
const { file_path: sprite } = await mcp.call('create_canvas', {
  width: 92,
  height: 92,
  color_mode: 'rgb',
});
await mcp.call('draw_pixels', {
  sprite_path: sprite,
  layer_name: 'Layer 1',
  frame_number: 1,
  pixels,
  use_palette: false,
});
const out = process.argv[2] ?? 'C:/Users/felip/AppData/Local/Temp/hunter-v3.png';
await mcp.call('export_sprite', {
  sprite_path: sprite,
  output_path: out,
  format: 'png',
  frame_number: 1,
});
console.log(`pixels=${pixels.length}\nexported=${out}`);
mcp.stop();
