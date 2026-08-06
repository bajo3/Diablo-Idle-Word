import {
  applyExperience,
  deriveCharacterStats,
  xpIntoLevel,
  totalAttributePoints,
  type AttributeKey,
} from '@brecha/shared';
import { BALANCE_VERSION, GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';

import type { ProgressionSnapshot } from '../api';

const STORAGE_VERSION = 1 as const;
const STORAGE_PREFIX = 'lbo-local-progression-v1:';
const DEFAULT_ATTRIBUTES = Object.freeze({
  strength: 10,
  dexterity: 10,
  intelligence: 10,
  vitality: 10,
});
const LOCAL_FINGERPRINT = '0'.repeat(64);

export type LocalExperienceResult = Readonly<{
  snapshot: ProgressionSnapshot;
  levelsGained: number;
}>;

export function createLocalProgression(characterId: string): ProgressionSnapshot {
  return snapshotFromState(characterId, {
    revision: 1,
    level: GAME_DATA.progression.minimumLevel,
    experience: 0,
    attributePoints: 0,
    attributes: { ...DEFAULT_ATTRIBUTES },
  });
}

export function loadLocalProgression(characterId: string): ProgressionSnapshot {
  if (typeof localStorage === 'undefined') return createLocalProgression(characterId);
  try {
    const raw = localStorage.getItem(storageKey(characterId));
    if (raw === null) return createLocalProgression(characterId);
    const parsed: unknown = JSON.parse(raw);
    if (!isStoredProgression(parsed, characterId)) return createLocalProgression(characterId);
    const stored = parsed.snapshot;
    return snapshotFromState(characterId, {
      revision: stored.revision,
      level: stored.level,
      experience: stored.experience,
      attributePoints: stored.attributePoints,
      attributes: stored.attributes,
    });
  } catch {
    return createLocalProgression(characterId);
  }
}

export function saveLocalProgression(snapshot: ProgressionSnapshot): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      storageKey(snapshot.characterId),
      JSON.stringify({ version: STORAGE_VERSION, snapshot }),
    );
  } catch {
    // Private browsing or quota errors must not stop the playable preview.
  }
}

export function applyLocalExperience(
  current: ProgressionSnapshot,
  delta: number,
): LocalExperienceResult {
  const safeDelta = Math.max(0, Math.trunc(delta));
  if (safeDelta === 0) return { snapshot: current, levelsGained: 0 };
  const result = applyExperience(
    {
      experience: BigInt(current.experience),
      level: current.level,
      attributePoints: current.attributePoints,
    },
    BigInt(safeDelta),
    GAME_DATA.progression,
  );
  const snapshot = snapshotFromState(current.characterId, {
    revision: current.revision + 1,
    level: result.level,
    experience: Number(result.experience),
    attributePoints: result.attributePoints,
    attributes: { ...current.attributes },
  });
  return { snapshot, levelsGained: result.levelsGained };
}

export function allocateLocalAttribute(
  current: ProgressionSnapshot,
  attribute: AttributeKey,
  amount = 1,
): ProgressionSnapshot {
  const safeAmount = Math.max(0, Math.trunc(amount));
  if (safeAmount === 0 || current.attributePoints < safeAmount) return current;
  return snapshotFromState(current.characterId, {
    revision: current.revision + 1,
    level: current.level,
    experience: current.experience,
    attributePoints: current.attributePoints - safeAmount,
    attributes: {
      ...current.attributes,
      [attribute]: current.attributes[attribute] + safeAmount,
    },
  });
}

export function resetLocalAttributes(current: ProgressionSnapshot): ProgressionSnapshot {
  return snapshotFromState(current.characterId, {
    revision: current.revision + 1,
    level: current.level,
    experience: current.experience,
    attributePoints: totalAttributePoints(current.level, GAME_DATA.progression),
    attributes: { ...DEFAULT_ATTRIBUTES },
  });
}

type LocalState = Readonly<{
  revision: number;
  level: number;
  experience: number;
  attributePoints: number;
  attributes: ProgressionSnapshot['attributes'];
}>;

function snapshotFromState(characterId: string, state: LocalState): ProgressionSnapshot {
  const level = Math.max(
    GAME_DATA.progression.minimumLevel,
    Math.min(GAME_DATA.progression.maximumLevel, state.level),
  );
  const experience = Math.max(0, Math.trunc(state.experience));
  const xp = xpIntoLevel(BigInt(experience), level, GAME_DATA.progression);
  const skills = GAME_DATA.abilities.map((ability, index) => ({
    abilityId: ability.id,
    displayName: ability.displayName,
    description: ability.description,
    unlockLevel: ability.unlockLevel,
    // Preview keeps the complete Guardian kit available while still showing the real level gate.
    unlocked: true,
    equipped: index < 4,
    barSlot: index < 4 ? index : null,
    level: 1,
  }));
  return {
    schemaVersion: 1,
    characterId,
    class: 'GUARDIAN',
    revision: Math.max(1, Math.trunc(state.revision)),
    level,
    experience,
    xpInLevel: Number(xp.current),
    xpToNextLevel: Number(xp.toNext),
    attributePoints: Math.max(0, Math.trunc(state.attributePoints)),
    totalAttributePoints: totalAttributePoints(level, GAME_DATA.progression),
    attributes: {
      strength: Math.max(0, Math.trunc(state.attributes.strength)),
      dexterity: Math.max(0, Math.trunc(state.attributes.dexterity)),
      intelligence: Math.max(0, Math.trunc(state.attributes.intelligence)),
      vitality: Math.max(0, Math.trunc(state.attributes.vitality)),
    },
    derivedStats: deriveCharacterStats({
      strength: Math.max(0, Math.trunc(state.attributes.strength)),
      dexterity: Math.max(0, Math.trunc(state.attributes.dexterity)),
      intelligence: Math.max(0, Math.trunc(state.attributes.intelligence)),
      vitality: Math.max(0, Math.trunc(state.attributes.vitality)),
    }),
    skills,
    equippedAbilityIds: skills.slice(0, 4).map((skill) => skill.abilityId),
    buildFingerprint: LOCAL_FINGERPRINT,
    gameDataVersion: GAME_DATA_VERSION,
    balanceVersion: BALANCE_VERSION,
    formulaVersion: GAME_DATA.progression.formulaVersion,
  };
}

function storageKey(characterId: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(characterId)}`;
}

function isStoredProgression(
  value: unknown,
  characterId: string,
): value is { version: 1; snapshot: ProgressionSnapshot } {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as { version?: unknown; snapshot?: unknown };
  if (record.version !== STORAGE_VERSION || typeof record.snapshot !== 'object') return false;
  const snapshot = record.snapshot as Partial<ProgressionSnapshot>;
  return (
    snapshot.characterId === characterId &&
    snapshot.schemaVersion === 1 &&
    isFiniteNumber(snapshot.revision) &&
    isFiniteNumber(snapshot.level) &&
    isFiniteNumber(snapshot.experience) &&
    isFiniteNumber(snapshot.attributePoints) &&
    typeof snapshot.attributes === 'object' &&
    snapshot.attributes !== null &&
    isFiniteNumber(snapshot.attributes.strength) &&
    isFiniteNumber(snapshot.attributes.dexterity) &&
    isFiniteNumber(snapshot.attributes.intelligence) &&
    isFiniteNumber(snapshot.attributes.vitality)
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
