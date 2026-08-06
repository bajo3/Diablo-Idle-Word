import { describe, expect, it } from 'vitest';

import {
  appendPresentation,
  EMPTY_GAME_PRESENTATION,
  localDefeatPresentation,
  parseServerEvent,
  serverEventToPresentation,
} from './game-events';

const rewardEvent = {
  protocolVersion: 1,
  type: 'REWARD_GRANTED' as const,
  requestId: 'req-reward-1',
  payload: {
    operationId: 'reward-op-1',
    characterId: 'character-1',
    source: 'enemy_defeat' as const,
    sourceId: 'enemy:hash-1',
    archetype: 'root_brute',
    experienceDelta: '24',
    goldDelta: '1200',
    materialsDelta: '3',
    forestLevel: 4,
    forestXpInLevel: 12,
    forestBestLevel: 4,
    leveledUp: true,
    replayed: false,
  },
};

describe('game event presentation adapter', () => {
  it('validates a reward event and maps authoritative deltas to loot and notification entries', () => {
    const event = parseServerEvent(rewardEvent);
    expect(event?.type).toBe('REWARD_GRANTED');
    const delta = serverEventToPresentation(event!);

    expect(delta.loot.map((entry) => entry.label)).toEqual([
      '+ 24 EXP',
      '+ 1.200 Oro',
      '+ 3 Materiales',
    ]);
    expect(delta.notifications[0]).toMatchObject({
      title: 'Nivel del bosque aumentado',
      detail: 'Root Brute · Nivel del bosque 4 · ¡oleada nueva!',
      icon: 'experience',
    });
  });

  it('rejects malformed or over-specified transport data before rendering it', () => {
    expect(parseServerEvent({ ...rewardEvent, unexpected: true })).toBeUndefined();
    expect(
      parseServerEvent({
        ...rewardEvent,
        payload: { ...rewardEvent.payload, goldDelta: '-1' },
      }),
    ).toBeUndefined();
  });

  it('deduplicates replayed operation IDs and bounds the HUD feed', () => {
    const first = localDefeatPresentation({
      eventId: 'local:enemy-1',
      archetype: 'corrupted_minion',
      experience: 10,
      gold: 5,
      materials: 1,
      forestLevel: 1,
      leveledUp: false,
    });
    const replay = localDefeatPresentation({
      eventId: 'local:enemy-1',
      archetype: 'corrupted_minion',
      experience: 10,
      gold: 5,
      materials: 1,
      forestLevel: 1,
      leveledUp: false,
    });
    const merged = appendPresentation(appendPresentation(EMPTY_GAME_PRESENTATION, first), replay);
    expect(merged.lootLog).toHaveLength(3);
    expect(merged.notifications).toHaveLength(1);
  });
});
