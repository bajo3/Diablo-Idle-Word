import { describe, expect, it } from 'vitest';

import {
  GuardianNameSchema,
  CreateGuardianInputSchema,
  LoginInputSchema,
  ProfileNameSchema,
  RegisterInputSchema,
  normalizeEmail,
} from './contracts.js';
import { FixedWindowRateLimiter } from './rate-limiter.js';

describe('authentication input contracts', () => {
  it('normalizes email and visible names before validation', () => {
    expect(normalizeEmail('  PLAYER@EXAMPLE.COM  ')).toBe('player@example.com');
    expect(ProfileNameSchema.parse('  GuarＤián  ')).toBe('GuarDián');
    expect(
      RegisterInputSchema.parse({
        email: ' PLAYER@EXAMPLE.COM ',
        password: 'secure-password',
        displayName: '  Viajera  ',
      }),
    ).toMatchObject({ email: 'player@example.com', displayName: 'Viajera' });
  });

  it('rejects unsafe or invalid Guardian names', () => {
    expect(() => GuardianNameSchema.parse('  ')).toThrow();
    expect(() => GuardianNameSchema.parse('bad<script>')).toThrow();
    expect(() => GuardianNameSchema.parse('x'.repeat(25))).toThrow();
  });

  it('accepts six-character passwords and rejects shorter credentials', () => {
    expect(
      RegisterInputSchema.parse({
        email: 'player@example.com',
        password: 'abc123',
        displayName: 'Viajera',
      }).password,
    ).toBe('abc123');
    expect(() =>
      LoginInputSchema.parse({ email: 'player@example.com', password: '12345' }),
    ).toThrow();
  });

  it('validates the selectable class and keeps the legacy Guardian default', () => {
    expect(CreateGuardianInputSchema.parse({ name: 'Viajera' })).toMatchObject({
      name: 'Viajera',
      class: 'GUARDIAN',
    });
    expect(CreateGuardianInputSchema.parse({ name: 'Barbara', class: 'BARBARIAN' }).class).toBe(
      'BARBARIAN',
    );
    expect(() => CreateGuardianInputSchema.parse({ name: 'Viajera', class: 'UNKNOWN' })).toThrow();
  });
});

describe('credential rate limiter', () => {
  it('caps attempts and starts a fresh deterministic window', () => {
    let now = 100;
    const limiter = new FixedWindowRateLimiter(2, 1000, () => now);
    expect(limiter.consume('127.0.0.1:a')).toBe(true);
    expect(limiter.consume('127.0.0.1:a')).toBe(true);
    expect(limiter.consume('127.0.0.1:a')).toBe(false);
    now = 1100;
    expect(limiter.consume('127.0.0.1:a')).toBe(true);
  });

  it('bounds unique caller keys and fails closed at capacity', () => {
    const limiter = new FixedWindowRateLimiter(2, 1000, () => 100, 2);
    expect(limiter.consume('caller:a')).toBe(true);
    expect(limiter.consume('caller:b')).toBe(true);
    expect(limiter.consume('caller:c')).toBe(false);
    expect(limiter.consume('caller:c')).toBe(false);
    // Active keys remain protected; a rotating caller cannot evict them.
    expect(limiter.consume('caller:a')).toBe(true);
  });

  it('rejects invalid capacities instead of silently disabling protection', () => {
    expect(() => new FixedWindowRateLimiter(0)).toThrow(/maxAttempts/);
    expect(() => new FixedWindowRateLimiter(1, 0)).toThrow(/windowMs/);
    expect(() => new FixedWindowRateLimiter(1, 1, Date.now, 0)).toThrow(/maxEntries/);
  });
});
