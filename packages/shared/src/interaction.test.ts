import { describe, expect, it } from 'vitest';

import {
  applyInteraction,
  EMPTY_INTERACTION_LEDGER,
  InteractionCommandSchema,
  InteractionLedgerSchema,
  type InteractionRequest,
  type InteractionTarget,
} from './interaction.js';

const chest: InteractionTarget = {
  interactionId: 'chest:forest:01',
  kind: 'chest',
  position: { x: 100, y: 100 },
  radiusPx: 32,
  available: true,
  oneShot: true,
};
const npc: InteractionTarget = {
  interactionId: 'npc:portal',
  kind: 'npc',
  position: { x: 100, y: 100 },
  radiusPx: 48,
  available: true,
  oneShot: false,
};
const request = (operationId: string, targetId = chest.interactionId): InteractionRequest => ({
  operationId,
  actorId: 'character:one',
  targetId,
  requestedAtMs: 1_000,
});

describe('interaction contract', () => {
  it('defines a versioned server intention without client-owned position or identity', () => {
    const command = InteractionCommandSchema.parse({
      schemaVersion: 1,
      operationId: '11111111-1111-4111-8111-111111111111',
      zoneId: 'corrupted_forest',
      targetId: chest.interactionId,
    });
    expect(command).toMatchObject({ zoneId: 'corrupted_forest', targetId: chest.interactionId });
    expect(() =>
      InteractionCommandSchema.parse({ ...command, actorPosition: { x: 100, y: 100 } }),
    ).toThrow();
  });

  it('validates a replay ledger before a server persists it', () => {
    expect(() =>
      InteractionLedgerSchema.parse({
        consumedTargetIds: [chest.interactionId],
        cooldowns: [],
        receipts: [],
      }),
    ).not.toThrow();
  });

  it('accepts a nearby target and consumes one-shot targets once', () => {
    const first = applyInteraction(EMPTY_INTERACTION_LEDGER, [chest], request('op:1'), {
      x: 120,
      y: 100,
    });
    expect(first.receipt).toMatchObject({ accepted: true, kind: 'chest' });
    expect(first.ledger.consumedTargetIds).toEqual(['chest:forest:01']);

    const second = applyInteraction(first.ledger, [chest], request('op:2'), {
      x: 120,
      y: 100,
    });
    expect(second.receipt).toMatchObject({ accepted: false, reason: 'already_consumed' });
    expect(second.ledger).toEqual(first.ledger);
  });

  it('allows reusable NPC interactions without growing consumed targets', () => {
    const first = applyInteraction(
      EMPTY_INTERACTION_LEDGER,
      [npc],
      request('op:npc', npc.interactionId),
      {
        x: 100,
        y: 100,
      },
    );
    const second = applyInteraction(first.ledger, [npc], request('op:npc:2', npc.interactionId), {
      x: 100,
      y: 100,
    });
    expect(first.receipt.accepted).toBe(true);
    expect(second.receipt.accepted).toBe(true);
    expect(second.ledger.consumedTargetIds).toEqual([]);
  });

  it('rejects unavailable and distant targets before producing a receipt', () => {
    const unavailable = applyInteraction(
      EMPTY_INTERACTION_LEDGER,
      [{ ...chest, available: false }],
      request('op:unavailable'),
      { x: 100, y: 100 },
    );
    const distant = applyInteraction(EMPTY_INTERACTION_LEDGER, [chest], request('op:distant'), {
      x: 500,
      y: 500,
    });
    expect(unavailable.receipt).toMatchObject({ accepted: false, reason: 'unavailable' });
    expect(distant.receipt).toMatchObject({ accepted: false, reason: 'out_of_range' });
    expect(unavailable.ledger).toEqual(EMPTY_INTERACTION_LEDGER);
    expect(distant.ledger).toEqual(EMPTY_INTERACTION_LEDGER);
  });

  it('replays an accepted operation without duplicating the ledger', () => {
    const first = applyInteraction(EMPTY_INTERACTION_LEDGER, [chest], request('op:replay'), {
      x: 100,
      y: 100,
    });
    const replay = applyInteraction(first.ledger, [chest], request('op:replay'), {
      x: 100,
      y: 100,
    });
    const conflict = applyInteraction(
      first.ledger,
      [npc, chest],
      request('op:replay', npc.interactionId),
      { x: 100, y: 100 },
    );
    expect(replay.replayed).toBe(true);
    expect(replay.receipt).toEqual(first.receipt);
    expect(replay.ledger).toEqual(first.ledger);
    expect(conflict.receipt).toMatchObject({ accepted: false, reason: 'operation_conflict' });
    expect(conflict.ledger).toEqual(first.ledger);
  });

  it('accepts revive targets and rejects malformed requests without mutating state', () => {
    const revive: InteractionTarget = {
      interactionId: 'revive:character:two',
      kind: 'revive',
      position: { x: 100, y: 100 },
      radiusPx: 48,
      available: true,
      oneShot: false,
    };
    const accepted = applyInteraction(
      EMPTY_INTERACTION_LEDGER,
      [revive],
      request('op:revive', revive.interactionId),
      {
        x: 100,
        y: 100,
      },
    );
    const malformed = applyInteraction(
      accepted.ledger,
      [revive],
      { operationId: 'op:bad' },
      {
        x: Number.NaN,
        y: 100,
      },
    );
    expect(accepted.receipt).toMatchObject({ accepted: true, kind: 'revive' });
    expect(malformed.receipt).toMatchObject({ accepted: false, reason: 'invalid_request' });
    expect(malformed.ledger).toEqual(accepted.ledger);
  });

  it('enforces actor state and damage interruption, then exposes duration/result metadata', () => {
    const timed: InteractionTarget = {
      ...npc,
      interactionId: 'revive:timed',
      durationMs: 100,
      allowedActorStates: ['downed'],
      interruptOnDamage: true,
      resultId: 'revive:timed:result',
      cooldownMs: 500,
    };
    const context = {
      actorPosition: { x: 100, y: 100 },
      actorState: 'downed' as const,
      nowMs: 1_000,
      interruptedByDamage: false,
    };
    const invalidState = applyInteraction(
      EMPTY_INTERACTION_LEDGER,
      [timed],
      request('op:state', timed.interactionId),
      { ...context, actorState: 'active' },
    );
    const interrupted = applyInteraction(
      EMPTY_INTERACTION_LEDGER,
      [timed],
      request('op:interrupted', timed.interactionId),
      { ...context, interruptedByDamage: true },
    );
    const accepted = applyInteraction(
      EMPTY_INTERACTION_LEDGER,
      [timed],
      request('op:timed', timed.interactionId),
      context,
    );
    const cooldown = applyInteraction(
      accepted.ledger,
      [timed],
      request('op:cooldown', timed.interactionId),
      { ...context, nowMs: 1_200 },
    );
    expect(invalidState.receipt).toMatchObject({ accepted: false, reason: 'invalid_state' });
    expect(interrupted.receipt).toMatchObject({ accepted: false, reason: 'interrupted' });
    expect(accepted.receipt).toMatchObject({
      accepted: true,
      resultId: 'revive:timed:result',
      durationMs: 100,
      startedAtMs: 1_000,
      completesAtMs: 1_100,
    });
    expect(accepted.ledger.cooldowns).toEqual([
      { targetId: timed.interactionId, availableAtMs: 1_600 },
    ]);
    expect(cooldown.receipt).toMatchObject({ accepted: false, reason: 'cooldown' });
  });
});
