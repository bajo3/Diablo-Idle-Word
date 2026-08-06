import { CORRUPTED_FOREST_INTERACTION_TARGETS } from '@brecha/game-data';
import {
  type InteractionLedger,
  type InteractionPoint,
  type InteractionReceipt,
  type InteractionTarget,
  resolveInteractionTarget,
} from '@brecha/shared';

/**
 * Local preview targets. The domain contract remains shared; this file only owns the
 * presentation/map placement used by the Phaser test scene.
 */
export const FOREST_INTERACTION_TARGETS = CORRUPTED_FOREST_INTERACTION_TARGETS;

/**
 * The current combat map is intentionally free of interaction placeholders. The authoritative
 * catalog remains available for the server and future authored maps, but the preview must not
 * render chests, altars or NPC markers that have no gameplay destination yet.
 */
export const FOREST_PREVIEW_INTERACTION_TARGETS: readonly InteractionTarget[] = Object.freeze([]);

/** Keep the prompt honest: it only appears when applyInteraction can accept the distance. */
export const INTERACTION_PROMPT_DISTANCE_PX = 0;

export function nearestInteractionTarget(
  targets: readonly InteractionTarget[],
  actorPosition: InteractionPoint,
  ledger: InteractionLedger,
  nowMs = 0,
  actorState: 'active' | 'downed' | 'dead' | 'disabled' = 'active',
): InteractionTarget | undefined {
  return targets
    .filter(
      (target) =>
        target.available &&
        !(target.oneShot && ledger.consumedTargetIds.includes(target.interactionId)) &&
        resolveInteractionTarget(target).allowedActorStates.includes(actorState) &&
        !ledger.cooldowns.some(
          (cooldown) =>
            cooldown.targetId === target.interactionId && cooldown.availableAtMs > nowMs,
        ),
    )
    .reduce<InteractionTarget | undefined>((nearest, target) => {
      const distance = distanceBetween(actorPosition, target.position);
      if (distance > target.radiusPx + INTERACTION_PROMPT_DISTANCE_PX) return nearest;
      if (nearest === undefined) return target;
      return distance < distanceBetween(actorPosition, nearest.position) ? target : nearest;
    }, undefined);
}

export function interactionKindLabel(target: InteractionTarget): string {
  if (target.ui?.label !== undefined) return target.ui.label;
  return {
    npc: 'exploradora',
    chest: 'cofre',
    revive: 'reanimación',
    altar: 'altar',
    portal: 'portal',
    ground_item: 'objeto',
    door: 'puerta',
    merchant: 'comerciante',
    quest: 'objetivo',
  }[target.kind];
}

export function interactionFeedback(receipt: InteractionReceipt): string {
  if (receipt.accepted) {
    if (receipt.kind === 'chest') return 'Cofre abierto · resultado autorizado';
    if (receipt.kind === 'revive') return 'Punto de reanimación activado';
    if (receipt.kind === 'npc') return 'Exploradora lista para hablar';
    return 'Interacción autorizada';
  }
  if (receipt.reason === 'already_consumed') return 'Este cofre ya fue abierto';
  if (receipt.reason === 'out_of_range') return 'Acercate para interactuar';
  if (receipt.reason === 'unavailable') return 'Esta interacción no está disponible';
  if (receipt.reason === 'invalid_state') return 'No podés interactuar en este estado';
  if (receipt.reason === 'interrupted') return 'La interacción fue interrumpida';
  if (receipt.reason === 'cooldown') return 'Todavía no está disponible';
  if (receipt.reason === 'operation_conflict') return 'Operación duplicada rechazada';
  if (receipt.reason === 'unknown_target') return 'No se encontró el objetivo';
  return 'Interacción inválida';
}

function distanceBetween(first: InteractionPoint, second: InteractionPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
