// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { gameApi, type ProgressionSnapshot } from '../api';
import { Skills } from './Skills';

const snapshot: ProgressionSnapshot = {
  schemaVersion: 1,
  characterId: 'character:test',
  class: 'GUARDIAN',
  revision: 2,
  level: 2,
  experience: 100,
  xpInLevel: 0,
  xpToNextLevel: 150,
  attributePoints: 1,
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
  skills: [
    {
      abilityId: 'ability.guardian.slash',
      displayName: 'Tajo',
      description: 'Ataque',
      unlockLevel: 1,
      unlocked: true,
      equipped: true,
      barSlot: 0,
      level: 1,
    },
    {
      abilityId: 'ability.guardian.power_strike',
      displayName: 'Golpe poderoso',
      description: 'Golpe',
      unlockLevel: 2,
      unlocked: false,
      equipped: false,
      barSlot: null,
      level: 0,
    },
  ],
  equippedAbilityIds: ['ability.guardian.slash'],
  buildFingerprint: 'b'.repeat(64),
  gameDataVersion: 'test',
  balanceVersion: 'test',
  formulaVersion: 'character-progression.1',
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Skills screen', () => {
  it('shows locked requirements and sends learn intent for an eligible skill', async () => {
    vi.spyOn(gameApi, 'progression').mockResolvedValue({ progression: snapshot });
    vi.spyOn(gameApi, 'learnSkill').mockResolvedValue({
      receipt: {
        operationId: 'op',
        requestHash: 'hash',
        kind: 'learn_skill',
        replayed: false,
        snapshot: {
          ...snapshot,
          skills: snapshot.skills.map((skill) =>
            skill.abilityId.endsWith('power_strike')
              ? { ...skill, unlocked: true, level: 1 }
              : skill,
          ),
        },
      },
    });
    render(<Skills characterId="character:test" onBack={vi.fn()} />);
    expect(await screen.findByText('Se desbloquea en nivel 2')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Aprender' }));
    await waitFor(() =>
      expect(gameApi.learnSkill).toHaveBeenCalledWith(
        expect.objectContaining({
          characterId: 'character:test',
          abilityId: 'ability.guardian.power_strike',
        }),
      ),
    );
  });

  it('renders the Barbarian branch metadata and keeps passive nodes off the action bar', async () => {
    const barbarian: ProgressionSnapshot = {
      ...snapshot,
      class: 'BARBARIAN',
      skills: [
        {
          abilityId: 'ability.barbarian.cleave',
          displayName: 'Hachazo creciente',
          description: 'Golpe frontal.',
          unlockLevel: 1,
          unlocked: true,
          equipped: true,
          barSlot: 0,
          level: 1,
          nodeId: 'node.barbarian.bloodsong.cleave',
          branchId: 'branch.barbarian.bloodsong',
          kind: 'active',
        },
        {
          abilityId: 'node.barbarian.bloodsong.blood_rush',
          displayName: 'Impulso de sangre',
          description: 'Velocidad.',
          unlockLevel: 2,
          unlocked: true,
          equipped: false,
          barSlot: null,
          level: 1,
          nodeId: 'node.barbarian.bloodsong.blood_rush',
          branchId: 'branch.barbarian.bloodsong',
          kind: 'passive',
        },
      ],
      equippedAbilityIds: ['ability.barbarian.cleave'],
    };
    vi.spyOn(gameApi, 'progression').mockResolvedValue({ progression: barbarian });
    render(<Skills characterId="character:test" onBack={vi.fn()} />);
    expect(await screen.findByText('Rama · Canto de sangre')).toBeTruthy();
    expect(screen.getByText('Pasiva · no ocupa ranura')).toBeTruthy();
    expect(screen.getByText('Impulso de sangre')).toBeTruthy();
  });
});
