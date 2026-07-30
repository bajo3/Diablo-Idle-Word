import { describe, expect, it } from 'vitest';
import {
  guardianCombatPresentation,
  hitFrameImpactDivergenceMs,
  validateGuardianCombatPresentation,
} from './combat-presentation';
describe('Guardian combat presentation metadata', () => {
  it('derives timing from versioned combat tuning', () =>
    expect(() => validateGuardianCombatPresentation()).not.toThrow());
  it('rejects a presentation timing divergence', () =>
    expect(() =>
      validateGuardianCombatPresentation([
        { ...guardianCombatPresentation[0]!, impactMs: 201 },
        ...guardianCombatPresentation.slice(1),
      ]),
    ).toThrow('Presentation diverges'));
  it('every presentation frame rate and frame set traces back to the animation catalog', () => {
    for (const entry of guardianCombatPresentation) {
      expect(entry.frames).toHaveLength(4);
      expect(entry.frameRate).toBeGreaterThan(0);
    }
  });
  it('flags a hit frame that no longer lines up with impactMs, ignoring rounding', () => {
    expect(
      hitFrameImpactDivergenceMs({ hitFrame: 2, startFrame: 0, frameRate: 10 }, 200),
    ).toBeUndefined();
    expect(hitFrameImpactDivergenceMs({ hitFrame: 2, startFrame: 0, frameRate: 10 }, 350)).toBe(
      200 - 350,
    );
    expect(hitFrameImpactDivergenceMs({ startFrame: 0, frameRate: 10 }, 999)).toBeUndefined();
  });
});
