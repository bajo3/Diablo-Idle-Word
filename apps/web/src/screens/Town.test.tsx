// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameApi, type TownSnapshot } from '../api';
import { Town } from './Town';

const town: TownSnapshot = {
  characterId: 'character:town-ui',
  characterName: 'Muro',
  level: 1,
  availability: 'AVAILABLE',
  gold: 100,
  materials: 3,
  inventory: { occupied: 0, capacity: 40 },
  portal: {
    zoneId: 'corrupted_forest',
    label: 'Bosque Corrupto',
    active: true,
    destination: 'expedition',
    awayAvailable: true,
  },
  merchant: { catalogVersion: 'town.mvp.1', items: [] },
  chest: { capacity: 80, occupied: 0, revision: 1, schemaVersion: 1 },
  tutorial: { id: 'town-intro.v1', status: 'NOT_STARTED', runs: 0, updatedAtServerMs: 0 },
  gameDataVersion: 'test',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Town', () => {
  it('opens the first tutorial and persists completion', async () => {
    vi.spyOn(gameApi, 'town').mockResolvedValue({ town });
    vi.spyOn(gameApi, 'updateTownTutorial').mockResolvedValue({
      receipt: {
        replayed: false,
        town: { ...town, tutorial: { ...town.tutorial, status: 'COMPLETED', runs: 1 } },
      },
    });
    render(
      <Town
        characterId="character:town-ui"
        characterName="Muro"
        level={1}
        gold={0}
        materials={0}
        onDock={vi.fn()}
        onBack={vi.fn()}
      />,
    );
    expect(await screen.findByText('Tres pasos para sobrevivir')).toBeTruthy();
    fireEvent.click(screen.getByText('Marcar como visto'));
    await waitFor(() =>
      expect(gameApi.updateTownTutorial).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'complete', tutorialId: 'town-intro.v1' }),
      ),
    );
  });
});
