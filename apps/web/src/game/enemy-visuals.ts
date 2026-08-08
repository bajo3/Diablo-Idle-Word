import {
  assassin,
  druid,
  necromancer,
  paladin,
  ranger,
  rootBrute,
  type PixelLabCharacter,
} from './pixellab-characters';

/**
 * Enemy visual identity. Each enemy reuses the Guardian's own generated frames (`darkKnight` in
 * pixellab-characters.ts) with a Phaser render-time tint. The previous first pass therefore read as
 * one silhouette in several colours. Three of those archetypes now use distinct generated class
 * silhouettes as a visual placeholder until dedicated enemy sheets are budgeted; the stable enemy
 * IDs, combat tuning and hitboxes remain unchanged. The tint is ignored when `character` is set,
 * but kept in the record so a fallback remains available if art is removed.
 */
export type EnemyVisualId =
  | 'corrupted_minion'
  | 'possessed_archer'
  | 'dark_shaman'
  | 'root_brute'
  | 'unstable_beast'
  | SkeletonTierId;

/**
 * The Skeleton line (Paso 10): one undead-warrior archetype reskinned across five level-scaled
 * tiers instead of five unrelated enemies, the way Diablo II reuses a monster family at
 * increasing area levels. `skeletonTierForLevel` below is the single place that decides which
 * tier a given character level fights.
 */
export type SkeletonTierId =
  | 'skeleton_recruit'
  | 'skeleton_warrior'
  | 'bone_soldier'
  | 'bone_warlord'
  | 'skeleton_king';

export type EnemyVisual = Readonly<{
  displayName: string;
  tint: number;
  /** Own generated art; when absent, the dummy reuses the Guardian's frames tinted. */
  character?: PixelLabCharacter;
  /**
   * Render scale for the borrowed-silhouette enemies. Tint alone leaves three archetypes with the
   * Guardian's exact outline, so a fight reads as one shape in four colours; sizing them apart at
   * least makes a weak minion and a heavy beast distinguishable at a glance while their own art is
   * still unbudgeted. Enemies with real art keep their authored proportions (scale 1).
   */
  scale?: number;
}>;

export const ENEMY_VISUALS: Readonly<Record<EnemyVisualId, EnemyVisual>> = Object.freeze({
  corrupted_minion: {
    displayName: 'Esbirro corrupto',
    tint: 0x5f8f52,
    character: assassin,
    scale: 0.82,
  },
  possessed_archer: { displayName: 'Arquero poseído', tint: 0x9c3b3b, character: ranger },
  dark_shaman: {
    displayName: 'Chamán oscuro',
    tint: 0x8a3ffc,
    character: necromancer,
    scale: 0.94,
  },
  root_brute: { displayName: 'Bruto de raíces', tint: 0xa8752f, character: rootBrute },
  unstable_beast: {
    displayName: 'Bestia inestable',
    tint: 0xd9a441,
    character: druid,
    scale: 1.2,
  },
  // Skeleton line, weakest to strongest. All five reuse the Paladín's armored silhouette (a real
  // generated sheet, not a placeholder) — the tint carries the tier the way Diablo II's own
  // Skeleton recolors do, and scale nudges the read from "recruit" to "king" at a glance.
  skeleton_recruit: {
    displayName: 'Esqueleto Recluta',
    tint: 0xd8d0c0,
    character: paladin,
    scale: 0.88,
  },
  skeleton_warrior: {
    displayName: 'Esqueleto Guerrero',
    tint: 0xb8ae9a,
    character: paladin,
    scale: 0.94,
  },
  bone_soldier: {
    displayName: 'Soldado Óseo',
    tint: 0x8f8f95,
    character: paladin,
    scale: 1,
  },
  bone_warlord: {
    displayName: 'Señor de Huesos',
    tint: 0x5b4a6f,
    character: paladin,
    scale: 1.08,
  },
  skeleton_king: {
    displayName: 'Rey Esqueleto',
    tint: 0xd9b34a,
    character: paladin,
    scale: 1.18,
  },
});

/**
 * Which Skeleton tier a character level fights: one step every two levels across the 1-10 cap
 * (`CHARACTER_PROGRESSION.maximumLevel` in `@brecha/game-data`), clamped at both ends so a level
 * outside that range still resolves to a real tier instead of throwing.
 */
export function skeletonTierForLevel(level: number): SkeletonTierId {
  if (level >= 9) return 'skeleton_king';
  if (level >= 7) return 'bone_warlord';
  if (level >= 5) return 'bone_soldier';
  if (level >= 3) return 'skeleton_warrior';
  return 'skeleton_recruit';
}
