// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GameHudOverlay } from './GameHudOverlay';
import type { ProgressionSnapshot } from '../api';
import type { GameHudSnapshot, GameRuntime } from './runtime';

const hud: GameHudSnapshot = {
  facing: 'down',
  cameraZoom: 1.2307692307,
  paused: false,
  connection: 'online',
  health: 186,
  maxHealth: 220,
  downed: false,
  fury: 45,
  maxFury: 100,
  cooldownRemainingMs: { slash: 0, powerStrike: 2400, whirlwind: 0, ironSkin: 0 },
  ironSkinActive: false,
  enemiesAlive: 3,
  forestLevel: 2,
  forestBestLevel: 2,
  forestXpInLevel: 125,
  forestXpToAdvance: 300,
  forestWaveIndex: 0,
  forestWaveSize: 4,
  experienceEarned: 0,
  potionCharges: 25,
  potionCooldownRemainingMs: 0,
  lootLog: [],
  notifications: [],
};

function renderHud(
  overrides: Partial<GameHudSnapshot> = {},
  progression?: ProgressionSnapshot,
  props: Partial<{ onOpenTown: () => void; runtime: Partial<GameRuntime> }> = {},
) {
  const runtime: GameRuntime = {
    activate: vi.fn(),
    destroy: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
    setConnection: vi.fn(),
    ...props.runtime,
  };
  const onAutoBattleChange = vi.fn();
  const view = render(
    <GameHudOverlay
      autoBattle={false}
      checkpointError={undefined}
      checkpointPending={false}
      hud={{ ...hud, ...overrides }}
      {...(progression === undefined ? {} : { progression })}
      onAutoBattleChange={onAutoBattleChange}
      onCheckpoint={vi.fn()}
      onExit={vi.fn()}
      onOpenInventory={vi.fn()}
      onOpenTown={props.onOpenTown ?? vi.fn()}
      onShowDamageNumbersChange={vi.fn()}
      runtime={runtime}
      showDamageNumbers={true}
      stage={<div data-testid="stage" />}
    />,
  );
  return { ...view, runtime, onAutoBattleChange };
}

describe('GameHudOverlay', () => {
  afterEach(() => cleanup());

  it('keeps the canvas stage and renders the presentation panels/icons', () => {
    renderHud();
    expect(screen.getByTestId('stage')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Mundo' }).getAttribute('data-enemies-alive')).toBe(
      '3',
    );
    expect(screen.getByRole('region', { name: 'Mundo' }).getAttribute('data-camera-zoom')).toBe(
      '1.230769',
    );
    expect(screen.getByRole('region', { name: 'Mundo' }).getAttribute('data-forest-level')).toBe(
      '2',
    );
    expect(
      screen.getByRole('region', { name: 'Mundo' }).getAttribute('data-forest-wave-size'),
    ).toBe('4');
    expect(screen.queryByText('125 / 300 (Bosque)')).toBeNull();
    expect(screen.getByText('BOSQUE CORRUPTO · NIVEL 2 · OLEADA 1')).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Bonificaciones activas' })).toBeTruthy();
    expect(screen.queryByRole('complementary', { name: 'Party' })).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Chat' })).toBeTruthy();
    expect(screen.getByRole('complementary', { name: 'Notificaciones' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tajo (LMB)' })).toBeTruthy();
  });

  it('routes skill and auto actions to their adapters and hides manual controls', () => {
    const { runtime, onAutoBattleChange } = renderHud();
    fireEvent.click(screen.getByRole('button', { name: 'Tajo (LMB)' }));
    fireEvent.click(screen.getByRole('button', { name: 'Combate automático' }));
    expect(runtime.activate).toHaveBeenCalledWith('slash');
    expect(onAutoBattleChange).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('button', { name: 'Pausar' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Guardar punto de control' })).toBeNull();
  });

  it('shows character experience and level progress when the server snapshot is available', () => {
    renderHud(
      {},
      {
        schemaVersion: 1,
        characterId: 'character:1',
        class: 'BARBARIAN',
        revision: 2,
        level: 3,
        experience: 310,
        xpInLevel: 60,
        xpToNextLevel: 200,
        attributePoints: 6,
        totalAttributePoints: 6,
        attributes: { strength: 12, dexterity: 6, intelligence: 3, vitality: 14 },
        derivedStats: {
          maxHealth: 268,
          physicalDamageMin: 32,
          physicalDamageMax: 43,
          armor: 40,
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
    );
    const experience = screen.getByRole('progressbar', { name: 'Experiencia del personaje' });
    expect(experience.getAttribute('aria-valuenow')).toBe('60');
    expect(experience.getAttribute('aria-valuemax')).toBe('200');
    expect(screen.getByText('60 / 200 EXP')).toBeTruthy();
  });

  it('makes a downed Guardian visibly non-terminal and blocks combat controls', () => {
    renderHud({ downed: true, health: 0 });

    expect(screen.getByText('HAS CAÍDO')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Mundo' }).getAttribute('data-guardian-state')).toBe(
      'downed',
    );
    expect(screen.getByRole('button', { name: 'Tajo (LMB)' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Combate autom/ }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('offers a way back to town once the Guardian is down', () => {
    const onOpenTown = vi.fn();
    renderHud({ downed: true, health: 0 }, undefined, { onOpenTown });

    fireEvent.click(screen.getByRole('button', { name: 'VOLVER AL PUEBLO' }));
    expect(onOpenTown).toHaveBeenCalledTimes(1);
  });

  it('drinks a potion, and refuses to when the belt is empty', () => {
    const drinkPotion = vi.fn();
    renderHud({ potionCharges: 3 }, undefined, { runtime: { drinkPotion } });
    const potion = screen.getByRole('button', { name: /Poción de vida/ });
    expect(potion.textContent).toContain('×3');
    fireEvent.click(potion);
    expect(drinkPotion).toHaveBeenCalledTimes(1);

    cleanup();
    renderHud({ potionCharges: 0 }, undefined, { runtime: { drinkPotion } });
    expect(screen.getByRole('button', { name: /Poción de vida/ }).hasAttribute('disabled')).toBe(
      true,
    );
  });

  it('switches chat tabs without changing the canvas stage', () => {
    renderHud();
    fireEvent.click(screen.getByRole('button', { name: 'SISTEMA' }));
    expect(screen.queryByText('Oleada')).toBeNull();
    expect(screen.getByText('Bienvenido a La Brecha Oscura')).toBeTruthy();
    expect(screen.getByTestId('stage')).toBeTruthy();
  });

  it('renders event-driven loot and notifications in place of reference fixtures', () => {
    renderHud({
      lootLog: [{ id: 'loot-event', label: '+ 10 EXP', tone: 'blue' }],
      notifications: [
        {
          id: 'notification-event',
          title: 'Recompensa obtenida',
          detail: 'Corrupted Minion · Nivel del bosque 1',
          icon: 'gold',
          tone: 'gold',
        },
      ],
    });
    expect(screen.getByText('+ 10 EXP')).toBeTruthy();
    expect(screen.getByText('Recompensa obtenida')).toBeTruthy();
    expect(screen.queryByText('+ 124 Oro')).toBeNull();
    expect(screen.queryByText('MisiÃ³n completada')).toBeNull();
  });

  it('exposes compact panel navigation for narrow layouts', () => {
    renderHud();
    const compactNav = screen.getByRole('navigation', { name: 'Paneles compactos del HUD' });
    const chatButton = within(compactNav).getByRole('button', { name: /^CHAT$/ });

    expect(within(compactNav).queryByRole('button', { name: /^PARTY$/ })).toBeNull();
    expect(
      within(compactNav)
        .getByRole('button', { name: /^BUFFS$/ })
        .getAttribute('aria-pressed'),
    ).toBe('true');
    expect(chatButton.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(chatButton);

    expect(chatButton.getAttribute('aria-pressed')).toBe('true');
  });
});
