export type Intent<T> = Readonly<{ operationId: string; payload: T }>;

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('A cryptographically secure randomUUID implementation is required.');
  }
  return globalThis.crypto.randomUUID();
}

export class ActionRunner {
  private readonly running = new Map<string, Promise<unknown>>();

  public isRunning(key: string): boolean {
    return this.running.has(key);
  }

  public run<T>(key: string, action: () => Promise<T>): Promise<T> {
    const existing = this.running.get(key) as Promise<T> | undefined;
    if (existing !== undefined) return existing;

    const operation = Promise.resolve().then(action);
    const tracked = operation.finally(() => {
      if (this.running.get(key) === tracked) this.running.delete(key);
    });
    this.running.set(key, tracked);
    return tracked;
  }

  public createIntent<T>(payload: T): Intent<T> {
    return { operationId: newId(), payload };
  }

  public retry<T>(intent: Intent<T>, action: (value: Intent<T>) => Promise<void>): Promise<void> {
    return action(intent);
  }
}
