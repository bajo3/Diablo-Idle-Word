import type { CharacterClassId, EquipmentSlot, ItemInstance, ItemStatKey } from '@brecha/shared';

export type Profile = { id: string; email: string; displayName: string };
export type Character = {
  id: string;
  name: string;
  class: CharacterClassId;
  level: number;
  availability: string;
  selected: boolean;
};
export type ForestProgressSnapshot = {
  formatVersion: 1;
  stateSchemaVersion: 1;
  characterId: string;
  revision: number;
  savedAtServerMs: number;
  dataVersion: string;
  balanceVersion: string;
  payload: {
    level: number;
    xpInLevel: number;
    bestLevel: number;
    totalXp: number;
    totalGold: number;
    totalMaterials: number;
    countedDefeats: string[];
  };
};
export type InventoryItemSnapshot = ItemInstance & {
  displayName: string;
  type: string;
  slot?: EquipmentSlot;
  favorite: boolean;
  equippedSlot?: EquipmentSlot;
  sellValue: number;
};
export type InventorySnapshot = {
  characterId: string;
  capacity: number;
  revision: number;
  schemaVersion: number;
  items: InventoryItemSnapshot[];
  equipment: Array<{ itemId: string; slot: EquipmentSlot }>;
  gold: number;
  materials: number;
  derivedStats: Record<ItemStatKey, number>;
  gameDataVersion: string;
};
export type InventoryReceipt = {
  operationId: string;
  requestHash: string;
  kind: string;
  replayed: boolean;
  snapshot: InventorySnapshot;
};
export type MerchantStockSnapshot = {
  stockId: string;
  definitionId: string;
  itemLevel: number;
  rarity: 'common' | 'magic' | 'rare' | 'legendary';
  price: number;
  displayName: string;
  type: string;
  slot?: string;
  itemPowerRange: readonly [number, number];
};
export type TownSnapshot = {
  characterId: string;
  characterName: string;
  level: number;
  availability: string;
  gold: number;
  materials: number;
  inventory: { occupied: number; capacity: number };
  portal: {
    zoneId: 'corrupted_forest';
    label: string;
    active: true;
    destination: 'expedition';
    awayAvailable: true;
  };
  merchant: { catalogVersion: string; items: MerchantStockSnapshot[] };
  chest: { capacity: number; revision: number; schemaVersion: number; occupied: number };
  tutorial: {
    id: 'town-intro.v1';
    status: 'NOT_STARTED' | 'ACTIVE' | 'COMPLETED' | 'SKIPPED';
    runs: number;
    updatedAtServerMs: number;
  };
  gameDataVersion: string;
};
export type ChestSnapshot = {
  characterId: string;
  capacity: number;
  revision: number;
  schemaVersion: number;
  items: InventoryItemSnapshot[];
  gameDataVersion: string;
};
export type ChestReceipt = {
  operationId: string;
  requestHash: string;
  kind: string;
  replayed: boolean;
  chest: ChestSnapshot;
  inventory: InventorySnapshot;
};
export type ProgressionSkillSnapshot = {
  abilityId: string;
  displayName: string;
  description: string;
  unlockLevel: number;
  unlocked: boolean;
  equipped: boolean;
  barSlot: number | null;
  level: number;
  nodeId?: string;
  branchId?: string;
  kind?: 'active' | 'passive' | 'ultimate' | 'basic_attack';
  prerequisiteNodeId?: string;
  pointCost?: number;
  effectIds?: string[];
};
export type ProgressionSnapshot = {
  schemaVersion: 1;
  characterId: string;
  class: CharacterClassId;
  revision: number;
  level: number;
  experience: number;
  xpInLevel: number;
  xpToNextLevel: number;
  attributePoints: number;
  totalAttributePoints: number;
  attributes: { strength: number; dexterity: number; intelligence: number; vitality: number };
  derivedStats: {
    maxHealth: number;
    physicalDamageMin: number;
    physicalDamageMax: number;
    armor: number;
    criticalChancePercent: number;
    attackSpeedPercent: number;
  };
  skills: ProgressionSkillSnapshot[];
  equippedAbilityIds: string[];
  buildFingerprint: string;
  gameDataVersion: string;
  balanceVersion: string;
  formulaVersion: string;
};
export type ProgressionReceipt = {
  operationId: string;
  requestHash: string;
  kind: string;
  replayed: boolean;
  snapshot: ProgressionSnapshot;
};
export type ServerStatus = {
  status: 'available' | 'maintenance';
  message: string;
  gameDataVersion: string;
  protocolVersion: number;
};
export type RewardResult = {
  operationId: string;
  characterId: string;
  archetype: string;
  experienceDelta: string;
  goldDelta: string;
  materialsDelta: string;
  forestLevel: number;
  forestXpInLevel: number;
  forestBestLevel: number;
  leveledUp: boolean;
  drop?: ItemInstance;
  dropStatus: 'granted' | 'no_drop' | 'inventory_full';
  difficulty: 'normal' | 'veteran';
  partySize: number;
  visibility: 'private';
  createdAtMs: number;
};
export type AwayReport = {
  awaySessionId: string;
  calibrationId: string;
  zoneId: string;
  difficulty: 'normal' | 'veteran';
  startedAtServerMs: number;
  endedAtServerMs: number;
  elapsedSeconds: number;
  computedSeconds: number;
  discardedSeconds: number;
  efficiency: number;
  survivalFactor: number;
  estimatedEnemiesDefeated: number;
  rewards: { experience: number; gold: number; materials: number };
  generatedItemsByRarity: { common: number; magic: number; rare: number; legendary: number };
  reductions: string[];
  balanceVersion: string;
  gameDataVersion: string;
  calculationSeed: string;
};
export type AwayStatus = {
  characterId: string;
  availability: string;
  serverNowMs: number;
  calibration?: {
    id: string;
    state: 'NOT_STARTED' | 'RUNNING' | 'VALID' | 'INVALID' | 'ACTIVATED';
    zoneId: string;
    difficulty: 'normal' | 'veteran';
    buildFingerprint: string;
    startedAtServerMs?: number;
    completedAtServerMs?: number;
    validDurationSeconds: number;
    invalidReason?: string;
    metrics: {
      validDurationSeconds: number;
      normalEnemiesDefeated: number;
      eliteEnemiesDefeated: number;
      rewards: { experience: number; gold: number; materials: number };
      damageDealt: number;
      damageTaken: number;
      deathsOrDowns: number;
      effectiveCombatSeconds: number;
      droppedItemsByRarity: { common: number; magic: number; rare: number; legendary: number };
      magicFind: number;
    };
    estimatePerHour: { experience: number; gold: number; materials: number; enemies: number };
  };
  session?: {
    id: string;
    calibrationId: string;
    state: 'ACTIVE' | 'COMPLETED' | 'REWARD_PENDING' | 'CLAIMED' | 'CANCELLED';
    startedAtServerMs: number;
    endedAtServerMs?: number;
    maxDurationSeconds: number;
    zoneId: string;
    difficulty: 'normal' | 'veteran';
  };
  result?: {
    id: string;
    state: 'PENDING' | 'CLAIMED' | 'REJECTED';
    report: AwayReport;
    claimedItems: ItemInstance[];
  };
};
export type ApiFailureKind = 'aborted' | 'http' | 'offline' | 'timeout' | 'unreachable';

export class ApiError extends Error {
  public constructor(
    public readonly kind: ApiFailureKind,
    public readonly status?: number,
    public readonly code = 'network_error',
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

type FetchLike = typeof fetch;
type RequestBody = Record<string, unknown> | undefined;
export type ApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  online?: () => boolean;
  timeoutMs?: number;
};

/**
 * Where the API lives when no explicit base URL is injected: the page's own origin, unless
 * `VITE_API_URL` names a different host.
 *
 * Same-origin is the *default* rather than a production-only branch on purpose. `import.meta.env`'s
 * own DEV/PROD flags proved unreliable here — the repo's root `.env` sets `NODE_ENV=development`,
 * which Vite honours even for `vite build`, so a genuine production bundle came out with
 * `PROD:false` and silently pointed at the developer's localhost. Defaulting to the current origin
 * means the worst case of a misread environment is a working deployment, not a broken login.
 *
 * The split local setup (Vite on 5173, API on 3001) keeps working because it sets `VITE_API_URL`.
 */
export function defaultApiBaseUrl(
  env: Readonly<{ VITE_API_URL?: string | undefined }> = {
    VITE_API_URL: import.meta.env.VITE_API_URL as string | undefined,
  },
): string {
  const configured = env.VITE_API_URL;
  return configured !== undefined && configured.length > 0 ? configured : '';
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly online: () => boolean;
  private readonly timeoutMs: number;

  public constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? defaultApiBaseUrl();
    // A bare `fetch` reference throws "Illegal invocation" in real browsers once called as
    // `this.fetchImpl(...)`: native fetch requires its receiver to be the global object. Binding
    // it here is required, not stylistic - unit tests never caught this because their injected
    // fetchImpl mocks don't have that native receiver check.
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.online = options.online ?? (() => navigator.onLine);
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  public session(): Promise<{ profile: Profile }> {
    return this.read('/api/auth/session');
  }
  public status(): Promise<ServerStatus> {
    return this.read('/api/status', 1);
  }
  public characters(): Promise<{ characters: Character[] }> {
    return this.read('/api/characters');
  }
  public forestProgress(characterId: string): Promise<{ progress: ForestProgressSnapshot }> {
    return this.read(`/api/characters/${encodeURIComponent(characterId)}/forest-progress`);
  }
  public recentRewards(characterId: string): Promise<{ results: RewardResult[] }> {
    return this.read(`/api/characters/${encodeURIComponent(characterId)}/rewards/recent`);
  }
  public town(characterId: string): Promise<{ town: TownSnapshot }> {
    return this.read(`/api/characters/${encodeURIComponent(characterId)}/town`);
  }
  public updateTownTutorial(input: {
    characterId: string;
    operationId: string;
    tutorialId: 'town-intro.v1';
    action: 'start' | 'complete' | 'skip' | 'replay';
  }): Promise<{ receipt: { replayed: boolean; town: TownSnapshot } }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/town/tutorial`,
      'POST',
      input,
    );
  }
  public awayStatus(characterId: string): Promise<{ away: AwayStatus }> {
    return this.read(`/api/characters/${encodeURIComponent(characterId)}/away`);
  }
  public startAwayCalibration(input: {
    characterId: string;
    operationId: string;
    zoneId: 'corrupted_forest';
    difficulty: 'normal' | 'veteran';
  }): Promise<{ away: AwayStatus }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/away/calibration`,
      'POST',
      input,
    );
  }
  public completeAwayCalibration(input: {
    characterId: string;
    calibrationId: string;
  }): Promise<{ away: AwayStatus }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/away/calibration/${encodeURIComponent(input.calibrationId)}/complete`,
      'POST',
      {},
    );
  }
  public activateAway(input: {
    characterId: string;
    calibrationId: string;
    operationId: string;
  }): Promise<{ away: AwayStatus }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/away/activate`,
      'POST',
      input,
    );
  }
  public returnAway(input: {
    characterId: string;
    operationId: string;
  }): Promise<{ away: AwayStatus }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/away/return`,
      'POST',
      input,
    );
  }
  public claimAway(characterId: string): Promise<{
    receipt: { operationId: string; replayed: boolean; result: AwayStatus['result'] };
  }> {
    return this.mutate(`/api/characters/${encodeURIComponent(characterId)}/away/claim`, 'POST', {});
  }
  public inventory(characterId: string): Promise<{ inventory: InventorySnapshot }> {
    return this.read(`/api/characters/${encodeURIComponent(characterId)}/inventory`);
  }
  public progression(characterId: string): Promise<{ progression: ProgressionSnapshot }> {
    return this.read(`/api/characters/${encodeURIComponent(characterId)}/progression`);
  }
  public allocateAttribute(input: {
    characterId: string;
    attribute: keyof ProgressionSnapshot['attributes'];
    amount: number;
    operationId: string;
  }): Promise<{ receipt: ProgressionReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/progression/attributes`,
      'POST',
      input,
    );
  }
  public learnSkill(input: {
    characterId: string;
    abilityId: string;
    operationId: string;
  }): Promise<{ receipt: ProgressionReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/progression/skills/learn`,
      'POST',
      input,
    );
  }
  public setSkillBar(input: {
    characterId: string;
    abilityId: string;
    barSlot: number | null;
    operationId: string;
  }): Promise<{ receipt: ProgressionReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/progression/skills/bar`,
      'POST',
      input,
    );
  }
  public resetAttributes(input: {
    characterId: string;
    operationId: string;
  }): Promise<{ receipt: ProgressionReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/progression/reset-attributes`,
      'POST',
      input,
    );
  }
  public equipItem(input: {
    characterId: string;
    itemId: string;
    operationId: string;
    slot?: EquipmentSlot;
  }): Promise<{ receipt: InventoryReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/inventory/equip`,
      'POST',
      input,
    );
  }
  public unequipItem(input: {
    characterId: string;
    itemId: string;
    operationId: string;
  }): Promise<{ receipt: InventoryReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/inventory/unequip`,
      'POST',
      input,
    );
  }
  public favoriteItem(input: {
    characterId: string;
    itemId: string;
    favorite: boolean;
    operationId: string;
  }): Promise<{ receipt: InventoryReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/inventory/favorite`,
      'POST',
      input,
    );
  }
  public sellItem(input: {
    characterId: string;
    itemId: string;
    operationId: string;
  }): Promise<{ receipt: InventoryReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/inventory/sell`,
      'POST',
      input,
    );
  }
  public buyItem(input: {
    characterId: string;
    stockId: string;
    operationId: string;
  }): Promise<{ receipt: InventoryReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/merchant/buy`,
      'POST',
      input,
    );
  }
  public chest(
    characterId: string,
  ): Promise<{ chest: ChestSnapshot; inventory: InventorySnapshot }> {
    return this.read(`/api/characters/${encodeURIComponent(characterId)}/chest`);
  }
  public depositChest(input: {
    characterId: string;
    itemId: string;
    operationId: string;
  }): Promise<{ receipt: ChestReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/chest/deposit`,
      'POST',
      input,
    );
  }
  public withdrawChest(input: {
    characterId: string;
    itemId: string;
    operationId: string;
  }): Promise<{ receipt: ChestReceipt }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/chest/withdraw`,
      'POST',
      input,
    );
  }
  public login(email: string, password: string): Promise<{ profile: Profile }> {
    return this.mutate('/api/auth/login', 'POST', { email, password });
  }
  public register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ profile: Profile }> {
    return this.mutate('/api/auth/register', 'POST', { email, password, displayName });
  }
  public logout(): Promise<void> {
    return this.mutate('/api/auth/logout', 'POST', {});
  }
  public updateProfile(displayName: string): Promise<{ profile: Profile }> {
    return this.mutate('/api/profile', 'PATCH', { displayName });
  }
  public createGuardian(
    name: string,
    classId: CharacterClassId = 'GUARDIAN',
  ): Promise<{ character: Character }> {
    return this.mutate('/api/characters', 'POST', { name, class: classId });
  }
  public selectCharacter(characterId: string): Promise<{ character: Character }> {
    return this.mutate(`/api/characters/${encodeURIComponent(characterId)}/select`, 'POST', {});
  }
  public deleteCharacter(characterId: string): Promise<void> {
    return this.mutate(`/api/characters/${encodeURIComponent(characterId)}`, 'DELETE', {});
  }
  public saveCheckpoint(input: {
    operationId: string;
    schemaVersion: 1;
    characterId: string;
    sceneId: 'local:test';
    checkpointId: string;
    experienceGained?: string;
  }): Promise<{ receipt: { operationId: string } }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/progress/checkpoints`,
      'POST',
      input,
    );
  }

  private mutate<T>(
    path: string,
    method: 'DELETE' | 'PATCH' | 'POST',
    body: RequestBody,
  ): Promise<T> {
    return this.request<T>(path, method, body);
  }

  private async read<T>(path: string, retries = 0): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await this.request<T>(path, 'GET');
      } catch (error: unknown) {
        lastError = error;
        if (
          !(error instanceof ApiError) ||
          !['offline', 'timeout', 'unreachable'].includes(error.kind)
        )
          throw error;
      }
    }
    throw lastError;
  }

  private request<T>(path: string, method: string, body?: RequestBody): Promise<T> {
    if (!this.online()) return Promise.reject(new ApiError('offline'));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort('timeout'), this.timeoutMs);
    const init: RequestInit = { method, credentials: 'include', signal: controller.signal };
    if (body !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    return this.fetchImpl(`${this.baseUrl}${path}`, init)
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ error: 'network_error' }))) as {
            error?: string;
          };
          throw new ApiError('http', response.status, payload.error ?? 'network_error');
        }
        return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError) throw error;
        if (controller.signal.aborted)
          throw new ApiError(controller.signal.reason === 'timeout' ? 'timeout' : 'aborted');
        throw new ApiError('unreachable');
      })
      .finally(() => window.clearTimeout(timeout));
  }
}

export const gameApi = new ApiClient();
