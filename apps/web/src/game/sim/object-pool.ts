/**
 * Small deterministic object pool used by presentation adapters.
 *
 * The pool owns leases, not object state: the caller must reset an item before releasing it and
 * must initialize it after acquiring it. Keeping that boundary explicit makes it usable for Phaser
 * GameObjects without importing Phaser into the pure simulation layer.
 */
export class ObjectPool<T> {
  private readonly available: T[];
  private readonly active = new Set<T>();

  public constructor(items: readonly T[]) {
    const unique = new Set(items);
    if (unique.size !== items.length) throw new Error('ObjectPool: items must be unique');
    this.available = [...items];
  }

  public acquire(): T | undefined {
    const item = this.available.pop();
    if (item === undefined) return undefined;
    this.active.add(item);
    return item;
  }

  /** Returns false when an item was already available (double release). */
  public release(item: T): boolean {
    if (!this.active.delete(item)) return false;
    this.available.push(item);
    return true;
  }

  /** Releases every active lease exactly once and invokes the adapter reset for each item. */
  public reset(resetItem: (item: T) => void): void {
    for (const item of [...this.active]) {
      resetItem(item);
      this.release(item);
    }
  }

  public get capacity(): number {
    return this.available.length + this.active.size;
  }

  public get activeCount(): number {
    return this.active.size;
  }

  public get availableCount(): number {
    return this.available.length;
  }
}
