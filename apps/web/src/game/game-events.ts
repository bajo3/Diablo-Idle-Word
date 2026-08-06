import { ServerEventSchema, type ServerEvent } from '@brecha/shared';

import type { IconName } from '../components/Icon';
import type { UiLootEntry, UiNotification, UiTone } from '../data/uiPresentation';

/**
 * Presentation-only output of a server event. The server remains the authority for every value;
 * this module only turns validated events into bounded, deduplicated HUD messages.
 */
export type GamePresentationDelta = Readonly<{
  loot: readonly UiLootEntry[];
  notifications: readonly UiNotification[];
}>;

export type GamePresentationState = Readonly<{
  lootLog: readonly UiLootEntry[];
  notifications: readonly UiNotification[];
}>;

export const EMPTY_GAME_PRESENTATION: GamePresentationState = Object.freeze({
  lootLog: Object.freeze([]),
  notifications: Object.freeze([]),
});

const MAX_PRESENTATION_ENTRIES = 8;

/** Parse untrusted transport data without allowing malformed events into the render layer. */
export function parseServerEvent(raw: unknown): ServerEvent | undefined {
  const result = ServerEventSchema.safeParse(raw);
  return result.success ? result.data : undefined;
}

/**
 * Converts a validated authoritative event into display data. Empty output is intentional for
 * snapshots and acknowledgements that do not represent a player-facing moment.
 */
export function serverEventToPresentation(event: ServerEvent): GamePresentationDelta {
  switch (event.type) {
    case 'REWARD_GRANTED':
      return rewardPresentation({
        id: event.payload.operationId,
        archetype: event.payload.archetype,
        experience: event.payload.experienceDelta,
        gold: event.payload.goldDelta,
        materials: event.payload.materialsDelta,
        forestLevel: event.payload.forestLevel,
        leveledUp: event.payload.leveledUp,
        items: event.payload.items,
      });
    case 'COMBAT_RESULT':
      return event.payload.defeated
        ? {
            loot: [],
            notifications: [
              notification(
                `combat:${event.payload.operationId}`,
                'Enemigo derrotado',
                `${event.payload.abilityId} · objetivo eliminado`,
                'skull',
                'corruption',
              ),
            ],
          }
        : emptyDelta();
    case 'INTERACTION_EFFECT':
      return {
        loot: [],
        notifications: [
          notification(
            `interaction:${event.payload.operationId}`,
            interactionTitle(event.payload.effectType),
            event.payload.replayed ? 'Resultado recuperado' : 'Efecto aplicado',
            event.payload.effectType === 'revive'
              ? 'heart'
              : event.payload.effectType === 'loot_authorization'
                ? 'chest'
                : 'check',
            'accent',
          ),
        ],
      };
    case 'INTERACTION_INTERRUPTED':
      return {
        loot: [],
        notifications: [
          notification(
            `interaction-interrupted:${event.payload.operationId}`,
            'Interacción interrumpida',
            'El daño recibió prioridad',
            'notification',
            'danger',
          ),
        ],
      };
    case 'COMMAND_REJECTED':
      return {
        loot: [],
        notifications: [
          notification(
            `command-rejected:${event.requestId}`,
            'Acción rechazada',
            event.payload.message,
            'notification',
            'danger',
          ),
        ],
      };
    default:
      return emptyDelta();
  }
}

/** Local preview adapter: uses the same presentation contract before the WebSocket exists. */
export function localDefeatPresentation(
  input: Readonly<{
    eventId: string;
    archetype: string;
    experience: number;
    gold: number;
    materials: number;
    forestLevel: number;
    leveledUp: boolean;
  }>,
): GamePresentationDelta {
  return rewardPresentation({
    id: input.eventId,
    archetype: input.archetype,
    experience: String(Math.max(0, Math.trunc(input.experience))),
    gold: String(Math.max(0, Math.trunc(input.gold))),
    materials: String(Math.max(0, Math.trunc(input.materials))),
    forestLevel: input.forestLevel,
    leveledUp: input.leveledUp,
    items: [],
  });
}

/** Merge newest feedback first, deduplicating operation IDs and bounding DOM growth. */
export function appendPresentation(
  state: GamePresentationState,
  delta: GamePresentationDelta,
): GamePresentationState {
  return {
    lootLog: boundedUnique(delta.loot, state.lootLog),
    notifications: boundedUnique(delta.notifications, state.notifications),
  };
}

function rewardPresentation(
  input: Readonly<{
    id: string;
    archetype: string;
    experience: string;
    gold: string;
    materials: string;
    forestLevel: number;
    leveledUp: boolean;
    items: readonly {
      instanceId: string;
      definitionId: string;
      rarity: string;
      itemPower: number;
    }[];
  }>,
): GamePresentationDelta {
  const loot: UiLootEntry[] = [];
  addLoot(loot, input.id, 'xp', input.experience, 'EXP', 'blue');
  addLoot(loot, input.id, 'gold', input.gold, 'Oro', 'gold');
  addLoot(loot, input.id, 'materials', input.materials, 'Materiales', 'corruption');
  for (const item of input.items)
    loot.push({
      id: `${input.id}:loot:item:${item.instanceId}`,
      label: `Objeto · ${labelForArchetype(item.definitionId)} · ${item.rarity} · POD ${item.itemPower}`,
      tone: item.rarity === 'legendary' ? 'gold' : item.rarity === 'rare' ? 'accent' : 'blue',
    });
  const levelDetail = input.leveledUp
    ? `Nivel del bosque ${input.forestLevel} · ¡oleada nueva!`
    : `Nivel del bosque ${input.forestLevel}`;
  return {
    loot,
    notifications: [
      notification(
        `reward:${input.id}`,
        input.leveledUp ? 'Nivel del bosque aumentado' : 'Recompensa obtenida',
        `${labelForArchetype(input.archetype)} · ${levelDetail}`,
        input.leveledUp ? 'experience' : 'gold',
        input.leveledUp ? 'accent' : 'gold',
      ),
    ],
  };
}

function addLoot(
  output: UiLootEntry[],
  eventId: string,
  id: string,
  rawAmount: string,
  label: string,
  tone: UiTone,
): void {
  const amount = rawAmount.replace(/^0+(?=\d)/, '');
  if (amount === '0' || amount === '') return;
  output.push({ id: `${eventId}:loot:${id}`, label: `+ ${formatAmount(amount)} ${label}`, tone });
}

function notification(
  id: string,
  title: string,
  detail: string,
  icon: IconName,
  tone: UiTone,
): UiNotification {
  return { id, title, detail, icon, tone };
}

function boundedUnique<T extends Readonly<{ id: string }>>(
  incoming: readonly T[],
  existing: readonly T[],
): readonly T[] {
  const result: T[] = [];
  const seen = new Set<string>();
  for (const entry of [...incoming, ...existing]) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
    if (result.length >= MAX_PRESENTATION_ENTRIES) break;
  }
  return Object.freeze(result);
}

function emptyDelta(): GamePresentationDelta {
  return { loot: [], notifications: [] };
}

function formatAmount(amount: string): string {
  return amount.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function labelForArchetype(archetype: string): string {
  return archetype.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function interactionTitle(effectType: 'revive' | 'dialogue' | 'loot_authorization'): string {
  return effectType === 'revive'
    ? 'Reanimación completada'
    : effectType === 'loot_authorization'
      ? 'Cofre autorizado'
      : 'Interacción completada';
}
