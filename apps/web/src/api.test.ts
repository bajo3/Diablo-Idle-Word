// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';

import { ApiClient, ApiError, defaultApiBaseUrl } from './api';

const response = (status: number, body: unknown): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('defaultApiBaseUrl', () => {
  it('defaults to the page origin so the session cookie stays first-party', () => {
    // The single-origin deployment depends on this. It must not hinge on import.meta.env's PROD
    // flag: the repo's root .env sets NODE_ENV=development, which Vite honours even for a
    // production build, so PROD arrived as false in a real bundle.
    expect(defaultApiBaseUrl({})).toBe('');
    expect(defaultApiBaseUrl({ VITE_API_URL: '' })).toBe('');
    expect(defaultApiBaseUrl({ VITE_API_URL: undefined })).toBe('');
  });

  it('honours an explicit VITE_API_URL for the split local setup', () => {
    expect(defaultApiBaseUrl({ VITE_API_URL: 'http://localhost:3001' })).toBe(
      'http://localhost:3001',
    );
  });
});

describe('ApiClient', () => {
  it('retries safe reads once after an unreachable transport failure', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network failed'))
      .mockResolvedValueOnce(response(200, { status: 'available' }));
    const client = new ApiClient({ baseUrl: 'http://test', fetchImpl, online: () => true });

    await expect(client.status()).resolves.toEqual({ status: 'available' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not retry a mutation automatically', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('network failed'));
    const client = new ApiClient({ baseUrl: 'http://test', fetchImpl, online: () => true });

    await expect(client.createGuardian('Muro')).rejects.toMatchObject({ kind: 'unreachable' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('classifies an offline signal without starting a request', async () => {
    const fetchImpl = vi.fn();
    const client = new ApiClient({ baseUrl: 'http://test', fetchImpl, online: () => false });

    await expect(client.session()).rejects.toEqual(new ApiError('offline'));
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
