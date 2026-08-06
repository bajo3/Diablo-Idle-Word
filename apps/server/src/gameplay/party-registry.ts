import { randomBytes, randomUUID } from 'node:crypto';

import {
  DifficultySchema,
  PARTY_MAX_MEMBERS,
  PartyJoinCodeSchema,
  PartySnapshotSchema,
  PartyStatusSchema,
  ZoneIdSchema,
  type PartySnapshot,
} from '@brecha/shared';
import { z } from 'zod';

type Difficulty = z.infer<typeof DifficultySchema>;
type PartyMember = Readonly<{
  userId: string;
  characterId: string;
  ready: boolean;
}>;
type PartyEntry = {
  partyId: string;
  joinCode: string;
  status: z.infer<typeof PartyStatusSchema>;
  leaderCharacterId: string;
  zoneId: string | undefined;
  difficulty: Difficulty | undefined;
  revision: number;
  lastActivityMs: number;
  members: Map<string, PartyMember>;
};

export type PartyMemberRecord = PartyMember;
export type PartyRegistryOptions = Readonly<{
  idFactory?: () => string;
  codeFactory?: () => string;
  lobbyTtlMs?: number;
}>;

export const DEFAULT_PARTY_LOBBY_TTL_MS = 15 * 60 * 1000;

export type PartyStartInput = Readonly<{
  userId: string;
  characterId: string;
  zoneId: string;
  difficulty: Difficulty;
  nowMs?: number;
}>;

export class PartyError extends Error {
  public constructor(
    public readonly code:
      'NOT_FOUND' | 'NOT_MEMBER' | 'CONFLICT' | 'CAPACITY' | 'NOT_READY' | 'INVALID_STATE',
    message: string,
  ) {
    super(message);
    this.name = 'PartyError';
  }
}

/** Process-local party authority. Character ownership is supplied by the authenticated caller. */
export class PartyRegistry {
  private readonly parties = new Map<string, PartyEntry>();
  private readonly codeIndex = new Map<string, string>();
  private readonly characterIndex = new Map<string, string>();
  private readonly userIndex = new Map<string, string>();
  private readonly idFactory: () => string;
  private readonly codeFactory: () => string;
  private readonly lobbyTtlMs: number;

  public constructor(options: PartyRegistryOptions = {}) {
    this.idFactory = options.idFactory ?? (() => randomUUID());
    this.codeFactory = options.codeFactory ?? (() => randomBytes(3).toString('hex').toUpperCase());
    this.lobbyTtlMs = positiveDuration(options.lobbyTtlMs ?? DEFAULT_PARTY_LOBBY_TTL_MS);
  }

  public create(userId: string, characterId: string, nowMs = 0): PartySnapshot {
    this.assertNotMember(userId, characterId);
    const partyId = this.uniquePartyId();
    const joinCode = this.uniqueJoinCode();
    const party: PartyEntry = {
      partyId,
      joinCode,
      status: 'LOBBY',
      leaderCharacterId: characterId,
      zoneId: undefined,
      difficulty: undefined,
      revision: 1,
      lastActivityMs: nonNegativeTime(nowMs),
      members: new Map([[characterId, { userId, characterId, ready: true }]]),
    };
    this.parties.set(partyId, party);
    this.codeIndex.set(joinCode, partyId);
    this.indexMember(partyId, { userId, characterId, ready: true });
    return this.snapshot(partyId);
  }

  public join(userId: string, characterId: string, rawJoinCode: string, nowMs = 0): PartySnapshot {
    this.assertNotMember(userId, characterId);
    const parsedJoinCode = PartyJoinCodeSchema.safeParse(rawJoinCode);
    if (!parsedJoinCode.success) throw new PartyError('NOT_FOUND', 'The party code is invalid.');
    const joinCode = parsedJoinCode.data;
    const partyId = this.codeIndex.get(joinCode);
    if (partyId === undefined) throw new PartyError('NOT_FOUND', 'The party code is invalid.');
    const party = this.requireParty(partyId);
    if (party.status !== 'LOBBY')
      throw new PartyError('INVALID_STATE', 'The party has already started.');
    if (party.members.size >= PARTY_MAX_MEMBERS)
      throw new PartyError('CAPACITY', 'The party is full.');
    const member = { userId, characterId, ready: false } as const;
    party.members.set(characterId, member);
    party.revision += 1;
    party.lastActivityMs = nonNegativeTime(nowMs);
    this.indexMember(partyId, member);
    return this.snapshot(partyId);
  }

  public setReady(userId: string, characterId: string, ready: boolean, nowMs = 0): PartySnapshot {
    const party = this.requireMember(userId, characterId);
    if (party.status !== 'LOBBY')
      throw new PartyError('INVALID_STATE', 'Party readiness cannot change after start.');
    const current = party.members.get(characterId);
    if (current === undefined) throw new PartyError('NOT_MEMBER', 'The character is not in party.');
    party.members.set(characterId, { ...current, ready });
    party.revision += 1;
    party.lastActivityMs = nonNegativeTime(nowMs);
    return this.snapshot(party.partyId);
  }

  public start(input: PartyStartInput): PartySnapshot {
    const party = this.requireMember(input.userId, input.characterId);
    if (party.leaderCharacterId !== input.characterId)
      throw new PartyError('CONFLICT', 'Only the party leader can start the party.');
    if (party.status !== 'LOBBY')
      throw new PartyError('INVALID_STATE', 'The party has already started.');
    if ([...party.members.values()].some((member) => !member.ready))
      throw new PartyError('NOT_READY', 'Every party member must be ready.');
    party.zoneId = ZoneIdSchema.parse(input.zoneId);
    party.difficulty = DifficultySchema.parse(input.difficulty);
    party.status = 'ACTIVE';
    party.revision += 1;
    party.lastActivityMs = nonNegativeTime(input.nowMs ?? 0);
    return this.snapshot(party.partyId);
  }

  /** Reopens a start that failed before instance creation completed. */
  public abortStart(partyId: string, nowMs = 0): PartySnapshot {
    const party = this.requireParty(partyId);
    if (party.status !== 'ACTIVE') return this.snapshot(partyId);
    party.status = 'LOBBY';
    party.zoneId = undefined;
    party.difficulty = undefined;
    party.revision += 1;
    party.lastActivityMs = nonNegativeTime(nowMs);
    return this.snapshot(partyId);
  }

  public leave(userId: string, characterId: string): PartySnapshot | undefined {
    const party = this.requireMember(userId, characterId);
    party.members.delete(characterId);
    this.characterIndex.delete(characterId);
    this.userIndex.delete(userId);
    if (party.members.size === 0) {
      this.parties.delete(party.partyId);
      this.codeIndex.delete(party.joinCode);
      return undefined;
    }
    if (party.leaderCharacterId === characterId) {
      const nextLeader = party.members.keys().next().value;
      if (typeof nextLeader !== 'string') throw new Error('A non-empty party has no next leader.');
      party.leaderCharacterId = nextLeader;
      const next = party.members.get(nextLeader)!;
      party.members.set(nextLeader, { ...next, ready: true });
    }
    party.revision += 1;
    return this.snapshot(party.partyId);
  }

  public snapshotForCharacter(characterId: string): PartySnapshot | undefined {
    const partyId = this.characterIndex.get(characterId);
    return partyId === undefined ? undefined : this.snapshot(partyId);
  }

  public partyIdForCharacter(characterId: string): string | undefined {
    return this.characterIndex.get(characterId);
  }

  /**
   * Removes abandoned lobbies without touching active parties. A disconnected member still keeps
   * the lobby alive while its session may reconnect; cleanup only removes a lobby when every member
   * is disconnected and the server-authoritative activity timestamp exceeded the TTL.
   */
  public cleanupExpired(
    nowMs: number,
    connectedUserIds: ReadonlySet<string>,
  ): readonly PartySnapshot[] {
    const now = nonNegativeTime(nowMs);
    const removed: PartySnapshot[] = [];
    for (const party of this.parties.values()) {
      if (party.status !== 'LOBBY' || now - party.lastActivityMs < this.lobbyTtlMs) continue;
      if ([...party.members.values()].some((member) => connectedUserIds.has(member.userId)))
        continue;
      removed.push(this.snapshot(party.partyId));
      this.removeParty(party);
    }
    return removed;
  }

  public members(partyId: string): readonly PartyMemberRecord[] {
    return [...this.requireParty(partyId).members.values()];
  }

  public snapshot(partyId: string): PartySnapshot {
    const party = this.requireParty(partyId);
    return PartySnapshotSchema.parse({
      schemaVersion: 1,
      partyId: party.partyId,
      joinCode: party.joinCode,
      status: party.status,
      leaderCharacterId: party.leaderCharacterId,
      ...(party.zoneId === undefined ? {} : { zoneId: party.zoneId }),
      ...(party.difficulty === undefined ? {} : { difficulty: party.difficulty }),
      revision: party.revision,
      members: [...party.members.values()].map((member) => ({
        characterId: member.characterId,
        ready: member.ready,
        leader: member.characterId === party.leaderCharacterId,
      })),
    });
  }

  private requireParty(partyId: string): PartyEntry {
    const party = this.parties.get(partyId);
    if (party === undefined) throw new PartyError('NOT_FOUND', 'The party does not exist.');
    return party;
  }

  private requireMember(userId: string, characterId: string): PartyEntry {
    const partyId = this.characterIndex.get(characterId);
    if (partyId === undefined)
      throw new PartyError('NOT_MEMBER', 'The character is not in a party.');
    const party = this.requireParty(partyId);
    if (party.members.get(characterId)?.userId !== userId)
      throw new PartyError('NOT_MEMBER', 'The character is not owned by this session.');
    return party;
  }

  private assertNotMember(userId: string, characterId: string): void {
    if (this.characterIndex.has(characterId) || this.userIndex.has(userId))
      throw new PartyError('CONFLICT', 'The user or character is already in a party.');
  }

  private indexMember(partyId: string, member: PartyMember): void {
    this.characterIndex.set(member.characterId, partyId);
    this.userIndex.set(member.userId, partyId);
  }

  private removeParty(party: PartyEntry): void {
    this.parties.delete(party.partyId);
    this.codeIndex.delete(party.joinCode);
    for (const member of party.members.values()) {
      this.characterIndex.delete(member.characterId);
      this.userIndex.delete(member.userId);
    }
  }

  private uniquePartyId(): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = `party:${this.idFactory()}`;
      if (!this.parties.has(candidate)) return candidate;
    }
    throw new PartyError('CONFLICT', 'Could not allocate a unique party id.');
  }

  private uniqueJoinCode(): string {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = PartyJoinCodeSchema.parse(this.codeFactory());
      if (!this.codeIndex.has(candidate)) return candidate;
    }
    throw new PartyError('CONFLICT', 'Could not allocate a unique party code.');
  }
}

function nonNegativeTime(value: number): number {
  if (!Number.isInteger(value) || value < 0)
    throw new Error('Party time must be a non-negative integer.');
  return value;
}

function positiveDuration(value: number): number {
  if (!Number.isInteger(value) || value <= 0)
    throw new Error('Party lobby TTL must be a positive integer.');
  return value;
}
