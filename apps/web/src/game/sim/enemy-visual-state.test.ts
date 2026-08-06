import { describe, expect, it } from 'vitest';

import {
  activeEnemyVisualState,
  enemyAbilityVisualMode,
  enemyAiVisualState,
  latchEnemyVisualState,
} from './enemy-visual-state';

describe('enemy visual state adapter', () => {
  it('maps every AI intent to the shared 11-state visual contract', () => {
    expect(enemyAiVisualState('idle')).toBe('idle');
    expect(enemyAiVisualState('patrol')).toBe('moving');
    expect(enemyAiVisualState('detect')).toBe('interacting');
    expect(enemyAiVisualState('chase')).toBe('moving');
    expect(enemyAiVisualState('attack')).toBe('attacking');
    expect(enemyAiVisualState('use_ability')).toBe('casting');
    expect(enemyAiVisualState('use_ability', 'channel')).toBe('channeling');
    expect(enemyAiVisualState('retreat')).toBe('moving');
    expect(enemyAiVisualState('stunned')).toBe('stunned');
    expect(enemyAiVisualState('dead')).toBe('dead');
  });

  it('classifies telegraphed profiles as channeling and instant acts as casting', () => {
    expect(enemyAbilityVisualMode({ kind: 'area_attack' })).toBe('channel');
    expect(enemyAbilityVisualMode({ kind: 'telegraphed_explosion' })).toBe('channel');
    expect(enemyAbilityVisualMode({ kind: 'melee_strike' })).toBe('cast');
    expect(enemyAbilityVisualMode({ kind: 'ranged_shot' })).toBe('cast');
    expect(enemyAbilityVisualMode({ kind: 'heal_allies' })).toBe('cast');
  });

  it('keeps hit reactions temporary and death terminal', () => {
    const hit = latchEnemyVisualState(undefined, { state: 'stunned', untilMs: 180 });
    expect(activeEnemyVisualState('moving', hit, 100)).toBe('stunned');
    expect(activeEnemyVisualState('moving', hit, 180)).toBe('moving');
    const knockback = latchEnemyVisualState(hit, { state: 'knocked_back', untilMs: 220 });
    expect(activeEnemyVisualState('moving', knockback, 200)).toBe('knocked_back');
    const death = latchEnemyVisualState(hit, { state: 'dead', untilMs: undefined });
    expect(activeEnemyVisualState('idle', death, 10_000)).toBe('dead');
    expect(latchEnemyVisualState(death, hit)).toEqual(death);
  });

  it('extends an active hit window instead of shortening feedback', () => {
    const first = { state: 'stunned' as const, untilMs: 180 };
    expect(latchEnemyVisualState(first, { state: 'stunned', untilMs: 220 })).toEqual({
      state: 'stunned',
      untilMs: 220,
    });
  });
});
