/**
 * `hunter` (Cazadora) rig definition.
 *
 * Proportions come from measurements of the shipped `ranger` sprite, not from taste: a 92x92 frame,
 * a silhouette roughly 28 wide by 62 tall, a head that starts as a 3px point at y=17, arms held
 * clear of the torso by transparent gaps, one empty row under the hem, then two separate legs.
 * The value range is equally borrowed — the ranger keeps its cloth between about 0.12 and 0.25
 * luminance over a near-black key line, which is why an earlier, brighter attempt read as toy-like
 * beside it. Only the hue family differs: ranger is purple-gray, the huntress is forest green.
 */
import { part } from './rig.mjs';

const C = {
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

const L = {
  K: C.line,
  d: C.deepest,
  1: C.dark,
  2: C.mid,
  3: C.light,
  4: C.bright,
  r: C.rim,
  L: C.leatherDark,
  M: C.leatherMid,
  N: C.leatherLight,
  s: C.skinShadow,
  S: C.skin,
  H: C.skinLight,
  G: C.goldDark,
  g: C.gold,
  a: C.metalDark,
  b: C.metalMid,
  c: C.metalLight,
};

/**
 * Builds centred rows of a given per-row width, filled with a left-to-right glyph ramp. Used for
 * the robe, whose shape is a smooth taper — spelling 39 rows of it out by hand invites typos that
 * an eye would only catch after a full render.
 */
function taperedRows(widths, ramp) {
  const total = Math.max(...widths);
  return widths.map((w) => {
    const pad = Math.floor((total - w) / 2);
    let row = '.'.repeat(pad);
    for (let i = 0; i < w; i += 1) {
      const t = w === 1 ? 0 : i / (w - 1);
      row += ramp[Math.min(ramp.length - 1, Math.floor(t * ramp.length))];
    }
    return row + '.'.repeat(total - pad - w);
  });
}

// Narrow through the arms (y35-48) so they clear the body, then a restrained flare into a flat
// hem. An earlier pass widened to 21 and rounded off, which turned the lower body into a balloon;
// the ranger's skirt instead runs close to straight with hard vertical edges.
const ROBE_WIDTHS = [
  13, 15, 17, 17, 15, 13, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 13, 15, 15, 17,
  17, 17, 17, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19, 19,
];
const ROBE_RAMP = ['4', '3', '3', '2', '2', '1', 'd'];

/**
 * The robe with its cloth folds. A single vertical crease down the centre plus darkened side
 * edges is what stops a large flat area of one value from reading as a sack — the same three
 * marks the ranger's skirt uses.
 */
function robeRows() {
  const rows = taperedRows(ROBE_WIDTHS, ROBE_RAMP).map((row) => [...row]);
  const total = rows[0].length;
  const centre = Math.floor(total / 2);
  rows.forEach((row, y) => {
    if (y < 20) return; // folds only below the belt, where the cloth hangs free
    row[centre] = 'd';
    row[centre - 1] = '1';
    const left = row.findIndex((glyph) => glyph !== '.');
    const right = row.length - 1 - [...row].reverse().findIndex((glyph) => glyph !== '.');
    row[left] = 'd';
    row[right] = 'd';
    if (y > 22) {
      row[left + 4] = '1';
      row[right - 4] = 'd';
    }
  });
  return rows.map((row) => row.join(''));
}

function bowRows() {
  const height = 25;
  const width = 7;
  const grid = Array.from({ length: height }, () => Array(width).fill('.'));
  for (let y = 0; y < height; y += 1) {
    const bulge = Math.round(3 * Math.sin((Math.PI * y) / (height - 1)));
    grid[y][3 - bulge] = 'N';
    grid[y][4 - bulge] = 'L';
    if (grid[y][3] === '.') grid[y][3] = 'b'; // string runs straight between the tips
  }
  grid[0][3] = 'M';
  grid[height - 1][3] = 'M';
  return grid.map((row) => row.join(''));
}

const south = {
  // Pure transform node: no pixels of its own, it just gives the upper body a single handle. A
  // walk bob would otherwise have to list head, jerkin, both arms, the belt and the quiver in
  // every frame, and those entries drift out of sync the moment one is edited alone.
  core: part({ rows: [], legend: L, anchor: { x: 0, y: 0 }, layer: 'body' }),

  // ── body ──────────────────────────────────────────────────────────────────────────────────
  robe: part({
    rows: robeRows(),
    legend: L,
    anchor: { x: 9, y: 0 },
    layer: 'body',
  }),
  // 11 wide rather than 13: the ranger's head is small relative to the body, and the extra two
  // columns were enough to push this one toward a bobblehead.
  head: part({
    rows: [
      '....333....',
      '..33444433.',
      '.334444433.',
      '3344444433.',
      '334ddddd433',
      '34dsssssd43',
      '34dsKsKsd43',
      '34dsSHSsd43',
      '.4dsSSSsd4.',
      '.34dsssd43.',
      '..33444333.',
      '...33333...',
    ],
    legend: L,
    anchor: { x: 5, y: 11 },
    layer: 'body',
    parent: 'core',
  }),
  // Narrower than the robe so cloth still frames it on both sides, instead of reading as a bib.
  jerkin: part({
    rows: [
      '.NNNNNNN.',
      'NMMMMMMML',
      'NMMMMMMML',
      'NMMMMMMLL',
      'NMMMMMMLL',
      'NMMMMMMLL',
      'NMMMMMLLL',
      'NMMMMMLLL',
      '.MMMMMLL.',
      '.MMMMLLL.',
      '.MMMMLLL.',
      '.MMMLLLL.',
    ],
    legend: L,
    anchor: { x: 4, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  // Lit hard on the left and sunk on the right so the limbs separate from the cloth behind them.
  armL: part({
    rows: Array.from({ length: 15 }, () => 'r43'),
    legend: L,
    anchor: { x: 1, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  armR: part({
    rows: Array.from({ length: 15 }, () => '21d'),
    legend: L,
    anchor: { x: 1, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  handL: part({
    rows: ['sSs', 'SHS', '.s.'],
    legend: L,
    anchor: { x: 1, y: 0 },
    layer: 'body',
    parent: 'armL',
  }),
  handR: part({
    rows: ['sSs', 'sSs', '.s.'],
    legend: L,
    anchor: { x: 1, y: 0 },
    layer: 'body',
    parent: 'armR',
  }),
  legL: part({
    rows: Array.from({ length: 5 }, () => '2321'),
    legend: L,
    anchor: { x: 2, y: 0 },
    layer: 'body',
  }),
  legR: part({
    rows: Array.from({ length: 5 }, () => '1211'),
    legend: L,
    anchor: { x: 2, y: 0 },
    layer: 'body',
  }),
  belt: part({
    rows: ['MMMMMGgGMMMMM', 'LLLLLGgGLLLLL', 'LLLLLLGLLLLLL', 'ddddddddddddd'],
    legend: L,
    anchor: { x: 6, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  quiver: part({
    rows: [
      '..g.g..',
      '..c.c..',
      '..b.b..',
      '.NNNNN.',
      'NMMMMML',
      'NMMMMML',
      'NMMMMML',
      'NMMMMML',
      'NMMMMML',
      'NMMMMML',
      'NMMMMML',
      '.MMMMLL',
      '.MMMLLL',
      '.LLLLL.',
    ],
    legend: L,
    anchor: { x: 3, y: 0 },
    layer: 'body',
    parent: 'core',
  }),

  // ── armor (swapped when gear is equipped; renders as its own aligned sheet) ────────────────
  // A fitted circlet with a low brow guard rather than a full dome — a wide cap over an already
  // rounded hood turned the head into a mushroom.
  helmet: part({
    rows: ['...ccc...', '.ccbbbcc.', 'cbbbbbbbc', 'cbbaaabbc', 'ba.....ab'],
    legend: L,
    anchor: { x: 4, y: 4 },
    layer: 'armor',
    parent: 'head',
  }),
  chest: part({
    rows: [
      '.bbbbbbb.',
      'bccbbbccb',
      'bcbbbbbcb',
      'bcbaaabcb',
      'bcbaaabcb',
      'bbbaaabbb',
      '.bbaaabb.',
      '.bbbbbbb.',
      '..bbbbb..',
      '..bbbbb..',
    ],
    legend: L,
    anchor: { x: 4, y: 0 },
    layer: 'armor',
    parent: 'jerkin',
  }),
  bracerL: part({
    rows: ['cbb', 'cbb', 'bba', 'bba', '.a.'],
    legend: L,
    anchor: { x: 1, y: 0 },
    layer: 'armor',
    parent: 'armL',
  }),
  bracerR: part({
    rows: ['bba', 'bba', 'baa', 'baa', '.a.'],
    legend: L,
    anchor: { x: 1, y: 0 },
    layer: 'armor',
    parent: 'armR',
  }),
  bootL: part({
    rows: ['NMMLL', 'NMMLL', 'cbbaa', 'NMMLL', 'ddddd'],
    legend: L,
    anchor: { x: 2, y: 0 },
    layer: 'armor',
    parent: 'legL',
  }),
  bootR: part({
    rows: ['MMLLL', 'MMLLL', 'bbaaa', 'MMLLL', 'ddddd'],
    legend: L,
    anchor: { x: 2, y: 0 },
    layer: 'armor',
    parent: 'legR',
  }),

  // ── weapon ────────────────────────────────────────────────────────────────────────────────
  bow: part({
    rows: bowRows(),
    legend: L,
    anchor: { x: 3, y: 0 },
    layer: 'weapon',
    parent: 'armL',
  }),
};

// ── north (facing away) ───────────────────────────────────────────────────────────────────────
// The whole point of authoring this direction is that the face must NOT be here. Reusing the
// south parts, as an earlier pass did, left the huntress looking over her own shoulder while
// walking away from the camera.
const NORTH_ROBE_WIDTHS = ROBE_WIDTHS;

const north = {
  ...south,
  head: part({
    rows: [
      '....333....',
      '..33444433.',
      '.334444433.',
      '33444344433',
      '33444344433',
      '33344344433',
      '33344344433',
      '33344344333',
      '.33444443..',
      '.33444433..',
      '..33444333.',
      '...33333...',
    ],
    legend: L,
    anchor: { x: 5, y: 11 },
    layer: 'body',
    parent: 'core',
  }),
  // Worn on the back, so from behind it reads full width and sits centred rather than peeking
  // past one shoulder.
  quiver: part({
    rows: [
      '..g.g..',
      '..c.c..',
      '..b.b..',
      'NNNNNNN',
      'NMMMMML',
      'NMMbMML',
      'NMMbMML',
      'NMMMMML',
      'NMMbMML',
      'NMMbMML',
      'NMMMMML',
      'NMMMMLL',
      '.MMMLLL',
      '.LLLLL.',
    ],
    legend: L,
    anchor: { x: 3, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  // The back of a hooded cloak has no belt buckle facing the camera.
  belt: part({
    rows: ['MMMMMMMMMMMMM', 'LLLLLLLLLLLLL', 'LLLLLLLLLLLLL', 'ddddddddddddd'],
    legend: L,
    anchor: { x: 6, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  chest: part({
    rows: [
      '.bbbbbbb.',
      'bbbbbbbbb',
      'bbbaaabbb',
      'bbbaaabbb',
      'bbbaaabbb',
      'bbbaaabbb',
      '.bbaaabb.',
      '.bbbbbbb.',
      '..bbbbb..',
      '..bbbbb..',
    ],
    legend: L,
    anchor: { x: 4, y: 0 },
    layer: 'armor',
    parent: 'jerkin',
  }),
};

// ── east (profile) ────────────────────────────────────────────────────────────────────────────
// A profile is genuinely narrower: the shoulders turn edge-on, so the robe loses about four
// columns and the far arm all but disappears behind the body.
const EAST_ROBE_WIDTHS = [
  13, 15, 17, 17, 15, 13, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 13, 15, 15, 17,
  17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17, 17,
];

function eastRobeRows() {
  const rows = taperedRows(EAST_ROBE_WIDTHS, ROBE_RAMP).map((row) => [...row]);
  rows.forEach((row, y) => {
    if (y < 20) return;
    const left = row.findIndex((glyph) => glyph !== '.');
    const right = row.length - 1 - [...row].reverse().findIndex((glyph) => glyph !== '.');
    row[left] = 'd';
    row[right] = 'd';
    row[left + 3] = '1';
  });
  return rows.map((row) => row.join(''));
}

const east = {
  ...south,
  robe: part({
    rows: eastRobeRows(),
    legend: L,
    anchor: { x: 8, y: 0 },
    layer: 'body',
  }),
  head: part({
    rows: [
      '...333...',
      '.3344433.',
      '33444443.',
      '334444443',
      '3344dddss',
      '334dssSHs',
      '334dsSKHs',
      '334dsSSHs',
      '.34dsSSs.',
      '.334dss3.',
      '..344433.',
      '...3333..',
    ],
    legend: L,
    anchor: { x: 4, y: 11 },
    layer: 'body',
    parent: 'core',
  }),
  jerkin: part({
    rows: [
      '.NNNNN.',
      'NMMMMML',
      'NMMMMML',
      'NMMMMLL',
      'NMMMMLL',
      'NMMMMLL',
      'NMMMLLL',
      'NMMMLLL',
      '.MMMLL.',
      '.MMLLL.',
      '.MMLLL.',
      '.MMLLL.',
    ],
    legend: L,
    anchor: { x: 3, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  legL: part({
    rows: Array.from({ length: 5 }, () => '1dd1'),
    legend: L,
    anchor: { x: 2, y: 0 },
    layer: 'body',
  }),
  // Far arm: sunk to the darkest values so it reads as being behind the torso, not beside it.
  armR: part({
    rows: Array.from({ length: 15 }, () => '1dd'),
    legend: L,
    anchor: { x: 1, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  belt: part({
    rows: ['MMMGgGMMM', 'LLLGgGLLL', 'LLLLGLLLL', 'ddddddddd'],
    legend: L,
    anchor: { x: 4, y: 0 },
    layer: 'body',
    parent: 'core',
  }),
  chest: part({
    rows: [
      '.bbbbb.',
      'bccbccb',
      'bcbbbcb',
      'bcaaacb',
      'bcaaacb',
      'bbaaabb',
      '.baaab.',
      '.bbbbb.',
      '..bbb..',
      '..bbb..',
    ],
    legend: L,
    anchor: { x: 3, y: 0 },
    layer: 'armor',
    parent: 'jerkin',
  }),
  helmet: part({
    rows: ['..ccc..', '.cbbbc.', 'cbbbbbc', 'cbaaabc', 'ba...ab'],
    legend: L,
    anchor: { x: 3, y: 4 },
    layer: 'armor',
    parent: 'head',
  }),
};

/**
 * Rest positions place each part's anchor in the 92x92 frame. Feet land at y=77, just above the
 * 0.86 pivot line the runtime anchors sprites on, and y=68 is left empty so the hem and the legs
 * never merge into one block.
 */
const REST = {
  robe: { x: 46, y: 29 },
  head: { x: 46, y: 29 },
  jerkin: { x: 46, y: 34 },
  armL: { x: 38, y: 32 },
  armR: { x: 54, y: 32 },
  handL: { x: 38, y: 47 },
  handR: { x: 54, y: 47 },
  legL: { x: 42, y: 69 },
  legR: { x: 50, y: 69 },
  belt: { x: 46, y: 46 },
  quiver: { x: 57, y: 28 },
  helmet: { x: 46, y: 24 },
  chest: { x: 46, y: 34 },
  bracerL: { x: 38, y: 42 },
  bracerR: { x: 54, y: 42 },
  bootL: { x: 42, y: 73 },
  bootR: { x: 50, y: 73 },
  bow: { x: 34, y: 38 },
};

/** Facing away: quiver centred on the back, bow carried on the opposite side. */
const REST_NORTH = { ...REST, quiver: { x: 46, y: 30 }, bow: { x: 58, y: 38 } };

/** Profile: everything tucks toward the centre line and the far arm hides behind the torso. */
const REST_EAST = {
  ...REST,
  // Near arm carried forward of the chest so it clears the robe; far arm tucked behind it.
  armL: { x: 50, y: 32 },
  armR: { x: 42, y: 33 },
  handL: { x: 50, y: 47 },
  handR: { x: 42, y: 48 },
  bracerL: { x: 50, y: 42 },
  bracerR: { x: 42, y: 43 },
  // Legs overlap by two columns instead of sitting side by side — a profile shows one leg
  // passing in front of the other, never two full legs abreast.
  legL: { x: 44, y: 69 },
  legR: { x: 47, y: 69 },
  bootL: { x: 44, y: 73 },
  bootR: { x: 47, y: 73 },
  quiver: { x: 43, y: 30 },
  bow: { x: 53, y: 38 },
};

const still = {};

/** A slow breath: the whole upper body lifts a pixel and settles. */
const IDLE = [{}, { core: [0, -1] }, { core: [0, -1] }, {}];

/**
 * Eight frames, two strides: contact, weight, pass, lift — then mirrored.
 *
 * Facing the camera a stride reads almost entirely as vertical lift, so the swinging leg rises 4px
 * rather than reaching forward, the body drops on weight acceptance and rises on the push, and the
 * arms counter-swing against the legs. An earlier pass used 1-2px throughout and the eight frames
 * were indistinguishable.
 */
const WALK = [
  { legR: [0, -4], armL: [0, 2], armR: [0, -2] },
  { legR: [0, -2], core: [0, 1], armL: [0, 3], armR: [0, -1], robe: [0, 1] },
  { armL: [0, 1] },
  { legL: [0, -4], core: [0, -2], armL: [0, -1], armR: [0, 1], robe: [0, -1] },
  { legL: [0, -4], armL: [0, -2], armR: [0, 2] },
  { legL: [0, -2], core: [0, 1], armL: [0, -1], armR: [0, 3], robe: [0, 1] },
  { armR: [0, 1] },
  { legR: [0, -4], core: [0, -2], armL: [0, 1], armR: [0, -1], robe: [0, -1] },
];

/** Draw, hold, loose, recover. The bow hand stays planted; the string hand pulls back past the ear. */
const BASIC_ATTACK = [
  { armR: [0, -1] },
  { armR: [1, -3], head: [0, -1] },
  { armR: [3, -4], head: [-1, -1], core: [-1, 0] },
  { armR: [3, -4], head: [-1, -1], core: [-1, 0] },
  { armR: [-2, -2], core: [1, 0] },
  { armR: [0, -1] },
  {},
];

/** Knocked back off the front foot, then settling. */
const HIT = [
  { core: [1, 1] },
  { core: [3, 2], robe: [1, 0] },
  { core: [3, 2], robe: [1, 0] },
  { core: [2, 1] },
  { core: [1, 0] },
  {},
];

/** Knees buckle, the body folds forward and comes to rest on the ground plane. */
const DEATH = [
  { core: [0, 3] },
  { core: [0, 7], robe: [0, 2], armL: [1, 0], armR: [-1, 0] },
  { core: [0, 12], robe: [0, 5], legL: [0, 3], legR: [0, 3], armL: [2, 0], armR: [-2, 0] },
  { core: [0, 17], robe: [0, 9], legL: [0, 5], legR: [0, 5], armL: [3, 0], armR: [-3, 0] },
  { core: [0, 21], robe: [0, 12], legL: [0, 6], legR: [0, 6], armL: [4, 0], armR: [-4, 0] },
  { core: [0, 23], robe: [0, 13], legL: [0, 6], legR: [0, 6], armL: [5, 0], armR: [-5, 0] },
  { core: [0, 24], robe: [0, 14], legL: [0, 6], legR: [0, 6], armL: [5, 0], armR: [-5, 0] },
];

export const hunterRig = {
  id: 'hunter',
  displayName: 'Cazadora',
  frame: { width: 92, height: 92 },
  origin: { x: 0.5, y: 0.86 },
  outlineColor: C.line,
  // Painter's order: everything behind the torso first, arms and head last, so limbs read as being
  // in front. Filtering by layer preserves this order inside each emitted sheet.
  drawOrder: [
    'robe',
    'quiver',
    'legL',
    'legR',
    'bootL',
    'bootR',
    'jerkin',
    'belt',
    'chest',
    'armL',
    'armR',
    'bracerL',
    'bracerR',
    'handL',
    'handR',
    'head',
    'helmet',
    'bow',
  ],
  parts: { south, north, east },
  rest: { south: REST, north: REST_NORTH, east: REST_EAST },
  animations: {
    idle: { durationMs: 166, poses: IDLE },
    walk: { durationMs: 100, poses: WALK },
    basic_attack: { durationMs: 83, poses: BASIC_ATTACK },
    hit: { durationMs: 100, poses: HIT },
    death: { durationMs: 125, poses: DEATH },
  },
  still,
};
