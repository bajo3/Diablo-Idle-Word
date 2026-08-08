import { z } from 'zod';

import {
  AbilityIdSchema,
  AffixDefinitionSchema,
  AssetManifestEntrySchema,
  ClassRegistrySchema,
  EquipmentSlotSchema,
  IdSchema,
  ItemDefinitionSchema,
  ItemRaritySchema,
  ItemTypeSchema,
  MapObjectPropertiesSchema,
  SpriteAnimationSchema,
  SpriteSheetSchema,
  VersionSchema,
} from '@brecha/shared';

export const TuningStatusSchema = z.enum(['TBD', 'PROVISIONAL']);
export const AttributeEffectSchema = z.enum([
  'physical_damage',
  'heavy_equipment_access',
  'armor',
  'critical_chance',
  'accuracy',
  'attack_speed_minor',
  'elemental_resistance',
  'effect_effectiveness',
  'max_health',
  'recovery',
  'status_resistance',
]);
export const AttributeDefinitionSchema = z.strictObject({
  id: z.enum(['strength', 'dexterity', 'intelligence', 'vitality']),
  displayName: z.string().trim().min(1).max(80),
  semanticEffects: z.array(AttributeEffectSchema).min(1),
  tuningStatus: TuningStatusSchema,
});
export const AbilityMechanicSchema = z.enum([
  'short_frontal_targeting',
  'nearby_multi_target',
  'generates_fury',
  'slow_attack',
  'high_damage',
  'knockback',
  'consumes_fury',
  'self_area_damage',
  'brief_duration',
  'reduced_movement',
  'temporary_damage_reduction',
  'not_invulnerable',
  'high_cooldown',
  'heal_on_kill',
  'healing_capped',
]);
export const GuardianAbilitySchema = z.strictObject({
  id: AbilityIdSchema,
  kind: z.enum(['basic_attack', 'active', 'passive']),
  displayName: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(400),
  animationId: z.string().trim().min(1).max(128),
  mechanics: z.array(AbilityMechanicSchema).min(1),
  unlockLevel: z.number().int().min(1).max(10),
  tuningStatus: TuningStatusSchema,
});
export const GuardianDefinitionSchema = z.strictObject({
  id: z.literal('guardian'),
  displayName: z.literal('Guardián'),
  role: z.literal('melee_resilient'),
  resource: z.literal('fury'),
  attributeKeys: z.tuple([
    z.literal('strength'),
    z.literal('dexterity'),
    z.literal('intelligence'),
    z.literal('vitality'),
  ]),
  attributeIds: z.array(AttributeDefinitionSchema.shape.id).length(4),
  abilityIds: z.array(AbilityIdSchema).length(5),
});
export const ItemTypeDefinitionSchema = z
  .strictObject({
    id: ItemTypeSchema,
    compatibleSlots: z.array(EquipmentSlotSchema),
    tuningStatus: TuningStatusSchema,
  })
  .superRefine((value, context) => {
    const expectedSlots = {
      weapon_one_hand: ['main_hand'],
      weapon_two_hand: ['main_hand'],
      shield: ['off_hand'],
      helmet: ['helmet'],
      chest: ['chest'],
      gloves: ['gloves'],
      boots: ['boots'],
      amulet: ['amulet'],
      ring: ['ring_1', 'ring_2'],
      material: [],
    } as const;
    const expected = expectedSlots[value.id];
    if (
      value.compatibleSlots.length !== expected.length ||
      value.compatibleSlots.some((slot, index) => slot !== expected[index])
    )
      context.addIssue({
        code: 'custom',
        message: `${value.id} has incompatible equipment slots`,
        path: ['compatibleSlots'],
      });
  });
export const RarityDefinitionSchema = z.strictObject({
  id: ItemRaritySchema,
  description: z.string().trim().min(1).max(300),
  tuningStatus: TuningStatusSchema,
});
export const EnemyBehaviorSchema = z.enum([
  'melee',
  'ranged',
  'keep_distance',
  'reposition',
  'heal_allies',
  'buff_allies',
  'area_attack',
  'stun',
  'fast_pursuit',
  'telegraphed_explosion',
]);
export const EnemyDefinitionSchema = z.strictObject({
  id: z.enum([
    'corrupted_minion',
    'possessed_archer',
    'dark_shaman',
    'root_brute',
    'unstable_beast',
    'skeleton_recruit',
    'skeleton_warrior',
    'bone_soldier',
    'bone_warlord',
    'skeleton_king',
  ]),
  displayName: z.string().trim().min(1).max(80),
  behaviors: z.array(EnemyBehaviorSchema).min(1),
  aiStates: z
    .array(
      z.enum([
        'idle',
        'patrol',
        'detect',
        'chase',
        'attack',
        'use_ability',
        'retreat',
        'stunned',
        'dead',
      ]),
    )
    .length(9),
  tuningStatus: TuningStatusSchema,
});
export const ZoneDefinitionSchema = z.strictObject({
  id: z.literal('corrupted_forest'),
  displayName: z.literal('Bosque Corrupto'),
  awayModeEligible: z.boolean(),
  enemyIds: z.array(EnemyDefinitionSchema.shape.id).length(10),
  mapId: IdSchema,
  tuningStatus: TuningStatusSchema,
});

/**
 * Data-only registry for the next content wave. It deliberately does not feed the active Forest
 * spawn list yet: M1 proves IDs and cross-references; M4/M5 will add tuning, assets and runtime
 * activation one vertical slice at a time.
 */
export const ExpansionEnemyDefinitionSchema = z.strictObject({
  id: IdSchema,
  displayName: z.string().trim().min(1).max(80),
  archetype: z.enum(['melee', 'ranged', 'caster', 'summoner']),
  behaviors: z.array(EnemyBehaviorSchema).min(1),
  aiStates: z
    .array(
      z.enum([
        'idle',
        'patrol',
        'detect',
        'chase',
        'attack',
        'use_ability',
        'retreat',
        'stunned',
        'dead',
      ]),
    )
    .length(9),
  tuningStatus: TuningStatusSchema,
});

export const ExpansionMapDefinitionSchema = z.strictObject({
  id: IdSchema,
  zoneId: IdSchema,
  backgroundAssetId: IdSchema,
  format: z.literal('tiled'),
  version: VersionSchema,
  tuningStatus: TuningStatusSchema,
});

export const ExpansionZoneDefinitionSchema = z.strictObject({
  id: IdSchema,
  displayName: z.string().trim().min(1).max(80),
  mapId: IdSchema,
  enemyIds: z.array(IdSchema).min(1),
  awayModeEligible: z.boolean(),
  tuningStatus: TuningStatusSchema,
});

export const ContentExpansionRegistrySchema = z.strictObject({
  registryVersion: VersionSchema,
  enemies: z.array(ExpansionEnemyDefinitionSchema).min(5),
  maps: z.array(ExpansionMapDefinitionSchema).min(3),
  zones: z.array(ExpansionZoneDefinitionSchema).min(3),
});
export const MissionDefinitionSchema = z.strictObject({
  id: z.literal('mission.corrupted_forest.breach'),
  zoneId: z.literal('corrupted_forest'),
  objectives: z.tuple([
    z.strictObject({ type: z.literal('destroy_altars'), count: z.literal(3) }),
    z.strictObject({ type: z.literal('defeat_boss'), enemyId: z.literal('corrupted_guardian') }),
  ]),
  tuningStatus: TuningStatusSchema,
});
export const BalanceSchema = z.strictObject({
  version: VersionSchema,
  tuningStatus: TuningStatusSchema,
  awayMode: z.strictObject({
    calibrationSeconds: z.literal(300),
    minimumRewardSeconds: z.literal(600),
    maximumRewardSeconds: z.literal(28_800),
    efficiency: z.literal(0.8),
    formulaVersion: VersionSchema,
  }),
  multiplayer: z.strictObject({
    minimumPlayers: z.literal(1),
    maximumPlayers: z.literal(4),
    healthPerAdditionalPlayer: z.literal(0.65),
    damagePerAdditionalPlayer: z.literal(0.15),
  }),
  difficulty: z.strictObject({
    normal: z.strictObject({
      enemyHealthMultiplier: z.literal(1),
      enemyDamageMultiplier: z.literal(1),
    }),
    veteran: z.strictObject({
      enemyHealthMultiplier: z.literal(1.25),
      enemyDamageMultiplier: z.literal(1.15),
    }),
  }),
  visual: z.strictObject({
    standardFrameSize: z.literal(64),
    largeFrameSize: z.literal(128),
  }),
});
export const GuardianCombatAbilitySchema = z.strictObject({
  id: AbilityIdSchema,
  input: z.enum(['primary', 'secondary', 'q', 'e', 'passive']),
  furyCost: z.number().int().nonnegative(),
  cooldownMs: z.number().int().nonnegative(),
  damageMultiplier: z.number().nonnegative(),
  rangePx: z.number().int().positive().optional(),
  arcDegrees: z.number().int().positive().max(360).optional(),
  maxTargets: z.number().int().positive().optional(),
  impactMs: z.number().int().nonnegative().optional(),
  recoveryMs: z.number().int().nonnegative().optional(),
  radiusPx: z.number().int().positive().optional(),
  tickOffsetsMs: z.array(z.number().int().nonnegative()).optional(),
  durationMs: z.number().int().positive().optional(),
  movementMultiplier: z.number().positive().max(1).optional(),
  knockbackPx: z.number().int().nonnegative().optional(),
  damageTakenMultiplier: z.number().positive().max(1).optional(),
  furyOnHit: z.number().int().nonnegative().optional(),
});
export const GuardianCombatSchema = z.strictObject({
  combatFormulaVersion: z.literal('guardian-combat.1'),
  tuningStatus: z.literal('PROVISIONAL'),
  level: z.literal(1),
  attributes: z.strictObject({
    strength: z.literal(10),
    dexterity: z.literal(5),
    intelligence: z.literal(3),
    vitality: z.literal(12),
  }),
  weaponDamage: z.tuple([z.literal(10), z.literal(14)]),
  maxFury: z.literal(100),
  criticalBaseChance: z.literal(0.05),
  criticalPerDexterity: z.literal(0.005),
  criticalCap: z.literal(0.5),
  criticalMultiplier: z.literal(1.5),
  armorDenominatorBase: z.literal(100),
  armorDenominatorPerLevel: z.literal(50),
  armorReductionCap: z.literal(0.75),
  furyOnDamageTaken: z.literal(5),
  furyDecayDelayMs: z.literal(3000),
  furyDecayPerSecond: z.literal(5),
  battleThirst: z.strictObject({
    healFraction: z.literal(0.05),
    capFraction: z.literal(0.15),
    windowMs: z.literal(10_000),
  }),
  abilities: z.array(GuardianCombatAbilitySchema).length(5),
});
/** Provisional combat tuning for the first non-Guardian vertical slice. */
export const BarbarianCombatSchema = z.strictObject({
  combatFormulaVersion: z.literal('barbarian-combat.1'),
  tuningStatus: z.literal('PROVISIONAL'),
  level: z.literal(1),
  attributes: z.strictObject({
    strength: z.literal(14),
    dexterity: z.literal(6),
    intelligence: z.literal(3),
    vitality: z.literal(14),
  }),
  weaponDamage: z.tuple([z.literal(12), z.literal(18)]),
  maxFury: z.literal(120),
  criticalBaseChance: z.literal(0.04),
  criticalPerDexterity: z.literal(0.004),
  criticalCap: z.literal(0.45),
  criticalMultiplier: z.literal(1.5),
  armorDenominatorBase: z.literal(100),
  armorDenominatorPerLevel: z.literal(50),
  armorReductionCap: z.literal(0.75),
  furyOnDamageTaken: z.literal(7),
  furyDecayDelayMs: z.literal(3500),
  furyDecayPerSecond: z.literal(4),
  battleThirst: z.strictObject({
    healFraction: z.literal(0.04),
    capFraction: z.literal(0.12),
    windowMs: z.literal(10_000),
  }),
  abilities: z.array(GuardianCombatAbilitySchema).length(4),
});
/**
 * A static, data-driven damage source used to make incoming damage honestly verifiable in the
 * local Step 7 scene: no detection, no navigation, no aggro — just a telegraphed periodic pulse.
 * Never lethal (see LocalCombatController.applyIncomingDamage): death/derribado is Paso 9 scope.
 */
export const HazardDefinitionSchema = z.strictObject({
  id: z.literal('hazard.corrupted_pulse'),
  displayName: z.string().trim().min(1).max(80),
  periodMs: z.number().int().positive(),
  telegraphMs: z.number().int().positive(),
  radiusPx: z.number().int().positive(),
  damage: z.number().int().positive(),
  lethal: z.literal(false),
});

export const CharacterProgressionSchema = z.strictObject({
  formulaVersion: VersionSchema,
  minimumLevel: z.literal(1),
  maximumLevel: z.literal(10),
  xpToReachLevel: z.array(z.number().int().nonnegative()).length(10),
  attributePointsPerLevel: z.number().int().positive().max(10),
  resetCostPerLevel: z.number().int().positive().max(100_000),
});
/** One enemy's attack: windup (telegraph-visible) -> impact (damage resolves) -> recovery. */
export const EnemyAttackTuningSchema = z.strictObject({
  /** Symmetric attacker roll consumed by `resolveAttack`; kept in data, never in the server tick. */
  weaponDamage: z
    .tuple([z.number().int().positive(), z.number().int().positive()])
    .refine(([minimum, maximum]) => maximum >= minimum, 'Enemy weapon damage range is invalid.'),
  power: z.number().int().nonnegative(),
  level: z.number().int().positive(),
  criticalChance: z.number().min(0).max(1),
  criticalMultiplier: z.number().positive(),
  windupMs: z.number().int().nonnegative(),
  impactMs: z.number().int().nonnegative(),
  recoveryMs: z.number().int().nonnegative(),
  rangePx: z.number().int().positive(),
  arcDegrees: z.number().int().positive().max(360),
  damageMultiplier: z.number().positive(),
  cooldownMs: z.number().int().positive(),
});
/**
 * Numerical combat/AI tuning for one enemy (Paso 8.1), kept separate from the descriptive
 * `EnemyDefinitionSchema` the same way `guardianCombat` is kept separate from `guardian`.
 * `animationIds`/`frameSize` are reserved identifiers for enemy sprites that don't exist yet
 * (Paso 8.4+) - they are format-checked here but not cross-referenced against
 * `animations`/`assets` the way the Guardian's are, since there is nothing to reference yet.
 */
export const EnemyTuningSchema = z.strictObject({
  enemyId: z.enum([
    'corrupted_minion',
    'possessed_archer',
    'dark_shaman',
    'root_brute',
    'unstable_beast',
    'skeleton_recruit',
    'skeleton_warrior',
    'bone_soldier',
    'bone_warlord',
    'skeleton_king',
  ]),
  tuningStatus: z.literal('PROVISIONAL'),
  maxHealth: z.number().int().positive(),
  armor: z.number().int().nonnegative(),
  moveSpeedPxPerSec: z.number().positive(),
  separationRadiusPx: z.number().int().positive(),
  detectRadiusPx: z.number().int().positive(),
  loseTargetRadiusPx: z.number().int().positive(),
  leashRadiusPx: z.number().int().positive(),
  attack: EnemyAttackTuningSchema,
  telegraphMs: z.number().int().nonnegative(),
  xpReward: z.number().int().positive(),
  goldReward: z.number().int().nonnegative(),
  materialsReward: z.number().int().nonnegative(),
  animationIds: z.array(z.string().trim().min(1).max(128)).min(1),
  frameSize: z.union([z.literal(64), z.literal(92), z.literal(128)]),
});
/**
 * Numerical tuning for the enemy combat-ability profiles (Paso 8, specific-behaviours layer).
 * Consumed by `resolveEnemyAbilityProfile` in `behavior-profile.ts`. All values PROVISIONAL -
 * they ride the same `BALANCE_VERSION` as the rest of combat, so changing them is a versioned
 * balance change, not a silent tweak. The heal/area/explosion/ranged blocks each describe one
 * behaviour selected by the resolver from the enemy's `behaviors` tags (never from its id).
 */
export const EnemyAbilityTuningSchema = z.strictObject({
  tuningStatus: z.literal('PROVISIONAL'),
  healAllies: z.strictObject({
    healMissingFraction: z.number().positive().max(1),
    ignoreAboveFraction: z.number().positive().max(1),
  }),
  areaAttack: z.strictObject({
    radiusPx: z.number().int().positive(),
    stunMs: z.number().int().nonnegative(),
  }),
  explosion: z.strictObject({
    radiusPx: z.number().int().positive(),
    telegraphMs: z.number().int().positive(),
    damageMultiplier: z.number().positive(),
  }),
  ranged: z.strictObject({
    projectileSpeedPxPerSec: z.number().int().positive(),
    projectileMaxRangePx: z.number().int().positive(),
    hitRadiusPx: z.number().int().positive(),
  }),
});
/**
 * Tuning for one level of the endless Corrupted Forest (Paso 9). Each level scales monotonically
 * (enforced by validation) so progression is always "harder than before, never easier". All values
 * PROVISIONAL and versioned via `BALANCE_VERSION`. Consumed by `packages/shared/endless-forest.ts`.
 */
export const ForestLevelTuningSchema = z.strictObject({
  level: z.number().int().positive(),
  enemyHealthMultiplier: z.number().positive(),
  enemyDamageMultiplier: z.number().positive(),
  waveSize: z.number().int().positive(),
  xpToAdvance: z.number().int().nonnegative(),
});
export const EndlessForestSchema = z.strictObject({
  tuningStatus: z.literal('PROVISIONAL'),
  minimumLevel: z.literal(1),
  maximumLevel: z.literal(20),
  levels: z.array(ForestLevelTuningSchema).length(20),
});
export const MapDefinitionSchema = z.strictObject({
  id: z.literal('map.corrupted_forest'),
  format: z.literal('tiled'),
  version: VersionSchema,
  requiredLayers: z
    .array(
      z.enum([
        'ground',
        'decoration_lower',
        'collisions',
        'interactive_objects',
        'obstacles',
        'decoration_upper',
        'spawn_zones',
        'camera_zones',
        'altars',
        'doors',
        'portal',
        'boss_arena',
        'checkpoints',
        'ambient_sound',
        'minimap',
      ]),
    )
    .length(15),
  objects: z.array(MapObjectPropertiesSchema),
});
export const LootTableEntrySchema = z.strictObject({
  definitionId: IdSchema,
  weight: z.number().int().positive(),
  dropChance: z.number().min(0).max(1),
  minimumLevel: z.number().int().positive(),
  maximumLevel: z.number().int().positive(),
});
export const LootTableSchema = z.strictObject({
  id: IdSchema,
  source: z.string().trim().min(1).max(64),
  tuningStatus: z.literal('PROVISIONAL'),
  entries: z.array(LootTableEntrySchema).min(1),
});
export const ItemGenerationConfigSchema = z.strictObject({
  generatorVersion: z.string().trim().min(1).max(64),
  rarityWeights: z
    .array(z.strictObject({ rarity: ItemRaritySchema, weight: z.number().int().positive() }))
    .min(1),
  affixCountByRarity: z.strictObject({
    common: z.literal(0),
    magic: z.number().int().min(0).max(4),
    rare: z.number().int().min(0).max(4),
    legendary: z.number().int().min(0).max(4),
  }),
});
export const GameDataCatalogSchema = z.strictObject({
  version: VersionSchema,
  balance: BalanceSchema,
  progression: CharacterProgressionSchema,
  guardianCombat: GuardianCombatSchema,
  barbarianCombat: BarbarianCombatSchema,
  guardian: GuardianDefinitionSchema,
  attributes: z.array(AttributeDefinitionSchema).length(4),
  abilities: z.array(GuardianAbilitySchema).length(5),
  itemTypes: z.array(ItemTypeDefinitionSchema).length(10),
  rarities: z.array(RarityDefinitionSchema).length(4),
  itemDefinitions: z.array(ItemDefinitionSchema).min(1),
  affixes: z.array(AffixDefinitionSchema).min(1),
  lootTables: z.array(LootTableSchema).min(1),
  itemGeneration: ItemGenerationConfigSchema,
  enemies: z.array(EnemyDefinitionSchema).length(10),
  enemyTuning: z.array(EnemyTuningSchema).length(10),
  enemyAbilityTuning: EnemyAbilityTuningSchema,
  endlessForest: EndlessForestSchema,
  zone: ZoneDefinitionSchema,
  mission: MissionDefinitionSchema,
  spriteSheets: z.array(SpriteSheetSchema).min(1),
  animations: z.array(SpriteAnimationSchema).min(1),
  assets: z.array(AssetManifestEntrySchema).min(1),
  maps: z.array(MapDefinitionSchema).length(1),
  hazards: z.array(HazardDefinitionSchema).length(1),
  contentExpansion: ContentExpansionRegistrySchema,
  /**
   * Post-MVP class expansion registry (M1, `docs/plans/post-goal-class-expansion.md`). Carries
   * Guardian's identity as one `ClassDefinition` for shape parity; Guardian's actual abilities and
   * combat tuning stay authoritative in `guardian`/`guardianCombat` above, untouched by this field.
   */
  classRegistry: ClassRegistrySchema,
});

export type TuningStatus = z.infer<typeof TuningStatusSchema>;
export type AttributeEffect = z.infer<typeof AttributeEffectSchema>;
export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;
export type AbilityMechanic = z.infer<typeof AbilityMechanicSchema>;
export type GuardianAbility = z.infer<typeof GuardianAbilitySchema>;
export type GuardianDefinition = z.infer<typeof GuardianDefinitionSchema>;
export type ItemTypeDefinition = z.infer<typeof ItemTypeDefinitionSchema>;
export type RarityDefinition = z.infer<typeof RarityDefinitionSchema>;
export type LootTableEntry = z.infer<typeof LootTableEntrySchema>;
export type LootTable = z.infer<typeof LootTableSchema>;
export type ItemGenerationConfig = z.infer<typeof ItemGenerationConfigSchema>;
export type EnemyBehavior = z.infer<typeof EnemyBehaviorSchema>;
export type EnemyDefinition = z.infer<typeof EnemyDefinitionSchema>;
export type EnemyAttackTuning = z.infer<typeof EnemyAttackTuningSchema>;
export type EnemyTuning = z.infer<typeof EnemyTuningSchema>;
export type EnemyAbilityTuning = z.infer<typeof EnemyAbilityTuningSchema>;
export type ForestLevelTuning = z.infer<typeof ForestLevelTuningSchema>;
export type EndlessForest = z.infer<typeof EndlessForestSchema>;
export type ZoneDefinition = z.infer<typeof ZoneDefinitionSchema>;
export type MissionDefinition = z.infer<typeof MissionDefinitionSchema>;
export type Balance = z.infer<typeof BalanceSchema>;
export type GuardianCombatAbility = z.infer<typeof GuardianCombatAbilitySchema>;
export type GuardianCombat = z.infer<typeof GuardianCombatSchema>;
export type MapDefinition = z.infer<typeof MapDefinitionSchema>;
export type HazardDefinition = z.infer<typeof HazardDefinitionSchema>;
export type CharacterProgression = z.infer<typeof CharacterProgressionSchema>;
export type ExpansionEnemyDefinition = z.infer<typeof ExpansionEnemyDefinitionSchema>;
export type ExpansionMapDefinition = z.infer<typeof ExpansionMapDefinitionSchema>;
export type ExpansionZoneDefinition = z.infer<typeof ExpansionZoneDefinitionSchema>;
export type ContentExpansionRegistry = z.infer<typeof ContentExpansionRegistrySchema>;
export type GameDataCatalog = z.infer<typeof GameDataCatalogSchema>;
