import type { ActiveInstanceState } from '@brecha/shared';

/** Stable interaction id used by the Forest revive point. */
export const REVIVE_INTERACTION_ID = 'revive:forest:altar';

/**
 * Selects the downed party member that an active Guardian is allowed to revive.
 *
 * Selection is server-side and deterministic: nearest downed member first, then character id as a
 * stable tie-break. A player cannot revive itself, and a dead/active member is never a target.
 */
export function selectReviveTarget(
  state: Pick<ActiveInstanceState, 'players'>,
  actorCharacterId: string,
): string | undefined {
  const actor = state.players.find((player) => player.characterId === actorCharacterId);
  if (actor === undefined || actor.actorState !== 'active' || actor.health <= 0) return undefined;
  return [...state.players]
    .filter(
      (player) =>
        player.characterId !== actorCharacterId &&
        player.actorState === 'downed' &&
        player.health === 0,
    )
    .sort(
      (left, right) =>
        squaredDistance(actor.position, left.position) -
          squaredDistance(actor.position, right.position) ||
        left.characterId.localeCompare(right.characterId),
    )[0]?.characterId;
}

function squaredDistance(
  left: Readonly<{ x: number; y: number }>,
  right: Readonly<{ x: number; y: number }>,
): number {
  return (right.x - left.x) ** 2 + (right.y - left.y) ** 2;
}
