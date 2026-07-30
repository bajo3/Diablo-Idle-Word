import { describe, expect, it, vi } from 'vitest';

import { ActionRunner } from './action-runner';

describe('ActionRunner', () => {
  it('shares the same in-flight promise and invokes an action only once per key', async () => {
    const runner = new ActionRunner();
    let release: ((value: string) => void) | undefined;
    const action = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          release = resolve;
        }),
    );

    const first = runner.run('profile', action);
    const second = runner.run('profile', action);

    expect(first).toBe(second);
    expect(runner.isRunning('profile')).toBe(true);
    await Promise.resolve();
    expect(action).toHaveBeenCalledTimes(1);
    release?.('done');
    await expect(first).resolves.toBe('done');
    await expect(second).resolves.toBe('done');
    expect(runner.isRunning('profile')).toBe(false);
  });

  it('keeps the exact intent for retry and creates fresh secure ids for new intents', async () => {
    const runner = new ActionRunner();
    const randomUuid = vi
      .spyOn(globalThis.crypto, 'randomUUID')
      .mockReturnValueOnce('11111111-1111-4111-8111-111111111111')
      .mockReturnValueOnce('22222222-2222-4222-8222-222222222222');
    const intent = runner.createIntent({ name: 'Muro' });
    const action = vi.fn(async (value: typeof intent) => {
      expect(value).toBe(intent);
    });

    await runner.retry(intent, action);

    expect(action).toHaveBeenCalledWith(intent);
    expect(action.mock.calls[0]?.[0]).toEqual({
      operationId: '11111111-1111-4111-8111-111111111111',
      payload: { name: 'Muro' },
    });
    expect(runner.createIntent({ name: 'Muro' })).toEqual({
      operationId: '22222222-2222-4222-8222-222222222222',
      payload: { name: 'Muro' },
    });
    randomUuid.mockRestore();
  });
});
