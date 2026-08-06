import { GAME_DATA, GAME_DATA_VERSION } from '@brecha/game-data';
import { ItemRaritySchema, ItemTypeSchema } from '@brecha/shared';
import { z } from 'zod';

export const TOWN_CATALOG_VERSION = 'town.mvp.1' as const;
export const TOWN_FORMULA_VERSION = 'town-economy.1' as const;

export const MerchantStockSchema = z.strictObject({
  stockId: z.string().trim().min(1).max(64),
  definitionId: z.string().trim().min(1).max(128),
  itemLevel: z.number().int().positive(),
  rarity: ItemRaritySchema,
  price: z.number().int().positive(),
});
export type MerchantStock = z.infer<typeof MerchantStockSchema>;

/** Fixed server-side stock for the first town. Prices are gold sinks, never client input. */
export const TOWN_MERCHANT_STOCK: readonly MerchantStock[] = [
  {
    stockId: 'merchant.iron-sword',
    definitionId: 'item.weapon.iron_sword',
    itemLevel: 1,
    rarity: 'common',
    price: 80,
  },
  {
    stockId: 'merchant.iron-helm',
    definitionId: 'item.armor.iron_helm',
    itemLevel: 1,
    rarity: 'common',
    price: 60,
  },
  {
    stockId: 'merchant.leather-cuirass',
    definitionId: 'item.armor.leather_cuirass',
    itemLevel: 1,
    rarity: 'common',
    price: 90,
  },
  {
    stockId: 'merchant.iron-gloves',
    definitionId: 'item.armor.iron_gloves',
    itemLevel: 1,
    rarity: 'common',
    price: 50,
  },
  {
    stockId: 'merchant.traveler-boots',
    definitionId: 'item.armor.traveler_boots',
    itemLevel: 1,
    rarity: 'common',
    price: 55,
  },
  {
    stockId: 'merchant.forest-amulet',
    definitionId: 'item.accessory.forest_amulet',
    itemLevel: 2,
    rarity: 'magic',
    price: 180,
  },
];

const validatedStock = TOWN_MERCHANT_STOCK.map((entry) => MerchantStockSchema.parse(entry));

export type MerchantStockSnapshot = MerchantStock & {
  displayName: string;
  type: z.infer<typeof ItemTypeSchema>;
  slot?: string;
  itemPowerRange: readonly [number, number];
};

export function merchantStockById(stockId: string): MerchantStock {
  const stock = validatedStock.find((entry) => entry.stockId === stockId);
  if (stock === undefined) throw new MerchantStockNotFoundError();
  return stock;
}

export function merchantCatalog(): readonly MerchantStockSnapshot[] {
  return validatedStock.map((entry) => {
    const definition = GAME_DATA.itemDefinitions.find(
      (candidate) => candidate.id === entry.definitionId,
    );
    if (definition === undefined)
      throw new Error(`Merchant definition missing: ${entry.definitionId}`);
    return {
      ...entry,
      displayName: definition.displayName,
      type: definition.type,
      ...(definition.slot === undefined ? {} : { slot: definition.slot }),
      itemPowerRange: definition.itemPowerRange,
    };
  });
}

export class MerchantStockNotFoundError extends Error {
  public constructor() {
    super('The requested merchant stock entry does not exist.');
    this.name = 'MerchantStockNotFoundError';
  }
}

export const TOWN_DATA_VERSION = GAME_DATA_VERSION;
