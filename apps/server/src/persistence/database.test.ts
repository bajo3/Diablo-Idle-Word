import { describe, expect, it, vi } from 'vitest';

import type { DatabaseClient } from './database.js';
import { disconnectDatabaseOnClose } from './database.js';

describe('database lifecycle', () => {
  it('disconnects only when Fastify closes, not when the listener starts', async () => {
    let closeHook: (() => Promise<void>) | undefined;
    const app = {
      addHook: vi.fn((_name: 'onClose', hook: () => Promise<void>) => {
        closeHook = hook;
      }),
    };
    const database = {
      $disconnect: vi.fn().mockResolvedValue(undefined),
    } as unknown as DatabaseClient;

    disconnectDatabaseOnClose(app, database);
    expect(database.$disconnect).not.toHaveBeenCalled();
    expect(closeHook).toBeDefined();
    await closeHook?.();
    expect(database.$disconnect).toHaveBeenCalledTimes(1);
  });
});
