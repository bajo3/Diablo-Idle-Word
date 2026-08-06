// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';
import { ApiError } from './api';

const api = vi.hoisted(() => ({
  characters: vi.fn(),
  createGuardian: vi.fn(),
  deleteCharacter: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  register: vi.fn(),
  selectCharacter: vi.fn(),
  session: vi.fn(),
  status: vi.fn(),
  town: vi.fn(),
  updateProfile: vi.fn(),
  saveCheckpoint: vi.fn(),
}));

vi.mock('./api', () => {
  class ApiError extends Error {
    public constructor(
      public readonly kind: string,
      public readonly status?: number,
      public readonly code = 'network_error',
    ) {
      super(code);
    }
  }
  return { ApiClient: class ApiClient {}, ApiError, gameApi: api };
});

const available = {
  status: 'available' as const,
  message: 'Disponible.',
  gameDataVersion: 'test',
  protocolVersion: 1,
};

const ayla = { id: 'user:1', email: 'a@local.invalid', displayName: 'Ayla' };
const muro = {
  id: 'character:1',
  name: 'Muro',
  class: 'GUARDIAN',
  level: 1,
  availability: 'AVAILABLE',
  selected: true,
};

function authenticatedSession(): void {
  api.session.mockResolvedValue({ profile: ayla });
  api.characters.mockResolvedValue({ characters: [muro] });
}

beforeEach(() => {
  window.history.replaceState({}, '', '/');
  api.status.mockResolvedValue(available);
  api.session.mockRejectedValue(new ApiError('http', 401, 'unauthenticated'));
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('Paso 5 session lifecycle', () => {
  it('recovers an authenticated session after a reload without showing the anonymous form', async () => {
    authenticatedSession();

    render(<App />);

    await screen.findByRole('heading', { name: 'Ayla' });
    expect(screen.queryByRole('heading', { name: 'Entrá a la brecha' })).toBeNull();
    expect(screen.getByText('Muro')).toBeTruthy();
  });

  it('boots once under StrictMode and keeps protected routes out of the anonymous view', async () => {
    window.history.replaceState({}, '', '/guardianes');
    render(
      <StrictMode>
        <App />
      </StrictMode>,
    );

    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Entrá a la brecha' })).toBeTruthy(),
    );
    expect(api.status).toHaveBeenCalledTimes(1);
    expect(api.session).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(window.location.pathname).toBe('/'));
  });

  it('keeps the server status route public for an anonymous session', async () => {
    render(<App />);

    await screen.findByRole('heading', { name: 'Entrá a la brecha' });
    fireEvent.click(screen.getByRole('button', { name: 'Estado del servidor' }));
    await screen.findByRole('heading', { name: 'Estado del servidor' });
    expect(screen.getByText('Disponible.')).toBeTruthy();
  });

  it('logs in and renders the authoritative Guardian selector', async () => {
    api.login.mockResolvedValue({ profile: ayla });
    api.characters.mockResolvedValue({ characters: [muro] });
    render(<App />);

    await screen.findByRole('heading', { name: 'Entrá a la brecha' });
    fireEvent.change(screen.getByLabelText('Correo'), { target: { value: 'a@local.invalid' } });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'secure-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Ayla' })).toBeTruthy());
    expect(screen.getByText('Muro')).toBeTruthy();
    expect(screen.getByText('Seleccionado')).toBeTruthy();
  });

  it('returns to Pueblo after selecting a Guardian', async () => {
    window.history.replaceState({}, '', '/guardianes');
    api.session.mockResolvedValue({ profile: ayla });
    api.characters
      .mockResolvedValueOnce({ characters: [{ ...muro, selected: false }] })
      .mockResolvedValueOnce({ characters: [{ ...muro, selected: true }] });
    api.selectCharacter.mockResolvedValue(undefined);
    api.town.mockResolvedValue({
      town: {
        characterName: 'Muro',
        level: 1,
        gold: 1240,
        materials: 45,
        tutorial: { status: 'COMPLETED' },
      },
    });

    render(<App />);

    await screen.findByRole('heading', { name: 'Ayla' });
    fireEvent.click(screen.getByRole('button', { name: 'Seleccionar' }));
    await waitFor(() => expect(window.location.pathname).toBe('/pueblo'));
    expect(screen.getByText('PUEBLO · Muro')).toBeTruthy();
  });

  it('explains when registration email already exists', async () => {
    api.register.mockRejectedValue(new ApiError('http', 409, 'conflict'));
    render(<App />);

    await screen.findByRole('heading', { name: 'Entrá a la brecha' });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: 'Bajo31' } });
    fireEvent.change(screen.getByLabelText('Correo'), {
      target: { value: 'felipelentini98@hotmail.com' },
    });
    fireEvent.change(screen.getByLabelText('Contraseña'), { target: { value: 'abc123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(
      await screen.findByText('Ya existe una cuenta con ese correo. Elegí “Ya tengo cuenta”.'),
    ).toBeTruthy();
  });

  it('logs out explicitly without relying on browser unload', async () => {
    authenticatedSession();
    api.logout.mockResolvedValue(undefined);
    api.session
      .mockResolvedValueOnce({ profile: ayla })
      .mockRejectedValueOnce(new ApiError('http', 401, 'unauthenticated'));
    render(<App />);

    await screen.findByRole('heading', { name: 'Ayla' });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    await screen.findByRole('heading', { name: 'Entrá a la brecha' });
    expect(api.logout).toHaveBeenCalledTimes(1);
  });

  it('updates the profile and reflects offline then recovered connection state', async () => {
    authenticatedSession();
    api.updateProfile
      .mockRejectedValueOnce(new ApiError('offline'))
      .mockResolvedValueOnce({ profile: { ...ayla, displayName: 'Nova' } });
    render(<App />);

    await screen.findByRole('heading', { name: 'Ayla' });
    fireEvent.change(screen.getByLabelText('Nombre visible'), { target: { value: 'Nova' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await waitFor(() =>
      expect(screen.getByText('Sin conexión').getAttribute('data-connection-state')).toBe(
        'offline',
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar perfil' }));
    await screen.findByRole('heading', { name: 'Nova' });
    expect(screen.getByText('En línea').getAttribute('data-connection-state')).toBe('online');
    expect(api.updateProfile).toHaveBeenCalledTimes(2);
  });

  it('requires explicit delete confirmation and sends at most one delete request', async () => {
    authenticatedSession();
    api.deleteCharacter.mockResolvedValue(undefined);
    render(<App />);

    await screen.findByRole('heading', { name: 'Ayla' });
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(api.deleteCharacter).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
    await waitFor(() => expect(api.deleteCharacter).toHaveBeenCalledTimes(1));
  });

  it('does not mount the local game route for a selected unavailable Guardian', async () => {
    window.history.replaceState({}, '', '/mundo');
    api.session.mockResolvedValue({ profile: ayla });
    api.characters.mockResolvedValue({
      characters: [{ ...muro, availability: 'AWAY_FARMING' }],
    });

    render(<App />);

    expect(
      await screen.findByText('Seleccioná un Guardián disponible antes de entrar.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Mundo')).toBeNull();
  });

  it('keeps the Personaje route behind authentication for anonymous visitors', async () => {
    window.history.replaceState({}, '', '/personaje');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Entrá a la brecha' })).toBeTruthy();
    expect(screen.queryByText('Seleccioná un personaje para abrir la hoja.')).toBeNull();
  });

  it('guides an authenticated session without a selection to Guardianes before opening Personaje', async () => {
    window.history.replaceState({}, '', '/personaje');
    api.session.mockResolvedValue({ profile: ayla });
    api.characters.mockResolvedValue({ characters: [{ ...muro, selected: false }] });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Seleccioná un Guardián' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ir a Guardianes' }));
    expect(await screen.findByRole('heading', { name: 'Ayla' })).toBeTruthy();
    expect(screen.getByText('Muro')).toBeTruthy();
  });
});
