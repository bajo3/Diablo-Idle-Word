import { describe, expect, it } from 'vitest';

import { assertSafeTestEnvironment } from './test-postgres.js';

describe('PostgreSQL integration safety guards', () => {
  it('accepts only local brecha_oscura outside production', () => {
    expect(() =>
      assertSafeTestEnvironment('postgresql://brecha:local@localhost:5432/brecha_oscura', 'test'),
    ).not.toThrow();
  });

  it('rejects remote hosts, a different base database, and production', () => {
    expect(() =>
      assertSafeTestEnvironment(
        'postgresql://brecha:local@db.example.test:5432/brecha_oscura',
        'test',
      ),
    ).toThrow('localhost');
    expect(() =>
      assertSafeTestEnvironment('postgresql://brecha:local@localhost:5432/postgres', 'test'),
    ).toThrow('brecha_oscura');
    expect(() =>
      assertSafeTestEnvironment(
        'postgresql://brecha:local@127.0.0.1:5432/brecha_oscura',
        'production',
      ),
    ).toThrow('production');
  });
});
