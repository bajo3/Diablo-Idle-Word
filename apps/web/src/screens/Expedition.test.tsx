// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Expedition } from './Expedition';

afterEach(cleanup);

describe('Expedition', () => {
  it('offers the functional Corrupted Forest and enters with a stable selection', () => {
    const onEnter = vi.fn();
    render(<Expedition characterName="Muro" onBack={vi.fn()} onEnter={onEnter} />);

    expect(screen.getByRole('heading', { name: 'Elegí tu destino' })).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /Bosque Corrupto/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByText('Ruinas Sumergidas')).toBeTruthy();
    expect(screen.getByText('Corrupción intensa')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Entrar a la expedición' }));

    expect(onEnter).toHaveBeenCalledWith({ zoneId: 'corrupted-forest', difficulty: 'normal' });
  });

  it('returns to the town without changing the expedition selection', () => {
    const onBack = vi.fn();
    render(<Expedition characterName="Muro" onBack={onBack} onEnter={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Volver al pueblo' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
