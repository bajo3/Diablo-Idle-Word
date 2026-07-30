import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

import { ActionRunner } from './action-runner';
import { ApiError, gameApi } from './api';
import { GameIsland } from './game/GameIsland';
import { usePath } from './router';
import { useSessionBootstrap } from './session';

type AuthMode = 'login' | 'register';
type ConnectionState = 'connecting' | 'online' | 'offline' | 'degraded' | 'maintenance';

const errorText = (error: unknown) => {
  if (!(error instanceof ApiError)) return 'No se pudo completar la operación.';
  if (error.kind === 'offline') return 'Sin conexión. Revisá tu red y reintentá.';
  if (error.kind === 'timeout') return 'El servidor tardó demasiado. Podés reintentar.';
  if (error.kind === 'unreachable') return 'No se pudo alcanzar el servidor. Podés reintentar.';
  if (error.kind === 'http' && error.code === 'maintenance')
    return 'El servidor está en mantenimiento.';
  return 'No se pudo completar la operación.';
};

const connectionFromError = (error: unknown): ConnectionState =>
  error instanceof ApiError && error.kind === 'offline' ? 'offline' : 'degraded';

export function App() {
  const [path, navigate] = usePath();
  const [session, retrySession, authenticate] = useSessionBootstrap(gameApi);
  const runner = useRef(new ActionRunner()).current;
  const [busyKeys, setBusyKeys] = useState<ReadonlySet<string>>(() => new Set());
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [message, setMessage] = useState<string>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [pendingDeletion, setPendingDeletion] = useState<string>();

  const markSuccess = useCallback(() => {
    setConnection((current) => (current === 'maintenance' ? current : 'online'));
  }, []);
  const markFailure = useCallback((error: unknown) => {
    setConnection(
      error instanceof ApiError && error.kind === 'http' && error.code === 'maintenance'
        ? 'maintenance'
        : connectionFromError(error),
    );
  }, []);
  const runAction = useCallback(
    <T,>(key: string, action: () => Promise<T>): Promise<T> => {
      setBusyKeys((current) => new Set(current).add(key));
      return runner.run(key, action).finally(() => {
        setBusyKeys((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
      });
    },
    [runner],
  );

  useEffect(() => {
    const offline = () => setConnection('offline');
    const online = () => setConnection('degraded');
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    return () => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    };
  }, []);
  useEffect(() => {
    if (session.kind === 'booting') setConnection('connecting');
    else if (session.kind === 'maintenance') setConnection('maintenance');
    else if (session.kind === 'recoverable-error')
      setConnection(connectionFromError(session.error));
    else markSuccess();
  }, [markSuccess, session]);
  useEffect(() => {
    if (session.kind === 'anonymous' && path === '/guardianes') navigate('/');
  }, [navigate, path, session.kind]);

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await runAction('auth', async () => {
      try {
        const result =
          authMode === 'login'
            ? await gameApi.login(email, password)
            : await gameApi.register(email, password, displayName);
        const characters = await gameApi.characters();
        markSuccess();
        setMessage(undefined);
        authenticate(result.profile, characters.characters);
        navigate('/guardianes');
      } catch (error) {
        markFailure(error);
        setMessage(errorText(error));
      }
    });
  };
  const logout = async () => {
    await runAction('logout', async () => {
      try {
        await gameApi.logout();
        markSuccess();
        setMessage(undefined);
        navigate('/');
        retrySession();
      } catch (error) {
        markFailure(error);
        setMessage(errorText(error));
      }
    });
  };
  const updateProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (session.kind !== 'authenticated') return;
    await runAction('profile:update', async () => {
      try {
        const result = await gameApi.updateProfile(displayName);
        markSuccess();
        setMessage(undefined);
        authenticate(result.profile, session.characters);
        setDisplayName('');
      } catch (error) {
        markFailure(error);
        setMessage(errorText(error));
      }
    });
  };
  const createGuardian = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (session.kind !== 'authenticated') return;
    await runAction('guardian:create', async () => {
      try {
        await gameApi.createGuardian(guardianName);
        const characters = await gameApi.characters();
        markSuccess();
        setMessage(undefined);
        authenticate(session.profile, characters.characters);
        setGuardianName('');
      } catch (error) {
        markFailure(error);
        setMessage(errorText(error));
      }
    });
  };
  const selectGuardian = async (id: string) => {
    if (session.kind !== 'authenticated') return;
    const key = `guardian:select:${id}`;
    await runAction(key, async () => {
      try {
        await gameApi.selectCharacter(id);
        const characters = await gameApi.characters();
        markSuccess();
        setMessage(undefined);
        authenticate(session.profile, characters.characters);
      } catch (error) {
        markFailure(error);
        setMessage(errorText(error));
      }
    });
  };
  const confirmDeleteGuardian = async () => {
    if (session.kind !== 'authenticated' || pendingDeletion === undefined) return;
    const id = pendingDeletion;
    const key = `guardian:delete:${id}`;
    await runAction(key, async () => {
      try {
        await gameApi.deleteCharacter(id);
        const characters = await gameApi.characters();
        markSuccess();
        setMessage(undefined);
        authenticate(session.profile, characters.characters);
        setPendingDeletion(undefined);
      } catch (error) {
        markFailure(error);
        setMessage(errorText(error));
      }
    });
  };

  if (session.kind === 'booting')
    return (
      <Screen>
        <ConnectionStatus state={connection} />
      </Screen>
    );
  if (path === '/estado') {
    const status = session.status;
    return (
      <Screen>
        <ConnectionStatus state={connection} />
        <h1>Estado del servidor</h1>
        <p>{status === undefined ? 'No se pudo confirmar el estado.' : status.message}</p>
        <button onClick={() => navigate('/')} type="button">
          Volver
        </button>
      </Screen>
    );
  }
  if (session.kind === 'recoverable-error')
    return (
      <Screen>
        <ConnectionStatus state={connection} />
        <h1>Conexión interrumpida</h1>
        <p>{errorText(session.error)}</p>
        <button onClick={retrySession} type="button">
          Reintentar sesión
        </button>
      </Screen>
    );
  if (session.kind === 'maintenance')
    return (
      <Screen>
        <ConnectionStatus state={connection} />
        <h1>Servidor en mantenimiento</h1>
        <p>{session.status.message}</p>
        <button onClick={() => navigate('/estado')} type="button">
          Ver estado
        </button>
      </Screen>
    );
  if (session.kind === 'anonymous' && path === '/guardianes')
    return (
      <Screen>
        <ConnectionStatus state={connection} />
        <p aria-live="polite">Abriendo la entrada…</p>
      </Screen>
    );
  if (session.kind === 'anonymous' && path === '/partida')
    return (
      <Screen>
        <ConnectionStatus state={connection} />
        <p aria-live="polite">Abriendo la entrada…</p>
      </Screen>
    );
  if (session.kind === 'anonymous') {
    return (
      <Screen>
        <ConnectionStatus state={connection} />
        <h1>Entrá a la brecha</h1>
        <form className="form" onSubmit={submitAuth}>
          {authMode === 'register' ? (
            <label>
              Nombre visible
              <input
                onChange={(event) => setDisplayName(event.target.value)}
                required
                value={displayName}
              />
            </label>
          ) : null}
          <label>
            Correo
            <input
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          <label>
            Contraseña
            <input
              minLength={12}
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>
          <button disabled={busyKeys.has('auth')} type="submit">
            {authMode === 'login' ? 'Ingresar' : 'Crear cuenta'}
          </button>
        </form>
        <button
          onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
          type="button"
        >
          {authMode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
        </button>
        <button onClick={() => navigate('/estado')} type="button">
          Estado del servidor
        </button>
        <Notice message={message} />
      </Screen>
    );
  }

  if (path === '/partida') {
    const selected = session.characters.find(
      (character) => character.selected && character.availability === 'AVAILABLE',
    );
    return (
      <Screen>
        <ConnectionStatus state={connection} />
        <h1>Partida local</h1>
        {selected === undefined ? (
          <p>Seleccioná un Guardián disponible antes de entrar.</p>
        ) : (
          <GameIsland
            characterId={selected.id}
            connection={connection === 'connecting' ? 'degraded' : connection}
            onCheckpoint={async (intent) => {
              try {
                await gameApi.saveCheckpoint(intent);
                markSuccess();
              } catch (error) {
                markFailure(error);
                setMessage(errorText(error));
                throw error;
              }
            }}
          />
        )}
        <Notice message={message} />
        <button onClick={() => navigate('/guardianes')} type="button">
          Volver a Guardianes
        </button>
      </Screen>
    );
  }

  return (
    <main className="shell">
      <section className="panel dashboard">
        <header className="panel-header">
          <div>
            <p className="eyebrow">Sesión activa</p>
            <h1>{session.profile.displayName}</h1>
            <p>{session.profile.email}</p>
          </div>
          <div className="actions">
            <button onClick={() => navigate('/estado')} type="button">
              Estado
            </button>
            <button disabled={busyKeys.has('logout')} onClick={() => void logout()} type="button">
              Cerrar sesión
            </button>
          </div>
        </header>
        <ConnectionStatus state={connection} />
        <section aria-labelledby="profile-title">
          <h2 id="profile-title">Perfil</h2>
          <form className="inline-form" onSubmit={updateProfile}>
            <label className="visually-hidden" htmlFor="display-name">
              Nombre visible
            </label>
            <input
              id="display-name"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder={session.profile.displayName}
              required
              value={displayName}
            />
            <button disabled={busyKeys.has('profile:update')} type="submit">
              Guardar perfil
            </button>
          </form>
        </section>
        <section aria-labelledby="characters-title">
          <h2 id="characters-title">Guardianes</h2>
          <form className="inline-form" onSubmit={createGuardian}>
            <label className="visually-hidden" htmlFor="guardian-name">
              Nombre del Guardián
            </label>
            <input
              id="guardian-name"
              maxLength={24}
              onChange={(event) => setGuardianName(event.target.value)}
              placeholder="Nombre del Guardián"
              required
              value={guardianName}
            />
            <button disabled={busyKeys.has('guardian:create')} type="submit">
              Crear Guardián
            </button>
          </form>
          <ul className="characters">
            {session.characters.map((character) => (
              <li key={character.id}>
                <div>
                  <strong>{character.name}</strong>
                  {character.selected ? <span className="badge">Seleccionado</span> : null}
                  <small>
                    {character.class} · Nivel {character.level} · {character.availability}
                  </small>
                </div>
                <div className="actions">
                  <button
                    disabled={
                      character.selected ||
                      character.availability !== 'AVAILABLE' ||
                      busyKeys.has(`guardian:select:${character.id}`)
                    }
                    onClick={() => void selectGuardian(character.id)}
                    type="button"
                  >
                    Seleccionar
                  </button>
                  <button
                    disabled={
                      character.availability !== 'AVAILABLE' ||
                      busyKeys.has(`guardian:delete:${character.id}`)
                    }
                    onClick={() => setPendingDeletion(character.id)}
                    type="button"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {session.characters.some(
            (character) => character.selected && character.availability === 'AVAILABLE',
          ) ? (
            <button onClick={() => navigate('/partida')} type="button">
              Entrar a partida local
            </button>
          ) : null}
        </section>
        {pendingDeletion === undefined ? null : (
          <section aria-label="Confirmar eliminación" className="notice">
            <p>La eliminación del Guardián se confirmará en el servidor.</p>
            <div className="actions">
              <button onClick={() => setPendingDeletion(undefined)} type="button">
                Cancelar
              </button>
              <button
                disabled={busyKeys.has(`guardian:delete:${pendingDeletion}`)}
                onClick={() => void confirmDeleteGuardian()}
                type="button"
              >
                Confirmar eliminación
              </button>
            </div>
          </section>
        )}
        <Notice message={message} />
      </section>
    </main>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="shell">
      <section className="panel">{children}</section>
    </main>
  );
}
function Notice({ message }: { message: string | undefined }) {
  return message === undefined ? null : (
    <p aria-live="polite" className="notice">
      {message}
    </p>
  );
}
function ConnectionStatus({ state }: { state: ConnectionState }) {
  const label = {
    connecting: 'Conectando con La Brecha Oscura…',
    degraded: 'Conexión degradada',
    maintenance: 'Servidor en mantenimiento',
    offline: 'Sin conexión',
    online: 'En línea',
  }[state];
  return (
    <p aria-live="polite" className="eyebrow" data-connection-state={state}>
      {label}
    </p>
  );
}
