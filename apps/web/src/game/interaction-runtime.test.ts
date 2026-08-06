import { describe, expect, it } from 'vitest';

import {
  applyInteraction,
  EMPTY_INTERACTION_LEDGER,
  type InteractionRequest,
} from '@brecha/shared';

import {
  FOREST_INTERACTION_TARGETS,
  FOREST_PREVIEW_INTERACTION_TARGETS,
  interactionFeedback,
  nearestInteractionTarget,
} from './interaction-runtime';

const request = (operationId: string, targetId: string): InteractionRequest => ({
  operationId,
  actorId: 'character:local',
  targetId,
  requestedAtMs: 1,
});

describe('forest interaction adapter', () => {
  it('keeps the combat preview free of chest and altar placeholders', () => {
    expect(FOREST_PREVIEW_INTERACTION_TARGETS).toHaveLength(0);
  });

  it('offers the nearby chest before the farther targets', () => {
    expect(
      nearestInteractionTarget(
        FOREST_INTERACTION_TARGETS,
        { x: 160, y: 160 },
        EMPTY_INTERACTION_LEDGER,
      )?.interactionId,
    ).toBe('chest:forest:01');
  });

  it('removes a consumed one-shot chest from the prompt candidates', () => {
    const first = applyInteraction(
      EMPTY_INTERACTION_LEDGER,
      FOREST_INTERACTION_TARGETS,
      request('op:chest', 'chest:forest:01'),
      { x: 160, y: 160 },
    );
    expect(
      nearestInteractionTarget(FOREST_INTERACTION_TARGETS, { x: 160, y: 160 }, first.ledger)
        ?.interactionId,
    ).toBeUndefined();
  });

  it('maps accepted and rejected receipts to readable feedback', () => {
    const accepted = applyInteraction(
      EMPTY_INTERACTION_LEDGER,
      FOREST_INTERACTION_TARGETS,
      request('op:npc', 'npc:forest:scout'),
      { x: 160, y: 285 },
    );
    expect(interactionFeedback(accepted.receipt)).toBe('Exploradora lista para hablar');
    expect(
      interactionFeedback({ ...accepted.receipt, accepted: false, reason: 'out_of_range' }),
    ).toBe('Acercate para interactuar');
  });
});
