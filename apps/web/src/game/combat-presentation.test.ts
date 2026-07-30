import { describe, expect, it } from 'vitest';
import {
  guardianCombatPresentation,
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
});
