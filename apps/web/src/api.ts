export type Profile = { id: string; email: string; displayName: string };
export type Character = {
  id: string;
  name: string;
  class: 'GUARDIAN';
  level: number;
  availability: string;
  selected: boolean;
};
export type ServerStatus = {
  status: 'available' | 'maintenance';
  message: string;
  gameDataVersion: string;
  protocolVersion: number;
};
export type ApiFailureKind = 'aborted' | 'http' | 'offline' | 'timeout' | 'unreachable';

export class ApiError extends Error {
  public constructor(
    public readonly kind: ApiFailureKind,
    public readonly status?: number,
    public readonly code = 'network_error',
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

type FetchLike = typeof fetch;
type RequestBody = Record<string, unknown> | undefined;
export type ApiClientOptions = {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  online?: () => boolean;
  timeoutMs?: number;
};

export class ApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly online: () => boolean;
  private readonly timeoutMs: number;

  public constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? import.meta.env.VITE_API_URL ?? 'http://localhost:3001';
    // A bare `fetch` reference throws "Illegal invocation" in real browsers once called as
    // `this.fetchImpl(...)`: native fetch requires its receiver to be the global object. Binding
    // it here is required, not stylistic - unit tests never caught this because their injected
    // fetchImpl mocks don't have that native receiver check.
    this.fetchImpl = options.fetchImpl ?? fetch.bind(globalThis);
    this.online = options.online ?? (() => navigator.onLine);
    this.timeoutMs = options.timeoutMs ?? 8_000;
  }

  public session(): Promise<{ profile: Profile }> {
    return this.read('/api/auth/session');
  }
  public status(): Promise<ServerStatus> {
    return this.read('/api/status', 1);
  }
  public characters(): Promise<{ characters: Character[] }> {
    return this.read('/api/characters');
  }
  public login(email: string, password: string): Promise<{ profile: Profile }> {
    return this.mutate('/api/auth/login', 'POST', { email, password });
  }
  public register(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ profile: Profile }> {
    return this.mutate('/api/auth/register', 'POST', { email, password, displayName });
  }
  public logout(): Promise<void> {
    return this.mutate('/api/auth/logout', 'POST', {});
  }
  public updateProfile(displayName: string): Promise<{ profile: Profile }> {
    return this.mutate('/api/profile', 'PATCH', { displayName });
  }
  public createGuardian(name: string): Promise<{ character: Character }> {
    return this.mutate('/api/characters', 'POST', { name });
  }
  public selectCharacter(characterId: string): Promise<{ character: Character }> {
    return this.mutate(`/api/characters/${encodeURIComponent(characterId)}/select`, 'POST', {});
  }
  public deleteCharacter(characterId: string): Promise<void> {
    return this.mutate(`/api/characters/${encodeURIComponent(characterId)}`, 'DELETE', {});
  }
  public saveCheckpoint(input: {
    operationId: string;
    schemaVersion: 1;
    characterId: string;
    sceneId: 'local:test';
    checkpointId: string;
  }): Promise<{ receipt: { operationId: string } }> {
    return this.mutate(
      `/api/characters/${encodeURIComponent(input.characterId)}/progress/checkpoints`,
      'POST',
      input,
    );
  }

  private mutate<T>(
    path: string,
    method: 'DELETE' | 'PATCH' | 'POST',
    body: RequestBody,
  ): Promise<T> {
    return this.request<T>(path, method, body);
  }

  private async read<T>(path: string, retries = 0): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      try {
        return await this.request<T>(path, 'GET');
      } catch (error: unknown) {
        lastError = error;
        if (
          !(error instanceof ApiError) ||
          !['offline', 'timeout', 'unreachable'].includes(error.kind)
        )
          throw error;
      }
    }
    throw lastError;
  }

  private request<T>(path: string, method: string, body?: RequestBody): Promise<T> {
    if (!this.online()) return Promise.reject(new ApiError('offline'));
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort('timeout'), this.timeoutMs);
    const init: RequestInit = { method, credentials: 'include', signal: controller.signal };
    if (body !== undefined) {
      init.headers = { 'content-type': 'application/json' };
      init.body = JSON.stringify(body);
    }
    return this.fetchImpl(`${this.baseUrl}${path}`, init)
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({ error: 'network_error' }))) as {
            error?: string;
          };
          throw new ApiError('http', response.status, payload.error ?? 'network_error');
        }
        return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
      })
      .catch((error: unknown) => {
        if (error instanceof ApiError) throw error;
        if (controller.signal.aborted)
          throw new ApiError(controller.signal.reason === 'timeout' ? 'timeout' : 'aborted');
        throw new ApiError('unreachable');
      })
      .finally(() => window.clearTimeout(timeout));
  }
}

export const gameApi = new ApiClient();
