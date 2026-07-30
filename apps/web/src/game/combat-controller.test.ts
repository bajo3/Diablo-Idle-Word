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
  it('moves a power-strike target through an injected collision constraint', () => {
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
    const event = controller.update().find((candidate) => candidate.type === 'knockback');
    expect(event).toMatchObject({ type: 'knockback', position: { x: 100, y: 0 } });
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
