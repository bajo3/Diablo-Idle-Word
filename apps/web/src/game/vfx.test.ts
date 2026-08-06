import { describe, expect, it } from 'vitest';

import { abilityVfxKind, combatVfx, durationForMotion, VFX_POOL_CAPACITY } from './vfx';

describe('combat VFX contract', () => {
  it('maps every ability to a readable descriptor and bounded pool', () => {
    expect(abilityVfxKind('slash')).toBe('slash');
    expect(abilityVfxKind('powerStrike')).toBe('power_strike');
    expect(abilityVfxKind('whirlwind')).toBe('whirlwind');
    expect(VFX_POOL_CAPACITY.ability).toBeGreaterThan(0);
    expect(combatVfx('critical').color).not.toBe(combatVfx('impact').color);
  });

  it('honours reduced motion without removing the event', () => {
    expect(durationForMotion('explosion', true)).toBeLessThan(
      durationForMotion('explosion', false),
    );
    expect(durationForMotion('impact', true)).toBeGreaterThan(0);
  });
});
