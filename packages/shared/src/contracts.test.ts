import { describe, expect, it } from 'vitest';

import {
  AwayMetricsSchema,
  AwayResultSchema,
  CalibrationSnapshotSchema,
  CharacterAvailabilitySchema,
  ClientEventSchema,
  ServerEventSchema,
  SpriteAnimationSchema,
  SpriteSheetSchema,
} from './index.js';

const validMetrics = {
  validDurationSeconds: 300,
  normalEnemiesDefeated: 4,
  eliteEnemiesDefeated: 0,
  rewards: { experience: 1, gold: 2, materials: 3 },
  damageDealt: 4,
  damageTaken: 5,
  deathsOrDowns: 0,
  effectiveCombatSeconds: 200,
  droppedItemsByRarity: { common: 0, magic: 0, rare: 0, legendary: 0 },
  magicFind: 0,
};
const validBuild = {
  schemaVersion: 1,
  characterId: 'character.1',
  classId: 'guardian',
  level: 1,
  attributes: { strength: 0, dexterity: 0, intelligence: 0, vitality: 0 },
  equippedItems: [],
  equippedAbilityIds: [],
  fingerprint: 'build.1',
  gameDataVersion: 'data.1',
  balanceVersion: 'balance.1',
};
const validCalibration = {
  schemaVersion: 1,
  calibrationId: 'calibration.1',
  state: 'VALID',
  zoneId: 'corrupted_forest',
  difficulty: 'normal',
  startedAtServerMs: 1_000,
  completedAtServerMs: 2_000,
  build: validBuild,
  metrics: validMetrics,
  calculationSeed: 'seed.1',
};

describe('shared contracts', () => {
  it('uses exactly the GOAL character availability vocabulary', () => {
    for (const state of [
      'AVAILABLE',
      'IN_ACTIVE_RUN',
      'AWAY_CALIBRATING',
      'AWAY_FARMING',
      'AWAY_REWARD_PENDING',
    ])
      expect(CharacterAvailabilitySchema.safeParse(state).success).toBe(true);
    for (const alias of ['IN_MISSION', 'CALIBRATING_AWAY_MODE', 'AWAY_RESULT_PENDING'])
      expect(CharacterAvailabilitySchema.safeParse(alias).success).toBe(false);
  });

  it('accepts a versioned, discriminated network intent', () => {
    expect(
      ClientEventSchema.parse({
        protocolVersion: 1,
        requestId: 'request.move.1',
        sequence: 3,
        type: 'MOVE_INTENT',
        payload: { x: 12, y: -4 },
      }).type,
    ).toBe('MOVE_INTENT');
  });

  it('accepts server-owned endless-forest objective state in mission messages', () => {
    const event = ServerEventSchema.parse({
      protocolVersion: 1,
      requestId: 'mission.forest.1',
      type: 'MISSION_STATE',
      payload: {
        missionId: 'mission.corrupted_forest.breach',
        revision: 4,
        objectives: [
          {
            objectiveId: 'objective.forest.level',
            mode: 'endless_forest',
            status: 'active',
            progress: 1,
            target: 20,
          },
        ],
      },
    });
    if (event.type !== 'MISSION_STATE') throw new Error('Expected a mission state event.');
    expect(event.payload.objectives).toEqual([
      {
        objectiveId: 'objective.forest.level',
        mode: 'endless_forest',
        status: 'active',
        progress: 1,
        target: 20,
      },
    ]);
  });

  it('accepts a server interruption receipt for a damaged revive actor', () => {
    expect(
      ServerEventSchema.parse({
        protocolVersion: 1,
        requestId: 'revive-interrupted',
        type: 'INTERACTION_INTERRUPTED',
        payload: {
          operationId: 'revive-interrupted',
          characterId: 'character:actor',
          reason: 'damage',
          stateRevision: 8,
        },
      }),
    ).toMatchObject({ type: 'INTERACTION_INTERRUPTED', payload: { reason: 'damage' } });
  });

  it('accepts an individual authoritative enemy reward event', () => {
    expect(
      ServerEventSchema.parse({
        protocolVersion: 1,
        requestId: 'reward:instance:forest:one:enemy:1',
        type: 'REWARD_GRANTED',
        payload: {
          operationId: 'reward:character:one:enemy:1',
          characterId: 'character:one',
          source: 'enemy_defeat',
          sourceId: 'instance:forest:one:enemy:1',
          archetype: 'corrupted_minion',
          experienceDelta: '10',
          goldDelta: '5',
          materialsDelta: '1',
          forestLevel: 1,
          forestXpInLevel: 10,
          forestBestLevel: 1,
          leveledUp: false,
          replayed: false,
        },
      }),
    ).toMatchObject({ type: 'REWARD_GRANTED', payload: { source: 'enemy_defeat' } });
  });

  it('rejects invalid network versions, extra fields and event types', () => {
    expect(
      ClientEventSchema.safeParse({
        protocolVersion: 2,
        requestId: 'request.1',
        sequence: 0,
        type: 'MOVE_INTENT',
        payload: { x: 0, y: 0 },
      }).success,
    ).toBe(false);
    expect(
      ClientEventSchema.safeParse({
        protocolVersion: 1,
        requestId: 'request.1',
        sequence: 0,
        type: 'MOVE_INTENT',
        payload: { x: 0, y: 0, cheat: true },
      }).success,
    ).toBe(false);
    expect(
      ServerEventSchema.safeParse({
        protocolVersion: 1,
        requestId: 'request.1',
        type: 'UNKNOWN_EVENT',
        payload: {},
      }).success,
    ).toBe(false);
    expect(
      ServerEventSchema.safeParse({
        protocolVersion: 1,
        type: 'INSTANCE_SNAPSHOT',
        requestId: 'request.snapshot',
        payload: {
          instanceId: 'instance:forest:one',
          zoneId: 'corrupted_forest',
          difficulty: 'normal',
          serverTimeMs: 1000,
          tick: 4,
          revision: 2,
          players: [
            {
              characterId: 'character:one',
              position: { x: 160, y: 160 },
              actorState: 'active',
              health: 220,
              maxHealth: 220,
            },
          ],
        },
      }).success,
    ).toBe(true);
    expect(
      ClientEventSchema.safeParse({
        protocolVersion: 1,
        requestId: 'party.join',
        sequence: 1,
        type: 'PARTY_JOIN_INTENT',
        payload: { joinCode: 'ABC123' },
      }).success,
    ).toBe(true);
    expect(
      ServerEventSchema.safeParse({
        protocolVersion: 1,
        requestId: 'party.snapshot',
        type: 'PARTY_SNAPSHOT',
        payload: {
          schemaVersion: 1,
          partyId: 'party:test',
          joinCode: 'ABC123',
          status: 'ACTIVE',
          leaderCharacterId: 'character:one',
          zoneId: 'corrupted_forest',
          difficulty: 'normal',
          revision: 3,
          members: [
            { characterId: 'character:one', ready: true, leader: true },
            { characterId: 'character:two', ready: true, leader: false },
          ],
        },
      }).success,
    ).toBe(true);
    expect(
      ServerEventSchema.safeParse({
        protocolVersion: 1,
        requestId: 'combat.result',
        type: 'COMBAT_RESULT',
        payload: {
          operationId: 'combat.result',
          characterId: 'character:one',
          abilityId: 'ability.guardian.slash',
          executionId: 'combat.result',
          replayed: false,
          damage: 12,
          critical: false,
          targetId: 'enemy:forest:1',
          targetHealth: 28,
          defeated: false,
          cooldownEndsAt: 1_500,
          revision: 4,
        },
      }).success,
    ).toBe(true);
  });

  it('rejects metric payloads with invalid values or extra fields', () => {
    expect(AwayMetricsSchema.safeParse(validMetrics).success).toBe(true);
    expect(
      AwayMetricsSchema.safeParse({ ...validMetrics, normalEnemiesDefeated: -1 }).success,
    ).toBe(false);
    expect(
      AwayMetricsSchema.safeParse({ ...validMetrics, untrustedClientReward: 99 }).success,
    ).toBe(false);
  });

  it('enforces away calibration and result time invariants', () => {
    expect(CalibrationSnapshotSchema.safeParse(validCalibration).success).toBe(true);
    expect(
      CalibrationSnapshotSchema.safeParse({ ...validCalibration, completedAtServerMs: 999 })
        .success,
    ).toBe(false);
    expect(
      CalibrationSnapshotSchema.safeParse({
        ...validCalibration,
        metrics: { ...validMetrics, validDurationSeconds: 299 },
      }).success,
    ).toBe(false);
    expect(
      CalibrationSnapshotSchema.safeParse({ ...validCalibration, invalidReason: 'BUILD_CHANGED' })
        .success,
    ).toBe(false);
    expect(
      CalibrationSnapshotSchema.safeParse({ ...validCalibration, completedAtServerMs: undefined })
        .success,
    ).toBe(false);
    expect(
      CalibrationSnapshotSchema.safeParse({
        ...validCalibration,
        state: 'INVALID',
        invalidReason: undefined,
      }).success,
    ).toBe(false);
    const result = {
      schemaVersion: 1,
      awaySessionId: 'away.1',
      calibrationId: 'calibration.1',
      zoneId: 'corrupted_forest',
      difficulty: 'normal',
      startedAtServerMs: 1_000,
      endedAtServerMs: 2_000,
      elapsedSeconds: 1_000,
      computedSeconds: 800,
      discardedSeconds: 200,
      efficiency: 0.8,
      survivalFactor: 1,
      estimatedEnemiesDefeated: 1,
      rewards: { experience: 1, gold: 1, materials: 1 },
      generatedItemsByRarity: { common: 0, magic: 0, rare: 0, legendary: 0 },
      reductions: [],
      balanceVersion: 'balance.1',
      gameDataVersion: 'data.1',
      calculationSeed: 'seed.1',
    };
    expect(AwayResultSchema.safeParse(result).success).toBe(true);
    expect(AwayResultSchema.safeParse({ ...result, computedSeconds: 1_001 }).success).toBe(false);
    expect(AwayResultSchema.safeParse({ ...result, discardedSeconds: 201 }).success).toBe(false);
    expect(AwayResultSchema.safeParse({ ...result, endedAtServerMs: 999 }).success).toBe(false);
  });

  it('requires complete unique directions and in-range unique animation events', () => {
    const sheet = {
      id: 'sheet.1',
      frameWidth: 64,
      frameHeight: 64,
      frameCount: 4,
      origin: { x: 0, y: 1 },
      offset: { x: 0, y: 0 },
      directions: ['up', 'down', 'left', 'right'],
      mirrorLeftFromRight: true,
    };
    expect(SpriteSheetSchema.safeParse(sheet).success).toBe(true);
    expect(
      SpriteSheetSchema.safeParse({ ...sheet, directions: ['up', 'up', 'left', 'right'] }).success,
    ).toBe(false);
    const animation = {
      id: 'animation.1',
      atlasId: 'sheet.1',
      state: 'attacking',
      direction: 'down',
      startFrame: 0,
      endFrame: 3,
      frameRate: 1,
      repeat: 0,
      lockMovement: false,
      interruptible: true,
      hitFrame: 2,
      eventFrames: [{ frame: 2, event: 'combat.hit' }],
    };
    expect(SpriteAnimationSchema.safeParse(animation).success).toBe(true);
    expect(SpriteAnimationSchema.safeParse({ ...animation, hitFrame: 4 }).success).toBe(false);
    expect(
      SpriteAnimationSchema.safeParse({
        ...animation,
        eventFrames: [
          { frame: 2, event: 'combat.hit' },
          { frame: 2, event: 'combat.hit' },
        ],
      }).success,
    ).toBe(false);
  });
});
