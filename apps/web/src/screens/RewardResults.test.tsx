// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameApi } from '../api';
import { RewardResults } from './RewardResults';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('RewardResults', () => {
  it('renders only the authenticated character result with its private item', async () => {
    vi.spyOn(gameApi, 'recentRewards').mockResolvedValue({
      results: [
        {
          operationId: 'reward:test',
          characterId: 'character:test',
          archetype: 'corrupted_minion',
          experienceDelta: '10',
          goldDelta: '5',
          materialsDelta: '1',
          forestLevel: 2,
          forestXpInLevel: 3,
          forestBestLevel: 2,
          leveledUp: true,
          drop: {
            instanceId: 'item:test',
            definitionId: 'item.weapon.corrupted_guardian',
            itemLevel: 2,
            rarity: 'rare',
            itemPower: 12,
            baseStats: [],
            affixes: [],
            generationSeed: 'test-seed',
            generatorVersion: 'item-generation.1',
            source: 'enemy_defeat',
            quantity: 1,
          },
          dropStatus: 'granted',
          difficulty: 'veteran',
          partySize: 2,
          visibility: 'private',
          createdAtMs: Date.UTC(2026, 7, 4, 12),
        },
      ],
    });
    render(<RewardResults characterId="character:test" onBack={vi.fn()} />);
    expect(await screen.findByText(/Corrupted Minion/)).toBeTruthy();
    expect(screen.getByText(/Objeto:/)).toBeTruthy();
    expect(screen.getByText(/Veterano/)).toBeTruthy();
    expect(gameApi.recentRewards).toHaveBeenCalledWith('character:test');
  });
});
