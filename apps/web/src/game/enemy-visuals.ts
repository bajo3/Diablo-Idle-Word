/**
 * Enemy visual identity without new art (Paso 8 sprites remain blocked on PixelLab budget — see
 * docs/plans/step-08-enemies-ai.md). Each enemy reuses the Guardian's own generated frames
 * (`darkKnight` in pixellab-characters.ts) with a Phaser render-time tint, so five visually
 * distinct silhouettes exist without a single extra generation spent.
 */
export type EnemyVisualId =
  'corrupted_minion' | 'possessed_archer' | 'dark_shaman' | 'root_brute' | 'unstable_beast';

export type EnemyVisual = Readonly<{ displayName: string; tint: number }>;

export const ENEMY_VISUALS: Readonly<Record<EnemyVisualId, EnemyVisual>> = Object.freeze({
  corrupted_minion: { displayName: 'Esbirro corrupto', tint: 0x5f8f52 },
  possessed_archer: { displayName: 'Arquero poseído', tint: 0x9c3b3b },
  dark_shaman: { displayName: 'Chamán oscuro', tint: 0x8a3ffc },
  root_brute: { displayName: 'Bruto de raíces', tint: 0xa8752f },
  unstable_beast: { displayName: 'Bestia inestable', tint: 0xd9a441 },
});
