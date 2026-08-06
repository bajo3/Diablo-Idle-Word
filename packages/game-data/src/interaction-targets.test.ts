import { describe, expect, it } from 'vitest';

import { InteractionTargetSchema, resolveInteractionTarget } from '@brecha/shared';

import { CORRUPTED_FOREST_INTERACTION_TARGETS } from './interaction-targets.js';

describe('forest interaction target catalog', () => {
  it('keeps target ids unique and validates the reusable contract metadata', () => {
    const ids = CORRUPTED_FOREST_INTERACTION_TARGETS.map((target) => target.interactionId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const target of CORRUPTED_FOREST_INTERACTION_TARGETS) {
      expect(InteractionTargetSchema.parse(target)).toEqual(target);
      expect(resolveInteractionTarget(target)).toMatchObject({
        authority: 'server',
        durationMs: expect.any(Number),
        allowedActorStates: expect.any(Array),
        cooldownMs: expect.any(Number),
      });
    }
  });
});
