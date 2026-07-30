import Phaser from 'phaser';

import type { RandomSource } from '@brecha/shared';

/**
 * Procedural environment art for the Bosque Corrupto. Everything here is painted once from a
 * seeded `RandomSource` and baked into a single texture, so the ground costs one draw call per
 * frame instead of thousands, and two runs with the same seed paint the identical world (GOAL.md
 * §32 determinism — no `Math.random`, no per-frame randomness).
 */
export type ScatterPoint = Readonly<{ x: number; y: number }>;

/** Pure placement helper: deterministic scatter inside a margin-inset rectangle. */
export function scatterPoints(
  count: number,
  width: number,
  height: number,
  margin: number,
  random: RandomSource,
): readonly ScatterPoint[] {
  return Array.from({ length: Math.max(0, count) }, () => ({
    x: random.nextInt(margin, Math.max(margin, width - margin)),
    y: random.nextInt(margin, Math.max(margin, height - margin)),
  }));
}

/** Corrupted-forest palette: mossy earth with the purple corruption the zone is named for. */
const PALETTE = Object.freeze({
  soil: 0x1b241c,
  soilPatchDark: 0x151d17,
  soilPatchLight: 0x24301f,
  pebble: 0x39403a,
  grassLow: 0x2c4429,
  grassHigh: 0x3d6236,
  corruption: 0x6b3f8a,
  corruptionGlow: 0x8a3ffc,
});

const GROUND_TEXTURE_KEY = 'env:corrupted-forest-ground';
const VIGNETTE_TEXTURE_KEY = 'env:vignette';

/**
 * Paints soil, patches, pebbles, grass tufts and corruption veins into one baked texture and
 * returns the image placed at the world origin. Safe to call once per scene `create()`.
 */
export function paintCorruptedForestGround(
  scene: Phaser.Scene,
  width: number,
  height: number,
  random: RandomSource,
): Phaser.GameObjects.Image {
  if (scene.textures.exists(GROUND_TEXTURE_KEY)) scene.textures.remove(GROUND_TEXTURE_KEY);
  const canvas = scene.add.graphics();

  canvas.fillStyle(PALETTE.soil, 1).fillRect(0, 0, width, height);

  // Broad earth patches first, so smaller detail always reads on top of them. Kept very low
  // contrast on purpose: at higher alpha 100+ stacked circles read as blobs, not as terrain.
  for (const point of scatterPoints(120, width, height, 0, random)) {
    const radius = random.nextInt(28, 86);
    canvas
      .fillStyle(random.next() < 0.5 ? PALETTE.soilPatchDark : PALETTE.soilPatchLight, 0.13)
      .fillCircle(point.x, point.y, radius);
  }

  for (const point of scatterPoints(150, width, height, 8, random)) {
    canvas
      .fillStyle(PALETTE.pebble, 0.35 + random.next() * 0.3)
      .fillCircle(point.x, point.y, random.nextInt(1, 3));
  }

  for (const point of scatterPoints(260, width, height, 12, random)) {
    const blades = random.nextInt(2, 4);
    const tall = random.next() < 0.35;
    canvas.fillStyle(tall ? PALETTE.grassHigh : PALETTE.grassLow, 0.75);
    for (let blade = 0; blade < blades; blade += 1) {
      const originX = point.x + (blade - blades / 2) * 3;
      const heightPx = random.nextInt(tall ? 7 : 4, tall ? 12 : 8);
      const lean = random.nextInt(-3, 3);
      canvas.fillTriangle(
        originX - 1.5,
        point.y,
        originX + 1.5,
        point.y,
        originX + lean,
        point.y - heightPx,
      );
    }
  }

  // Corruption veins: short chained segments with a soft outer glow pass underneath. Each chain
  // keeps a rough heading so the veins creep like roots instead of scribbling back over themselves.
  for (const start of scatterPoints(9, width, height, 70, random)) {
    let x = start.x;
    let y = start.y;
    let angle = random.next() * Math.PI * 2;
    const segments = random.nextInt(4, 8);
    for (let segment = 0; segment < segments; segment += 1) {
      angle += (random.next() - 0.5) * 1.1;
      const length = random.nextInt(22, 46);
      const nextX = x + Math.cos(angle) * length;
      const nextY = y + Math.sin(angle) * length;
      canvas
        .lineStyle(6, PALETTE.corruptionGlow, 0.05)
        .lineBetween(x, y, nextX, nextY)
        .lineStyle(1.5, PALETTE.corruption, 0.24)
        .lineBetween(x, y, nextX, nextY);
      x = nextX;
      y = nextY;
    }
  }

  canvas.generateTexture(GROUND_TEXTURE_KEY, width, height);
  canvas.destroy();
  return scene.add.image(0, 0, GROUND_TEXTURE_KEY).setOrigin(0, 0).setDepth(-100);
}

/**
 * Mossy stone slabs for the static obstacles: a lit top face over a darker body, so walls read as
 * solid geometry instead of flat rectangles. Returns the rectangle used for physics collision.
 */
export function paintStoneObstacle(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
): Phaser.GameObjects.Rectangle {
  const body = scene.add.rectangle(x, y, width, height, 0x2b3830).setDepth(y);
  scene.add
    .rectangle(x, y - height / 2 + 3, width, 6, 0x415041)
    .setDepth(y + 0.1)
    .setAlpha(0.9);
  scene.add
    .rectangle(x, y + height / 2 - 2, width, 4, 0x11170f)
    .setDepth(y + 0.1)
    .setAlpha(0.6);
  return body;
}

/**
 * Camera-locked radial vignette that darkens the frame edges without touching gameplay. A
 * `scrollFactor(0)` object is still scaled by camera zoom, so the caller's zoom is divided back
 * out to keep the overlay exactly viewport-sized.
 */
export function addVignette(
  scene: Phaser.Scene,
  width: number,
  height: number,
  zoom = 1,
): Phaser.GameObjects.Image {
  if (!scene.textures.exists(VIGNETTE_TEXTURE_KEY)) {
    const texture = scene.textures.createCanvas(VIGNETTE_TEXTURE_KEY, width, height);
    const context = texture?.context;
    if (texture !== null && context !== undefined && context !== null) {
      const gradient = context.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.32,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.72,
      );
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0,0,0,0.45)');
      context.fillStyle = gradient;
      context.fillRect(0, 0, width, height);
      texture.refresh();
    }
  }
  return scene.add
    .image(width / 2, height / 2, VIGNETTE_TEXTURE_KEY)
    .setScrollFactor(0)
    .setScale(1 / zoom)
    .setDepth(900);
}
