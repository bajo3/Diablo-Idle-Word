export const GAME_SETTINGS_STORAGE_KEY = 'lbo-settings-v2';
export const LEGACY_GAME_SETTINGS_STORAGE_KEY = 'lbo-settings-v1';
export const GAME_SETTINGS_EVENT = 'lbo:settings-changed';

export type GameSettings = Readonly<{
  sound: boolean;
  music: boolean;
  reducedMotion: boolean;
  masterVolume: number;
  musicVolume: number;
  ambienceVolume: number;
  sfxVolume: number;
  uiVolume: number;
}>;

export const DEFAULT_GAME_SETTINGS: GameSettings = Object.freeze({
  sound: true,
  music: true,
  reducedMotion: false,
  masterVolume: 0.8,
  musicVolume: 0.45,
  ambienceVolume: 0.35,
  sfxVolume: 0.7,
  uiVolume: 0.65,
});

const volumeKeys = [
  'masterVolume',
  'musicVolume',
  'ambienceVolume',
  'sfxVolume',
  'uiVolume',
] as const;

export function sanitizeGameSettings(input: unknown): GameSettings {
  const source = isRecord(input) ? input : {};
  const legacySound =
    typeof source.sound === 'boolean' ? source.sound : DEFAULT_GAME_SETTINGS.sound;
  const legacyMusic =
    typeof source.music === 'boolean' ? source.music : DEFAULT_GAME_SETTINGS.music;
  const reducedMotion =
    typeof source.reducedMotion === 'boolean'
      ? source.reducedMotion
      : DEFAULT_GAME_SETTINGS.reducedMotion;
  const volumes = Object.fromEntries(
    volumeKeys.map((key) => [key, clampVolume(source[key], DEFAULT_GAME_SETTINGS[key])]),
  ) as Pick<GameSettings, (typeof volumeKeys)[number]>;
  return Object.freeze({
    sound: legacySound,
    music: legacyMusic,
    reducedMotion,
    ...volumes,
  });
}

export function readGameSettings(storage?: Pick<Storage, 'getItem'>): GameSettings {
  const target = storage ?? safeLocalStorage();
  if (target === undefined) return DEFAULT_GAME_SETTINGS;
  for (const key of [GAME_SETTINGS_STORAGE_KEY, LEGACY_GAME_SETTINGS_STORAGE_KEY]) {
    try {
      const raw = target.getItem(key);
      if (raw !== null) return sanitizeGameSettings(JSON.parse(raw) as unknown);
    } catch {
      // A blocked or malformed localStorage entry must never prevent the game from booting.
    }
  }
  return DEFAULT_GAME_SETTINGS;
}

export function writeGameSettings(
  settings: GameSettings,
  storage?: Pick<Storage, 'setItem'>,
): GameSettings {
  const normalized = sanitizeGameSettings(settings);
  const target = storage ?? safeLocalStorage();
  try {
    target?.setItem(GAME_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // Settings remain active in memory if storage is unavailable.
  }
  return normalized;
}

export function publishGameSettings(settings: GameSettings): GameSettings {
  const normalized = writeGameSettings(settings);
  if (typeof window !== 'undefined')
    window.dispatchEvent(
      new CustomEvent<GameSettings>(GAME_SETTINGS_EVENT, { detail: normalized }),
    );
  return normalized;
}

function clampVolume(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function safeLocalStorage(): Storage | undefined {
  try {
    return typeof window === 'undefined' ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}
