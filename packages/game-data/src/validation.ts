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
  const duplicateGroups = [
    ['ability', data.abilities.map(({ id }) => id)],
    ['attribute', data.attributes.map(({ id }) => id)],
    ['item type', data.itemTypes.map(({ id }) => id)],
    ['rarity', data.rarities.map(({ id }) => id)],
    ['enemy', data.enemies.map(({ id }) => id)],
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
  return data;
}
