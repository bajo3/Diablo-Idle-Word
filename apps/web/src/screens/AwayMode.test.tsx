// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameApi } from '../api';
import { AwayMode } from './AwayMode';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AwayMode', () => {
  it('starts a server calibration from the visible preparation action', async () => {
    vi.spyOn(gameApi, 'awayStatus').mockResolvedValue({
      away: { characterId: 'character:test', availability: 'AVAILABLE', serverNowMs: Date.now() },
    });
    vi.spyOn(gameApi, 'startAwayCalibration').mockResolvedValue({
      away: {
        characterId: 'character:test',
        availability: 'AWAY_CALIBRATING',
        serverNowMs: Date.now(),
        calibration: {
          id: 'calibration:test',
          state: 'RUNNING',
          zoneId: 'corrupted_forest',
          difficulty: 'normal',
          buildFingerprint: 'fingerprint',
          startedAtServerMs: Date.now(),
          validDurationSeconds: 0,
          metrics: {
            validDurationSeconds: 0,
            normalEnemiesDefeated: 0,
            eliteEnemiesDefeated: 0,
            rewards: { experience: 0, gold: 0, materials: 0 },
            damageDealt: 0,
            damageTaken: 0,
            deathsOrDowns: 0,
            effectiveCombatSeconds: 0,
            droppedItemsByRarity: { common: 0, magic: 0, rare: 0, legendary: 0 },
            magicFind: 0,
          },
          estimatePerHour: { experience: 0, gold: 0, materials: 0, enemies: 0 },
        },
      },
    });
    render(<AwayMode characterId="character:test" characterName="Muro" onBack={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Preparar modo offline' }));
    expect(gameApi.startAwayCalibration).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: 'character:test',
        zoneId: 'corrupted_forest',
        difficulty: 'normal',
      }),
    );
    expect(await screen.findByText('Calibrando rendimiento real')).toBeTruthy();
  });
});
