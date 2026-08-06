import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GAME_SETTINGS,
  LEGACY_GAME_SETTINGS_STORAGE_KEY,
  GAME_SETTINGS_STORAGE_KEY,
  readGameSettings,
  sanitizeGameSettings,
} from './settings';

describe('game settings', () => {
  it('clamps volume values and keeps boolean preferences safe', () => {
    expect(sanitizeGameSettings({ masterVolume: 2, sfxVolume: -1, sound: false })).toMatchObject({
      masterVolume: 1,
      sfxVolume: 0,
      sound: false,
      music: true,
    });
  });

  it('reads the current key and migrates the legacy boolean shape', () => {
    const storage = new Map<string, string>([
      [LEGACY_GAME_SETTINGS_STORAGE_KEY, JSON.stringify({ sound: false, music: false })],
    ]);
    const adapter = { getItem: (key: string) => storage.get(key) ?? null };
    expect(readGameSettings(adapter)).toMatchObject({ sound: false, music: false });
    expect(readGameSettings({ getItem: () => null })).toEqual(DEFAULT_GAME_SETTINGS);
    expect(GAME_SETTINGS_STORAGE_KEY).toBe('lbo-settings-v2');
  });
});
