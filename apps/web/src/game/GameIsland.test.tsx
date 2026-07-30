// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GameIsland, type RuntimeLoader } from './GameIsland';

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
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(runtime.resume).toHaveBeenCalledTimes(1);
    view.unmount();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(runtime.pause).toHaveBeenCalledTimes(2);
    expect(runtime.resume).toHaveBeenCalledTimes(1);
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

  it('retries the exact failed checkpoint intent and disables the control while pending', async () => {
    const runtime = { pause: vi.fn(), resume: vi.fn(), destroy: vi.fn(), setConnection: vi.fn() };
    const loadRuntime: RuntimeLoader = async () => ({ mountGameRuntime: () => runtime });
    let rejectFirst: ((error: Error) => void) | undefined;
    const firstRequest = new Promise<void>((_resolve, reject) => {
      rejectFirst = reject;
    });
    const checkpoint = vi.fn().mockReturnValueOnce(firstRequest).mockResolvedValueOnce(undefined);
    const uuid = vi
      .spyOn(crypto, 'randomUUID')
      .mockReturnValue('11111111-1111-4111-8111-111111111111');
    render(
      <GameIsland
        characterId="character:1"
        connection="online"
        loadRuntime={loadRuntime}
        onCheckpoint={checkpoint}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto de control' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto de control' }));
    expect(checkpoint).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Guardar punto de control' })).toHaveProperty(
      'disabled',
      true,
    );
    rejectFirst?.(new Error('offline'));
    await screen.findByText('No se pudo guardar el punto de control. Podés reintentar.');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar punto de control' }));
    await waitFor(() => expect(checkpoint).toHaveBeenCalledTimes(2));
    expect(checkpoint.mock.calls[1]?.[0]).toEqual(checkpoint.mock.calls[0]?.[0]);
    uuid.mockRestore();
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
    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar números de daño' }));
    resolveLoader?.({ mountGameRuntime: () => runtime });
    await waitFor(() => expect(runtime.setDamageNumbers).toHaveBeenLastCalledWith(false));
  });
});
