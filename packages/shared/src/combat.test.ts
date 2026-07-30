import { describe, expect, it } from 'vitest';

import {
  advanceGuardianCombat,
  applyBattleThirst,
  applyDamageTaken,
  armorMitigation,
  createGuardianCombatState,
  criticalChance,
  resolvePhysicalDamage,
  targetWithinArc,
  targetWithinRadius,
  tryActivateAbility,
  type GuardianCombatTuning,
  type GuardianCombatState,
} from './combat.js';

const tuning: GuardianCombatTuning = {
  formulaVersion: 'guardian-combat.1',
  level: 1,
  strength: 10,
  dexterity: 5,
  vitality: 12,
  weaponDamage: [10, 14],
  maxFury: 100,
  criticalBaseChance: 0.05,
  criticalPerDexterity: 0.005,
  criticalCap: 0.5,
  criticalMultiplier: 1.5,
  armorDenominatorBase: 100,
  armorDenominatorPerLevel: 50,
  armorReductionCap: 0.75,
  furyOnDamageTaken: 5,
  furyDecayDelayMs: 3000,
  furyDecayPerSecond: 5,
  battleThirst: { healFraction: 0.05, capFraction: 0.15, windowMs: 10_000 },
  abilities: {
    slash: {
      id: 'slash',
      furyCost: 0,
      cooldownMs: 500,
      damageMultiplier: 1,
      rangePx: 78,
      arcDegrees: 100,
      maxTargets: 3,
      impactMs: 200,
      furyOnHit: 10,
    },
    powerStrike: {
      id: 'power',
      furyCost: 30,
      cooldownMs: 4000,
      damageMultiplier: 2.25,
      rangePx: 90,
      arcDegrees: 80,
      maxTargets: 3,
      impactMs: 400,
      knockbackPx: 128,
    },
    whirlwind: {
      id: 'whirlwind',
      furyCost: 40,
      cooldownMs: 7000,
      damageMultiplier: 0.45,
      radiusPx: 96,
      tickOffsetsMs: [0, 300, 600, 900],
      movementMultiplier: 0.65,
    },
    ironSkin: {
      id: 'iron',
      furyCost: 25,
      cooldownMs: 12_000,
      damageMultiplier: 0,
      impactMs: 250,
      durationMs: 4000,
      damageTakenMultiplier: 0.55,
    },
  },
};
const minimumRng = { nextInt: () => 10, next: () => 1 };
describe('Guardian combat pure rules', () => {
  it('derives level-one health, armor and exact critical chance', () => {
    const state = createGuardianCombatState(tuning);
    expect(state).toMatchObject({ health: 220, maxHealth: 220, armor: 25, fury: 0 });
    expect(criticalChance(tuning)).toBeCloseTo(0.075);
  });
  it('uses one final rounding after mitigation and critical', () => {
    expect(resolvePhysicalDamage(tuning, 100, 1, minimumRng)).toEqual({
      base: 20,
      mitigation: 0.4,
      critical: false,
      amount: 12,
    });
    expect(resolvePhysicalDamage(tuning, 0, 1, { nextInt: () => 14, next: () => 0 })).toEqual({
      base: 24,
      mitigation: 0,
      critical: true,
      amount: 36,
    });
  });
  it('clamps armor mitigation and never produces negative damage', () => {
    expect(armorMitigation(0, 1, tuning)).toBe(0);
    expect(armorMitigation(1_000_000, 1, tuning)).toBe(0.75);
    expect(resolvePhysicalDamage(tuning, 1_000_000, 0, minimumRng).amount).toBe(0);
  });
  it('reserves resource and cooldown only for accepted activations', () => {
    const initial = createGuardianCombatState(tuning);
    expect(
      tryActivateAbility(tuning, initial, { ability: 'powerStrike', executionId: 'a', at: 0 }),
    ).toEqual({ accepted: false, reason: 'fury' });
    const accepted = tryActivateAbility(
      tuning,
      { ...initial, fury: 30 },
      { ability: 'powerStrike', executionId: 'b', at: 25 },
    );
    expect(accepted).toMatchObject({
      accepted: true,
      state: { fury: 0, cooldownEndsAt: { powerStrike: 4025 } },
    });
    expect(
      tryActivateAbility(
        tuning,
        { ...(accepted.accepted ? accepted.state : initial), fury: 30 },
        {
          ability: 'powerStrike',
          executionId: 'c',
          at: 4025,
        },
      ).accepted,
    ).toBe(true);
  });
  it('starts iron skin on cast impact and expires from that point', () => {
    const accepted = tryActivateAbility(
      tuning,
      { ...createGuardianCombatState(tuning), fury: 25 },
      { ability: 'ironSkin', executionId: 'skin', at: 0 },
    );
    if (!accepted.accepted) throw new Error('expected iron skin acceptance');
    expect(applyDamageTaken(tuning, accepted.state, 100, 249).health).toBe(134);
    const damaged = applyDamageTaken(tuning, accepted.state, 100, 250);
    expect(damaged.health).toBe(173);
    expect(damaged.fury).toBe(5);
    expect(advanceGuardianCombat(tuning, damaged, 250, 4250).ironSkinEndsAt).toBeUndefined();
  });
  it('caps battle thirst in its rolling window and deduplicates defeats', () => {
    const hurt = { ...createGuardianCombatState(tuning), health: 100 };
    const first = applyBattleThirst(tuning, hurt, 'defeat:a', 100);
    const duplicate = applyBattleThirst(tuning, first, 'defeat:a', 200);
    const second = applyBattleThirst(tuning, duplicate, 'defeat:b', 300);
    const third = applyBattleThirst(tuning, second, 'defeat:c', 400);
    expect([first.health, duplicate.health, second.health, third.health]).toEqual([
      111, 111, 122, 133,
    ]);
  });
  it('does not generate fury or reset combat from a downed Guardian', () => {
    const downed = { ...createGuardianCombatState(tuning), health: 0, fury: 9, lastCombatAt: 77 };
    expect(applyDamageTaken(tuning, downed, 100, 100)).toEqual(downed);
  });
  it('decays fury only after the configured combat delay', () => {
    const state = { ...createGuardianCombatState(tuning), fury: 20, lastCombatAt: 0 };
    expect(advanceGuardianCombat(tuning, state, 0, 3000).fury).toBe(20);
    expect(advanceGuardianCombat(tuning, state, 0, 5000).fury).toBe(10);
  });
  it('decays at exactly the same cadence in 10 Hz updates or one jump and still cleans expirations', () => {
    const initial = {
      ...createGuardianCombatState(tuning),
      fury: 20,
      lastCombatAt: 0,
      ironSkinStartsAt: 0,
      ironSkinEndsAt: 4000,
      battleThirstHeals: [{ defeatId: 'old', at: 0, amount: 11 }],
    };
    let stepped: GuardianCombatState = initial;
    for (let at = 100; at <= 5000; at += 100)
      stepped = advanceGuardianCombat(tuning, stepped, at - 100, at);
    const jumped = advanceGuardianCombat(tuning, initial, 0, 5000);
    expect(stepped.fury).toBe(10);
    expect(stepped.fury).toBe(jumped.fury);
    expect(jumped.ironSkinEndsAt).toBeUndefined();
    expect(jumped.battleThirstHeals).toHaveLength(1);
    expect(advanceGuardianCombat(tuning, initial, 0, 10_001).battleThirstHeals).toHaveLength(0);
  });
  it('clamps critical chance at its configured cap', () => {
    expect(criticalChance({ ...tuning, dexterity: 1_000 })).toBe(0.5);
  });
  it('selects arc and radius targets deterministically', () => {
    const origin = { x: 0, y: 0 };
    const front = { id: 'front', position: { x: 50, y: 0 }, armor: 0, health: 1 };
    const side = { ...front, id: 'side', position: { x: 0, y: 50 } };
    expect(targetWithinArc(origin, { x: 1, y: 0 }, front, 78, 100)).toBe(true);
    expect(targetWithinArc(origin, { x: 1, y: 0 }, side, 78, 100)).toBe(false);
    expect(targetWithinRadius(origin, side, 50)).toBe(true);
  });
});
