// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameApi, type ProgressionSnapshot } from '../api';
import { Character } from './Character';
import {
  saveLocalProgression,
  createLocalProgression,
  applyLocalExperience,
} from '../game/local-progression';

const snapshot: ProgressionSnapshot = {
  schemaVersion: 1,
  characterId: 'character:test',
  class: 'GUARDIAN',
  revision: 2,
  level: 2,
  experience: 100,
  xpInLevel: 0,
  xpToNextLevel: 150,
  attributePoints: 3,
  totalAttributePoints: 3,
  attributes: { strength: 10, dexterity: 10, intelligence: 10, vitality: 10 },
  derivedStats: {
    maxHealth: 220,
    physicalDamageMin: 28,
    physicalDamageMax: 41,
    armor: 30,
    criticalChancePercent: 10,
    attackSpeedPercent: 3.5,
  },
  skills: [],
  equippedAbilityIds: [],
  buildFingerprint: 'a'.repeat(64),
  gameDataVersion: 'test',
  balanceVersion: 'test',
  formulaVersion: 'character-progression.1',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Character screen', () => {
  it('renders server progression and sends one-point allocation intent', async () => {
    vi.spyOn(gameApi, 'progression').mockResolvedValue({ progression: snapshot });
    vi.spyOn(gameApi, 'allocateAttribute').mockResolvedValue({
      receipt: {
        operationId: 'op',
        requestHash: 'hash',
        kind: 'allocate_attributes',
        replayed: false,
        snapshot: {
          ...snapshot,
          attributePoints: 2,
          attributes: { ...snapshot.attributes, strength: 11 },
        },
      },
    });
    render(<Character characterId="character:test" onBack={vi.fn()} />);
    expect(await screen.findByText('Hoja del Guardián')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar Fuerza' }));
    await waitFor(() =>
      expect(gameApi.allocateAttribute).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: 'character:test',
          attribute: 'strength',
          amount: 1,
        }),
      ),
    );
  });

  it('allocates attributes in the offline preview without calling the API', async () => {
    const local = applyLocalExperience(createLocalProgression('preview:test'), 100).snapshot;
    saveLocalProgression(local);
    const progression = vi.spyOn(gameApi, 'progression');
    render(<Character characterId="preview:test" local onBack={vi.fn()} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Aumentar Fuerza' }));
    await waitFor(() => expect(screen.getByText('2')).toBeTruthy());
    expect(progression).not.toHaveBeenCalled();
  });
});
