import { useCallback, useEffect, useRef, useState } from 'react';

import { ApiClient, ApiError, type Character, type Profile, type ServerStatus } from './api';

export type SessionState =
  | { kind: 'booting' }
  | { kind: 'anonymous'; status: ServerStatus }
  | { kind: 'authenticated'; profile: Profile; characters: Character[]; status: ServerStatus }
  | { kind: 'recoverable-error'; error: ApiError; status?: ServerStatus }
  | { kind: 'maintenance'; status: ServerStatus };

export function useSessionBootstrap(
  api: ApiClient,
): readonly [SessionState, () => void, (profile: Profile, characters: Character[]) => void] {
  const [state, setState] = useState<SessionState>({ kind: 'booting' });
  const bootstrap = useRef<Promise<void> | undefined>(undefined);
  const load = useCallback(() => {
    if (bootstrap.current !== undefined) return;
    bootstrap.current = Promise.all([
      api.status(),
      api
        .session()
        .catch((error: unknown): ApiError =>
          error instanceof ApiError ? error : new ApiError('unreachable'),
        ),
    ])
      .then(async ([status, session]) => {
        if (status.status === 'maintenance') {
          setState({ kind: 'maintenance', status });
          return;
        }
        if (session instanceof ApiError && session.kind === 'http' && session.status === 401) {
          setState({ kind: 'anonymous', status });
          return;
        }
        if (session instanceof ApiError) {
          setState({ kind: 'recoverable-error', error: session, status });
          return;
        }
        const characters = await api.characters();
        setState({
          kind: 'authenticated',
          profile: session.profile,
          characters: characters.characters,
          status,
        });
      })
      .catch((error: unknown) =>
        setState({
          kind: 'recoverable-error',
          error: error instanceof ApiError ? error : new ApiError('unreachable'),
        }),
      );
  }, [api]);
  useEffect(() => {
    load();
  }, [load]);
  const retry = () => {
    bootstrap.current = undefined;
    setState({ kind: 'booting' });
    load();
  };
  const authenticate = (profile: Profile, characters: Character[]) =>
    setState((current) =>
      current.kind === 'maintenance'
        ? current
        : {
            kind: 'authenticated',
            profile,
            characters,
            status:
              current.kind === 'authenticated' || current.kind === 'anonymous'
                ? current.status
                : {
                    status: 'available',
                    message: 'Disponible.',
                    gameDataVersion: '',
                    protocolVersion: 1,
                  },
          },
    );
  return [state, retry, authenticate] as const;
}
