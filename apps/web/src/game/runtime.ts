import Phaser from 'phaser';

import { GAME_DATA } from '@brecha/game-data';
import {
  createSeededRandom,
  applyDefeat,
  createForestProgressState,
  createForestWave,
  currentLevelTuning,
  EMPTY_ENEMY_REWARD_LEDGER,
  EnemySpawnDirector,
  grantEnemyDefeatReward,
  hasProjectileExpired,
  isTelegraphActive,
  projectileHitsTarget,
  projectilePositionAt,
  resolveAttack,
  resolveEnemyAction,
  resolveEnemyTelegraph,
  telegraphResolvedThisTick,
  seedFromString,
  applyInteraction,
  EMPTY_INTERACTION_LEDGER,
  type InteractionLedger,
  type ForestProgressState,
  type ForestWavePlan,
  type EnemyAiState,
  type EnemyAbilityEffect,
  type EnemyAbilityTarget,
  type EnemySpawnedProjectile,
  type EnemySpawnedTelegraph,
  type AttackerStats,
  type DefenderStats,
  type EnemyRewardLedger,
  type EnemySpawnAction,
  type EnemySpawnDirectorConfig,
  type EnemySpawnSafetyCheck,
  type CharacterClassId,
} from '@brecha/shared';

import {
  guardianCombatTuning,
  LocalCombatController,
  type CombatEvent,
  type DummyTarget,
} from './combat-controller';
import {
  guardianCombatPresentation,
  validateGuardianCombatPresentation,
} from './combat-presentation';
import {
  appendPresentation,
  EMPTY_GAME_PRESENTATION,
  localDefeatPresentation,
  parseServerEvent,
  serverEventToPresentation,
  type GamePresentationState,
} from './game-events';
import { localAssetManifest, validateAssetManifest, validateLoadedFrameCount } from './assets';
import {
  motionFromInput,
  resolveCharacterState,
  type Direction4,
  type LocalCharacterState,
} from './domain';
import { ENEMY_VISUALS, skeletonTierForLevel, type EnemyVisualId } from './enemy-visuals';
import {
  arcadeDebugEnabled,
  arcadeDebugOptIn,
  CAMERA_FOLLOW_DEADZONE,
  CAMERA_FOLLOW_LERP,
  CAMERA_WORLD_PADDING_PX,
  CAMERA_ZOOM,
  POTION,
  PROJECTILE_VISUAL_CHEST_LIFT_PX,
  resolveCharacterVisual,
} from './presentation';
import {
  advanceEnemy,
  createEnemy,
  scheduleNextAbility,
  scheduleNextAttack,
  wantsToAttack,
  wantsToUseAbility,
  type EnemyRecord,
} from './sim/enemy-sim';
import {
  activeEnemyVisualState,
  enemyAbilityVisualMode,
  enemyAiVisualState,
  latchEnemyVisualState,
  type EnemyVisualLatch,
} from './sim/enemy-visual-state';
import { ObjectPool } from './sim/object-pool';
import {
  FOREST_PREVIEW_INTERACTION_TARGETS,
  interactionFeedback,
  interactionKindLabel,
  nearestInteractionTarget,
} from './interaction-runtime';
import {
  DEFAULT_ENEMY_STRESS_COUNT,
  MAX_ENEMY_STRESS_COUNT,
  STRESS_FRAME_SAMPLE_CAPACITY,
  enemyStressEnabled,
  enemyStressSpawnPoints,
  parseEnemyStressCount,
  percentile,
} from './sim/enemy-stress';
import {
  addAmbientSpores,
  addVignette,
  borderBandPoints,
  paintCorruptedForestGround,
  paintHouse,
  plantCorruptedTree,
} from './environment';
import {
  darkKnight,
  generatedClassCharacters,
  hunter,
  layeredCharacterSheets,
  mapDirection,
  mapState,
  pixelLabKey,
  pixelLabSheetsToLoad,
  pickAnimation,
  type LayeredCharacter,
  type PixelLabAnimationName,
  type PixelLabCharacter,
} from './pixellab-characters';
import { abilityVfxKind, combatVfx, durationForMotion, VFX_POOL_CAPACITY } from './vfx';
import {
  equipmentRarityColor,
  isTwoHandedWeapon,
  validateEquipmentVisualCompatibility,
  weaponSilhouetteForDefinition,
  type EquipmentVisualLoadout,
  type WeaponSilhouette,
} from './equipment-visual';
import { GameAudioMixer } from './audio';
import type { GameSettings } from '../settings';
import { clampWorldPosition, constrainDummyKnockback, TEST_WORLD } from './runtime-movement';

/** Start in the playable center so a zoomed-out camera can keep the Guardian visible immediately. */
const PLAYER_SPAWN = Object.freeze({ x: TEST_WORLD.width / 2, y: TEST_WORLD.height / 2 });
/** Keep the full 92px character silhouette inside the authored world bounds. */
const ENEMY_SPAWN_CONFIG: EnemySpawnDirectorConfig<EnemyVisualId> = Object.freeze({
  minActive: 3,
  maxActive: 3,
  cleanupDelayMs: 500,
  respawnDelayMs: 1500,
  safeSpawnRadiusPx: 140,
  spawnPoints: Object.freeze([
    { x: 360, y: 180 },
    { x: 400, y: 260 },
    { x: 300, y: 330 },
    { x: 420, y: 430 },
    { x: 560, y: 160 },
    { x: 900, y: 180 },
    { x: 1020, y: 350 },
    { x: 980, y: 560 },
  ]),
  composition: Object.freeze([
    'corrupted_minion',
    'possessed_archer',
    'dark_shaman',
    'root_brute',
    'unstable_beast',
  ] as const),
  idPrefix: 'enemy',
});
/**
 * Wave composition, level-aware: the five base archetypes plus whichever Skeleton tier fits the
 * player's current forest level (Paso 10). Appended rather than swapped in, so the existing five
 * archetypes stay guaranteed present at every level — the Skeleton line is new variety layered on
 * top, not a replacement that could accidentally thin out the roster.
 */
function composeWaveArchetypes(level: number): readonly EnemyVisualId[] {
  return [...ENEMY_SPAWN_CONFIG.composition, skeletonTierForLevel(level)];
}
const ENEMY_MIN_SEPARATION_PX = 58;
/** Bounded visual capacities for the local preview and the opt-in 40-enemy stress mode. */
const STRESS_METRICS_PUBLISH_MS = 500;
const GUARDIAN_TARGET_ID = 'guardian';
const ENEMY_HIT_VISUAL_MS = 180;
const ENEMY_KNOCKBACK_VISUAL_MS = 220;
/**
 * Static, data-driven damage hazard: no detection/navigation/aggro (that is Paso 8's job). It
 * exists solely to make incoming damage — and therefore health, Iron Skin and Battle Thirst —
 * honestly verifiable in the running game instead of provably true in tests and invisible in play.
 */
const HAZARD = GAME_DATA.hazards[0]!;
const HAZARD_POSITION = Object.freeze({ x: 640, y: 460 });
/**
 * Ruined cottages: solid map geometry (the Guardian collides with them; enemies still path through
 * freely, matching how `CombatObstacle` currently only feeds the player's own knockback sweep).
 * Positions sit clear of every enemy spawn point, the hazard and the player's own spawn so a fresh
 * run never starts wedged against a wall.
 */
const HOUSE_OBSTACLES: readonly Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>[] = Object.freeze([
  { x: 760, y: 240, width: 64, height: 50 },
  { x: 190, y: 560, width: 58, height: 46 },
]);
const EXPEDITION_BACKGROUND_KEY = 'env:corrupted-forest-background';
const LEGENDARY_GLINT_TEXTURE_KEY = 'vfx:legendary-glint';

export type RuntimeConnection = 'online' | 'offline' | 'degraded' | 'maintenance';
export type RuntimeAbility = 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin';
export type GameHudSnapshot = Readonly<{
  facing: Direction4;
  /** Presentation-only camera scale, exposed for deterministic HUD/smoke observability. */
  cameraZoom: number;
  paused: boolean;
  connection: RuntimeConnection;
  health: number;
  maxHealth: number;
  downed: boolean;
  fury: number;
  maxFury: number;
  cooldownRemainingMs: Readonly<Record<'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin', number>>;
  ironSkinActive: boolean;
  /** Living enemies this frame, for the HUD minimap counter. Derived from controller.getTargets(). */
  enemiesAlive: number;
  /** Current level and XP of the endless Corrupted Forest loop (Paso 9). */
  forestLevel: number;
  forestBestLevel: number;
  forestXpInLevel: number;
  forestXpToAdvance: number;
  forestWaveIndex: number;
  forestWaveSize: number;
  /** XP credited by defeated mobs during this runtime session; the local preview reduces it into its persisted character progression. */
  experienceEarned: number;
  /** Health-potion belt: charges left, and how long until the next sip is allowed. */
  potionCharges: number;
  potionCooldownRemainingMs: number;
  /** Bounded, presentation-only feedback derived from local or validated server events. */
  lootLog: GamePresentationState['lootLog'];
  notifications: GamePresentationState['notifications'];
}>;
const EMPTY_EQUIPMENT_VISUAL: EquipmentVisualLoadout = Object.freeze({
  weapon: undefined,
  armor: Object.freeze([]),
});
export type GameRuntime = Readonly<{
  pause(): void;
  resume(): void;
  destroy(): void;
  setConnection(connection: RuntimeConnection): void;
  setDamageNumbers?(enabled: boolean): void;
  setAutoBattle?(enabled: boolean): void;
  setAudioSettings?(settings: GameSettings): void;
  setReducedMotion?(enabled: boolean): void;
  /** Applies only server-derived equipment presentation; it never changes combat stats. */
  setEquipmentVisual?(loadout: EquipmentVisualLoadout): void;
  activate?(ability: RuntimeAbility): void;
  /** Spends one health-potion charge, if the belt has one and the shared cooldown has elapsed. */
  drinkPotion?(): void;
  /**
   * Binds combat to the character's server-authoritative level, attributes, and equipped-gear
   * bonuses (armor/physical damage/max health/critical chance summed from equipment — see
   * `InventorySnapshot.derivedStats` server-side). The bonus fields are optional so a caller with
   * only a progression snapshot (no inventory fetched yet) can still call this.
   */
  setCharacterProfile?(
    profile: Readonly<{
      level: number;
      strength: number;
      dexterity: number;
      vitality: number;
      armorBonus?: number;
      physicalDamageBonus?: number;
      maxHealthBonus?: number;
      criticalChanceBonus?: number;
    }>,
  ): void;
  /** Applies a validated server event to presentation only; it never mutates authority state. */
  applyServerEvent?(raw: unknown): boolean;
}>;

class BootScene extends Phaser.Scene {
  public constructor() {
    super('boot');
  }
  public preload(): void {
    validateAssetManifest(localAssetManifest);
    validateGuardianCombatPresentation();
    validateEquipmentVisualCompatibility(darkKnight);
    // The layered placeholder contract stays loaded and validated: it is still the shape Paso 8's
    // enemies are described with, even though the Guardian now renders real generated art. The
    // equipment overlays below deliberately remain separate from this contract until authored
    // per-frame layers exist.
    for (const asset of localAssetManifest)
      this.load.spritesheet(asset.id, asset.path, { frameWidth: 64, frameHeight: 64 });
    for (const character of [darkKnight, ...generatedClassCharacters])
      for (const sheet of pixelLabSheetsToLoad(character))
        this.load.spritesheet(sheet.key, sheet.path, {
          frameWidth: sheet.frameWidth,
          frameHeight: sheet.frameHeight,
        });
    // Any enemy whose visual carries its own generated character gets its sheets loaded too —
    // driven by the catalog, so adding art to another enemy only touches enemy-visuals.ts.
    for (const character of enemyCharactersToLoad())
      for (const sheet of pixelLabSheetsToLoad(character))
        this.load.spritesheet(sheet.key, sheet.path, {
          frameWidth: sheet.frameWidth,
          frameHeight: sheet.frameHeight,
        });
    // Layered characters load exactly like merged ones — each layer is a character in its own
    // right, so nothing about the loader had to change to support equipment as real art.
    for (const layer of layeredCharacterSheets(hunter))
      for (const sheet of pixelLabSheetsToLoad(layer))
        this.load.spritesheet(sheet.key, sheet.path, {
          frameWidth: sheet.frameWidth,
          frameHeight: sheet.frameHeight,
        });
    this.load.image(EXPEDITION_BACKGROUND_KEY, '/assets/backgrounds/corrupted-forest.webp');
  }
  public create(): void {
    for (const asset of localAssetManifest)
      validateLoadedFrameCount(asset, this.textures.get(asset.id).frameTotal);
    this.scene.start('test');
  }
}

class FeedbackPool {
  private readonly impacts: Phaser.GameObjects.Arc[];
  private readonly numbers: Phaser.GameObjects.Text[];
  private impactIndex = 0;
  private numberIndex = 0;
  private reducedMotion = false;
  public constructor(private readonly scene: Phaser.Scene) {
    this.impacts = Array.from({ length: VFX_POOL_CAPACITY.impact }, () =>
      scene.add.circle(0, 0, 12, 0xf5d486, 0).setDepth(100),
    );
    this.numbers = Array.from({ length: VFX_POOL_CAPACITY.floatingText }, () =>
      scene.add
        .text(0, 0, '', {
          color: '#f5d486',
          fontSize: '15px',
          stroke: '#131713',
          strokeThickness: 3,
        })
        .setOrigin(0.5)
        .setDepth(101)
        .setVisible(false),
    );
  }
  public impact(
    x: number,
    y: number,
    amount: number,
    critical: boolean,
    showNumber: boolean,
  ): void {
    const circle = this.impacts[this.impactIndex++ % this.impacts.length]!;
    this.scene.tweens.killTweensOf(circle);
    circle
      .setPosition(x, y)
      .setFillStyle(critical ? 0xffd14a : 0xd5f1dc, 0.9)
      .setScale(0.45)
      .setAlpha(0.9)
      .setActive(true)
      .setVisible(true);
    const text = this.numbers[this.numberIndex++ % this.numbers.length]!;
    this.scene.tweens.killTweensOf(text);
    if (!showNumber) {
      text.setText('').setActive(false).setVisible(false);
    } else
      text
        .setPosition(x, y - 30)
        .setText(`${critical ? '¡' : ''}${amount}`)
        .setColor(critical ? '#ffd14a' : '#eaf6ed')
        .setActive(true)
        .setVisible(true)
        .setAlpha(1);
    this.scene.tweens.add({
      targets: circle,
      scale: 1.6,
      alpha: 0,
      duration: this.reducedMotion ? 80 : 180,
      onComplete: () => circle.setActive(false).setVisible(false),
    });
    if (showNumber)
      this.scene.tweens.add({
        targets: text,
        y: y - (this.reducedMotion ? 20 : 56),
        alpha: 0,
        duration: this.reducedMotion ? 180 : 500,
        onComplete: () => text.setActive(false).setVisible(false),
      });
  }
  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
  }
  public destroy(): void {
    [...this.impacts, ...this.numbers].forEach((object) => object.destroy());
  }
}

type PooledArcVisualConfig = Readonly<{
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
  depth: number;
  rotation?: number;
  stroke?: Readonly<{ width: number; color: number; alpha: number }>;
}>;

/**
 * Phaser adapter for the pure ObjectPool. Every Arc is allocated during scene creation; effects
 * only acquire, reset and release an existing object. Exhaustion drops presentation feedback
 * instead of creating an unbounded object, while combat events remain authoritative.
 */
class PooledArcVisuals {
  private readonly objects: readonly Phaser.GameObjects.Arc[];
  private readonly pool: ObjectPool<Phaser.GameObjects.Arc>;

  public constructor(
    private readonly scene: Phaser.Scene,
    capacity: number,
  ) {
    this.objects = Array.from({ length: capacity }, () => scene.add.circle(0, 0, 1, 0xffffff, 0));
    this.pool = new ObjectPool(this.objects);
    this.objects.forEach((arc) => this.reset(arc));
  }

  public acquire(config: PooledArcVisualConfig): Phaser.GameObjects.Arc | undefined {
    const arc = this.pool.acquire();
    if (arc === undefined) return undefined;
    this.scene.tweens.killTweensOf(arc);
    arc
      .setPosition(config.x, config.y)
      .setScale(config.radius)
      .setFillStyle(config.color, config.alpha)
      .setStrokeStyle(
        config.stroke?.width ?? 0,
        config.stroke?.color ?? 0,
        config.stroke?.alpha ?? 0,
      )
      .setDepth(config.depth)
      .setAngle(config.rotation ?? 0)
      .setAlpha(1)
      .setActive(true)
      .setVisible(true);
    return arc;
  }

  public release(arc: Phaser.GameObjects.Arc): void {
    if (!this.pool.release(arc)) return;
    this.reset(arc);
  }

  public destroy(): void {
    this.pool.reset((arc) => this.reset(arc));
    this.objects.forEach((arc) => arc.destroy());
  }

  public get activeCount(): number {
    return this.pool.activeCount;
  }

  public get capacity(): number {
    return this.pool.capacity;
  }

  private reset(arc: Phaser.GameObjects.Arc): void {
    this.scene.tweens.killTweensOf(arc);
    arc.setPosition(0, 0).setScale(1).setAngle(0).setAlpha(0).setActive(false).setVisible(false);
  }
}

type PooledArrowVisualConfig = Readonly<{
  x: number;
  y: number;
  color: number;
  alpha: number;
  depth: number;
  rotation: number;
}>;

/**
 * Bounded arrow-shaped projectile visuals for ranged enemies. The projectile's geometry and
 * impact remain pure/server-owned; this pool only replaces the old magic-looking orb with a
 * readable arrowhead and prevents allocations during a dense wave.
 */
class PooledArrowVisuals {
  private readonly objects: readonly Phaser.GameObjects.Polygon[];
  private readonly pool: ObjectPool<Phaser.GameObjects.Polygon>;

  public constructor(
    private readonly scene: Phaser.Scene,
    capacity: number,
  ) {
    this.objects = Array.from({ length: capacity }, () =>
      scene.add.polygon(0, 0, [10, 0, -7, -4, -4, 0, -7, 4], 0xffffff, 0),
    );
    this.pool = new ObjectPool(this.objects);
    this.objects.forEach((arrow) => this.reset(arrow));
  }

  public acquire(config: PooledArrowVisualConfig): Phaser.GameObjects.Polygon | undefined {
    const arrow = this.pool.acquire();
    if (arrow === undefined) return undefined;
    this.scene.tweens.killTweensOf(arrow);
    arrow
      .setPosition(config.x, config.y)
      .setScale(1)
      .setFillStyle(config.color, config.alpha)
      .setStrokeStyle(1, 0x2b1710, 0.95)
      .setDepth(config.depth)
      .setRotation(config.rotation)
      .setAlpha(1)
      .setActive(true)
      .setVisible(true);
    return arrow;
  }

  public release(arrow: Phaser.GameObjects.Polygon): void {
    if (!this.pool.release(arrow)) return;
    this.reset(arrow);
  }

  public destroy(): void {
    this.pool.reset((arrow) => this.reset(arrow));
    this.objects.forEach((arrow) => arrow.destroy());
  }

  public get activeCount(): number {
    return this.pool.activeCount;
  }

  public get capacity(): number {
    return this.pool.capacity;
  }

  private reset(arrow: Phaser.GameObjects.Polygon): void {
    this.scene.tweens.killTweensOf(arrow);
    arrow
      .setPosition(0, 0)
      .setScale(1)
      .setRotation(0)
      .setAlpha(0)
      .setActive(false)
      .setVisible(false);
  }
}

class TestScene extends Phaser.Scene {
  private readonly characterClass: CharacterClassId;
  private facing: Direction4 = 'down';
  private paused = false;
  private connection: RuntimeConnection = 'online';
  private player!: Phaser.Physics.Arcade.Sprite;
  private wasd!: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
  private shadow!: Phaser.GameObjects.Ellipse;
  /** Temporary but contract-compatible overlays until authored layered sheets replace them. */
  private armorVisual!: Phaser.GameObjects.Container;
  private weaponVisual!: Phaser.GameObjects.Container;
  private equipmentVisual: EquipmentVisualLoadout = EMPTY_EQUIPMENT_VISUAL;
  private readonly character: PixelLabCharacter;
  /**
   * Set when the played character ships pixel-aligned layers. While it is undefined the runtime
   * keeps the older behaviour for merged art: translucent, rarity-tinted vector overlays.
   */
  private readonly layeredCharacter: LayeredCharacter | undefined;
  private armorLayerSprite: Phaser.GameObjects.Sprite | undefined;
  private weaponLayerSprite: Phaser.GameObjects.Sprite | undefined;
  private state: LocalCharacterState = 'idle';
  private actionEndsAt = 0;
  private pausedAt: number | undefined;
  private pausedDuration = 0;
  /** One seed per run: identical command sequences must replay identically (GOAL.md §32). */
  private readonly runSeed = seedFromString(crypto.randomUUID());
  /**
   * Built in create(), not as a field initializer: LocalCombatController's constructor calls
   * clock.now() eagerly, and this.time (Phaser's Scene clock) does not exist yet at the point a
   * field initializer runs — the scene has not been installed into a Game. Constructing it here
   * as a class field throws "Cannot read properties of undefined (reading 'now')" the moment a
   * real browser (not a mocked/short-circuited test double) actually boots this scene.
   */
  private controller!: LocalCombatController;
  private readonly dummyVisuals = new Map<string, Phaser.GameObjects.Sprite>();
  private readonly dummyShadows = new Map<string, Phaser.GameObjects.Ellipse>();
  /** IA records keyed by dummy id. Populated in addDummy; ticked each update() so the enemies
   *  chase/kite the player instead of standing still (Paso 8.4 adapter, previously missing). */
  private readonly enemies = new Map<string, EnemyRecord>();
  /** Presentation-only hit/death latches; combat remains authoritative in LocalCombatController. */
  private readonly enemyVisualLatches = new Map<string, EnemyVisualLatch>();
  /** Monotonic action tokens let a repeated attack restart once, never once per render frame. */
  private readonly enemyAnimationActionTokens = new Map<string, number>();
  private readonly enemyAnimationSignatures = new Map<string, string>();
  /** Pure lifecycle authority for active slots, death cleanup and delayed replacements. */
  private spawnDirector!: EnemySpawnDirector<EnemyVisualId>;
  private enemySpawnConfig!: EnemySpawnDirectorConfig<EnemyVisualId>;
  private readonly enemyStressCount: number;
  private readonly stressEnabled: boolean;
  /** Bounded session XP is emitted to the preview adapter; the authenticated server remains authoritative. */
  private enemyRewardLedger: EnemyRewardLedger = EMPTY_ENEMY_REWARD_LEDGER;
  /** Bounded presentation counter for the XP feedback requested during local test runs. */
  private experienceEarned = 0;
  /** Bounded HUD feedback; values are never used as gameplay authority. */
  private presentation: GamePresentationState = EMPTY_GAME_PRESENTATION;
  /** Forest progression is a pure state value; this scene only applies authoritative defeat events. */
  private forestProgress!: ForestProgressState;
  /** Current pure plan consumed by the spawn director; changes only after a confirmed level-up. */
  private forestWavePlan!: ForestWavePlan<EnemyVisualId>;
  private forestWaveIndex = 0;
  private readonly forestWaveSeed: number;
  /** Shared interaction ledger for the local preview; later server commands can replay it exactly. */
  private interactionLedger: InteractionLedger = EMPTY_INTERACTION_LEDGER;
  private interactionSequence = 0;
  private interactionPrompt!: Phaser.GameObjects.Text;
  private interactionFeedbackText!: Phaser.GameObjects.Text;
  private interactionFeedbackTween: Phaser.Tweens.Tween | undefined;
  private readonly interactionVisuals = new Map<string, Phaser.GameObjects.Container>();
  /** Combat-clock ms of the last enemy AI tick; the AI integrates position over [from, to). */
  private lastEnemyTickAt = 0;
  /** Seeded RNG shared by the pure enemy ability resolver for deterministic local replays. */
  private enemyAbilityRandom!: ReturnType<typeof createSeededRandom>;
  private enemyAbilitySequence = 0;
  private guardianStunnedUntil = 0;
  private potionCharges = POTION.charges;
  private potionReadyAt = 0;
  private characterProfile:
    | Readonly<{
        level: number;
        strength: number;
        dexterity: number;
        vitality: number;
        armorBonus?: number;
        physicalDamageBonus?: number;
        maxHealthBonus?: number;
        criticalChanceBonus?: number;
      }>
    | undefined;
  private readonly enemyProjectiles = new Map<
    string,
    Readonly<{
      ownerId: string;
      projectile: EnemySpawnedProjectile;
      attacker: AttackerStats;
      visual: Phaser.GameObjects.Polygon;
    }>
  >();
  private readonly enemyTelegraphs = new Map<
    string,
    Readonly<{
      ownerId: string;
      telegraph: EnemySpawnedTelegraph;
      attacker: AttackerStats;
      visual: Phaser.GameObjects.Arc;
    }>
  >();
  private enemyProjectileVisuals!: PooledArrowVisuals;
  private enemyTelegraphVisuals!: PooledArcVisuals;
  private burstVisuals!: PooledArcVisuals;
  private abilityVisuals!: PooledArcVisuals;
  private readonly stressFrameSamples = Array.from(
    { length: STRESS_FRAME_SAMPLE_CAPACITY },
    () => 0,
  );
  private stressFrameCursor = 0;
  private stressFrameSampleCount = 0;
  private readonly stressFrameIntervals = Array.from(
    { length: STRESS_FRAME_SAMPLE_CAPACITY },
    () => 0,
  );
  private stressFrameIntervalCursor = 0;
  private stressFrameIntervalCount = 0;
  private stressRafId: number | undefined;
  private stressFrameLastAt: number | undefined;
  private stressProbeDisposed = false;
  private stressMetricsPublishedAt = -Infinity;
  private hazardPulseAt = HAZARD.periodMs;
  private hazardIndicator!: Phaser.GameObjects.Arc;
  /** Fills from the centre outwards as the telegraph runs, so "how long until this hurts" is
   * readable at a glance instead of only as a slowly brightening outline. */
  private hazardFill!: Phaser.GameObjects.Arc;
  private feedback!: FeedbackPool;
  /** Visual aura around the Guardian while Iron Skin is active; created/destroyed with the buff. */
  private ironSkinAura: Phaser.GameObjects.Arc | undefined;
  private audio = new GameAudioMixer({
    sound: true,
    music: true,
    reducedMotion: false,
    masterVolume: 0.8,
    musicVolume: 0.45,
    ambienceVolume: 0.35,
    sfxVolume: 0.7,
    uiVolume: 0.65,
  });
  /**
   * Phaser normally emits SHUTDOWN when a scene is stopped, but a route change can destroy the
   * parent game before that event is delivered. Keep audio teardown explicit and idempotent so a
   * music interval or Web Audio context can never survive after returning to the menu.
   */
  private audioReleased = false;
  private reducedMotion = false;
  private showDamageNumbers = true;
  /** Vision pivot (GOAL.md §0.1): combat is semi-automatic by default, manual input is the
   * intervention layer for content that demands it. This flag is that layer's on/off switch. */
  private autoBattle = false;
  private lastHudAt = -Infinity;
  private readonly suppressContextMenu = (event: Event) => event.preventDefault();
  public constructor(
    private readonly onHud: (snapshot: GameHudSnapshot) => void,
    characterClass?: CharacterClassId,
  ) {
    super('test');
    this.characterClass = characterClass ?? 'GUARDIAN';
    const search = typeof window === 'undefined' ? '' : window.location.search;
    const visual = resolveCharacterVisual(
      this.characterClass,
      search,
      import.meta.env.MODE === 'development',
    );
    this.character = visual.character;
    this.layeredCharacter = visual.layeredCharacter;
    this.stressEnabled = enemyStressEnabled(search, import.meta.env.MODE === 'development');
    this.enemyStressCount = this.stressEnabled
      ? parseEnemyStressCount(search)
      : DEFAULT_ENEMY_STRESS_COUNT;
    this.forestWaveSeed = seedFromString(`${this.runSeed}:forest-waves`);
  }
  public create(): void {
    this.forestProgress = createForestProgressState(GAME_DATA.endlessForest);
    this.forestWavePlan = createForestWave(
      GAME_DATA.endlessForest,
      this.forestProgress.level,
      this.forestWaveIndex,
      this.forestWaveSeed,
      composeWaveArchetypes(this.forestProgress.level),
    );
    this.controller = new LocalCombatController(
      { now: () => this.combatNow() },
      createSeededRandom(this.runSeed),
      constrainDummyKnockback,
      this.characterClass,
    );
    // A profile set before Phaser finished booting is applied as soon as the controller exists.
    if (this.characterProfile !== undefined)
      this.controller.applyCharacterProfile(this.characterProfile);
    this.enemyAbilityRandom = createSeededRandom(this.runSeed ^ 0x3a11ab1e);
    const scenery = createSeededRandom(this.runSeed);
    paintCorruptedForestGround(this, TEST_WORLD.width, TEST_WORLD.height, scenery);
    this.add
      .image(TEST_WORLD.width / 2, TEST_WORLD.height / 2, EXPEDITION_BACKGROUND_KEY)
      // Overdrawn by the camera padding so scrolling past an arena edge never reveals empty canvas.
      .setDisplaySize(
        TEST_WORLD.width + CAMERA_WORLD_PADDING_PX * 2,
        TEST_WORLD.height + CAMERA_WORLD_PADDING_PX * 2,
      )
      .setAlpha(0.86)
      .setDepth(-99);
    for (const point of borderBandPoints(26, TEST_WORLD.width, TEST_WORLD.height, 90, scenery))
      plantCorruptedTree(this, point.x, point.y, scenery);
    const houseBodies = HOUSE_OBSTACLES.map((house) =>
      paintHouse(this, house.x, house.y, house.width, house.height),
    );
    addAmbientSpores(this, TEST_WORLD.width, TEST_WORLD.height);
    createPixelLabAnimations(this, this.character);
    if (this.layeredCharacter !== undefined)
      for (const layer of layeredCharacterSheets(this.layeredCharacter))
        createPixelLabAnimations(this, layer);
    for (const character of enemyCharactersToLoad()) createPixelLabAnimations(this, character);
    this.physics.world.setBounds(0, 0, TEST_WORLD.width, TEST_WORLD.height);
    this.shadow = this.add
      .ellipse(PLAYER_SPAWN.x, PLAYER_SPAWN.y, 34, 12, 0x000000, 0.4)
      .setDepth(159);
    this.player = this.physics.add
      .sprite(PLAYER_SPAWN.x, PLAYER_SPAWN.y, pixelLabKey(this.character, 'idle', 'south'))
      .setOrigin(this.character.origin.x, this.character.origin.y);
    this.player
      .setCollideWorldBounds(true)
      .setBodySize(26, 18)
      .setOffset(33, 61)
      .setDepth(this.player.y);
    // Houses block the Guardian's own body; enemies still path through them freely for now (Paso
    // 8's navigation owns enemy-vs-geometry collision, not this scene).
    for (const houseBody of houseBodies) {
      this.physics.add.existing(houseBody, true);
      this.physics.add.collider(this.player, houseBody);
    }
    const layered = this.layeredCharacter;
    if (layered !== undefined) {
      // Same origin, same animation keys, one depth step apart: the three sprites move as one.
      this.armorLayerSprite = this.add
        .sprite(this.player.x, this.player.y, pixelLabKey(layered.armor, 'idle', 'south'))
        .setOrigin(layered.armor.origin.x, layered.armor.origin.y)
        .setVisible(false);
      this.weaponLayerSprite = this.add
        .sprite(this.player.x, this.player.y, pixelLabKey(layered.weapon, 'idle', 'south'))
        .setOrigin(layered.weapon.origin.x, layered.weapon.origin.y)
        .setVisible(false);
    }
    this.armorVisual = this.add
      .container(this.player.x, this.player.y)
      .setDepth(this.player.y + 0.1);
    this.weaponVisual = this.add
      .container(this.player.x, this.player.y)
      .setDepth(this.player.y + 0.2);
    this.renderEquipmentVisuals();
    this.createInteractionVisuals();
    const initialEnemyCount = this.stressEnabled
      ? this.enemyStressCount
      : this.forestWavePlan.spawns.length;
    this.enemySpawnConfig = createEnemySpawnConfig(
      initialEnemyCount,
      this.stressEnabled
        ? ENEMY_SPAWN_CONFIG.composition
        : this.forestWavePlan.spawns.map(({ archetype }) => archetype),
    );
    this.enemyProjectileVisuals = new PooledArrowVisuals(this, VFX_POOL_CAPACITY.projectile);
    this.enemyTelegraphVisuals = new PooledArcVisuals(this, VFX_POOL_CAPACITY.telegraph);
    this.burstVisuals = new PooledArcVisuals(this, VFX_POOL_CAPACITY.burst);
    this.abilityVisuals = new PooledArcVisuals(this, VFX_POOL_CAPACITY.ability);
    this.spawnDirector = new EnemySpawnDirector(
      this.enemySpawnConfig,
      createSeededRandom(this.runSeed ^ 0x51f15e),
    );
    this.applyEnemySpawnActions(
      this.spawnDirector.initialize(this.combatNow(), this.spawnSafetyCheck()),
    );
    this.hazardFill = this.add
      .circle(HAZARD_POSITION.x, HAZARD_POSITION.y, HAZARD.radiusPx, 0x8a3ffc, 0.22)
      .setDepth(3)
      .setScale(0);
    this.hazardIndicator = this.add
      .circle(HAZARD_POSITION.x, HAZARD_POSITION.y, HAZARD.radiusPx, 0x8a3ffc, 0)
      .setStrokeStyle(2, 0x8a3ffc, 0)
      .setDepth(4);
    this.wasd = this.input.keyboard!.addKeys('W,A,S,D') as Record<
      'W' | 'A' | 'S' | 'D',
      Phaser.Input.Keyboard.Key
    >;
    this.cameras.main
      .startFollow(this.player, true, CAMERA_FOLLOW_LERP, CAMERA_FOLLOW_LERP, 0, 0)
      .setDeadzone(CAMERA_FOLLOW_DEADZONE, CAMERA_FOLLOW_DEADZONE)
      .setBounds(
        -CAMERA_WORLD_PADDING_PX,
        -CAMERA_WORLD_PADDING_PX,
        TEST_WORLD.width + CAMERA_WORLD_PADDING_PX * 2,
        TEST_WORLD.height + CAMERA_WORLD_PADDING_PX * 2,
      )
      .setZoom(CAMERA_ZOOM);
    addVignette(this, this.cameras.main.width, this.cameras.main.height, CAMERA_ZOOM);
    this.feedback = new FeedbackPool(this);
    this.game.canvas.dataset.characterClass = this.characterClass;
    this.game.canvas.dataset.characterVisual = this.character.id;
    this.game.canvas.dataset.characterLayered = this.layeredCharacter?.id ?? '';
    this.game.canvas.addEventListener('contextmenu', this.suppressContextMenu);
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerdown', this.onPointerDown, this);
    this.input.keyboard!.on('keydown-Q', this.onWhirlwind, this);
    this.input.keyboard!.on('keydown-E', this.onIronSkin, this);
    this.input.keyboard!.on('keydown-F', this.onInteract, this);
    this.input.keyboard!.on('keydown-X', this.drinkPotion, this);
    this.input.keyboard!.on('keydown-ESC', this.togglePause, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.releaseInput, this);
    this.lastEnemyTickAt = this.combatNow();
    this.game.canvas.dataset.enemyStress = String(this.enemyStressCount);
    this.game.canvas.dataset.forestWaveIndex = String(this.forestWaveIndex);
    this.game.canvas.dataset.forestWaveSize = String(this.forestWavePlan.tuning.waveSize);
    this.game.canvas.dataset.interactionLedgerSize = String(this.interactionLedger.receipts.length);
    this.publishEquipmentVisualDebug();
    this.updateInteractionPrompt();
    if (this.stressEnabled) this.startStressFrameProbe();
    this.publishStressMetrics(true);
    this.publishHud(true);
  }
  public override update(): void {
    if (this.paused) return;
    const frameStartedAt = this.stressEnabled ? performanceNow() : undefined;
    const now = this.combatNow();
    const snapshot = this.controller.snapshot();
    const downed = snapshot.downed;
    const enemyTickFrom = this.lastEnemyTickAt;
    let rawX = (this.wasd.D.isDown ? 1 : 0) - (this.wasd.A.isDown ? 1 : 0);
    let rawY = (this.wasd.S.isDown ? 1 : 0) - (this.wasd.W.isDown ? 1 : 0);
    if (downed) {
      rawX = 0;
      rawY = 0;
    } else if (this.autoBattle) {
      const target = this.nearestAliveDummy();
      if (target === undefined) {
        rawX = 0;
        rawY = 0;
      } else {
        const dx = target.position.x - this.player.x;
        const dy = target.position.y - this.player.y;
        this.facing = motionFromInput(dx, dy, this.facing).direction;
        const rangePx = guardianCombatTuning.abilities.slash.rangePx ?? 78;
        const inRange = Math.hypot(dx, dy) <= rangePx;
        rawX = inRange ? 0 : dx;
        rawY = inRange ? 0 : dy;
        if (inRange && snapshot.cooldownRemainingMs.slash <= 0) this.activate('slash');
      }
    }
    if (downed) {
      rawX = 0;
      rawY = 0;
      this.state = resolveCharacterState(this.state, 'downed');
      this.player.setTint(0x6d6175).setAlpha(0.72).setAngle(-90);
    } else if (now < this.guardianStunnedUntil) {
      rawX = 0;
      rawY = 0;
      this.player.setTint(0xff9a72);
      this.player.setAlpha(1).setAngle(0);
    } else {
      this.player.clearTint().setAlpha(1).setAngle(0);
    }
    const motion = motionFromInput(rawX, rawY, this.facing);
    this.facing = motion.direction;
    const locked =
      !downed &&
      now < this.actionEndsAt &&
      (this.state === 'attacking' || this.state === 'casting');
    this.state = downed
      ? resolveCharacterState(this.state, 'downed')
      : now < this.actionEndsAt
        ? this.state
        : motion.state;
    const boundedPlayerPosition = clampWorldPosition(this.player);
    this.player
      .setVelocity(
        downed || locked ? 0 : motion.x * 220 * snapshot.movementMultiplier,
        downed || locked ? 0 : motion.y * 220 * snapshot.movementMultiplier,
      )
      .setPosition(boundedPlayerPosition.x, boundedPlayerPosition.y)
      .setDepth(this.player.y);
    this.syncLayers();
    this.updateInteractionPrompt();
    this.playSynchronizedAnimations();
    this.processEnemyLifecycle(now);
    this.stepEnemies(now);
    this.updateEnemyAbilities(enemyTickFrom, now);
    this.handleEvents(this.controller.update({ x: this.player.x, y: this.player.y }));
    this.updateHazard(now);
    this.publishHud(false);
    this.recordStressFrame(frameStartedAt);
  }
  public pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.pausedAt = this.time.now;
    this.player.setVelocity(0, 0);
    this.publishHud(true);
  }
  public resume(): void {
    if (!this.paused) return;
    if (this.pausedAt !== undefined) this.pausedDuration += this.time.now - this.pausedAt;
    this.pausedAt = undefined;
    this.paused = false;
    this.publishHud(true);
  }
  public setConnection(connection: RuntimeConnection): void {
    this.connection = connection;
    this.publishHud(true);
  }
  public setDamageNumbers(enabled: boolean): void {
    this.showDamageNumbers = enabled;
  }
  public setAudioSettings(settings: GameSettings): void {
    if (this.audioReleased) return;
    this.audio.setSettings(settings);
  }

  /** Called by the React-owned runtime before Phaser is destroyed. */
  public stopAudio(): void {
    if (this.audioReleased) return;
    this.audioReleased = true;
    this.audio.destroy();
  }
  public setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    this.feedback?.setReducedMotion(enabled);
    if (this.ironSkinAura === undefined) return;
    this.tweens.killTweensOf(this.ironSkinAura);
    this.ironSkinAura.setAlpha(0.6);
    if (!enabled)
      this.tweens.add({
        targets: this.ironSkinAura,
        alpha: { from: 0.4, to: 0.85 },
        duration: durationForMotion('buff', false),
        yoyo: true,
        repeat: -1,
      });
  }
  public setAutoBattle(enabled: boolean): void {
    this.autoBattle = enabled;
  }
  public setEquipmentVisual(loadout: EquipmentVisualLoadout): void {
    this.equipmentVisual = Object.freeze({
      weapon: loadout.weapon,
      armor: Object.freeze([...loadout.armor]),
    });
    if (this.player === undefined) return;
    this.renderEquipmentVisuals();
    this.syncLayers();
    this.publishEquipmentVisualDebug();
  }
  public applyServerEvent(raw: unknown): boolean {
    const event = parseServerEvent(raw);
    if (event === undefined) return false;
    if (event.type === 'REWARD_GRANTED') {
      const delta = Number(event.payload.experienceDelta);
      if (Number.isSafeInteger(delta) && delta > 0)
        this.experienceEarned = Math.min(Number.MAX_SAFE_INTEGER, this.experienceEarned + delta);
    }
    this.presentation = appendPresentation(this.presentation, serverEventToPresentation(event));
    this.publishHud(true);
    return true;
  }
  public activateAbility(ability: RuntimeAbility): void {
    if (this.controller === undefined) return;
    this.activate(ability);
  }
  /**
   * Applied whenever a fresh progression snapshot arrives, including after a level-up mid-run, so
   * combat reflects the character the server knows about. Held until the scene exists because
   * GameIsland can call it before Phaser finishes booting.
   */
  public setCharacterProfile(profile: {
    level: number;
    strength: number;
    dexterity: number;
    vitality: number;
    armorBonus?: number;
    physicalDamageBonus?: number;
    maxHealthBonus?: number;
    criticalChanceBonus?: number;
  }): void {
    this.characterProfile = profile;
    if (this.controller === undefined) return;
    this.controller.applyCharacterProfile(profile);
    this.publishHud(true);
  }
  /**
   * Spends a charge only when the sip actually heals: on cooldown, out of charges, downed or
   * already at full health it is a no-op, so a mistimed click never silently burns a potion.
   */
  public drinkPotion(): void {
    if (this.controller === undefined || this.paused) return;
    const now = this.combatNow();
    if (this.potionCharges <= 0 || now < this.potionReadyAt) return;
    const restored = this.controller.healGuardian(
      this.controller.snapshot().maxHealth * POTION.healFraction,
    );
    if (restored === 0) return;
    this.potionCharges -= 1;
    this.potionReadyAt = now + POTION.cooldownMs;
    this.burstAt(this.player.x, this.player.y - PROJECTILE_VISUAL_CHEST_LIFT_PX, 0x6fe7a1);
    this.presentation = appendPresentation(this.presentation, {
      loot: [{ id: `potion:${now}`, label: `+${restored} vida`, tone: 'accent' }],
      notifications: [],
    });
    this.publishHud(true);
  }
  private createInteractionVisuals(): void {
    for (const target of FOREST_PREVIEW_INTERACTION_TARGETS) {
      const accent =
        target.kind === 'chest' ? 0xe0bf52 : target.kind === 'revive' ? 0x8a3ffc : 0x79b98a;
      const container = this.add
        .container(target.position.x, target.position.y)
        .setDepth(target.position.y + 2);
      const shadow = this.add.ellipse(0, 11, 42, 13, 0x000000, 0.24);
      const body = this.add.rectangle(0, 0, 30, 24, accent, 0.8).setStrokeStyle(2, 0xf5d486, 0.8);
      const marker = this.add.circle(0, -22, 5, accent, 0.95);
      const label = this.add
        .text(0, 28, interactionKindLabel(target), {
          color: '#f5d486',
          fontSize: '11px',
          stroke: '#131713',
          strokeThickness: 3,
        })
        .setOrigin(0.5);
      container.add([shadow, body, marker, label]);
      this.interactionVisuals.set(target.interactionId, container);
    }
    this.interactionPrompt = this.add
      .text(0, 0, '', {
        color: '#f5d486',
        fontSize: '13px',
        fontStyle: 'bold',
        stroke: '#131713',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(142)
      .setVisible(false);
    this.interactionFeedbackText = this.add
      .text(0, 0, '', {
        color: '#f5d486',
        fontSize: '14px',
        fontStyle: 'bold',
        stroke: '#131713',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(143)
      .setVisible(false);
  }
  private updateInteractionPrompt(): void {
    if (this.interactionPrompt === undefined || this.player === undefined) return;
    const target = nearestInteractionTarget(
      FOREST_PREVIEW_INTERACTION_TARGETS,
      { x: this.player.x, y: this.player.y },
      this.interactionLedger,
      this.combatNow(),
      this.controller.snapshot().downed ? 'downed' : 'active',
    );
    this.game.canvas.dataset.interactionTarget = target?.interactionId ?? '';
    if (target === undefined) {
      this.interactionPrompt.setVisible(false);
      this.game.canvas.dataset.interactionPrompt = '';
      return;
    }
    const prompt = target.ui?.prompt ?? `[F] ${interactionKindLabel(target)}`;
    this.interactionPrompt
      .setText(prompt)
      .setPosition(this.player.x, this.player.y - 54)
      .setVisible(true);
    this.game.canvas.dataset.interactionPrompt = prompt;
  }
  private onInteract(): void {
    if (this.paused || this.player === undefined) return;
    const actorPosition = { x: this.player.x, y: this.player.y };
    const target = nearestInteractionTarget(
      FOREST_PREVIEW_INTERACTION_TARGETS,
      actorPosition,
      this.interactionLedger,
      this.combatNow(),
      this.controller.snapshot().downed ? 'downed' : 'active',
    );
    if (target === undefined) {
      this.game.canvas.dataset.interactionLastReason = 'out_of_range';
      this.showInteractionFeedback('Acercate a un objetivo para interactuar');
      return;
    }
    const request = {
      operationId: `${this.runSeed}:interaction:${++this.interactionSequence}`,
      actorId: 'character:local',
      targetId: target.interactionId,
      requestedAtMs: Math.max(0, this.combatNow()),
    };
    const result = applyInteraction(
      this.interactionLedger,
      FOREST_PREVIEW_INTERACTION_TARGETS,
      request,
      {
        actorPosition,
        actorState: this.controller.snapshot().downed ? 'downed' : 'active',
        nowMs: Math.max(0, this.combatNow()),
        interruptedByDamage: false,
      },
    );
    if (result.receipt.accepted) {
      this.interactionLedger = result.ledger;
      this.refreshInteractionVisuals();
    }
    this.game.canvas.dataset.interactionLedgerSize = String(this.interactionLedger.receipts.length);
    this.game.canvas.dataset.interactionLastResult = result.receipt.accepted
      ? 'accepted'
      : 'rejected';
    this.game.canvas.dataset.interactionLastReason = result.receipt.reason ?? '';
    this.showInteractionFeedback(interactionFeedback(result.receipt));
    this.updateInteractionPrompt();
  }
  private refreshInteractionVisuals(): void {
    for (const target of FOREST_PREVIEW_INTERACTION_TARGETS) {
      if (!target.oneShot) continue;
      const consumed = this.interactionLedger.consumedTargetIds.includes(target.interactionId);
      this.interactionVisuals.get(target.interactionId)?.setAlpha(consumed ? 0.38 : 1);
    }
  }
  private showInteractionFeedback(message: string): void {
    if (this.interactionFeedbackText === undefined || this.player === undefined) return;
    this.interactionFeedbackTween?.stop();
    this.interactionFeedbackText
      .setText(message)
      .setPosition(this.player.x, this.player.y - 78)
      .setAlpha(1)
      .setVisible(true);
    this.interactionFeedbackTween = this.tweens.add({
      targets: this.interactionFeedbackText,
      y: this.player.y - 96,
      alpha: 0,
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => this.interactionFeedbackText.setVisible(false),
    });
  }
  /** Closest still-alive target — the only targeting rule the auto-battle intervention layer
   * needs while the local scene has no aggro/threat system of its own. */
  private nearestAliveDummy(): DummyTarget | undefined {
    const alive = this.controller.getTargets().filter((target) => target.health > 0);
    return alive.reduce<DummyTarget | undefined>((closest, target) => {
      if (closest === undefined) return target;
      const closer =
        squaredDistance(this.player, target.position) <
        squaredDistance(this.player, closest.position);
      return closer ? target : closest;
    }, undefined);
  }
  /** Applies pure spawn/cleanup commands to Phaser and the combat adapter in a fixed order. */
  private processEnemyLifecycle(now: number): void {
    if (this.spawnDirector === undefined) return;
    this.applyEnemySpawnActions(this.spawnDirector.tick(now, this.spawnSafetyCheck()));
  }
  /** Builds the next level plan and reconfigures the existing director without resetting IDs. */
  private advanceForestWave(level: number): void {
    this.forestWaveIndex += 1;
    const seed = seedFromString(`${this.forestWaveSeed}:${level}:${this.forestWaveIndex}`);
    this.forestWavePlan = createForestWave(
      GAME_DATA.endlessForest,
      level,
      this.forestWaveIndex,
      seed,
      composeWaveArchetypes(level),
    );
    const composition = this.stressEnabled
      ? ENEMY_SPAWN_CONFIG.composition
      : this.forestWavePlan.spawns.map(({ archetype }) => archetype);
    const activeCount = this.stressEnabled
      ? this.enemyStressCount
      : this.forestWavePlan.spawns.length;
    this.spawnDirector.configureWave({
      minActive: activeCount,
      maxActive: activeCount,
      composition,
    });
    this.game.canvas.dataset.forestWaveIndex = String(this.forestWaveIndex);
    this.game.canvas.dataset.forestWaveSize = String(this.forestWavePlan.tuning.waveSize);
    this.showForestLevelUp(level);
  }
  /** Level-up feedback is presentation-only; progression and wave configuration already resolved. */
  private showForestLevelUp(level: number): void {
    const banner = this.add
      .text(this.player.x, this.player.y - 82, `BOSQUE · NIVEL ${level}`, {
        color: '#f5d486',
        fontSize: '20px',
        fontStyle: 'bold',
        stroke: '#131713',
        strokeThickness: 5,
      })
      .setOrigin(0.5)
      .setDepth(130);
    if (!this.reducedMotion) this.cameras.main.flash(180, 138, 63, 252, false);
    this.tweens.add({
      targets: banner,
      y: banner.y - 24,
      alpha: 0,
      duration: 900,
      onComplete: () => banner.destroy(),
    });
  }
  private applyEnemySpawnActions(actions: readonly EnemySpawnAction<EnemyVisualId>[]): void {
    for (const action of actions) {
      if (action.type === 'cleanup') {
        this.removeEnemy(action.instanceId);
        continue;
      }
      if (action.type === 'spawn')
        this.addDummy(action.instanceId, action.position.x, action.position.y, action.archetype);
    }
  }
  /**
   * Safe spawn predicate owned by the Phaser adapter: the director chooses only configured points,
   * while this layer rejects world bounds, the Guardian and already-live enemies. Decorative
   * scenery intentionally never participates in movement collision in the combat preview.
   */
  private spawnSafetyCheck(): EnemySpawnSafetyCheck {
    return (candidate, activePositions) => {
      const insideWorld =
        candidate.x >= TEST_WORLD.margin &&
        candidate.y >= TEST_WORLD.margin &&
        candidate.x <= TEST_WORLD.width - TEST_WORLD.margin &&
        candidate.y <= TEST_WORLD.height - TEST_WORLD.margin;
      if (!insideWorld) return false;
      if (
        Math.hypot(candidate.x - this.player.x, candidate.y - this.player.y) <
        (this.enemySpawnConfig?.safeSpawnRadiusPx ?? ENEMY_SPAWN_CONFIG.safeSpawnRadiusPx)
      )
        return false;
      return activePositions.every(
        (position) =>
          Math.hypot(candidate.x - position.x, candidate.y - position.y) >= ENEMY_MIN_SEPARATION_PX,
      );
    };
  }
  private removeEnemy(id: string): void {
    this.controller.removeDummy(id);
    this.enemies.delete(id);
    this.enemyVisualLatches.delete(id);
    this.enemyAnimationActionTokens.delete(id);
    this.enemyAnimationSignatures.delete(id);
    this.removeEnemyEffectsOwnedBy(id);
    const visual = this.dummyVisuals.get(id);
    if (visual !== undefined) {
      this.tweens.killTweensOf(visual);
      visual.destroy();
      this.dummyVisuals.delete(id);
    }
    const shadow = this.dummyShadows.get(id);
    if (shadow !== undefined) {
      this.tweens.killTweensOf(shadow);
      shadow.destroy();
      this.dummyShadows.delete(id);
    }
  }
  private removeEnemyEffectsOwnedBy(ownerId: string): void {
    for (const [id, effect] of this.enemyProjectiles)
      if (effect.ownerId === ownerId) {
        this.enemyProjectileVisuals.release(effect.visual);
        this.enemyProjectiles.delete(id);
      }
    for (const [id, effect] of this.enemyTelegraphs)
      if (effect.ownerId === ownerId) {
        this.enemyTelegraphVisuals.release(effect.visual);
        this.enemyTelegraphs.delete(id);
      }
  }
  /** Maps the pure AI state plus a temporary presentation latch to generated animation art. */
  private playEnemyAnimation(id: string, aiState: EnemyAiState, now: number): void {
    const enemy = this.enemies.get(id);
    const sprite = this.dummyVisuals.get(id);
    if (enemy === undefined || sprite === undefined) return;
    const character = ENEMY_VISUALS[enemy.visual].character ?? this.character;
    const requestedState = enemyAiVisualState(
      aiState,
      enemyAbilityVisualMode(enemy.abilityProfile),
    );
    const visualState = activeEnemyVisualState(
      requestedState,
      this.enemyVisualLatches.get(id),
      now,
    );
    const animation = pickAnimation(character, visualState);
    const { sheet, flipX } = mapDirection(
      motionFromInput(
        this.player.x - enemy.sim.position.x,
        this.player.y - enemy.sim.position.y,
        'down',
      ).direction,
    );
    const key = pixelLabKey(character, animation, sheet);
    sprite.setFlipX(flipX);
    const actionToken = this.enemyAnimationActionTokens.get(id) ?? 0;
    const signature = `${visualState}:${key}:${actionToken}`;
    if (this.enemyAnimationSignatures.get(id) === signature) return;
    this.enemyAnimationSignatures.set(id, signature);
    sprite.anims.play(key, true);
  }
  private bumpEnemyAnimationAction(id: string): void {
    this.enemyAnimationActionTokens.set(id, (this.enemyAnimationActionTokens.get(id) ?? 0) + 1);
  }
  private requestEnemyVisualState(
    id: string,
    state: EnemyVisualLatch['state'],
    now: number,
    durationMs?: number,
  ): void {
    const untilMs = durationMs === undefined ? undefined : now + durationMs;
    const next = latchEnemyVisualState(this.enemyVisualLatches.get(id), { state, untilMs });
    this.enemyVisualLatches.set(id, next);
    const enemy = this.enemies.get(id);
    if (enemy !== undefined) this.playEnemyAnimation(id, enemy.sim.aiState, now);
  }
  /** Drive every living enemy's AI over the combat-clock window that elapsed since the last tick:
   *  perception → decideEnemyState (inside advanceEnemy) → steering velocity → new position,
   *  pushed back into both the dummy's combat record and its sprite. Enemies that the FSM leaves in
   *  `attack` and are past their per-enemy cooldown land a hit on the Guardian via the same
   *  `applyIncomingDamage` the hazard uses, so the existing self-damage feedback (shake + number)
   *  fires for free. The clock window comes from `combatNow()` (pause-aware), never `Date.now()`. */
  private stepEnemies(now: number): void {
    const fromMs = this.lastEnemyTickAt;
    const toMs = now;
    this.lastEnemyTickAt = toMs;
    if (this.enemies.size === 0 || toMs <= fromMs) return;
    const playerPos = { x: this.player.x, y: this.player.y };
    const targets = this.controller.getTargets();
    let incoming: CombatEvent[] = [];
    for (const target of targets) {
      if (target.health <= 0) continue;
      const enemy = this.enemies.get(target.id);
      if (enemy === undefined) continue;
      // Neighbour list for separation: positions of every *other* living enemy this frame.
      const neighbors = targets
        .filter((candidate) => candidate.health > 0 && candidate.id !== target.id)
        .map((candidate) => ({ position: { x: candidate.position.x, y: candidate.position.y } }));
      advanceEnemy(
        enemy,
        playerPos,
        neighbors,
        { fromMs, toMs },
        false,
        now >= enemy.nextAbilityAt,
      );
      enemy.sim = { ...enemy.sim, position: clampWorldPosition(enemy.sim.position) };
      this.controller.repositionDummy(target.id, enemy.sim.position);
      this.spawnDirector.updatePosition(target.id, enemy.sim.position);
      const usesAbility = wantsToUseAbility(enemy, now);
      const landsBasicAttack = wantsToAttack(enemy, now);
      if (usesAbility || landsBasicAttack) this.bumpEnemyAnimationAction(target.id);
      this.playEnemyAnimation(target.id, enemy.sim.aiState, now);
      if (usesAbility) {
        this.resolveEnemyAbility(enemy, now);
        scheduleNextAbility(enemy, now);
        continue;
      }
      if (landsBasicAttack) {
        incoming = incoming.concat(this.controller.applyIncomingDamage(enemy.hitDamage, now));
        scheduleNextAttack(enemy, now);
      }
    }
    if (incoming.length > 0) {
      this.handleEvents(incoming);
      this.publishHud(true);
    }
  }
  /** Resolves one behaviour-derived profile; the runtime only translates pure effects to Phaser. */
  private resolveEnemyAbility(enemy: EnemyRecord, now: number): void {
    const guardian = this.controller.guardianAbilityTarget({ x: this.player.x, y: this.player.y });
    const allies: EnemyAbilityTarget[] = this.controller
      .getTargets()
      .filter((target) => target.id !== enemy.id && target.health > 0)
      .map((target) => ({
        id: target.id,
        position: target.position,
        armor: target.armor,
        health: target.health,
        maxHealth: target.maxHealth,
      }));
    const targets = enemy.abilityProfile.kind === 'heal_allies' ? allies : [guardian];
    const tuning = GAME_DATA.enemyTuning.find((entry) => entry.enemyId === enemy.visual);
    if (tuning === undefined) return;
    const effects = resolveEnemyAction(enemy.abilityProfile, targets, {
      position: enemy.sim.position,
      attacker: enemy.attacker,
      abilityMultiplier: enemy.abilityMultiplier,
      telegraphMs: tuning.telegraphMs,
      atMs: now,
      random: this.enemyAbilityRandom,
      nextId: () => this.nextEnemyEffectId(enemy.id),
    });
    this.applyEnemyAbilityEffects(enemy.id, enemy.attacker, effects, now);
  }
  private nextEnemyEffectId(ownerId: string): string {
    return `enemy-effect:${ownerId}:${this.enemyAbilitySequence++}`;
  }
  private applyEnemyAbilityEffects(
    ownerId: string,
    attacker: AttackerStats,
    effects: readonly EnemyAbilityEffect[],
    now: number,
  ): void {
    for (const effect of effects) {
      if (effect.type === 'spawn_projectile') {
        this.addEnemyProjectile(ownerId, attacker, effect.projectile);
        continue;
      }
      if (effect.type === 'open_telegraph') {
        this.addEnemyTelegraph(ownerId, attacker, effect.telegraph);
        continue;
      }
      if (effect.type === 'damage' && effect.targetId === GUARDIAN_TARGET_ID) {
        this.handleEvents(this.controller.applyResolvedIncomingDamage(effect.result.amount, now));
        continue;
      }
      if (effect.type === 'heal' && this.controller.healDummy(effect.targetId, effect.amount)) {
        const target = this.controller
          .getTargets()
          .find((candidate) => candidate.id === effect.targetId);
        if (target !== undefined) this.burstAt(target.position.x, target.position.y, 0x6fe7a1);
        continue;
      }
      if (effect.type === 'stun' && effect.targetId === GUARDIAN_TARGET_ID) {
        this.guardianStunnedUntil = Math.max(this.guardianStunnedUntil, now + effect.durationMs);
      }
    }
  }
  private addEnemyProjectile(
    ownerId: string,
    attacker: AttackerStats,
    projectile: EnemySpawnedProjectile,
  ): void {
    // The arrow leaves the archer's chest, not its feet: lift the visual only (see
    // PROJECTILE_VISUAL_CHEST_LIFT_PX) so the shot reads as aimed at the Guardian's torso.
    const visualConfig = {
      x: projectile.origin.x,
      y: projectile.origin.y - PROJECTILE_VISUAL_CHEST_LIFT_PX,
      color: 0xffa85c,
      alpha: 0.9,
      depth: 8,
      rotation: Math.atan2(projectile.direction.y, projectile.direction.x),
    };
    let visual = this.enemyProjectileVisuals.acquire(visualConfig);
    if (visual === undefined && this.enemyProjectiles.size > 0) {
      const oldest = this.enemyProjectiles.keys().next().value;
      if (oldest !== undefined) {
        const previous = this.enemyProjectiles.get(oldest);
        if (previous !== undefined) this.enemyProjectileVisuals.release(previous.visual);
        this.enemyProjectiles.delete(oldest);
      }
      visual = this.enemyProjectileVisuals.acquire(visualConfig);
    }
    if (visual === undefined) return;
    this.enemyProjectiles.set(projectile.id, { ownerId, projectile, attacker, visual });
  }
  private addEnemyTelegraph(
    ownerId: string,
    attacker: AttackerStats,
    telegraph: EnemySpawnedTelegraph,
  ): void {
    const color = telegraph.stunMs === undefined ? 0xf0a35e : 0x8a3ffc;
    let visual = this.enemyTelegraphVisuals.acquire({
      x: telegraph.center.x,
      y: telegraph.center.y,
      radius: telegraph.radiusPx,
      color,
      alpha: 0.16,
      depth: 5,
      stroke: { width: 2, color, alpha: 0.75 },
    });
    if (visual === undefined && this.enemyTelegraphs.size > 0) {
      const oldest = this.enemyTelegraphs.keys().next().value;
      if (oldest !== undefined) {
        const previous = this.enemyTelegraphs.get(oldest);
        if (previous !== undefined) this.enemyTelegraphVisuals.release(previous.visual);
        this.enemyTelegraphs.delete(oldest);
      }
      visual = this.enemyTelegraphVisuals.acquire({
        x: telegraph.center.x,
        y: telegraph.center.y,
        radius: telegraph.radiusPx,
        color,
        alpha: 0.16,
        depth: 5,
        stroke: { width: 2, color, alpha: 0.75 },
      });
    }
    if (visual === undefined) return;
    this.enemyTelegraphs.set(telegraph.id, { ownerId, telegraph, attacker, visual });
  }
  /** Advances bounded projectile/telegraph entities and resolves each impact once. */
  private updateEnemyAbilities(fromMs: number, toMs: number): void {
    if (toMs <= fromMs || this.enemyAbilityRandom === undefined) return;
    const guardian = this.controller.guardianAbilityTarget({ x: this.player.x, y: this.player.y });
    for (const [id, effect] of this.enemyProjectiles) {
      if (projectileHitsTarget(effect.projectile, toMs, guardian, effect.projectile.hitRadiusPx)) {
        const result = resolveAttack(
          effect.attacker,
          defenderForEnemyTarget(guardian),
          effect.projectile.abilityMultiplier,
          this.enemyAbilityRandom,
        );
        this.applyEnemyAbilityEffects(
          effect.ownerId,
          effect.attacker,
          [{ type: 'damage', targetId: GUARDIAN_TARGET_ID, result }],
          toMs,
        );
        this.burstAt(this.player.x, this.player.y - PROJECTILE_VISUAL_CHEST_LIFT_PX, 0xffa85c);
        this.enemyProjectileVisuals.release(effect.visual);
        this.enemyProjectiles.delete(id);
        continue;
      }
      if (hasProjectileExpired(effect.projectile, toMs)) {
        this.enemyProjectileVisuals.release(effect.visual);
        this.enemyProjectiles.delete(id);
        continue;
      }
      const position = projectilePositionAt(effect.projectile, toMs);
      effect.visual
        .setPosition(position.x, position.y - PROJECTILE_VISUAL_CHEST_LIFT_PX)
        .setRotation(Math.atan2(effect.projectile.direction.y, effect.projectile.direction.x));
    }
    for (const [id, effect] of this.enemyTelegraphs) {
      const active = isTelegraphActive(effect.telegraph, toMs);
      const elapsed = Math.max(0, toMs - effect.telegraph.startedAt);
      const progress = Math.min(1, elapsed / effect.telegraph.telegraphMs);
      effect.visual.setAlpha(active ? 0.16 + progress * 0.42 : 0.08);
      if (!telegraphResolvedThisTick(effect.telegraph, fromMs, toMs)) continue;
      const effects = resolveEnemyTelegraph(
        effect.telegraph,
        [guardian],
        effect.attacker,
        this.enemyAbilityRandom,
      );
      this.applyEnemyAbilityEffects(effect.ownerId, effect.attacker, effects, toMs);
      this.burstAt(effect.telegraph.center.x, effect.telegraph.center.y, 0xf0a35e);
      this.enemyTelegraphVisuals.release(effect.visual);
      this.enemyTelegraphs.delete(id);
    }
  }
  private addDummy(id: string, x: number, y: number, visual: EnemyVisualId): void {
    // maxHealth/armor come from the catalog tuning now (was a flat 220/220 ignoring balance).
    const entry = GAME_DATA.enemyTuning.find((e) => e.enemyId === visual);
    if (entry === undefined) throw new Error(`No catalog tuning for enemy "${visual}"`);
    const { maxHealth, armor } = entry;
    this.controller.addDummy({ id, position: { x, y }, armor, health: maxHealth, maxHealth });
    this.enemies.set(id, createEnemy(id, visual, { x, y }));
    // An enemy with its own generated character renders its real frames; otherwise it reuses the
    // Guardian's frames tinted per enemy type (see enemy-visuals.ts) — no extra generation spent.
    const character = ENEMY_VISUALS[visual].character ?? this.character;
    // Scale is presentation only: the collision body, hitboxes and combat reach all stay driven by
    // the catalog, so a bigger-looking beast is not a bigger target.
    const scale = ENEMY_VISUALS[visual].scale ?? 1;
    this.dummyShadows.set(
      id,
      this.add.ellipse(x, y + 2, 34 * scale, 12 * scale, 0x000000, 0.4).setDepth(y - 1),
    );
    const sprite = this.add
      .sprite(x, y, pixelLabKey(character, 'idle', 'south'))
      .setOrigin(character.origin.x, character.origin.y)
      .setScale(scale)
      .setDepth(y);
    if (ENEMY_VISUALS[visual].character === undefined) sprite.setTint(ENEMY_VISUALS[visual].tint);
    sprite.play(pixelLabKey(character, 'idle', 'south'));
    this.dummyVisuals.set(id, sprite);
  }
  /** Telegraphs, then resolves, one static periodic pulse — data-driven, no detection/nav/aggro. */
  private updateHazard(now: number): void {
    const telegraphStartsAt = this.hazardPulseAt - HAZARD.telegraphMs;
    const telegraphing = now >= telegraphStartsAt && now < this.hazardPulseAt;
    const progress = telegraphing ? (now - telegraphStartsAt) / HAZARD.telegraphMs : 0;
    this.hazardIndicator.setStrokeStyle(2, 0x8a3ffc, telegraphing ? 0.35 + progress * 0.5 : 0);
    this.hazardFill.setScale(telegraphing ? progress : 0);
    if (now < this.hazardPulseAt) return;
    this.hazardPulseAt = now + HAZARD.periodMs;
    this.flashHazard();
    const distance = Math.hypot(
      this.player.x - HAZARD_POSITION.x,
      this.player.y - HAZARD_POSITION.y,
    );
    if (distance <= HAZARD.radiusPx)
      this.handleEvents(this.controller.applyIncomingDamage(HAZARD.damage, now));
  }
  /** One expanding ring per resolved pulse, acquired from the bounded burst pool. */
  private flashHazard(): void {
    const descriptor = combatVfx('danger');
    const flash = this.burstVisuals.acquire({
      x: HAZARD_POSITION.x,
      y: HAZARD_POSITION.y,
      radius: HAZARD.radiusPx,
      color: descriptor.color,
      alpha: this.reducedMotion ? 0.24 : 0.45,
      depth: 5,
      stroke: { width: descriptor.strokeWidth, color: descriptor.color, alpha: 0.7 },
    });
    if (flash === undefined) return;
    this.tweens.add({
      targets: flash,
      scale: this.reducedMotion ? descriptor.radius : descriptor.radius * descriptor.scale,
      alpha: 0,
      duration: durationForMotion('danger', this.reducedMotion),
      onComplete: () => this.burstVisuals.release(flash),
    });
  }
  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    this.facing =
      Math.abs(world.x - this.player.x) > Math.abs(world.y - this.player.y)
        ? world.x >= this.player.x
          ? 'right'
          : 'left'
        : world.y >= this.player.y
          ? 'down'
          : 'up';
  }
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    this.audio.unlock();
    pointer.event.preventDefault();
    this.activate(pointer.rightButtonDown() ? 'powerStrike' : 'slash');
  }
  private onWhirlwind(): void {
    this.activate(this.characterClass === 'BARBARIAN' ? 'powerStrike' : 'whirlwind');
  }
  private onIronSkin(): void {
    this.activate('ironSkin');
  }
  private activate(ability: 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin'): void {
    if (this.paused) return;
    const facing = directionVector(this.facing);
    const events = this.controller.activate(
      ability,
      crypto.randomUUID(),
      { x: this.player.x, y: this.player.y },
      facing,
    );
    if (events.some((event) => event.type === 'abilityAccepted')) {
      const presentation = guardianCombatPresentation.find((entry) => entry.ability === ability)!;
      this.state = presentation.state;
      this.actionEndsAt = this.combatNow() + presentation.durationMs;
      this.audio.playCombat(
        'activation',
        events.find((event) => event.type === 'abilityAccepted')!.executionId,
      );
      // Power Strike is the heavy hit — a faint camera shake gives it weight, like selfDamaged's.
      if (ability === 'powerStrike' && !this.reducedMotion) this.cameras.main.shake(40, 0.002);
      this.playAbilityEffect(ability);
    }
    this.handleEvents(events);
    this.publishHud(true);
  }
  /** Per-ability activation flourish on the Guardian. Iron Skin's aura is handled separately
   *  (it persists for the buff duration); the other three are one-shot effects here. */
  private playAbilityEffect(ability: 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin'): void {
    if (ability === 'ironSkin') return;
    const px = this.player.x;
    const py = this.player.y;
    const descriptor = combatVfx(abilityVfxKind(ability));
    const facing = directionVector(this.facing);
    const visual = this.abilityVisuals.acquire({
      x: px + (ability === 'slash' ? facing.x * 30 : 0),
      y: py + (ability === 'slash' ? facing.y * 30 : 0),
      radius: descriptor.radius,
      color: descriptor.color,
      alpha: ability === 'powerStrike' ? 0.35 : 0.6,
      depth: this.player.y - descriptor.depth,
      ...(descriptor.strokeWidth === 0
        ? {}
        : { stroke: { width: descriptor.strokeWidth, color: descriptor.color, alpha: 0.7 } }),
    });
    if (visual === undefined) return;
    const duration = durationForMotion(descriptor.kind, this.reducedMotion);
    this.tweens.add({
      targets: visual,
      ...(ability === 'whirlwind' && !this.reducedMotion ? { angle: 360 } : {}),
      alpha: 0,
      scale: this.reducedMotion ? descriptor.radius : descriptor.radius * descriptor.scale,
      duration,
      onComplete: () => this.abilityVisuals.release(visual),
    });
  }
  private handleEvents(events: readonly CombatEvent[]): void {
    const now = this.combatNow();
    for (const event of events) {
      if (event.type === 'damageApplied') {
        this.feedback.impact(
          event.position.x,
          event.position.y,
          event.amount,
          event.critical,
          this.showDamageNumbers,
        );
        this.audio.playCombat(event.critical ? 'critical' : 'hit', event.executionId);
        if (this.enemies.has(event.targetId))
          this.requestEnemyVisualState(event.targetId, 'stunned', now, ENEMY_HIT_VISUAL_MS);
      }
      if (event.type === 'knockback' && this.enemies.has(event.targetId))
        this.requestEnemyVisualState(
          event.targetId,
          'knocked_back',
          now,
          ENEMY_KNOCKBACK_VISUAL_MS,
        );
      if (event.type === 'targetDefeated') {
        const enemy = this.enemies.get(event.targetId);
        if (enemy !== undefined && this.spawnDirector.markDefeated(event.targetId, now)) {
          const tuning = GAME_DATA.enemyTuning.find((entry) => entry.enemyId === enemy.visual);
          if (tuning !== undefined) {
            this.enemyRewardLedger = grantEnemyDefeatReward(
              this.enemyRewardLedger,
              event.targetId,
              tuning.xpReward,
              now,
            );
            this.experienceEarned = Math.min(
              Number.MAX_SAFE_INTEGER,
              this.experienceEarned + tuning.xpReward,
            );
            const outcome = applyDefeat(
              this.forestProgress,
              {
                enemyInstanceId: event.targetId,
                xp: tuning.xpReward,
                gold: tuning.goldReward,
                materials: tuning.materialsReward,
              },
              GAME_DATA.endlessForest,
            );
            this.forestProgress = outcome.state;
            this.presentation = appendPresentation(
              this.presentation,
              localDefeatPresentation({
                eventId: `local:${event.targetId}`,
                archetype: enemy.visual,
                experience: tuning.xpReward,
                gold: tuning.goldReward,
                materials: tuning.materialsReward,
                forestLevel: outcome.resultingLevel,
                leveledUp: outcome.leveledUp,
              }),
            );
            if (outcome.leveledUp) this.advanceForestWave(outcome.resultingLevel);
          }
        }
        this.requestEnemyVisualState(event.targetId, 'dead', now);
        this.dummyVisuals.get(event.targetId)?.setTint(0x3b3b3b).setAlpha(0.5);
        this.dummyShadows.get(event.targetId)?.setAlpha(0.15);
        this.audio.playCombat('death', event.targetId);
        // Corruption burst on death — same expanding-ring pattern as flashHazard, single short tween.
        this.burstAt(event.position.x, event.position.y, 0x8a3ffc);
      }
      if (event.type === 'ironSkin') this.setIronSkinAura(event.active);
      if (event.type === 'selfDamaged') {
        this.feedback.impact(
          this.player.x,
          this.player.y - 20,
          event.amount,
          false,
          this.showDamageNumbers,
        );
        this.audio.playCombat('hit', `self:${Math.round(this.combatNow())}`);
        if (!this.reducedMotion) this.cameras.main.shake(80, 0.004);
      }
    }
    for (const target of this.controller.getTargets()) {
      const visual = this.dummyVisuals.get(target.id);
      visual?.setPosition(target.position.x, target.position.y).setDepth(target.position.y);
      this.dummyShadows
        .get(target.id)
        ?.setPosition(target.position.x, target.position.y + 2)
        .setDepth(target.position.y - 1);
      this.spawnDirector.updatePosition(target.id, target.position);
    }
  }
  /** Short expanding ring on a point — the visual primitive reused by death bursts and hazards. */
  private burstAt(x: number, y: number, color: number): void {
    const descriptor = combatVfx('explosion');
    const ring = this.burstVisuals.acquire({
      x,
      y,
      radius: descriptor.radius,
      color,
      alpha: this.reducedMotion ? 0.3 : 0.5,
      depth: 6,
    });
    if (ring === undefined) return;
    this.tweens.add({
      targets: ring,
      scale: this.reducedMotion ? descriptor.radius : descriptor.radius * descriptor.scale,
      alpha: 0,
      duration: durationForMotion('explosion', this.reducedMotion),
      onComplete: () => this.burstVisuals.release(ring),
    });
  }
  /** Pulses a translucent accent ring around the Guardian while Iron Skin is active, removed on
   *  expiry so the buff state is readable at a glance instead of only in the HUD. */
  private setIronSkinAura(active: boolean): void {
    if (!active) {
      this.ironSkinAura?.destroy();
      this.ironSkinAura = undefined;
      return;
    }
    if (this.ironSkinAura !== undefined) return;
    this.ironSkinAura = this.add
      .circle(this.player.x, this.player.y, 38)
      .setStrokeStyle(2, 0xa9c09f, 0.6)
      .setDepth(this.player.y - 1);
    if (this.reducedMotion) return;
    this.tweens.add({
      targets: this.ironSkinAura,
      alpha: { from: 0.4, to: 0.85 },
      duration: durationForMotion('buff', false),
      yoyo: true,
      repeat: -1,
    });
  }
  private syncLayers(): void {
    this.shadow.setPosition(this.player.x, this.player.y + 2).setDepth(this.player.y - 1);
    this.ironSkinAura?.setPosition(this.player.x, this.player.y).setDepth(this.player.y - 1);
    this.syncEquipmentVisuals();
  }
  private syncEquipmentVisuals(): void {
    const { flipX } = mapDirection(this.facing);
    const alpha = this.player.alpha;
    if (this.layeredCharacter !== undefined) {
      this.armorLayerSprite
        ?.setPosition(this.player.x, this.player.y)
        .setAlpha(alpha)
        .setDepth(this.player.y + 0.1)
        .setVisible(this.equipmentVisual.armor.length > 0);
      this.weaponLayerSprite
        ?.setPosition(this.player.x, this.player.y)
        .setAlpha(alpha)
        .setDepth(this.facing === 'up' ? this.player.y - 0.1 : this.player.y + 0.2)
        .setVisible(this.equipmentVisual.weapon !== undefined);
    }
    if (this.armorVisual === undefined || this.weaponVisual === undefined) return;
    this.armorVisual
      .setPosition(this.player.x, this.player.y)
      .setScale(flipX ? -1 : 1, 1)
      .setAlpha(alpha)
      .setDepth(this.player.y + 0.1)
      .setVisible(this.equipmentVisual.armor.length > 0);
    this.weaponVisual
      .setPosition(this.player.x, this.player.y)
      .setScale(flipX ? -1 : 1, 1)
      .setAlpha(alpha)
      .setDepth(this.facing === 'up' ? this.player.y - 0.1 : this.player.y + 0.2)
      .setVisible(this.equipmentVisual.weapon !== undefined);
  }
  /**
   * Draws small, nearest-neighbor-friendly overlays instead of pretending generated full-body art
   * is a layered spritesheet. Every overlay shares the 92x92 character origin (feet at y=0), is
   * recreated only when the authoritative loadout changes, and follows the same facing/animation
   * transform in syncLayers().
   */
  private renderEquipmentVisuals(): void {
    if (this.armorVisual === undefined || this.weaponVisual === undefined) return;
    this.armorVisual.removeAll(true);
    this.weaponVisual.removeAll(true);
    // Real layered art supersedes the vector stand-ins entirely; drawing both would double up.
    if (this.layeredCharacter !== undefined) {
      this.syncEquipmentVisuals();
      return;
    }
    for (const item of this.equipmentVisual.armor) {
      const graphics = this.add.graphics();
      const color = equipmentRarityColor(item.rarity);
      graphics.fillStyle(color, 0.22).lineStyle(2, color, 0.9);
      let center = { x: 0, y: -64 };
      if (item.slot === 'helmet') {
        center = { x: 0, y: -64 };
        graphics.fillCircle(center.x, center.y, 14);
        graphics.strokeCircle(center.x, center.y, 14);
        graphics.fillRect(-14, -63, 28, 6);
      } else if (item.slot === 'chest') {
        center = { x: 0, y: -37 };
        graphics.fillRoundedRect(-18, -52, 36, 30, 7);
        graphics.strokeRoundedRect(-18, -52, 36, 30, 7);
        graphics.fillCircle(0, -38, 3);
      } else if (item.slot === 'gloves') {
        center = { x: 0, y: -32 };
        graphics.fillCircle(-23, -32, 6);
        graphics.strokeCircle(-23, -32, 6);
        graphics.fillCircle(23, -32, 6);
        graphics.strokeCircle(23, -32, 6);
      } else if (item.slot === 'boots') {
        center = { x: 0, y: -16 };
        graphics.fillRoundedRect(-17, -21, 11, 11, 3);
        graphics.strokeRoundedRect(-17, -21, 11, 11, 3);
        graphics.fillRoundedRect(6, -21, 11, 11, 3);
        graphics.strokeRoundedRect(6, -21, 11, 11, 3);
      }
      this.armorVisual.add(graphics);
      // Same standing glint as a legendary weapon (below) — the whole loadout should read as
      // special, not just whatever happens to be in the main hand.
      if (item.rarity === 'legendary') this.armorVisual.add(this.spawnLegendaryGlint(center));
    }
    const weapon = this.equipmentVisual.weapon;
    if (weapon !== undefined) {
      const graphics = this.add.graphics();
      const color = equipmentRarityColor(weapon.rarity);
      const long = isTwoHandedWeapon(weapon.definitionId);
      const hilt = { x: 24, y: -30 };
      const tip = { x: long ? 60 : 52, y: long ? -66 : -57 };
      graphics.lineStyle(long ? 6 : 4, color, 0.95);
      graphics.beginPath();
      graphics.moveTo(hilt.x, hilt.y);
      graphics.lineTo(tip.x, tip.y);
      graphics.strokePath();
      // The shaft is shared by every weapon; only the head at the tip tells a sword from an axe.
      drawWeaponHead(graphics, weaponSilhouetteForDefinition(weapon.definitionId), tip, color, long);
      graphics.lineStyle(3, 0x664735, 0.95);
      graphics.beginPath();
      graphics.moveTo(18, -24);
      graphics.lineTo(31, -37);
      graphics.strokePath();
      this.weaponVisual.add(graphics);
      // Legendary gear earns a small pulsing glint at the weapon's tip — the only rarity tier that
      // gets a standing animated flourish rather than just a brighter fill/stroke color.
      if (weapon.rarity === 'legendary') this.weaponVisual.add(this.spawnLegendaryGlint(tip));
    }
    this.syncEquipmentVisuals();
  }
  /** A small pulsing sparkle, standing at `at` until the caller's container is torn down with it. */
  private spawnLegendaryGlint(at: Readonly<{ x: number; y: number }>): Phaser.GameObjects.Image {
    ensureLegendaryGlintTexture(this);
    const glint = this.add.image(at.x, at.y, LEGENDARY_GLINT_TEXTURE_KEY).setBlendMode('ADD');
    this.tweens.add({
      targets: glint,
      scale: { from: 0.6, to: 1.3 },
      alpha: { from: 0.9, to: 0.15 },
      duration: 900,
      repeat: -1,
      ease: 'Sine.easeOut',
    });
    return glint;
  }
  private publishEquipmentVisualDebug(): void {
    if (this.game?.canvas === undefined) return;
    this.game.canvas.dataset.equipmentVisual = [
      this.equipmentVisual.weapon === undefined
        ? 'weapon:none'
        : `weapon:${this.equipmentVisual.weapon.rarity}`,
      `armor:${this.equipmentVisual.armor.map((item) => `${item.slot}:${item.rarity}`).join(',') || 'none'}`,
    ].join('|');
  }
  /**
   * The generated art is composited (no separate armor/weapon layers), so one sprite carries the
   * whole character: the visual FSM state picks the animation and the facing picks the generated
   * sheet, mirroring `east` when the Guardian faces west.
   */
  private playSynchronizedAnimations(): void {
    const { sheet, flipX } = mapDirection(this.facing);
    this.player.setFlipX(flipX);
    this.player.anims.play(pixelLabKey(this.character, mapState(this.state), sheet), true);
    const layered = this.layeredCharacter;
    if (layered === undefined) return;
    // Driven from the same FSM state and facing rather than from their own timers — anything else
    // lets a helmet drift a frame behind the head it is sitting on.
    const state = mapState(this.state);
    this.armorLayerSprite
      ?.setFlipX(flipX)
      .anims.play(pixelLabKey(layered.armor, state, sheet), true);
    this.weaponLayerSprite
      ?.setFlipX(flipX)
      .anims.play(pixelLabKey(layered.weapon, state, sheet), true);
  }
  private publishHud(force: boolean): void {
    // setConnection/setDamageNumbers are part of the runtime's public API and are called by
    // GameIsland synchronously right after mount, before Phaser's async scene boot necessarily
    // reaches create(). The fields they set are still applied; create() publishes the first real
    // snapshot once the controller exists.
    if (this.controller === undefined) return;
    const now = this.combatNow();
    if (!force && now - this.lastHudAt < 100) return;
    this.lastHudAt = now;
    this.publishEnemyVisualDebug(now);
    this.publishEffectPoolDebug();
    const combat = this.controller.snapshot();
    const forestTuning = currentLevelTuning(this.forestProgress, GAME_DATA.endlessForest);
    this.onHud({
      facing: this.facing,
      cameraZoom: CAMERA_ZOOM,
      paused: this.paused,
      connection: this.connection,
      ...combat,
      enemiesAlive: this.controller.getTargets().filter((target) => target.health > 0).length,
      forestLevel: this.forestProgress.level,
      forestBestLevel: this.forestProgress.bestLevel,
      forestXpInLevel: this.forestProgress.xpInLevel,
      forestXpToAdvance:
        this.forestProgress.level >= GAME_DATA.endlessForest.maximumLevel
          ? 0
          : forestTuning.xpToAdvance,
      forestWaveIndex: this.forestWavePlan.waveIndex,
      forestWaveSize: this.forestWavePlan.tuning.waveSize,
      experienceEarned: this.experienceEarned,
      potionCharges: this.potionCharges,
      potionCooldownRemainingMs: Math.max(0, this.potionReadyAt - now),
      lootLog: this.presentation.lootLog,
      notifications: this.presentation.notifications,
    });
  }
  /** Non-visible smoke contract: exposes aggregate visual states without coupling React to Phaser. */
  private publishEnemyVisualDebug(now: number): void {
    const counts: Record<'idle' | 'walk' | 'attack' | 'hit' | 'death', number> = {
      idle: 0,
      walk: 0,
      attack: 0,
      hit: 0,
      death: 0,
    };
    const advancedCounts: Record<
      | 'idle'
      | 'moving'
      | 'attacking'
      | 'casting'
      | 'channeling'
      | 'interacting'
      | 'stunned'
      | 'knocked_back'
      | 'downed'
      | 'reviving'
      | 'dead',
      number
    > = {
      idle: 0,
      moving: 0,
      attacking: 0,
      casting: 0,
      channeling: 0,
      interacting: 0,
      stunned: 0,
      knocked_back: 0,
      downed: 0,
      reviving: 0,
      dead: 0,
    };
    for (const enemy of this.enemies.values()) {
      const base = enemyAiVisualState(
        enemy.sim.aiState,
        enemyAbilityVisualMode(enemy.abilityProfile),
      );
      const state = activeEnemyVisualState(base, this.enemyVisualLatches.get(enemy.id), now);
      advancedCounts[state] += 1;
      const label =
        state === 'moving'
          ? 'walk'
          : state === 'attacking'
            ? 'attack'
            : state === 'stunned'
              ? 'hit'
              : state === 'knocked_back'
                ? 'hit'
                : state === 'dead'
                  ? 'death'
                  : 'idle';
      counts[label] += 1;
    }
    this.game.canvas.dataset.enemyVisualStates = Object.entries(counts)
      .map(([state, count]) => `${state}:${count}`)
      .join(',');
    this.game.canvas.dataset.enemyVisualAdvanced = Object.entries(advancedCounts)
      .map(([state, count]) => `${state}:${count}`)
      .join(',');
  }
  /** Exposes bounded effect occupancy for smoke and stress assertions without coupling React to
   * Phaser internals. The values are capacities, not authority or gameplay state. */
  private publishEffectPoolDebug(): void {
    const audio = this.audio.diagnostics();
    this.game.canvas.dataset.enemyEffectPool = [
      `projectiles:${this.enemyProjectileVisuals.activeCount}/${this.enemyProjectileVisuals.capacity}`,
      `telegraphs:${this.enemyTelegraphVisuals.activeCount}/${this.enemyTelegraphVisuals.capacity}`,
      `bursts:${this.burstVisuals.activeCount}/${this.burstVisuals.capacity}`,
    ].join(',');
    this.game.canvas.dataset.audioDiagnostics = [
      `active:${audio.activeTones}`,
      `peak:${audio.peakTones}`,
      `dedupe:${audio.dedupeKeys}`,
      `state:${audio.contextState}`,
    ].join(',');
  }
  private startStressFrameProbe(): void {
    if (typeof requestAnimationFrame !== 'function') return;
    this.stressProbeDisposed = false;
    this.stressRafId = requestAnimationFrame(this.sampleStressFrame);
  }
  private readonly sampleStressFrame = (timestamp: number): void => {
    if (!this.stressEnabled || this.stressProbeDisposed) return;
    if (this.stressFrameLastAt !== undefined) {
      const elapsedMs = timestamp - this.stressFrameLastAt;
      if (Number.isFinite(elapsedMs) && elapsedMs >= 0) {
        this.stressFrameIntervals[this.stressFrameIntervalCursor] = elapsedMs;
        this.stressFrameIntervalCursor =
          (this.stressFrameIntervalCursor + 1) % STRESS_FRAME_SAMPLE_CAPACITY;
        this.stressFrameIntervalCount = Math.min(
          STRESS_FRAME_SAMPLE_CAPACITY,
          this.stressFrameIntervalCount + 1,
        );
      }
    }
    this.stressFrameLastAt = timestamp;
    if (this.combatNow() - this.stressMetricsPublishedAt >= STRESS_METRICS_PUBLISH_MS)
      this.publishStressMetrics(false);
    this.stressRafId = requestAnimationFrame(this.sampleStressFrame);
  };
  private recordStressFrame(frameStartedAt: number | undefined): void {
    if (frameStartedAt === undefined) return;
    const elapsedMs = performanceNow() - frameStartedAt;
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return;
    this.stressFrameSamples[this.stressFrameCursor] = elapsedMs;
    this.stressFrameCursor = (this.stressFrameCursor + 1) % STRESS_FRAME_SAMPLE_CAPACITY;
    this.stressFrameSampleCount = Math.min(
      STRESS_FRAME_SAMPLE_CAPACITY,
      this.stressFrameSampleCount + 1,
    );
    if (this.combatNow() - this.stressMetricsPublishedAt >= STRESS_METRICS_PUBLISH_MS)
      this.publishStressMetrics(false);
  }
  private publishStressMetrics(force: boolean): void {
    this.game.canvas.dataset.enemyStress = String(this.enemyStressCount);
    this.publishEffectPoolDebug();
    if (!this.stressEnabled) return;
    if (!force && this.stressFrameSampleCount === 0 && this.stressFrameIntervalCount === 0) return;
    const frameSamples =
      this.stressFrameIntervalCount > 0
        ? this.stressFrameIntervals.slice(0, this.stressFrameIntervalCount)
        : this.stressFrameSamples.slice(0, this.stressFrameSampleCount);
    const updateSamples = this.stressFrameSamples.slice(0, this.stressFrameSampleCount);
    const memory = (
      globalThis.performance as Performance & {
        memory?: Readonly<{ usedJSHeapSize: number }>;
      }
    ).memory;
    this.game.canvas.dataset.stressSamples = String(
      Math.max(this.stressFrameSampleCount, this.stressFrameIntervalCount),
    );
    this.game.canvas.dataset.stressFrameP50Ms = percentile(frameSamples, 0.5).toFixed(3);
    this.game.canvas.dataset.stressFrameP95Ms = percentile(frameSamples, 0.95).toFixed(3);
    this.game.canvas.dataset.stressFrameP99Ms = percentile(frameSamples, 0.99).toFixed(3);
    this.game.canvas.dataset.stressUpdateP95Ms = percentile(updateSamples, 0.95).toFixed(3);
    this.game.canvas.dataset.stressMemoryBytes =
      memory === undefined ? 'unavailable' : String(Math.round(memory.usedJSHeapSize));
    this.stressMetricsPublishedAt = this.combatNow();
  }
  private togglePause(): void {
    if (this.paused) this.resume();
    else this.pause();
  }
  /**
   * this.time (Phaser's Scene clock) does not exist until the scene has been installed into a
   * booted Game - which happens asynchronously. The runtime's public API (setConnection,
   * setDamageNumbers) is called synchronously right after mountGameRuntime returns, before that
   * boot necessarily completes, so this must tolerate being read pre-boot instead of throwing.
   */
  private combatNow(): number {
    const now = this.time?.now ?? 0;
    const currentPause = this.pausedAt === undefined ? 0 : now - this.pausedAt;
    return now - this.pausedDuration - currentPause;
  }
  private releaseInput(): void {
    this.stressProbeDisposed = true;
    if (this.stressRafId !== undefined) cancelAnimationFrame(this.stressRafId);
    this.stressRafId = undefined;
    this.input.off('pointermove', this.onPointerMove, this);
    this.input.off('pointerdown', this.onPointerDown, this);
    this.input.keyboard?.off('keydown-Q', this.onWhirlwind, this);
    this.input.keyboard?.off('keydown-E', this.onIronSkin, this);
    this.input.keyboard?.off('keydown-F', this.onInteract, this);
    this.input.keyboard?.off('keydown-X', this.drinkPotion, this);
    this.input.keyboard?.off('keydown-ESC', this.togglePause, this);
    this.game.canvas.removeEventListener('contextmenu', this.suppressContextMenu);
    this.feedback.destroy();
    this.stopAudio();
    this.interactionFeedbackTween?.stop();
    this.interactionPrompt?.destroy();
    this.interactionFeedbackText?.destroy();
    this.interactionVisuals.forEach((visual) => visual.destroy(true));
    this.interactionVisuals.clear();
    this.ironSkinAura?.destroy();
    this.ironSkinAura = undefined;
    this.dummyVisuals.forEach((visual) => visual.destroy());
    this.dummyVisuals.clear();
    this.dummyShadows.forEach((shadow) => shadow.destroy());
    this.dummyShadows.clear();
    this.enemyProjectiles.forEach((effect) => this.enemyProjectileVisuals.release(effect.visual));
    this.enemyProjectiles.clear();
    this.enemyTelegraphs.forEach((effect) => this.enemyTelegraphVisuals.release(effect.visual));
    this.enemyTelegraphs.clear();
    this.enemyProjectileVisuals.destroy();
    this.enemyTelegraphVisuals.destroy();
    this.burstVisuals.destroy();
    this.abilityVisuals.destroy();
    this.enemyVisualLatches.clear();
    this.enemyAnimationActionTokens.clear();
    this.enemyAnimationSignatures.clear();
    this.enemies.clear();
    this.enemyRewardLedger = EMPTY_ENEMY_REWARD_LEDGER;
    this.experienceEarned = 0;
    this.presentation = EMPTY_GAME_PRESENTATION;
  }
}

function squaredDistance(
  from: Readonly<{ x: number; y: number }>,
  to: Readonly<{ x: number; y: number }>,
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return dx * dx + dy * dy;
}
function defenderForEnemyTarget(target: EnemyAbilityTarget): DefenderStats {
  return {
    armor: target.armor,
    armorDenominatorBase: 0,
    armorDenominatorPerLevel: 0,
    armorReductionCap: 0.75,
    ...(target.incomingDamageMultiplier === undefined
      ? {}
      : { incomingDamageMultiplier: target.incomingDamageMultiplier }),
  };
}
function directionVector(direction: Direction4): Readonly<{ x: number; y: number }> {
  return {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  }[direction];
}
/**
 * Draws the weapon head at `tip` for one of the four procedural silhouettes (Paso 12). The shaft
 * itself is drawn by the caller and shared by all of them — only the head distinguishes a sword's
 * pommel from an axe's wedge, so a Guardian holding a "Hacha del ocaso" no longer looks like it is
 * holding the same generic blade as every other weapon.
 */
function drawWeaponHead(
  graphics: Phaser.GameObjects.Graphics,
  silhouette: WeaponSilhouette,
  tip: Readonly<{ x: number; y: number }>,
  color: number,
  long: boolean,
): void {
  const size = long ? 6 : 5;
  graphics.fillStyle(color, 0.95).lineStyle(2, color, 0.95);
  if (silhouette === 'axe') {
    graphics.beginPath();
    graphics.moveTo(tip.x - size * 1.6, tip.y - size * 0.4);
    graphics.lineTo(tip.x + size * 0.6, tip.y - size * 1.8);
    graphics.lineTo(tip.x + size * 1.4, tip.y + size * 0.2);
    graphics.lineTo(tip.x - size * 0.2, tip.y + size * 1.4);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    return;
  }
  if (silhouette === 'hammer') {
    graphics.fillRect(tip.x - size * 1.3, tip.y - size, size * 2.6, size * 2);
    graphics.strokeRect(tip.x - size * 1.3, tip.y - size, size * 2.6, size * 2);
    return;
  }
  if (silhouette === 'polearm') {
    graphics.beginPath();
    graphics.moveTo(tip.x, tip.y - size * 2.2);
    graphics.lineTo(tip.x + size * 0.8, tip.y);
    graphics.lineTo(tip.x - size * 0.8, tip.y);
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();
    return;
  }
  graphics.fillCircle(tip.x, tip.y, size);
  graphics.strokeCircle(tip.x, tip.y, size);
}
/**
 * Small four-pointed sparkle used for the legendary weapon glint (Paso 12). Generated once and
 * cached like the environment module's own procedural textures — `scene.textures.exists` guards
 * against re-painting it every time a legendary weapon is (re)rendered.
 */
function ensureLegendaryGlintTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(LEGENDARY_GLINT_TEXTURE_KEY)) return;
  const canvas = scene.add.graphics();
  canvas.fillStyle(0xffffff, 1);
  canvas.beginPath();
  canvas.moveTo(8, 0);
  canvas.lineTo(10, 6);
  canvas.lineTo(16, 8);
  canvas.lineTo(10, 10);
  canvas.lineTo(8, 16);
  canvas.lineTo(6, 10);
  canvas.lineTo(0, 8);
  canvas.lineTo(6, 6);
  canvas.closePath();
  canvas.fillPath();
  canvas.generateTexture(LEGENDARY_GLINT_TEXTURE_KEY, 16, 16);
  canvas.destroy();
}
/** One Phaser animation per (generated animation × generated direction) of a PixelLab character. */
function createPixelLabAnimations(scene: Phaser.Scene, character: PixelLabCharacter): void {
  const names = Object.keys(character.animations) as PixelLabAnimationName[];
  for (const name of names) {
    const animation = character.animations[name];
    if (animation === undefined) continue;
    for (const direction of ['north', 'south', 'east'] as const) {
      const key = pixelLabKey(character, name, direction);
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: scene.anims.generateFrameNumbers(key, {
          start: 0,
          end: animation.sheets[direction].frameCount - 1,
        }),
        frameRate: animation.frameRate,
        repeat: animation.repeat,
      });
    }
  }
}
/**
 * Distinct generated characters carried by enemy visuals, for preload/create. Deduped by id so two
 * enemies sharing a character (today: none, but plausible for variants) load it once.
 */
function enemyCharactersToLoad(): readonly PixelLabCharacter[] {
  const seen = new Set<string>();
  const out: PixelLabCharacter[] = [];
  for (const visual of Object.values(ENEMY_VISUALS)) {
    const character = visual.character;
    if (character === undefined || seen.has(character.id)) continue;
    seen.add(character.id);
    out.push(character);
  }
  return out;
}
const runtimes = new WeakMap<HTMLElement, GameRuntime>();

function createEnemySpawnConfig(
  count: number,
  composition: readonly EnemyVisualId[] = ENEMY_SPAWN_CONFIG.composition,
): EnemySpawnDirectorConfig<EnemyVisualId> {
  const boundedCount = Math.min(
    MAX_ENEMY_STRESS_COUNT,
    Math.max(DEFAULT_ENEMY_STRESS_COUNT, Math.trunc(count)),
  );
  const stress = boundedCount > DEFAULT_ENEMY_STRESS_COUNT;
  return Object.freeze({
    ...ENEMY_SPAWN_CONFIG,
    minActive: boundedCount,
    maxActive: boundedCount,
    composition,
    spawnPoints: stress ? enemyStressSpawnPoints() : ENEMY_SPAWN_CONFIG.spawnPoints,
  });
}

function performanceNow(): number {
  return globalThis.performance?.now() ?? 0;
}

export function mountGameRuntime(
  host: HTMLElement,
  onHud: (snapshot: GameHudSnapshot) => void,
  characterClass?: CharacterClassId,
): GameRuntime {
  runtimes.get(host)?.destroy();
  const scene = new TestScene(onHud, characterClass);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: host,
    width: 960,
    height: 540,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    pixelArt: true,
    fps: { target: 60 },
    physics: {
      default: 'arcade',
      arcade: {
        debug: arcadeDebugEnabled(
          import.meta.env.MODE === 'development',
          arcadeDebugOptIn(typeof localStorage === 'undefined' ? undefined : localStorage),
        ),
        fps: 60,
      },
    },
    scene: [BootScene, scene],
  });
  let destroyed = false;
  const runtime: GameRuntime = {
    pause: () => scene.pause(),
    resume: () => scene.resume(),
    setConnection: (connection) => scene.setConnection(connection),
    setDamageNumbers: (enabled) => scene.setDamageNumbers(enabled),
    setAudioSettings: (settings) => scene.setAudioSettings(settings),
    setReducedMotion: (enabled) => scene.setReducedMotion(enabled),
    setAutoBattle: (enabled) => scene.setAutoBattle(enabled),
    setEquipmentVisual: (loadout) => scene.setEquipmentVisual(loadout),
    activate: (ability) => scene.activateAbility(ability),
    drinkPotion: () => scene.drinkPotion(),
    setCharacterProfile: (profile) => scene.setCharacterProfile(profile),
    applyServerEvent: (raw) => scene.applyServerEvent(raw),
    destroy: () => {
      if (!destroyed) {
        destroyed = true;
        // Do this before Phaser tears down the scene graph; SHUTDOWN is a best-effort fallback.
        scene.stopAudio();
        game.destroy(true);
        runtimes.delete(host);
      }
    },
  };
  runtimes.set(host, runtime);
  return runtime;
}
