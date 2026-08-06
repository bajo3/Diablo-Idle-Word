// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GameIsland, type RuntimeLoader } from './GameIsland';
import type { GameHudSnapshot } from './runtime';
import { gameApi } from '../api';

afterEach(cleanup);

describe('GameIsland lifecycle', () => {
  it('pauses only for visibility, resumes on return, and removes the listener on unmount', async () => {
    const runtime = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), setConnection: vi.fn() };
    const mountGameRuntime = vi.fn(() => runtime);
    const loadRuntime: RuntimeLoader = async () => ({ mountGameRuntime });
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    const view = render(
      <GameIsland
        characterId="character:1"
        connection="online"
        loadRuntime={loadRuntime}
        onCheckpoint={async () => undefined}
      />,
    );
    await waitFor(() => expect(mountGameRuntime).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(runtime.pause).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(runtime.resume).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(runtime.resume).toHaveBeenCalledTimes(2);
    view.unmount();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(runtime.pause).toHaveBeenCalledTimes(2);
    expect(runtime.resume).toHaveBeenCalledTimes(2);
    if (hiddenDescriptor === undefined) delete (document as { hidden?: boolean }).hidden;
    else Object.defineProperty(document, 'hidden', hiddenDescriptor);
  });

  it('destroys exactly one injected runtime per strict mount without retaining a canvas', async () => {
    const destroy = vi.fn();
    const mountGameRuntime = vi.fn((host: HTMLElement) => {
      const canvas = document.createElement('canvas');
      canvas.dataset.runtimeCanvas = 'phaser';
      host.append(canvas);
      return {
        pause: vi.fn(),
        resume: vi.fn(),
        destroy: () => {
          canvas.remove();
          destroy();
        },
        setConnection: vi.fn(),
      };
    });
    const loadRuntime: RuntimeLoader = async () => ({ mountGameRuntime });
    for (let index = 0; index < 20; index += 1) {
      const view = render(
        <StrictMode>
          <GameIsland
            characterId="character:1"
            connection="online"
            loadRuntime={loadRuntime}
            onCheckpoint={async () => undefined}
          />
        </StrictMode>,
      );
      await waitFor(() =>
        expect(view.container.querySelectorAll('canvas[data-runtime-canvas]').length).toBe(1),
      );
      view.unmount();
      expect(view.container.querySelectorAll('canvas[data-runtime-canvas]')).toHaveLength(0);
    }
    expect(mountGameRuntime).toHaveBeenCalledTimes(20);
    expect(destroy).toHaveBeenCalledTimes(20);
  });

  it('does not render manual pause or checkpoint controls', async () => {
    const runtime = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), setConnection: vi.fn() };
    const mountGameRuntime = vi.fn(() => runtime);
    const loadRuntime: RuntimeLoader = async () => ({ mountGameRuntime });
    render(
      <GameIsland
        characterId="character:1"
        connection="online"
        loadRuntime={loadRuntime}
        onCheckpoint={async () => undefined}
      />,
    );
    await waitFor(() => expect(mountGameRuntime).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar punto de control' })).toBeNull();
  });

  it('saves an idempotent town checkpoint before leaving the expedition', async () => {
    const runtime = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), setConnection: vi.fn() };
    const mountGameRuntime = vi.fn(() => runtime);
    const onCheckpoint = vi.fn(async () => undefined);
    const onOpenTown = vi.fn();
    const loadRuntime: RuntimeLoader = async () => ({ mountGameRuntime });
    render(
      <GameIsland
        characterId="character:town-save"
        connection="online"
        loadRuntime={loadRuntime}
        onCheckpoint={onCheckpoint}
        onOpenTown={onOpenTown}
      />,
    );
    await waitFor(() => expect(mountGameRuntime).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole('button', { name: 'PUEBLO' }));
    await waitFor(() => expect(onCheckpoint).toHaveBeenCalledTimes(1));
    expect(onCheckpoint).toHaveBeenCalledWith(
      expect.objectContaining({ characterId: 'character:town-save', checkpointId: 'town:entry' }),
    );
    expect(onOpenTown).toHaveBeenCalledTimes(1);
  });

  it('binds combat to equipped-gear bonuses, preferring them over bare attributes', async () => {
    const setCharacterProfile = vi.fn();
    const runtime = {
      pause: vi.fn(),
      resume: vi.fn(),
      destroy: vi.fn(),
      setConnection: vi.fn(),
      setEquipmentVisual: vi.fn(),
      setCharacterProfile,
    };
    const mountGameRuntime = vi.fn(() => runtime);
    const loadRuntime: RuntimeLoader = async () => ({ mountGameRuntime });
    const progressionSpy = vi.spyOn(gameApi, 'progression').mockResolvedValue({
      progression: {
        schemaVersion: 1,
        characterId: 'character:geared',
        class: 'BARBARIAN',
        revision: 1,
        level: 3,
        experience: 310,
        xpInLevel: 60,
        xpToNextLevel: 200,
        attributePoints: 0,
        totalAttributePoints: 6,
        // Bare attributes only — equipmentStats below adds gear on top of these.
        attributes: { strength: 12, dexterity: 6, intelligence: 3, vitality: 14 },
        derivedStats: {
          maxHealth: 240,
          physicalDamageMin: 20,
          physicalDamageMax: 30,
          armor: 26,
          criticalChancePercent: 8,
          attackSpeedPercent: 2,
        },
        skills: [],
        equippedAbilityIds: [],
        buildFingerprint: 'a'.repeat(64),
        gameDataVersion: 'test',
        balanceVersion: 'test',
        formulaVersion: 'test',
      },
    });
    const inventorySpy = vi.spyOn(gameApi, 'inventory').mockResolvedValue({
      inventory: {
        characterId: 'character:geared',
        capacity: 40,
        revision: 1,
        schemaVersion: 1,
        items: [],
        equipment: [],
        gold: 4820,
        materials: 137,
        gameDataVersion: 'test',
        // Gear-inclusive: strength is bumped above the bare 12 to prove gear wins the merge.
        derivedStats: {
          strength: 17,
          dexterity: 6,
          intelligence: 3,
          vitality: 14,
          armor: 40,
          physical_damage: 25,
          critical_chance: 6,
          attack_speed_minor: 2,
          max_health: 30,
        },
      },
    });
    try {
      render(
        <GameIsland
          characterId="character:geared"
          connection="online"
          loadRuntime={loadRuntime}
          onCheckpoint={async () => undefined}
        />,
      );
      await waitFor(() =>
        expect(setCharacterProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            level: 3,
            strength: 17,
            dexterity: 6,
            vitality: 14,
            armorBonus: 40,
            physicalDamageBonus: 25,
            maxHealthBonus: 30,
            criticalChanceBonus: 0.06,
          }),
        ),
      );
      // The topbar shows the server's real balances, not the reference fixture's 125.430 gold.
      expect(await screen.findByText('4.820')).toBeTruthy();
      expect(screen.getByText('137')).toBeTruthy();
      expect(screen.queryByText('125.430')).toBeNull();
    } finally {
      progressionSpy.mockRestore();
      inventorySpy.mockRestore();
    }
  });

  it('reports unsynced session XP on checkpoint and never resends what was already saved', async () => {
    let publishHud: ((snapshot: GameHudSnapshot) => void) | undefined;
    const runtime = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), setConnection: vi.fn() };
    const mountGameRuntime = vi.fn(
      (_host: HTMLElement, onHud: (snapshot: GameHudSnapshot) => void) => {
        publishHud = onHud;
        return runtime;
      },
    );
    const onCheckpoint = vi.fn(async () => undefined);
    const onOpenTown = vi.fn();
    const loadRuntime: RuntimeLoader = async () => ({ mountGameRuntime });
    const hud = (experienceEarned: number): GameHudSnapshot => ({
      facing: 'down',
      cameraZoom: 1,
      paused: false,
      connection: 'online',
      health: 220,
      maxHealth: 220,
      downed: false,
      fury: 0,
      maxFury: 100,
      cooldownRemainingMs: { slash: 0, powerStrike: 0, whirlwind: 0, ironSkin: 0 },
      ironSkinActive: false,
      enemiesAlive: 3,
      forestLevel: 1,
      forestBestLevel: 1,
      forestXpInLevel: 0,
      forestXpToAdvance: 100,
      forestWaveIndex: 0,
      forestWaveSize: 3,
      experienceEarned,
      potionCharges: 25,
      potionCooldownRemainingMs: 0,
      lootLog: [],
      notifications: [],
    });
    render(
      <GameIsland
        characterId="character:xp-checkpoint"
        connection="online"
        loadRuntime={loadRuntime}
        onCheckpoint={onCheckpoint}
        onOpenTown={onOpenTown}
      />,
    );
    await waitFor(() => expect(mountGameRuntime).toHaveBeenCalledTimes(1));

    // Wait for the HUD to actually re-render with the published snapshot before clicking — a
    // click right after a bare (non-act) publishHud() would still see the stale, pre-update hud.
    publishHud?.(hud(140));
    await screen.findByText('+140');
    fireEvent.click(screen.getByRole('button', { name: 'PUEBLO' }));
    await waitFor(() => expect(onCheckpoint).toHaveBeenCalledTimes(1));
    expect(onCheckpoint).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ checkpointId: 'town:entry', experienceGained: '140' }),
    );

    // A second visit with 60 more session XP must report only the unsynced remainder, not 200.
    publishHud?.(hud(200));
    await screen.findByText('+200');
    fireEvent.click(screen.getByRole('button', { name: 'PUEBLO' }));
    await waitFor(() => expect(onCheckpoint).toHaveBeenCalledTimes(2));
    expect(onCheckpoint).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ checkpointId: 'town:entry', experienceGained: '60' }),
    );
  });

  it('applies local defeat XP to the preview progression snapshot', async () => {
    let publishHud: ((snapshot: GameHudSnapshot) => void) | undefined;
    const runtime = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), setConnection: vi.fn() };
    const mountGameRuntime = vi.fn(
      (_host: HTMLElement, onHud: (snapshot: GameHudSnapshot) => void) => {
        publishHud = onHud;
        return runtime;
      },
    );
    const loadRuntime: RuntimeLoader = async () => ({ mountGameRuntime });
    render(
      <GameIsland
        characterId="preview:xp-test"
        connection="offline"
        localProgression
        loadRuntime={loadRuntime}
        onCheckpoint={async () => undefined}
      />,
    );
    await waitFor(() => expect(mountGameRuntime).toHaveBeenCalledTimes(1));
    publishHud?.({
      facing: 'down',
      cameraZoom: 1,
      paused: false,
      connection: 'offline',
      health: 220,
      maxHealth: 220,
      downed: false,
      fury: 0,
      maxFury: 100,
      cooldownRemainingMs: { slash: 0, powerStrike: 0, whirlwind: 0, ironSkin: 0 },
      ironSkinActive: false,
      enemiesAlive: 3,
      forestLevel: 1,
      forestBestLevel: 1,
      forestXpInLevel: 0,
      forestXpToAdvance: 100,
      forestWaveIndex: 0,
      forestWaveSize: 3,
      experienceEarned: 100,
      potionCharges: 25,
      potionCooldownRemainingMs: 0,
      lootLog: [],
      notifications: [],
    });
    await waitFor(() => expect(screen.getByText('0 / 150 EXP')).toBeTruthy());
    expect(screen.getByText('NIVEL 2')).toBeTruthy();
  });

  it('applies a pre-mount damage-number choice after a deferred runtime import', async () => {
    const runtime = {
      pause: vi.fn(),
      resume: vi.fn(),
      destroy: vi.fn(),
      setConnection: vi.fn(),
      setDamageNumbers: vi.fn(),
    };
    let resolveLoader: ((value: { mountGameRuntime: () => typeof runtime }) => void) | undefined;
    const loadRuntime: RuntimeLoader = () =>
      new Promise((resolve) => {
        resolveLoader = resolve;
      });
    render(
      <GameIsland
        characterId="character:1"
        connection="online"
        loadRuntime={loadRuntime}
        onCheckpoint={async () => undefined}
      />,
    );
    const damageToggle = await screen.findByRole('checkbox', {
      name: 'Mostrar números de daño',
    });
    fireEvent.click(damageToggle);
    resolveLoader?.({ mountGameRuntime: () => runtime });
    await waitFor(() => expect(runtime.setDamageNumbers).toHaveBeenLastCalledWith(false));
  });
});
