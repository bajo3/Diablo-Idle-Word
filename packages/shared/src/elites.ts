import type { RandomSource } from './combat.js';

/**
 * At least two elite modifiers (Paso 8.6), selected through the same seeded `RandomSource` as
 * everything else in combat - no `Math.random`, so which enemies roll elite and which modifier
 * they get is reproducible from a run's seed.
 */
export type EliteModifierId = 'veloz' | 'resistente';

export type EliteModifier = Readonly<{
  id: EliteModifierId;
  displayName: string;
  moveSpeedMultiplier: number;
  maxHealthMultiplier: number;
  armorBonus: number;
}>;

export const ELITE_MODIFIERS: readonly EliteModifier[] = [
  {
    id: 'veloz',
    displayName: 'Veloz',
    moveSpeedMultiplier: 1.5,
    maxHealthMultiplier: 1,
    armorBonus: 0,
  },
  {
    id: 'resistente',
    displayName: 'Resistente',
    moveSpeedMultiplier: 1,
    maxHealthMultiplier: 1.75,
    armorBonus: 10,
  },
];

export function selectEliteModifier(random: RandomSource): EliteModifier {
  const index = random.nextInt(0, ELITE_MODIFIERS.length - 1);
  const modifier = ELITE_MODIFIERS[index];
  if (modifier === undefined) throw new Error(`Elite modifier index out of range: ${index}`);
  return modifier;
}

export type EliteScalableTuning = Readonly<{
  maxHealth: number;
  armor: number;
  moveSpeedPxPerSec: number;
}>;

/** Applies a modifier's multipliers/bonus to the three stats it can affect, leaving everything
 * else on the base tuning object untouched. */
export function applyEliteModifier<Tuning extends EliteScalableTuning>(
  base: Tuning,
  modifier: EliteModifier,
): Tuning {
  return {
    ...base,
    maxHealth: Math.round(base.maxHealth * modifier.maxHealthMultiplier),
    armor: base.armor + modifier.armorBonus,
    moveSpeedPxPerSec: base.moveSpeedPxPerSec * modifier.moveSpeedMultiplier,
  };
}
