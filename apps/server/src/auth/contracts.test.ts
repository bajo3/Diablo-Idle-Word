import { describe, expect, it } from 'vitest';

import {
  GuardianNameSchema,
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
});
