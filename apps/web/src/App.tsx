import { type FormEvent, type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { type CharacterClassId } from '@brecha/shared';

import { ActionRunner } from './action-runner';
import { ApiError, gameApi } from './api';
import { CharacterSelect } from './screens/CharacterSelect';
import { Gateway, GatewayMessage } from './screens/Gateway';
import { GameIsland } from './game/GameIsland';
import { Expedition } from './screens/Expedition';
import { Inventory } from './screens/Inventory';
import { RewardResults } from './screens/RewardResults';
import { MainMenu } from './screens/MainMenu';
import { Town } from './screens/Town';
import { Character } from './screens/Character';
import { Skills } from './screens/Skills';
import { AwayMode } from './screens/AwayMode';
import { Merchant } from './screens/Merchant';
import { Chest } from './screens/Chest';
import { Settings } from './screens/Settings';
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
  const [guardianClass, setGuardianClass] = useState<CharacterClassId>('BARBARIAN');
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
        if (error instanceof ApiError && error.code === 'conflict' && authMode === 'register') {
          setMessage('Ya existe una cuenta con ese correo. Elegí “Ya tengo cuenta”.');
        } else if (error instanceof ApiError && error.code === 'invalid_request') {
          setMessage('Revisá el correo, el nombre y la contraseña de al menos 6 caracteres.');
        } else if (error instanceof ApiError && error.code === 'unauthenticated') {
          setMessage('El correo o la contraseña no son correctos.');
        } else {
          setMessage(errorText(error));
        }
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
        await gameApi.createGuardian(guardianName, guardianClass);
        const characters = await gameApi.characters();
        markSuccess();
        setMessage(undefined);
        authenticate(session.profile, characters.characters);
        setGuardianName('');
        setGuardianClass('BARBARIAN');
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
        navigate('/pueblo');
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

  // Vitrina sin auth: se sirve antes de cualquier gate de sesión para no depender del backend.
  // Muestra la escena local con el Bruto (primer enemigo con arte propio) sin requerir server/DB.
  // Atajo visual de desarrollo, no parte del flujo de juego real.
  if (path === '/bruto-preview') {
    return (
      <main className="game-fullscreen">
        <GameIsland
          characterId="preview:bruto"
          connection="offline"
          localProgression
          onCheckpoint={async () => undefined}
          onExit={() => navigate('/')}
          onOpenCharacter={() => navigate('/bruto-personaje')}
          onOpenInventory={() => navigate('/inventario')}
          onOpenResults={() => navigate('/resultados')}
          onOpenTown={() => navigate('/pueblo')}
        />
      </main>
    );
  }

  if (path === '/bruto-personaje') {
    return (
      <Character characterId="preview:bruto" local onBack={() => navigate('/bruto-preview')} />
    );
  }

  // Kit de UI (bloque 1): Menú, Pueblo e Inventario. Sin lógica de backend todavía;
  // viven como pantallas navegables con datos de ejemplo para validar el diseño.
  if (path === '/menu') {
    const hasSession = session.kind === 'authenticated';
    const statusMessage =
      session.kind === 'anonymous' ||
      session.kind === 'authenticated' ||
      session.kind === 'maintenance' ||
      session.kind === 'recoverable-error'
        ? session.status?.message
        : undefined;
    return (
      <MainMenu
        hasSession={hasSession}
        serverStatus={statusMessage}
        onPlay={() => navigate(hasSession ? '/guardianes' : '/pueblo')}
        onContinue={hasSession ? () => navigate('/guardianes') : undefined}
        onSettings={() => navigate('/ajustes')}
        onCredits={() => setMessage('La Brecha Oscura · interfaz de prototipo.')}
        onStatus={() => navigate('/estado')}
        notice={message}
      />
    );
  }
  if (path === '/pueblo') {
    const selectedCharacter =
      session.kind === 'authenticated'
        ? session.characters.find((character) => character.selected)
        : undefined;
    const name =
      selectedCharacter?.name ??
      (session.kind === 'authenticated' ? session.profile.displayName : 'Guardián');
    return (
      <Town
        characterName={name}
        level={1}
        gold={1240}
        materials={45}
        {...(selectedCharacter === undefined ? {} : { characterId: selectedCharacter.id })}
        onBack={() => navigate('/guardianes')}
        onDock={(key) => {
          if (key === 'I') navigate('/inventario');
          else if (key === 'C' || key === 'Personaje') navigate('/personaje');
          else if (key === 'H' || key === 'Habilidades') navigate('/habilidades');
          else if (key === 'E' || key === 'Guardián del Portal') navigate('/expedicion');
          else if (key === 'A' || key === 'Ausente') navigate('/ausente');
          else if (key === 'M' || key === 'Comerciante') navigate('/comerciante');
          else if (key === 'B' || key === 'Cofre') navigate('/cofre');
          else if (key === 'ESC' || key === 'Ajustes') navigate('/ajustes');
          else navigate('/guardianes');
        }}
      />
    );
  }
  if (path === '/comerciante' || path === '/cofre') {
    const selectedCharacterId =
      session.kind === 'authenticated'
        ? session.characters.find((character) => character.selected)?.id
        : undefined;
    return path === '/comerciante' ? (
      <Merchant characterId={selectedCharacterId} onBack={() => navigate('/pueblo')} />
    ) : (
      <Chest characterId={selectedCharacterId} onBack={() => navigate('/pueblo')} />
    );
  }
  if (path === '/ajustes') return <Settings onBack={() => navigate('/pueblo')} />;
  if (path === '/inventario') {
    const selectedCharacterId =
      session.kind === 'authenticated'
        ? session.characters.find((character) => character.selected)?.id
        : undefined;
    return <Inventory characterId={selectedCharacterId} onBack={() => navigate('/pueblo')} />;
  }
  if (path === '/resultados') {
    const selectedCharacterId =
      session.kind === 'authenticated'
        ? session.characters.find((character) => character.selected)?.id
        : undefined;
    return <RewardResults characterId={selectedCharacterId} onBack={() => navigate('/pueblo')} />;
  }
  if (path === '/ausente') {
    const selectedCharacter =
      session.kind === 'authenticated'
        ? session.characters.find((character) => character.selected)
        : undefined;
    return (
      <AwayMode
        {...(selectedCharacter === undefined ? {} : { characterId: selectedCharacter.id })}
        characterName={selectedCharacter?.name ?? 'Guardián'}
        onBack={() => navigate('/pueblo')}
      />
    );
  }
  if (session.kind === 'authenticated' && (path === '/personaje' || path === '/habilidades')) {
    const selectedCharacter = session.characters.find((character) => character.selected);
    if (selectedCharacter === undefined) {
      return <CharacterSelectionRequired onGoToCharacters={() => navigate('/guardianes')} />;
    }
    const selectedCharacterId = selectedCharacter.id;
    if (path === '/personaje' && selectedCharacter.availability !== 'AVAILABLE') {
      return (
        <AwayMode
          characterId={selectedCharacter.id}
          characterName={selectedCharacter.name}
          onBack={() => navigate('/pueblo')}
          autoReturn={selectedCharacter.availability === 'AWAY_FARMING'}
        />
      );
    }
    return path === '/personaje' ? (
      <Character characterId={selectedCharacterId} onBack={() => navigate('/pueblo')} />
    ) : (
      <Skills characterId={selectedCharacterId} onBack={() => navigate('/pueblo')} />
    );
  }
  if (path === '/expedicion') {
    const name = session.kind === 'authenticated' ? session.profile.displayName : 'Guardián';
    return (
      <Expedition
        characterName={name}
        onBack={() => navigate('/pueblo')}
        onEnter={() => navigate(session.kind === 'authenticated' ? '/mundo' : '/bruto-preview')}
      />
    );
  }

  if (session.kind === 'booting') return <GatewayMessage connection={connection} />;
  if (path === '/estado') {
    const status = session.status;
    return (
      <GatewayMessage
        action={{ label: 'Volver', onClick: () => navigate('/') }}
        body={status === undefined ? 'No se pudo confirmar el estado.' : status.message}
        connection={connection}
        title="Estado del servidor"
      />
    );
  }
  if (session.kind === 'recoverable-error')
    return (
      <GatewayMessage
        action={{ label: 'Reintentar sesión', onClick: retrySession }}
        body={errorText(session.error)}
        connection={connection}
        title="Conexión interrumpida"
      />
    );
  if (session.kind === 'maintenance')
    return (
      <GatewayMessage
        action={{ label: 'Ver estado', onClick: () => navigate('/estado') }}
        body={session.status.message}
        connection={connection}
        title="Servidor en mantenimiento"
      />
    );
  if (session.kind === 'anonymous' && (path === '/guardianes' || path === '/mundo'))
    return <GatewayMessage body="Abriendo la entrada…" connection={connection} />;
  if (session.kind === 'anonymous') {
    return (
      <Gateway
        busy={busyKeys.has('auth')}
        connection={connection}
        displayName={displayName}
        email={email}
        mode={authMode}
        notice={message}
        onDisplayNameChange={setDisplayName}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onStatus={() => navigate('/estado')}
        onSubmit={submitAuth}
        onToggleMode={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
        password={password}
      />
    );
  }

  if (path === '/mundo') {
    const selected = session.characters.find(
      (character) => character.selected && character.availability === 'AVAILABLE',
    );
    if (selected === undefined) {
      return (
        <Screen>
          <h1>Entrar al mundo</h1>
          <p>Seleccioná un Guardián disponible antes de entrar.</p>
          <button onClick={() => navigate('/guardianes')} type="button">
            Volver a Guardianes
          </button>
        </Screen>
      );
    }
    return (
      <main className="game-fullscreen">
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
          onOpenCharacter={() => navigate('/personaje')}
          onOpenInventory={() => navigate('/inventario')}
          onOpenResults={() => navigate('/resultados')}
          onOpenTown={() => navigate('/pueblo')}
          onExit={() => navigate('/guardianes')}
        />
        <Notice message={message} />
      </main>
    );
  }

  return (
    <CharacterSelect
      busyKeys={busyKeys}
      characters={session.characters}
      connection={connection}
      displayName={session.profile.displayName}
      email={session.profile.email}
      newClass={guardianClass}
      newName={guardianName}
      notice={message}
      onCancelDelete={() => setPendingDeletion(undefined)}
      onConfirmDelete={() => void confirmDeleteGuardian()}
      onCreate={createGuardian}
      onEnterWorld={() => navigate('/mundo')}
      onLogout={() => void logout()}
      onNewClassChange={setGuardianClass}
      onNewNameChange={setGuardianName}
      onProfileDraftChange={setDisplayName}
      onRequestDelete={setPendingDeletion}
      onSelect={(id) => void selectGuardian(id)}
      onStatus={() => navigate('/estado')}
      onUpdateProfile={updateProfile}
      pendingDeletion={pendingDeletion}
      profileDraft={displayName}
    />
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="shell">
      <section className="panel">{children}</section>
    </main>
  );
}

function CharacterSelectionRequired({ onGoToCharacters }: { onGoToCharacters: () => void }) {
  return (
    <Screen>
      <h1>Seleccioná un Guardián</h1>
      <p>Elegí un personaje disponible antes de abrir su hoja o sus habilidades.</p>
      <button onClick={onGoToCharacters} type="button">
        Ir a Guardianes
      </button>
    </Screen>
  );
}

function Notice({ message }: { message: string | undefined }) {
  return message === undefined ? null : (
    <p aria-live="polite" className="notice">
      {message}
    </p>
  );
}
