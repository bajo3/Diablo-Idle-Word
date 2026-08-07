import {
  assassin,
  druid,
  necromancer,
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
  'corrupted_minion' | 'possessed_archer' | 'dark_shaman' | 'root_brute' | 'unstable_beast';

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
});
