import { afterEach, describe, expect, it, vi } from 'vitest';

import { connectGameServer } from './game-session';

class FakeSocket {
  public readonly readyState = 1;
  public closed = false;
  private readonly listeners = new Map<string, Set<(event: unknown) => void>>();

  public addEventListener(type: string, listener: (event: unknown) => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }
  public send(): void {
    // The presentation session does not send gameplay commands.
  }
  public close(): void {
    this.closed = true;
  }
  public emit(type: string, event: unknown = {}): void {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

afterEach(() => vi.useRealTimers());

describe('game server event session', () => {
  it('derives a ws endpoint, forwards JSON, and ignores malformed JSON', () => {
    const socket = new FakeSocket();
    const events: unknown[] = [];
    const factory = vi.fn(() => socket);
    const session = connectGameServer((event) => events.push(event), {
      baseUrl: 'https://game.local/',
      socketFactory: factory,
    });

    socket.emit('message', { data: '{"type":"REWARD_GRANTED"}' });
    socket.emit('message', { data: '{invalid' });

    expect(events).toEqual([{ type: 'REWARD_GRANTED' }]);
    expect(factory).toHaveBeenCalledWith('wss://game.local/ws');
    session.close();
    expect(socket.closed).toBe(true);
  });

  it('reconnects with bounded backoff until explicitly closed', () => {
    vi.useFakeTimers();
    const sockets: FakeSocket[] = [];
    const factory = vi.fn(() => {
      const socket = new FakeSocket();
      sockets.push(socket);
      return socket;
    });
    const session = connectGameServer(vi.fn(), {
      socketFactory: factory,
      baseUrl: 'http://game.local',
    });

    sockets[0]!.emit('close');
    vi.advanceTimersByTime(500);
    expect(factory).toHaveBeenCalledTimes(2);
    session.close();
    sockets[1]!.emit('close');
    vi.advanceTimersByTime(20_000);
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
