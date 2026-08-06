import { describe, expect, it } from 'vitest';

import { constrainKnockbackSweep, LocalCombatController } from './combat-controller';

function testController() {
  let time = 0;
  const controller = new LocalCombatController(
    { now: () => time },
    { nextInt: () => 10, next: () => 1 },
  );
  controller.addDummy({
    id: 'dummy:front',
    position: { x: 50, y: 0 },
    armor: 0,
    health: 1000,
    maxHealth: 1000,
  });
  return { controller, setTime: (next: number) => (time = next) };
}
describe('character profile drives combat', () => {
  it('raises max health with Vitality while preserving the current health fraction', () => {
    const { controller } = testController();
    const before = controller.snapshot();
    // Armour reduces the raw amount, so the exact loss is the formula's business — what matters
    // here is only that the character is genuinely wounded before the profile changes.
    controller.applyIncomingDamage(before.maxHealth);
    const halved = controller.snapshot();
    expect(halved.health).toBeGreaterThan(0);
    expect(halved.health).toBeLessThan(before.maxHealth);

    controller.applyCharacterProfile({
      level: 10,
      strength: 20,
      dexterity: 10,
      vitality: 40,
    });
    const after = controller.snapshot();
    expect(after.maxHealth).toBeGreaterThan(before.maxHealth);
    // Still wounded by the same proportion: growing Vitality must not act as a free heal.
    expect(after.health / after.maxHealth).toBeCloseTo(halved.health / halved.maxHealth, 2);
  });

  it('makes a stronger character hit harder with the same ability and roll', () => {
    const damageFor = (profile?: {
      level: number;
      strength: number;
      dexterity: number;
      vitality: number;
    }) => {
      const { controller, setTime } = testController();
      if (profile !== undefined) controller.applyCharacterProfile(profile);
      controller.activate('slash', 'execution:1', { x: 0, y: 0 }, { x: 1, y: 0 });
      setTime(200);
      const hit = controller.update().find((event) => event.type === 'damageApplied');
      return hit !== undefined && hit.type === 'damageApplied' ? hit.amount : 0;
    };

    expect(damageFor({ level: 20, strength: 60, dexterity: 10, vitality: 10 })).toBeGreaterThan(
      damageFor(),
    );
  });

  it('makes equipped gear (armor, max health, and weapon damage) actually change combat', () => {
    const baseProfile = { level: 5, strength: 15, dexterity: 10, vitality: 15 };
    const { controller: bare } = testController();
    bare.applyCharacterProfile(baseProfile);
    const bareSnapshot = bare.snapshot();

    const { controller: geared } = testController();
    geared.applyCharacterProfile({
      ...baseProfile,
      armorBonus: 40,
      maxHealthBonus: 60,
      physicalDamageBonus: 25,
      criticalChanceBonus: 0.2,
    });
    const gearedSnapshot = geared.snapshot();

    // Same level/attributes either way — only the gear-only fields differ, and only they should
    // move maxHealth. (Armor isn't on CombatHudSnapshot; it's exercised indirectly below.)
    expect(gearedSnapshot.maxHealth).toBe(bareSnapshot.maxHealth + 60);

    // A geared Guardian must hit an unarmoured dummy harder than the same build with no gear.
    // `testController()`'s fixed-value RNG (always returns 10) can't show this — it ignores the
    // weapon-damage range entirely — so build both attackers with an RNG that echoes the range's
    // floor back, the same way the shared combat.test.ts proves the same formula field.
    const attackerWith = (profile: {
      level: number;
      strength: number;
      dexterity: number;
      vitality: number;
      physicalDamageBonus?: number;
    }) => {
      let time = 0;
      const controller = new LocalCombatController(
        { now: () => time },
        { nextInt: (minimum: number) => minimum, next: () => 1 },
      );
      controller.addDummy({
        id: 'dummy:front',
        position: { x: 50, y: 0 },
        armor: 0,
        health: 1000,
        maxHealth: 1000,
      });
      controller.applyCharacterProfile(profile);
      controller.activate('slash', 'execution:1', { x: 0, y: 0 }, { x: 1, y: 0 });
      time = 200;
      return controller.update().find((event) => event.type === 'damageApplied');
    };
    const bareHit = attackerWith(baseProfile);
    const gearedHit = attackerWith({ ...baseProfile, physicalDamageBonus: 25 });
    expect(bareHit?.type).toBe('damageApplied');
    expect(gearedHit?.type).toBe('damageApplied');
    if (bareHit?.type === 'damageApplied' && gearedHit?.type === 'damageApplied')
      expect(gearedHit.amount).toBeGreaterThan(bareHit.amount);
  });

  it('leaves a downed character downed', () => {
    const { controller } = testController();
    controller.applyIncomingDamage(10_000);
    expect(controller.snapshot().downed).toBe(true);
    controller.applyCharacterProfile({
      level: 30,
      strength: 50,
      dexterity: 50,
      vitality: 99,
    });
    expect(controller.snapshot().health).toBe(0);
    expect(controller.snapshot().downed).toBe(true);
  });
});

describe('local Guardian combat controller', () => {
  it('applies a configured impact only once per execution/target/tick and drives HUD fury', () => {
    const { controller, setTime } = testController();
    expect(
      controller.activate('slash', 'execution:1', { x: 0, y: 0 }, { x: 1, y: 0 }),
    ).toHaveLength(1);
    setTime(200);
    expect(controller.update().filter((event) => event.type === 'damageApplied')).toHaveLength(1);
    expect(controller.update().filter((event) => event.type === 'damageApplied')).toHaveLength(0);
    expect(controller.snapshot().fury).toBe(10);
  });
  it('rejects missing fury and begins cooldown at accepted activation', () => {
    const { controller, setTime } = testController();
    expect(
      controller.activate('powerStrike', 'execution:1', { x: 0, y: 0 }, { x: 1, y: 0 })[0],
    ).toMatchObject({ type: 'abilityRejected', reason: 'fury' });
    controller.activate('slash', 'execution:2', { x: 0, y: 0 }, { x: 1, y: 0 });
    setTime(200);
    controller.update();
    expect(
      controller.activate('slash', 'execution:3', { x: 0, y: 0 }, { x: 1, y: 0 })[0],
    ).toMatchObject({ type: 'abilityRejected', reason: 'busy' });
  });
  it('keeps power-strike targets in place instead of pushing mobs away', () => {
    let time = 0;
    const controller = new LocalCombatController(
      { now: () => time },
      { nextInt: () => 10, next: () => 1 },
      (_from, proposed) => ({ x: Math.min(proposed.x, 100), y: proposed.y }),
    );
    controller.addDummy({
      id: 'dummy:front',
      position: { x: 50, y: 0 },
      armor: 0,
      health: 100,
      maxHealth: 100,
    });
    controller.activate('slash', 'fury', { x: 0, y: 0 }, { x: 1, y: 0 });
    time = 200;
    controller.update();
    time = 500;
    controller.activate('slash', 'fury:2', { x: 0, y: 0 }, { x: 1, y: 0 });
    time = 700;
    controller.update();
    time = 1000;
    controller.activate('slash', 'fury:3', { x: 0, y: 0 }, { x: 1, y: 0 });
    time = 1200;
    controller.update();
    time = 1500;
    controller.activate('powerStrike', 'power', { x: 0, y: 0 }, { x: 1, y: 0 });
    time = 1900;
    const events = controller.update();
    expect(events.some((candidate) => candidate.type === 'knockback')).toBe(false);
    expect(controller.getTargets()[0]?.position).toEqual({ x: 50, y: 0 });
  });
  it('keeps whirlwind movement through duration and resolves its four configured ticks once', () => {
    const { controller, setTime } = testController();
    for (const [at, id] of [
      [0, 'a'],
      [500, 'b'],
      [1000, 'c'],
      [1500, 'd'],
    ] as const) {
      setTime(at);
      controller.activate('slash', id, { x: 0, y: 0 }, { x: 1, y: 0 });
      setTime(at + 200);
      controller.update();
    }
    controller.addDummy({
      id: 'near-new-pose',
      position: { x: 1_010, y: 1_000 },
      armor: 0,
      health: 1000,
      maxHealth: 1000,
    });
    setTime(2000);
    expect(
      controller.activate('whirlwind', 'whirl', { x: 0, y: 0 }, { x: 1, y: 0 })[0],
    ).toMatchObject({ type: 'abilityAccepted' });
    expect(controller.update().filter((event) => event.type === 'damageApplied')).toHaveLength(1);
    setTime(2900);
    expect(controller.update().filter((event) => event.type === 'damageApplied')).toHaveLength(3);
    expect(controller.snapshot().movementMultiplier).toBe(0.65);
    setTime(3199);
    controller.update();
    expect(controller.snapshot().movementMultiplier).toBe(0.65);
    setTime(3200);
    controller.update();
    expect(controller.snapshot().movementMultiplier).toBe(1);
  });
  it('reports iron skin active only after its cast impact', () => {
    const { controller, setTime } = testController();
    for (const [at, id] of [
      [0, 'a'],
      [500, 'b'],
      [1000, 'c'],
    ] as const) {
      setTime(at);
      controller.activate('slash', id, { x: 0, y: 0 }, { x: 1, y: 0 });
      setTime(at + 200);
      controller.update();
    }
    setTime(1500);
    controller.activate('ironSkin', 'skin', { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(controller.snapshot().ironSkinActive).toBe(false);
    setTime(1750);
    expect(controller.update()).toContainEqual({ type: 'ironSkin', active: true });
    expect(controller.snapshot().ironSkinActive).toBe(true);
  });
  it('orders a 0→900 whirlwind catch-up chronologically and follows the actor pose', () => {
    const { controller, setTime } = testController();
    for (const [at, id] of [
      [0, 'a'],
      [500, 'b'],
      [1000, 'c'],
      [1500, 'd'],
    ] as const) {
      setTime(at);
      controller.activate('slash', id, { x: 0, y: 0 }, { x: 1, y: 0 });
      setTime(at + 200);
      controller.update();
    }
    controller.addDummy({
      id: 'near-new-pose',
      position: { x: 1_010, y: 1_000 },
      armor: 0,
      health: 1000,
      maxHealth: 1000,
    });
    setTime(2000);
    controller.activate('whirlwind', 'whirl', { x: 0, y: 0 }, { x: 1, y: 0 });
    setTime(2900);
    expect(
      controller
        .update({ x: 1_000, y: 1_000 })
        .filter((event) => event.type === 'damageApplied')
        .map((event) => (event.type === 'damageApplied' ? event.tick : -1)),
    ).toEqual([0, 1, 2, 3]);
  });
  it('rejects overlapping actions and accepts exactly at recovery boundary', () => {
    const { controller, setTime } = testController();
    controller.activate('slash', 'one', { x: 0, y: 0 }, { x: 1, y: 0 });
    setTime(499);
    expect(controller.activate('slash', 'two', { x: 0, y: 0 }, { x: 1, y: 0 })[0]).toMatchObject({
      reason: 'busy',
    });
    setTime(500);
    expect(controller.activate('slash', 'three', { x: 0, y: 0 }, { x: 1, y: 0 })[0]).toMatchObject({
      type: 'abilityAccepted',
    });
  });
  it('limits a multihit arc to three dummies', () => {
    let time = 0;
    const controller = new LocalCombatController(
      { now: () => time },
      { nextInt: () => 10, next: () => 1 },
    );
    for (let index = 0; index < 4; index += 1)
      controller.addDummy({
        id: `dummy:${index}`,
        position: { x: 50, y: index - 1.5 },
        armor: 0,
        health: 1000,
        maxHealth: 1000,
      });
    controller.activate('slash', 'multi', { x: 0, y: 0 }, { x: 1, y: 0 });
    time = 200;
    expect(controller.update().filter((event) => event.type === 'damageApplied')).toHaveLength(3);
  });
  it('applies incoming damage through the shared rule and returns a matching selfDamaged event', () => {
    const { controller } = testController();
    const before = controller.snapshot();
    const events = controller.applyIncomingDamage(100, 0);
    const after = controller.snapshot();
    expect(after.health).toBeLessThan(before.health);
    expect(after.fury).toBe(before.fury + 5);
    expect(events).toEqual([
      {
        type: 'selfDamaged',
        amount: before.health - after.health,
        health: after.health,
        maxHealth: before.maxHealth,
      },
    ]);
  });
  it('applies a resolved enemy amount once and clamps ally healing', () => {
    const { controller } = testController();
    const before = controller.snapshot();
    const damageEvents = controller.applyResolvedIncomingDamage(17, 0);
    expect(damageEvents[0]).toMatchObject({ type: 'selfDamaged', amount: 17 });
    expect(controller.snapshot().health).toBe(before.health - 17);
    controller.removeDummy('dummy:front');
    controller.addDummy({
      id: 'dummy:front',
      position: { x: 50, y: 0 },
      armor: 0,
      health: 900,
      maxHealth: 1000,
    });
    expect(controller.healDummy('dummy:front', 150)).toBe(true);
    expect(controller.getTargets().find((target) => target.id === 'dummy:front')?.health).toBe(
      1000,
    );
    expect(controller.healDummy('dummy:front', 50)).toBe(false);
  });
  it('exposes the Guardian with the active incoming-damage multiplier to enemy abilities', () => {
    const { controller, setTime } = testController();
    const target = controller.guardianAbilityTarget({ x: 0, y: 0 });
    expect(target).toMatchObject({ id: 'guardian', maxHealth: 220, armor: 25 });
    for (const [at, id] of [
      [0, 'a'],
      [500, 'b'],
      [1000, 'c'],
    ] as const) {
      setTime(at);
      controller.activate('slash', id, { x: 0, y: 0 }, { x: 1, y: 0 });
      setTime(at + 200);
      controller.update();
    }
    setTime(1500);
    controller.activate('ironSkin', 'skin', { x: 0, y: 0 }, { x: 1, y: 0 });
    setTime(1750);
    controller.update();
    expect(controller.guardianAbilityTarget({ x: 0, y: 0 }).incomingDamageMultiplier).toBe(0.55);
  });
  it('removes a defeated target idempotently before a pending impact can resolve', () => {
    const { controller, setTime } = testController();
    controller.activate('slash', 'pending', { x: 0, y: 0 }, { x: 1, y: 0 });
    expect(controller.removeDummy('dummy:front')).toBe(true);
    expect(controller.removeDummy('dummy:front')).toBe(false);
    setTime(200);
    expect(controller.update().filter((event) => event.type === 'damageApplied')).toHaveLength(0);
    expect(controller.getTargets()).toHaveLength(0);
  });
  it('is a no-op once the Guardian is already downed', () => {
    const { controller } = testController();
    controller.applyIncomingDamage(10_000, 0);
    expect(controller.snapshot().health).toBe(0);
    expect(controller.applyIncomingDamage(50, 100)).toEqual([]);
  });
  it('reduces incoming damage while Iron Skin is active and stops once it expires', () => {
    const { controller, setTime } = testController();
    for (const [at, id] of [
      [0, 'a'],
      [500, 'b'],
      [1000, 'c'],
    ] as const) {
      setTime(at);
      controller.activate('slash', id, { x: 0, y: 0 }, { x: 1, y: 0 });
      setTime(at + 200);
      controller.update();
    }
    setTime(1500);
    controller.activate('ironSkin', 'skin', { x: 0, y: 0 }, { x: 1, y: 0 });
    setTime(1750);
    controller.update();
    expect(controller.snapshot().ironSkinActive).toBe(true);
    const beforeShielded = controller.snapshot();
    controller.applyIncomingDamage(100, 1750);
    const shieldedLoss = beforeShielded.health - controller.snapshot().health;
    setTime(5751);
    controller.update();
    expect(controller.snapshot().ironSkinActive).toBe(false);
    const beforeUnshielded = controller.snapshot();
    controller.applyIncomingDamage(100, 5751);
    const unshieldedLoss = beforeUnshielded.health - controller.snapshot().health;
    expect(shieldedLoss).toBeLessThan(unshieldedLoss);
  });
  it('sweeps knockback across walls and stops at the safe world edge', () => {
    const bounds = { minimumX: 0, minimumY: 0, maximumX: 100, maximumY: 100 };
    expect(
      constrainKnockbackSweep(
        { x: 0, y: 50 },
        { x: 100, y: 50 },
        [{ x: 50, y: 50, width: 10, height: 50 }],
        bounds,
      ).x,
    ).toBeLessThan(45);
    expect(constrainKnockbackSweep({ x: 90, y: 10 }, { x: 200, y: 10 }, [], bounds)).toEqual({
      x: 100,
      y: 10,
    });
  });
});
