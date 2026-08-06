import { useEffect, useRef, useState } from 'react';

import {
  createGuardianCombatState,
  type CharacterClassId,
  type ItemStatKey,
} from '@brecha/shared';
import { GAME_DATA } from '@brecha/game-data';

import { guardianCombatTuning } from './combat-controller';
import { gameApi, type ProgressionSnapshot } from '../api';
import { equipmentVisualFromSnapshot, type EquipmentVisualLoadout } from './equipment-visual';
import { GameHudOverlay } from './GameHudOverlay';
import { connectGameServer } from './game-session';
import {
  applyLocalExperience,
  loadLocalProgression,
  saveLocalProgression,
} from './local-progression';
import { CAMERA_ZOOM, POTION } from './presentation';
import type { UiResource } from '../data/uiPresentation';
import type { GameHudSnapshot, GameRuntime, RuntimeConnection } from './runtime';
import {
  GAME_SETTINGS_EVENT,
  readGameSettings,
  sanitizeGameSettings,
  type GameSettings,
} from '../settings';

/** Mirrors LocalCombatController.snapshot() before the runtime mounts and publishes a real one. */
function initialHud(connection: RuntimeConnection): GameHudSnapshot {
  const state = createGuardianCombatState(guardianCombatTuning);
  return {
    facing: 'down',
    cameraZoom: CAMERA_ZOOM,
    paused: false,
    connection,
    health: state.health,
    maxHealth: state.maxHealth,
    downed: false,
    fury: state.fury,
    maxFury: guardianCombatTuning.maxFury,
    cooldownRemainingMs: { slash: 0, powerStrike: 0, whirlwind: 0, ironSkin: 0 },
    ironSkinActive: false,
    enemiesAlive: 0,
    forestLevel: GAME_DATA.endlessForest.minimumLevel,
    forestBestLevel: GAME_DATA.endlessForest.minimumLevel,
    forestXpInLevel: 0,
    forestXpToAdvance: GAME_DATA.endlessForest.levels[0]!.xpToAdvance,
    forestWaveIndex: 0,
    forestWaveSize: GAME_DATA.endlessForest.levels[0]!.waveSize,
    experienceEarned: 0,
    potionCharges: POTION.charges,
    potionCooldownRemainingMs: 0,
    lootLog: [],
    notifications: [],
  };
}

export type RuntimeLoader = () => Promise<{
  mountGameRuntime(
    host: HTMLElement,
    onHud: (snapshot: GameHudSnapshot) => void,
    characterClass?: CharacterClassId,
  ): GameRuntime;
}>;

function isRewardGrantedEvent(event: unknown): boolean {
  return (
    typeof event === 'object' &&
    event !== null &&
    'type' in event &&
    event.type === 'REWARD_GRANTED'
  );
}

const defaultRuntimeLoader: RuntimeLoader = () => import('./runtime');

export function GameIsland({
  characterId,
  characterClass,
  connection,
  onCheckpoint,
  loadRuntime = defaultRuntimeLoader,
  onOpenInventory,
  onOpenResults,
  onOpenCharacter,
  onOpenTown,
  onExit,
  localProgression = false,
}: {
  characterId: string;
  /** Picks the rig art (Amazona -> hunter, everything else the shipped Guardian). Undefined for
   * previews that have no persisted character, which keeps the Guardian. */
  characterClass?: CharacterClassId;
  connection: RuntimeConnection;
  onCheckpoint: (intent: {
    operationId: string;
    schemaVersion: 1;
    characterId: string;
    sceneId: 'local:test';
    checkpointId: string;
    experienceGained?: string;
  }) => Promise<void>;
  loadRuntime?: RuntimeLoader;
  onOpenInventory?: () => void;
  onOpenResults?: () => void;
  onOpenCharacter?: () => void;
  onOpenTown?: () => void;
  onExit?: () => void;
  localProgression?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<GameRuntime | undefined>(undefined);
  const pendingServerEvents = useRef<unknown[]>([]);
  const connectionRef = useRef(connection);
  const damageNumbersRef = useRef(true);
  const autoBattleRef = useRef(false);
  const manuallyPaused = useRef(false);
  const pausedByVisibility = useRef(false);
  const checkpointIntent = useRef<
    | {
        operationId: string;
        schemaVersion: 1;
        characterId: string;
        sceneId: 'local:test';
        checkpointId: string;
        experienceGained?: string;
      }
    | undefined
  >(undefined);
  const checkpointInFlight = useRef(false);
  /** Session XP already persisted by a successful checkpoint; only the remainder is sent next. */
  const syncedExperienceRef = useRef(0);
  /** The amount a pending checkpoint intent is carrying, applied to the baseline once it lands. */
  const pendingExperienceRef = useRef(0);
  const [checkpointPending, setCheckpointPending] = useState(false);
  const [checkpointError, setCheckpointError] = useState<string>();
  const [showDamageNumbers, setShowDamageNumbers] = useState(true);
  const [autoBattle, setAutoBattle] = useState(false);
  const [runtimeReady, setRuntimeReady] = useState(false);
  const [gameSettings, setGameSettings] = useState<GameSettings>(() => readGameSettings());
  const gameSettingsRef = useRef(gameSettings);
  const equipmentVisualRef = useRef<EquipmentVisualLoadout | undefined>(undefined);
  // Equipment's combat contribution (armor/physical_damage/max_health/critical_chance summed from
  // gear, already computed server-side by the same InventoryService the Inventory screen reads).
  const [equipmentStats, setEquipmentStats] = useState<Record<ItemStatKey, number> | undefined>(
    undefined,
  );
  // Only the two currencies the server actually tracks. The reference fixtures also showed
  // crystals/shards/leaves, which do not exist in any server contract — displaying them as if a
  // balance were real would be a mock dressed as a feature, so they are dropped once real data
  // arrives rather than being filled with zeros.
  const [resources, setResources] = useState<readonly UiResource[] | undefined>(undefined);
  const [hud, setHud] = useState<GameHudSnapshot>(() => initialHud(connection));
  const localExperienceRef = useRef(0);
  const [progression, setProgression] = useState<ProgressionSnapshot | undefined>(() =>
    localProgression ? loadLocalProgression(characterId) : undefined,
  );

  connectionRef.current = connection;
  damageNumbersRef.current = showDamageNumbers;
  autoBattleRef.current = autoBattle;
  gameSettingsRef.current = gameSettings;

  useEffect(() => {
    if (!localProgression) return;
    if (hud.experienceEarned < localExperienceRef.current) {
      localExperienceRef.current = hud.experienceEarned;
      return;
    }
    const delta = hud.experienceEarned - localExperienceRef.current;
    if (delta <= 0) return;
    localExperienceRef.current = hud.experienceEarned;
    setProgression((current) => {
      const next = applyLocalExperience(
        current ?? loadLocalProgression(characterId),
        delta,
      ).snapshot;
      saveLocalProgression(next);
      return next;
    });
  }, [characterId, hud.experienceEarned, localProgression]);

  useEffect(() => {
    let active = true;
    void loadRuntime().then(({ mountGameRuntime }) => {
      if (active && host.current !== null) {
        const mounted = mountGameRuntime(host.current, setHud, characterClass);
        runtime.current = mounted;
        setRuntimeReady(true);
        for (const event of pendingServerEvents.current) mounted.applyServerEvent?.(event);
        pendingServerEvents.current = [];
        mounted.setConnection(connectionRef.current);
        mounted.setDamageNumbers?.(damageNumbersRef.current);
        mounted.setAutoBattle?.(autoBattleRef.current);
        mounted.setAudioSettings?.(gameSettingsRef.current);
        mounted.setReducedMotion?.(gameSettingsRef.current.reducedMotion);
        if (equipmentVisualRef.current !== undefined)
          mounted.setEquipmentVisual?.(equipmentVisualRef.current);
      }
    });
    return () => {
      active = false;
      runtime.current?.destroy();
      runtime.current = undefined;
      setRuntimeReady(false);
    };
  }, [loadRuntime]);

  useEffect(() => {
    const mounted = runtime.current;
    if (
      !runtimeReady ||
      mounted?.setEquipmentVisual === undefined ||
      (connection !== 'online' && connection !== 'degraded')
    )
      return undefined;
    let cancelled = false;
    void gameApi
      .inventory(characterId)
      .then(({ inventory }) => {
        if (cancelled) return;
        const loadout = equipmentVisualFromSnapshot(inventory);
        equipmentVisualRef.current = loadout;
        mounted.setEquipmentVisual?.(loadout);
        setEquipmentStats(inventory.derivedStats);
        setResources([
          {
            id: 'gold',
            label: 'Oro',
            value: inventory.gold.toLocaleString('es-AR'),
            icon: 'gold',
            tone: 'gold',
          },
          {
            id: 'materials',
            label: 'Materiales',
            value: inventory.materials.toLocaleString('es-AR'),
            icon: 'shard',
            tone: 'corruption',
          },
        ]);
      })
      .catch(() => {
        // Anonymous previews and transient reconnects have no inventory; gameplay remains usable.
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, connection, runtimeReady]);

  useEffect(() => {
    if (!runtimeReady || (connection !== 'online' && connection !== 'degraded')) return undefined;
    let cancelled = false;
    void gameApi
      .progression(characterId)
      .then(({ progression: snapshot }) => {
        if (!cancelled) setProgression(snapshot);
      })
      .catch(() => {
        // Anonymous previews and transient reconnects can continue with the static HUD.
      });
    return () => {
      cancelled = true;
    };
  }, [characterId, connection, runtimeReady]);

  // Combat follows the character the server knows about: level-ups, attribute point spends and
  // equipment changes all land here through their own snapshot, so gear you equip in the Inventory
  // screen changes how the Guardian actually fights, not only how the sheet or the sprite reads.
  // `equipmentStats` (when loaded) already folds gear's own strength/dexterity/vitality rolls into
  // the base attributes — see InventoryService's `deriveStats` — so it takes priority over the
  // bare progression snapshot for those three; the flat armor/damage/health/crit bonuses only ever
  // come from gear, so they stay at 0 until equipment has actually loaded.
  useEffect(() => {
    if (!runtimeReady || progression === undefined) return;
    runtime.current?.setCharacterProfile?.({
      level: progression.level,
      strength: equipmentStats?.strength ?? progression.attributes.strength,
      dexterity: equipmentStats?.dexterity ?? progression.attributes.dexterity,
      vitality: equipmentStats?.vitality ?? progression.attributes.vitality,
      ...(equipmentStats === undefined
        ? {}
        : {
            armorBonus: equipmentStats.armor,
            physicalDamageBonus: equipmentStats.physical_damage,
            maxHealthBonus: equipmentStats.max_health,
            // Item rolls are percentage points ("3" meaning 3%); the combat formula's own
            // criticalBaseChance/criticalCap are fractions (0.03), so this needs converting.
            criticalChanceBonus: equipmentStats.critical_chance / 100,
          }),
    });
  }, [equipmentStats, progression, runtimeReady]);

  useEffect(() => {
    if (connection !== 'online' && connection !== 'degraded') return undefined;
    let cancelled = false;
    const session = connectGameServer((event) => {
      if (isRewardGrantedEvent(event)) {
        void gameApi
          .progression(characterId)
          .then(({ progression: snapshot }) => {
            if (!cancelled) setProgression(snapshot);
          })
          .catch(() => {
            // The reward event remains visible even if a reconnect delays the fresh progression snapshot.
          });
      }
      const mounted = runtime.current;
      if (mounted?.applyServerEvent?.(event)) return;
      if (mounted === undefined && pendingServerEvents.current.length < 32)
        pendingServerEvents.current.push(event);
    });
    return () => {
      cancelled = true;
      session.close();
    };
  }, [characterId, connection]);

  useEffect(() => runtime.current?.setConnection(connection), [connection]);
  useEffect(() => runtime.current?.setDamageNumbers?.(showDamageNumbers), [showDamageNumbers]);
  useEffect(() => runtime.current?.setAutoBattle?.(autoBattle), [autoBattle]);
  useEffect(() => {
    const apply = (next: GameSettings) => {
      const normalized = sanitizeGameSettings(next);
      setGameSettings(normalized);
      runtime.current?.setAudioSettings?.(normalized);
      runtime.current?.setReducedMotion?.(normalized.reducedMotion);
    };
    const onSettings = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      apply(sanitizeGameSettings(detail));
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key !== 'lbo-settings-v2' && event.key !== 'lbo-settings-v1') return;
      apply(readGameSettings());
    };
    window.addEventListener(GAME_SETTINGS_EVENT, onSettings);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(GAME_SETTINGS_EVENT, onSettings);
      window.removeEventListener('storage', onStorage);
    };
  }, []);
  useEffect(() => {
    runtime.current?.setAudioSettings?.(gameSettings);
    runtime.current?.setReducedMotion?.(gameSettings.reducedMotion);
  }, [gameSettings]);
  useEffect(() => {
    const onVisibilityChange = () => {
      const current = runtime.current;
      if (current === undefined) return;
      if (document.hidden) {
        if (!manuallyPaused.current) {
          pausedByVisibility.current = true;
          current.pause();
        }
        return;
      }
      if (pausedByVisibility.current) {
        pausedByVisibility.current = false;
        if (!manuallyPaused.current) current.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  const checkpoint = async (checkpointId = 'test:gate'): Promise<boolean> => {
    if (checkpointInFlight.current) return false;
    const previousIntent = checkpointIntent.current;
    let intent = previousIntent?.checkpointId === checkpointId ? previousIntent : undefined;
    if (intent === undefined) {
      // A fresh runtime session restarts hud.experienceEarned at 0; treat that as a new baseline
      // rather than reporting a negative delta (or worse, re-sending everything already synced).
      if (hud.experienceEarned < syncedExperienceRef.current) syncedExperienceRef.current = 0;
      const unsynced = localProgression
        ? 0
        : Math.max(0, hud.experienceEarned - syncedExperienceRef.current);
      pendingExperienceRef.current = unsynced;
      intent = {
        operationId: crypto.randomUUID(),
        schemaVersion: 1 as const,
        characterId,
        sceneId: 'local:test' as const,
        checkpointId,
        ...(unsynced > 0 ? { experienceGained: String(unsynced) } : {}),
      };
    }
    checkpointIntent.current = intent;
    checkpointInFlight.current = true;
    setCheckpointPending(true);
    try {
      await onCheckpoint(intent);
      const grantedExperience = pendingExperienceRef.current;
      syncedExperienceRef.current += grantedExperience;
      pendingExperienceRef.current = 0;
      checkpointIntent.current = undefined;
      setCheckpointError(undefined);
      // The checkpoint just persisted this XP server-side; refresh the sheet so level/attribute
      // points shown in the HUD stop lagging behind what the server now has on record.
      if (grantedExperience > 0) {
        void gameApi
          .progression(characterId)
          .then(({ progression: snapshot }) => setProgression(snapshot))
          .catch(() => {
            // A stale HUD sheet self-corrects on the next progression fetch or reward event.
          });
      }
      return true;
    } catch {
      checkpointErrorAndRetry(setCheckpointError);
      return false;
    } finally {
      checkpointInFlight.current = false;
      setCheckpointPending(false);
    }
  };

  const saveBeforeOpeningTown = async (): Promise<void> => {
    // Returning to the Pueblo is a durable boundary. The server records the authoritative
    // progression snapshot; the navigation still proceeds when a transient network error occurs
    // so the player is not trapped in combat, while the retry message remains visible.
    await checkpoint('town:entry');
    onOpenTown?.();
  };

  return (
    <GameHudOverlay
      autoBattle={autoBattle}
      checkpointError={checkpointError}
      checkpointPending={checkpointPending}
      hud={hud}
      {...(progression === undefined ? {} : { progression })}
      {...(resources === undefined ? {} : { resources })}
      onAutoBattleChange={setAutoBattle}
      onCheckpoint={() => void checkpoint()}
      onExit={onExit}
      onOpenInventory={onOpenInventory}
      onOpenResults={onOpenResults}
      onOpenCharacter={onOpenCharacter}
      onOpenTown={onOpenTown === undefined ? undefined : () => void saveBeforeOpeningTown()}
      onPause={() => {
        manuallyPaused.current = true;
        runtime.current?.pause();
      }}
      onResume={() => {
        manuallyPaused.current = false;
        runtime.current?.resume();
      }}
      onShowDamageNumbersChange={setShowDamageNumbers}
      runtime={runtime.current}
      showDamageNumbers={showDamageNumbers}
      stage={<div className="game-island" ref={host} />}
    />
  );
}

function checkpointErrorAndRetry(setCheckpointError: (message: string) => void): void {
  setCheckpointError('No se pudo guardar el punto de control. Podés reintentar.');
}

/** Pure helpers kept as a stable public surface for unit tests and future HUD variants. */
export function barPercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

export function cooldownFraction(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.max(0, Math.min(1, remainingMs / totalMs));
}

export function formatCooldown(ms: number): string {
  const secs = ms / 1000;
  if (secs < 10) return `${secs.toFixed(1)}s`;
  return `${Math.ceil(secs)}s`;
}
