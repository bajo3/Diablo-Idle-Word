// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Settings } from './Settings';
import { GAME_SETTINGS_STORAGE_KEY } from '../settings';

describe('Settings', () => {
  it('persists volume buses and exposes an accessible mute toggle', () => {
    render(<Settings onBack={vi.fn()} />);
    const effects = screen.getByLabelText('Efectos');
    fireEvent.change(effects, { target: { value: '0.25' } });
    expect(JSON.parse(localStorage.getItem(GAME_SETTINGS_STORAGE_KEY) ?? '{}')).toMatchObject({
      sfxVolume: 0.25,
    });
    const soundRow = screen.getByText('Efectos de sonido').parentElement;
    expect(soundRow).not.toBeNull();
    const sound = within(soundRow!).getByRole('button', { name: 'Activado' });
    fireEvent.click(sound);
    expect(sound.getAttribute('aria-pressed')).toBe('false');
  });
});
