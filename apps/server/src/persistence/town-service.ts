import { GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';
import { ItemInstanceSchema } from '@brecha/shared';
import { createHash } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';

import {
  CharacterNotAvailableError,
  CharacterNotFoundError,
} from '../characters/character-service.js';
import type { DatabaseClient } from './database.js';
import {
  MerchantStockNotFoundError,
  TOWN_CATALOG_VERSION,
  merchantCatalog,
  type MerchantStockSnapshot,
} from './town-catalog.js';
import type { ChestSnapshot } from './inventory-service.js';

export const TOWN_TUTORIAL_ID = 'town-intro.v1' as const;
const TutorialActionSchema = z.enum(['start', 'complete', 'skip', 'replay']);
export const UpdateTownTutorialInputSchema = z.strictObject({
  actorUserId: z.string().trim().min(1).max(128),
  characterId: z.string().trim().min(1).max(128),
  operationId: z.string().trim().min(1).max(128),
  tutorialId: z.literal(TOWN_TUTORIAL_ID),
  action: TutorialActionSchema,
});
export type UpdateTownTutorialInput = z.infer<typeof UpdateTownTutorialInputSchema>;

const TutorialStateSchema = z.strictObject({
  id: z.literal(TOWN_TUTORIAL_ID),
  status: z.enum(['NOT_STARTED', 'ACTIVE', 'COMPLETED', 'SKIPPED']),
  runs: z.number().int().nonnegative(),
  updatedAtServerMs: z.number().int().nonnegative(),
});
type TutorialState = z.infer<typeof TutorialStateSchema>;

const StoredChestItemSchema = z.strictObject({
  item: ItemInstanceSchema,
  favorite: z.boolean(),
});

export type TownSnapshot = {
  characterId: string;
  characterName: string;
  level: number;
  availability: string;
  gold: number;
  materials: number;
  inventory: { occupied: number; capacity: number };
  portal: {
    zoneId: 'corrupted_forest';
    label: string;
    active: true;
    destination: 'expedition';
    awayAvailable: true;
  };
  merchant: {
    catalogVersion: string;
    items: readonly MerchantStockSnapshot[];
  };
  chest: Pick<ChestSnapshot, 'capacity' | 'revision' | 'schemaVersion'> & { occupied: number };
  tutorial: TutorialState;
  gameDataVersion: string;
};

export type TownTutorialReceipt = {
  operationId: string;
  requestHash: string;
  kind: 'tutorial';
  replayed: boolean;
  town: TownSnapshot;
};

export class TownOperationConflictError extends Error {
  public constructor() {
    super('operationId was already used with a different town command.');
    this.name = 'TownOperationConflictError';
  }
}

export class TownTutorialConflictError extends Error {
  public constructor() {
    super('The requested tutorial transition is not valid.');
    this.name = 'TownTutorialConflictError';
  }
}

export class TownService {
  public constructor(
    private readonly prisma: DatabaseClient,
    private readonly now: () => Date = () => new Date(),
  ) {}

  public async getOwned(userId: string, characterId: string): Promise<TownSnapshot> {
    return this.prisma.$transaction(async (transaction) => {
      const character = await this.character(transaction, userId, characterId);
      await transaction.characterChest.upsert({
        where: { characterId },
        create: {
          id: `chest:${characterId}`,
          characterId,
          capacity: 80,
          schemaVersion: 1,
          items: [],
        },
        update: {},
      });
      return this.snapshot(transaction, characterId, character);
    });
  }

  public async updateTutorial(input: UpdateTownTutorialInput): Promise<TownTutorialReceipt> {
    const value = UpdateTownTutorialInputSchema.parse(input);
    const requestHash = tutorialRequestHash(value);
    return this.prisma.$transaction(
      async (transaction) => {
        const character = await this.character(transaction, value.actorUserId, value.characterId);
        if (character.availability !== 'AVAILABLE') throw new CharacterNotAvailableError();
        const existing = await transaction.characterTownOperation.findUnique({
          where: { operationId: value.operationId },
        });
        if (existing !== null) {
          if (existing.characterId !== value.characterId || existing.requestHash !== requestHash)
            throw new TownOperationConflictError();
          return townTutorialReceiptFromStored(existing, true);
        }
        const progress = await transaction.characterProgress.findUnique({
          where: { characterId: value.characterId },
          select: { state: true },
        });
        if (progress === null) throw new CharacterNotFoundError();
        const current = tutorialStateFromProgress(progress.state);
        const next = transitionTutorial(current, value.action, this.now().getTime());
        const state = mergeTutorialState(progress.state, next);
        await transaction.characterProgress.update({
          where: { characterId: value.characterId },
          data: { state, revision: { increment: 1 } },
        });
        await transaction.character.update({
          where: { id: value.characterId },
          data: { revision: { increment: 1 }, lastSeenAt: this.now() },
        });
        const town = await this.snapshot(transaction, value.characterId, character, next);
        await transaction.characterTownOperation.create({
          data: {
            id: townOperationId(value.operationId),
            characterId: value.characterId,
            operationId: value.operationId,
            requestHash,
            kind: 'tutorial',
            result: { town },
          },
        });
        return {
          operationId: value.operationId,
          requestHash,
          kind: 'tutorial' as const,
          replayed: false,
          town,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async character(
    transaction: Prisma.TransactionClient,
    userId: string,
    characterId: string,
  ) {
    const character = await transaction.character.findFirst({
      where: { id: characterId, userId, deletedAt: null },
      include: {
        progress: { select: { level: true, state: true } },
        inventory: { select: { capacity: true, _count: { select: { items: true } } } },
        chest: { select: { capacity: true, revision: true, schemaVersion: true, items: true } },
      },
    });
    if (character === null || character.progress === null || character.inventory === null)
      throw new CharacterNotFoundError();
    return character;
  }

  private async snapshot(
    transaction: Prisma.TransactionClient,
    characterId: string,
    character: Awaited<ReturnType<TownService['character']>>,
    tutorialOverride?: TutorialState,
  ): Promise<TownSnapshot> {
    const chest =
      character.chest ??
      (await transaction.characterChest.findUnique({
        where: { characterId },
        select: { capacity: true, revision: true, schemaVersion: true, items: true },
      }));
    if (chest === null) throw new CharacterNotFoundError();
    const items = parseChestItems(chest.items);
    return {
      characterId,
      characterName: character.name,
      level: character.progress?.level ?? 1,
      availability: character.availability,
      gold: safeNumber(character.gold),
      materials: safeNumber(character.materials),
      inventory: {
        occupied: character.inventory?._count.items ?? 0,
        capacity: character.inventory?.capacity ?? 40,
      },
      portal: {
        zoneId: 'corrupted_forest',
        label: GAME_DATA.zone.displayName,
        active: true,
        destination: 'expedition',
        awayAvailable: true,
      },
      merchant: { catalogVersion: TOWN_CATALOG_VERSION, items: merchantCatalog() },
      chest: {
        capacity: chest.capacity,
        revision: chest.revision,
        schemaVersion: chest.schemaVersion,
        occupied: items.length,
      },
      tutorial: tutorialOverride ?? tutorialStateFromProgress(character.progress?.state ?? {}),
      gameDataVersion: GAME_DATA_VERSION,
    };
  }
}

function tutorialStateFromProgress(value: Prisma.JsonValue): TutorialState {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const raw = (value as Record<string, unknown>).tutorial;
    const parsed = TutorialStateSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
  }
  return {
    id: TOWN_TUTORIAL_ID,
    status: 'NOT_STARTED',
    runs: 0,
    updatedAtServerMs: 0,
  };
}

function transitionTutorial(
  current: TutorialState,
  action: z.infer<typeof TutorialActionSchema>,
  nowMs: number,
): TutorialState {
  if (action === 'start' || action === 'replay') {
    return { ...current, status: 'ACTIVE', runs: current.runs + 1, updatedAtServerMs: nowMs };
  }
  if (current.status === 'NOT_STARTED' && action === 'complete') {
    return {
      ...current,
      status: 'COMPLETED',
      runs: Math.max(1, current.runs),
      updatedAtServerMs: nowMs,
    };
  }
  if (current.status === 'NOT_STARTED' && action === 'skip') {
    return { ...current, status: 'SKIPPED', updatedAtServerMs: nowMs };
  }
  if (current.status !== 'ACTIVE') throw new TownTutorialConflictError();
  return {
    ...current,
    status: action === 'complete' ? 'COMPLETED' : 'SKIPPED',
    updatedAtServerMs: nowMs,
  };
}

function mergeTutorialState(
  value: Prisma.JsonValue,
  tutorial: TutorialState,
): Prisma.InputJsonValue {
  const base =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? { ...(value as Record<string, unknown>) }
      : {};
  return { ...base, tutorial } as Prisma.InputJsonValue;
}

function parseChestItems(value: Prisma.JsonValue) {
  const parsed = z.array(StoredChestItemSchema).safeParse(value);
  if (!parsed.success) throw new Error('Stored chest data failed schema validation.');
  return parsed.data;
}

function tutorialRequestHash(input: UpdateTownTutorialInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        characterId: input.characterId,
        tutorialId: input.tutorialId,
        action: input.action,
      }),
    )
    .digest('hex');
}

function townOperationId(operationId: string): string {
  return `town-operation:${createHash('sha256').update(operationId).digest('hex').slice(0, 48)}`;
}

function townTutorialReceiptFromStored(
  record: { operationId: string; requestHash: string; result: Prisma.JsonValue },
  replayed: boolean,
): TownTutorialReceipt {
  const result = z.object({ town: z.unknown() }).parse(record.result);
  return {
    operationId: record.operationId,
    requestHash: record.requestHash,
    kind: 'tutorial',
    replayed,
    town: result.town as TownSnapshot,
  };
}

function safeNumber(value: bigint): number {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) ? numeric : Number.MAX_SAFE_INTEGER;
}

export { MerchantStockNotFoundError };
