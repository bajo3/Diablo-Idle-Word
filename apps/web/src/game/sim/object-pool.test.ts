import { describe, expect, it } from 'vitest';

import { ObjectPool } from './object-pool';

describe('ObjectPool', () => {
  it('leases only preallocated items and reuses the same identity', () => {
    const first = { id: 'first' };
    const second = { id: 'second' };
    const pool = new ObjectPool([first, second]);

    expect(pool.capacity).toBe(2);
    expect(pool.acquire()).toBe(second);
    expect(pool.acquire()).toBe(first);
    expect(pool.acquire()).toBeUndefined();
    expect(pool.activeCount).toBe(2);
    expect(pool.release(second)).toBe(true);
    expect(pool.release(second)).toBe(false);
    expect(pool.acquire()).toBe(second);
    expect(pool.availableCount).toBe(0);
  });

  it('resets every active lease once and returns all capacity', () => {
    const pool = new ObjectPool([1, 2, 3]);
    pool.acquire();
    pool.acquire();
    const reset: number[] = [];

    pool.reset((item) => reset.push(item));

    expect(reset.sort()).toEqual([2, 3]);
    expect(pool.activeCount).toBe(0);
    expect(pool.availableCount).toBe(3);
  });

  it('rejects duplicate preallocation identities', () => {
    const item = {};
    expect(() => new ObjectPool([item, item])).toThrow('items must be unique');
  });
});
