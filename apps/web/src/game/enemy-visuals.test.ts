import { describe, expect, it } from 'vitest';

import { ENEMY_VISUALS, skeletonTierForLevel } from './enemy-visuals';

const BASE_ARCHETYPE_IDS = [
  'corrupted_minion',
  'possessed_archer',
  'dark_shaman',
  'root_brute',
  'unstable_beast',
] as const;

const SKELETON_TIER_IDS = [
  'skeleton_recruit',
  'skeleton_warrior',
  'bone_soldier',
  'bone_warlord',
  'skeleton_king',
] as const;

describe('enemy visuals', () => {
  it('registers the five base archetypes plus the five Skeleton tiers, each with a valid tint', () => {
    const ids = Object.keys(ENEMY_VISUALS);
    expect(ids).toEqual([...BASE_ARCHETYPE_IDS, ...SKELETON_TIER_IDS]);
    const tints = Object.values(ENEMY_VISUALS).map(({ tint }) => tint);
    expect(new Set(tints).size).toBe(tints.length);
    for (const tint of tints) {
      expect(tint).toBeGreaterThanOrEqual(0);
      expect(tint).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('gives every base archetype a distinct generated silhouette or a safe tint fallback', () => {
    expect(ENEMY_VISUALS.root_brute.character?.id).toBe('root_brute');
    expect(ENEMY_VISUALS.possessed_archer.character?.id).toBe('ranger');
    expect(ENEMY_VISUALS.corrupted_minion.character?.id).toBe('assassin');
    expect(ENEMY_VISUALS.dark_shaman.character?.id).toBe('necromancer');
    expect(ENEMY_VISUALS.unstable_beast.character?.id).toBe('druid');
    const characterIds = BASE_ARCHETYPE_IDS.map((id) => ENEMY_VISUALS[id].character?.id);
    expect(new Set(characterIds).size).toBe(characterIds.length);
  });

  it('reskins one silhouette across the Skeleton line instead of five unrelated enemies', () => {
    // The whole point of a tier line (Paso 10, Diablo II's own Skeleton/Returned/Bone Warrior
    // pattern): every tier shares the Paladín's generated sheet, differentiated by tint and scale,
    // rather than budgeting five more sprite sheets for one level-scaled archetype.
    for (const id of SKELETON_TIER_IDS) expect(ENEMY_VISUALS[id].character?.id).toBe('paladin');
    const tiers = SKELETON_TIER_IDS.map((id) => ENEMY_VISUALS[id]);
    expect(new Set(tiers.map((tier) => tier.tint)).size).toBe(tiers.length);
    for (let index = 1; index < tiers.length; index += 1)
      expect(tiers[index]!.scale!).toBeGreaterThan(tiers[index - 1]!.scale!);
  });

  it('picks a Skeleton tier for every level in the 1-10 character cap, strongest at the top', () => {
    expect(skeletonTierForLevel(1)).toBe('skeleton_recruit');
    expect(skeletonTierForLevel(2)).toBe('skeleton_recruit');
    expect(skeletonTierForLevel(3)).toBe('skeleton_warrior');
    expect(skeletonTierForLevel(4)).toBe('skeleton_warrior');
    expect(skeletonTierForLevel(5)).toBe('bone_soldier');
    expect(skeletonTierForLevel(6)).toBe('bone_soldier');
    expect(skeletonTierForLevel(7)).toBe('bone_warlord');
    expect(skeletonTierForLevel(8)).toBe('bone_warlord');
    expect(skeletonTierForLevel(9)).toBe('skeleton_king');
    expect(skeletonTierForLevel(10)).toBe('skeleton_king');
    // Never throws outside the cap — a level past the character cap still resolves to the top tier.
    expect(skeletonTierForLevel(20)).toBe('skeleton_king');
  });
});
