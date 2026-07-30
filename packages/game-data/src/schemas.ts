import { z } from 'zod';

import {
  AbilityIdSchema,
  AssetManifestEntrySchema,
  EquipmentSlotSchema,
  IdSchema,
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
export const EnemyDefinitionSchema = z.strictObject({
  id: z.enum([
    'corrupted_minion',
    'possessed_archer',
    'dark_shaman',
    'root_brute',
    'unstable_beast',
  ]),
  displayName: z.string().trim().min(1).max(80),
  behaviors: z
    .array(
      z.enum([
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
      ]),
    )
    .min(1),
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
  enemyIds: z.array(EnemyDefinitionSchema.shape.id).length(5),
  mapId: IdSchema,
  tuningStatus: TuningStatusSchema,
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
export const GameDataCatalogSchema = z.strictObject({
  version: VersionSchema,
  balance: BalanceSchema,
  guardianCombat: GuardianCombatSchema,
  guardian: GuardianDefinitionSchema,
  attributes: z.array(AttributeDefinitionSchema).length(4),
  abilities: z.array(GuardianAbilitySchema).length(5),
  itemTypes: z.array(ItemTypeDefinitionSchema).length(10),
  rarities: z.array(RarityDefinitionSchema).length(4),
  enemies: z.array(EnemyDefinitionSchema).length(5),
  zone: ZoneDefinitionSchema,
  mission: MissionDefinitionSchema,
  spriteSheets: z.array(SpriteSheetSchema).min(1),
  animations: z.array(SpriteAnimationSchema).min(1),
  assets: z.array(AssetManifestEntrySchema).min(1),
  maps: z.array(MapDefinitionSchema).length(1),
  hazards: z.array(HazardDefinitionSchema).length(1),
});

export type TuningStatus = z.infer<typeof TuningStatusSchema>;
export type AttributeEffect = z.infer<typeof AttributeEffectSchema>;
export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;
export type AbilityMechanic = z.infer<typeof AbilityMechanicSchema>;
export type GuardianAbility = z.infer<typeof GuardianAbilitySchema>;
export type GuardianDefinition = z.infer<typeof GuardianDefinitionSchema>;
export type ItemTypeDefinition = z.infer<typeof ItemTypeDefinitionSchema>;
export type RarityDefinition = z.infer<typeof RarityDefinitionSchema>;
export type EnemyDefinition = z.infer<typeof EnemyDefinitionSchema>;
export type ZoneDefinition = z.infer<typeof ZoneDefinitionSchema>;
export type MissionDefinition = z.infer<typeof MissionDefinitionSchema>;
export type Balance = z.infer<typeof BalanceSchema>;
export type GuardianCombatAbility = z.infer<typeof GuardianCombatAbilitySchema>;
export type GuardianCombat = z.infer<typeof GuardianCombatSchema>;
export type MapDefinition = z.infer<typeof MapDefinitionSchema>;
export type HazardDefinition = z.infer<typeof HazardDefinitionSchema>;
export type GameDataCatalog = z.infer<typeof GameDataCatalogSchema>;
