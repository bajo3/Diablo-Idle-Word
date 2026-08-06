import { describe, expect, it } from 'vitest';

import { PartyError, PartyRegistry } from './party-registry.js';

function registry(): PartyRegistry {
  let id = 0;
  let code = 0;
  return new PartyRegistry({
    idFactory: () => `test-${++id}`,
    codeFactory: () => `ABC12${++code}`,
  });
}

describe('PartyRegistry', () => {
  it('creates a party, joins by code, synchronizes readiness and starts once', () => {
    const parties = registry();
    const created = parties.create('user:one', 'character:one');
    expect(created).toMatchObject({
      partyId: 'party:test-1',
      joinCode: 'ABC121',
      status: 'LOBBY',
      leaderCharacterId: 'character:one',
      members: [{ characterId: 'character:one', ready: true, leader: true }],
    });

    const joined = parties.join('user:two', 'character:two', created.joinCode);
    expect(joined).toMatchObject({
      status: 'LOBBY',
      revision: 2,
      members: [
        { characterId: 'character:one', ready: true, leader: true },
        { characterId: 'character:two', ready: false, leader: false },
      ],
    });
    expect(() =>
      parties.start({
        userId: 'user:one',
        characterId: 'character:one',
        zoneId: 'corrupted_forest',
        difficulty: 'normal',
      }),
    ).toThrowError(new PartyError('NOT_READY', 'Every party member must be ready.'));

    parties.setReady('user:two', 'character:two', true);
    const started = parties.start({
      userId: 'user:one',
      characterId: 'character:one',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
    });
    expect(started).toMatchObject({
      status: 'ACTIVE',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      revision: 4,
    });
    expect(parties.snapshotForCharacter('character:two')).toEqual(started);
    expect(() => parties.join('user:three', 'character:three', created.joinCode)).toThrow(
      /already started/,
    );
  });

  it('enforces one party per user, four members and leader transfer', () => {
    const parties = registry();
    const created = parties.create('user:one', 'character:one');
    parties.join('user:two', 'character:two', created.joinCode);
    parties.join('user:three', 'character:three', created.joinCode);
    parties.join('user:four', 'character:four', created.joinCode);
    expect(() => parties.join('user:five', 'character:five', created.joinCode)).toThrow(/full/);
    expect(() => parties.create('user:two', 'character:other')).toThrow(/already in a party/);

    const afterLeave = parties.leave('user:one', 'character:one');
    expect(afterLeave).toMatchObject({ leaderCharacterId: 'character:two', revision: 5 });
    expect(afterLeave?.members[0]).toMatchObject({ characterId: 'character:two', leader: true });
    expect(parties.partyIdForCharacter('character:one')).toBeUndefined();
  });

  it('keeps independent lobbies isolated for multiple test rooms', () => {
    const parties = registry();
    const first = parties.create('user:one', 'character:one');
    const second = parties.create('user:two', 'character:two');

    expect(first.partyId).not.toBe(second.partyId);
    expect(parties.snapshotForCharacter('character:one')?.partyId).toBe(first.partyId);
    expect(parties.snapshotForCharacter('character:two')?.partyId).toBe(second.partyId);
    expect(parties.members(first.partyId)).toHaveLength(1);
    expect(parties.members(second.partyId)).toHaveLength(1);
  });

  it('rejects invalid codes and unauthorized readiness changes', () => {
    const parties = registry();
    const created = parties.create('user:one', 'character:one');
    expect(() => parties.join('user:two', 'character:two', 'bad')).toThrow(PartyError);
    expect(() => parties.setReady('user:two', 'character:one', false)).toThrow(
      /not owned by this session/,
    );
    expect(parties.snapshot(created.partyId).revision).toBe(1);
  });

  it('retains a disconnected lobby for reconnect and removes it after the TTL', () => {
    let id = 0;
    const parties = new PartyRegistry({
      idFactory: () => `cleanup-${++id}`,
      codeFactory: () => 'CLEAN1',
      lobbyTtlMs: 1_000,
    });
    const created = parties.create('user:one', 'character:one', 10_000);

    expect(parties.cleanupExpired(10_999, new Set())).toEqual([]);
    expect(parties.snapshotForCharacter('character:one')).toEqual(created);

    expect(parties.cleanupExpired(11_000, new Set(['user:one']))).toEqual([]);
    expect(parties.snapshotForCharacter('character:one')).toEqual(created);

    const removed = parties.cleanupExpired(11_000, new Set());
    expect(removed).toEqual([created]);
    expect(parties.snapshotForCharacter('character:one')).toBeUndefined();
    expect(() => parties.snapshot(created.partyId)).toThrow(/does not exist/);
    expect(parties.create('user:one', 'character:one', 11_001)).toMatchObject({
      status: 'LOBBY',
    });
  });
});
