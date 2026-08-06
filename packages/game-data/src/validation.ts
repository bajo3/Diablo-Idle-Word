import { validateClassRegistry } from '@brecha/shared';

import { GameDataCatalogSchema, type GameDataCatalog } from './schemas.js';

function duplicateIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
}

function hasExactMembers(values: readonly string[], expected: readonly string[]): boolean {
  return (
    values.length === expected.length &&
    new Set(values).size === expected.length &&
    expected.every((value) => values.includes(value))
  );
}

/** Validates cross-references in addition to each strict Zod schema. */
export function validateGameData(input: unknown): GameDataCatalog {
  const data = GameDataCatalogSchema.parse(input);
  if (data.progression.xpToReachLevel[0] !== 0)
    throw new Error('Character progression must start at zero XP');
  for (let index = 1; index < data.progression.xpToReachLevel.length; index += 1) {
    const previous = data.progression.xpToReachLevel[index - 1] ?? 0;
    const current = data.progression.xpToReachLevel[index] ?? 0;
    if (current <= previous) throw new Error('Character progression XP thresholds must increase');
  }
  const duplicateGroups = [
    ['ability', data.abilities.map(({ id }) => id)],
    ['attribute', data.attributes.map(({ id }) => id)],
    ['item type', data.itemTypes.map(({ id }) => id)],
    ['rarity', data.rarities.map(({ id }) => id)],
    ['item definition', data.itemDefinitions.map(({ id }) => id)],
    ['affix', data.affixes.map(({ id }) => id)],
    ['loot table', data.lootTables.map(({ id }) => id)],
    ['enemy', data.enemies.map(({ id }) => id)],
    ['enemy tuning', data.enemyTuning.map(({ enemyId }) => enemyId)],
    ['sprite sheet', data.spriteSheets.map(({ id }) => id)],
    ['animation', data.animations.map(({ id }) => id)],
    ['asset', data.assets.map(({ id }) => id)],
    ['map', data.maps.map(({ id }) => id)],
    ['hazard', data.hazards.map(({ id }) => id)],
  ] as const;
  for (const [group, ids] of duplicateGroups) {
    const duplicates = duplicateIds(ids);
    if (duplicates.length > 0) throw new Error(`Duplicate ${group} IDs: ${duplicates.join(', ')}`);
  }
  const abilityIds = new Set(data.abilities.map(({ id }) => id));
  for (const id of data.guardian.abilityIds)
    if (!abilityIds.has(id)) throw new Error(`Guardian references unknown ability: ${id}`);
  const combatAbilityIds = new Set(data.guardianCombat.abilities.map(({ id }) => id));
  for (const id of data.guardian.abilityIds)
    if (!combatAbilityIds.has(id))
      throw new Error(`Guardian combat tuning is missing ability: ${id}`);
  for (const ability of data.abilities)
    if (!data.guardian.abilityIds.includes(ability.id))
      throw new Error(`Ability is not assigned to Guardian: ${ability.id}`);
  const attributeIds = data.attributes.map(({ id }) => id);
  if (
    !hasExactMembers(data.guardian.attributeIds, attributeIds) ||
    !hasExactMembers(data.guardian.attributeKeys, attributeIds)
  )
    throw new Error('Guardian attribute references must match the attribute catalog');
  const expectedAiStates = [
    'idle',
    'patrol',
    'detect',
    'chase',
    'attack',
    'use_ability',
    'retreat',
    'stunned',
    'dead',
  ];
  for (const enemy of data.enemies)
    if (!hasExactMembers(enemy.aiStates, expectedAiStates))
      throw new Error(`Enemy has invalid AI state graph: ${enemy.id}`);
  for (const tuning of data.enemyTuning)
    if (tuning.loseTargetRadiusPx <= tuning.detectRadiusPx)
      throw new Error(
        `Enemy detection needs hysteresis (loseTargetRadiusPx > detectRadiusPx): ${tuning.enemyId}`,
      );
  const itemDefinitionIds = new Set(data.itemDefinitions.map(({ id }) => id));
  const itemTypes = new Map(data.itemTypes.map((definition) => [definition.id, definition]));
  for (const definition of data.itemDefinitions) {
    const type = itemTypes.get(definition.type);
    if (type === undefined)
      throw new Error(`Item definition references unknown type: ${definition.id}`);
    if (definition.slot !== undefined && !type.compatibleSlots.includes(definition.slot))
      throw new Error(`Item definition uses incompatible slot: ${definition.id}`);
    for (const stat of definition.baseStats)
      if (stat.max < stat.min)
        throw new Error(`Item definition has descending stat range: ${definition.id}`);
  }
  const affixIds = new Set(data.affixes.map(({ id }) => id));
  if (
    new Set(data.itemGeneration.rarityWeights.map(({ rarity }) => rarity)).size !==
    data.itemGeneration.rarityWeights.length
  )
    throw new Error('Item generation rarity weights must be unique');
  for (const table of data.lootTables)
    for (const entry of table.entries) {
      if (!itemDefinitionIds.has(entry.definitionId))
        throw new Error(`Loot table references unknown item definition: ${entry.definitionId}`);
      if (entry.maximumLevel < entry.minimumLevel)
        throw new Error(`Loot table level range is descending: ${table.id}`);
    }
  if (affixIds.size !== data.affixes.length)
    throw new Error('Affix catalog contains duplicate IDs');
  const enemyIds = new Set(data.enemies.map(({ id }) => id));
  for (const id of data.zone.enemyIds)
    if (!enemyIds.has(id)) throw new Error(`Zone references unknown enemy: ${id}`);
  const mapIds = new Set<string>(data.maps.map(({ id }) => id));
  if (!mapIds.has(data.zone.mapId))
    throw new Error(`Zone references unknown map: ${data.zone.mapId}`);
  const sheetIds = new Set(data.spriteSheets.map(({ id }) => id));
  const assetsById = new Map(data.assets.map((asset) => [asset.id, asset]));
  const animationIds = new Set(data.animations.map(({ id }) => id));
  for (const sheet of data.spriteSheets) {
    const asset = assetsById.get(sheet.id);
    if (
      asset === undefined ||
      asset.type !== 'spritesheet' ||
      asset.spriteSheet === undefined ||
      asset.spriteSheet.id !== sheet.id
    )
      throw new Error(`Sprite sheet has no matching asset manifest entry: ${sheet.id}`);
  }
  for (const asset of data.assets) {
    if (duplicateIds(asset.animationIds).length > 0)
      throw new Error(`Asset has duplicate animation references: ${asset.id}`);
    for (const animationId of asset.animationIds)
      if (!animationIds.has(animationId))
        throw new Error(`Asset references unknown animation: ${animationId}`);
    if (asset.type === 'spritesheet' && asset.spriteSheet === undefined)
      throw new Error(`Spritesheet asset is missing spriteSheet metadata: ${asset.id}`);
    if (asset.type !== 'spritesheet' && asset.spriteSheet !== undefined)
      throw new Error(`Non-spritesheet asset cannot have spriteSheet metadata: ${asset.id}`);
  }
  for (const animation of data.animations) {
    const asset = assetsById.get(animation.atlasId);
    if (!sheetIds.has(animation.atlasId) || asset === undefined)
      throw new Error(`Animation references unknown atlas: ${animation.atlasId}`);
    if (!asset.animationIds.includes(animation.id))
      throw new Error(`Animation is missing from asset manifest: ${animation.id}`);
    if (
      animation.hitFrame !== undefined &&
      (animation.hitFrame < animation.startFrame || animation.hitFrame > animation.endFrame)
    )
      throw new Error(`Animation hit frame is outside its range: ${animation.id}`);
    if (
      animation.eventFrames.some(
        ({ frame }) => frame < animation.startFrame || frame > animation.endFrame,
      )
    )
      throw new Error(`Animation event frame is outside its range: ${animation.id}`);
  }
  const classRegistryIssues = validateClassRegistry(data.classRegistry);
  if (classRegistryIssues.length > 0)
    throw new Error(
      `Class registry is invalid: ${classRegistryIssues.map(({ path, message }) => `${path}: ${message}`).join('; ')}`,
    );
  const guardianClass = data.classRegistry.classes.find(({ classId }) => classId === 'guardian');
  if (guardianClass === undefined) throw new Error('Class registry is missing Guardian');
  if (!hasExactMembers(guardianClass.attributeIds, attributeIds))
    throw new Error('Guardian class registry entry has mismatched attribute references');

  const forest = data.endlessForest;
  if (forest.levels.length !== forest.maximumLevel - forest.minimumLevel + 1)
    throw new Error('Endless forest level count does not match its level range');
  for (let i = 0; i < forest.levels.length; i += 1) {
    const level = forest.levels[i]!;
    if (level.level !== forest.minimumLevel + i)
      throw new Error(`Endless forest level ${i} has an out-of-sequence level number`);
    if (i > 0) {
      const prev = forest.levels[i - 1]!;
      if (
        level.enemyHealthMultiplier < prev.enemyHealthMultiplier ||
        level.enemyDamageMultiplier < prev.enemyDamageMultiplier ||
        level.waveSize < prev.waveSize
      )
        throw new Error(`Endless forest scaling is not monotonic at level ${level.level}`);
    }
  }
  return data;
}
