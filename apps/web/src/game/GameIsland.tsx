import { useEffect, useRef, useState } from 'react';

import type { GameHudSnapshot, GameRuntime, RuntimeConnection } from './runtime';

export type RuntimeLoader = () => Promise<{
  mountGameRuntime(host: HTMLElement, onHud: (snapshot: GameHudSnapshot) => void): GameRuntime;
}>;
const defaultRuntimeLoader: RuntimeLoader = () => import('./runtime');

export function GameIsland({
  characterId,
  connection,
  onCheckpoint,
  loadRuntime = defaultRuntimeLoader,
}: {
  characterId: string;
  connection: RuntimeConnection;
  onCheckpoint: (intent: {
    operationId: string;
    schemaVersion: 1;
    characterId: string;
    sceneId: 'local:test';
    checkpointId: string;
  }) => Promise<void>;
  loadRuntime?: RuntimeLoader;
}) {
  const host = useRef<HTMLDivElement>(null);
  const runtime = useRef<GameRuntime | undefined>(undefined);
  const connectionRef = useRef(connection);
  const damageNumbersRef = useRef(true);
  const manuallyPaused = useRef(false);
  const pausedByVisibility = useRef(false);
  const checkpointIntent = useRef<
    | {
        operationId: string;
        schemaVersion: 1;
        characterId: string;
        sceneId: 'local:test';
        checkpointId: string;
      }
    | undefined
  >(undefined);
  const checkpointInFlight = useRef(false);
  const [checkpointPending, setCheckpointPending] = useState(false);
  const [checkpointError, setCheckpointError] = useState<string>();
  const [showDamageNumbers, setShowDamageNumbers] = useState(true);
  const [hud, setHud] = useState<GameHudSnapshot>({
    facing: 'down',
    paused: false,
    connection,
    health: 220,
    maxHealth: 220,
    fury: 0,
    maxFury: 100,
    cooldownRemainingMs: { slash: 0, powerStrike: 0, whirlwind: 0, ironSkin: 0 },
    ironSkinActive: false,
  });
  connectionRef.current = connection;
  damageNumbersRef.current = showDamageNumbers;
  useEffect(() => {
    let active = true;
    void loadRuntime().then(({ mountGameRuntime }) => {
      if (active && host.current !== null) {
        const mounted = mountGameRuntime(host.current, setHud);
        runtime.current = mounted;
        mounted.setConnection(connectionRef.current);
        mounted.setDamageNumbers?.(damageNumbersRef.current);
      }
    });
    return () => {
      active = false;
      runtime.current?.destroy();
      runtime.current = undefined;
    };
  }, [loadRuntime]);
  useEffect(() => runtime.current?.setConnection(connection), [connection]);
  useEffect(() => runtime.current?.setDamageNumbers?.(showDamageNumbers), [showDamageNumbers]);
  useEffect(() => {
    const onVisibilityChange = () => {
      const current = runtime.current;
      if (current === undefined) return;
      if (document.hidden) {
        if (!manuallyPaused.current) {
          pausedByVisibility.current = true;
          current.pause();
        }
        return;
      }
      if (pausedByVisibility.current) {
        pausedByVisibility.current = false;
        if (!manuallyPaused.current) current.resume();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);
  const checkpoint = async () => {
    if (checkpointInFlight.current) return;
    const intent = checkpointIntent.current ?? {
      operationId: crypto.randomUUID(),
      schemaVersion: 1 as const,
      characterId,
      sceneId: 'local:test' as const,
      checkpointId: 'test:gate',
    };
    checkpointIntent.current = intent;
    checkpointInFlight.current = true;
    setCheckpointPending(true);
    try {
      await onCheckpoint(intent);
      checkpointIntent.current = undefined;
      setCheckpointError(undefined);
    } catch {
      // Keep the exact intent for an explicit retry; the parent receives the original rejection.
      setCheckpointError('No se pudo guardar el punto de control. Podés reintentar.');
    } finally {
      checkpointInFlight.current = false;
      setCheckpointPending(false);
    }
  };
  return (
    <section aria-label="Partida local">
      <div className="game-island" ref={host} />
      <p aria-live="polite">
        Dirección: {hud.facing} · {hud.paused ? 'Pausada' : 'Activa'} · {hud.connection}
      </p>
      <dl aria-label="Estado de combate local" className="combat-hud">
        <div>
          <dt>Vida</dt>
          <dd>
            {hud.health}/{hud.maxHealth}
          </dd>
        </div>
        <div>
          <dt>Furia</dt>
          <dd>
            {hud.fury}/{hud.maxFury}
          </dd>
        </div>
        <div>
          <dt>Piel de hierro</dt>
          <dd>{hud.ironSkinActive ? 'Activa' : 'Lista'}</dd>
        </div>
        {Object.entries(hud.cooldownRemainingMs).map(([ability, remaining]) => (
          <div key={ability}>
            <dt>{ability}</dt>
            <dd>{Math.ceil(remaining / 1000)} s</dd>
          </div>
        ))}
      </dl>
      <p className="notice">
        Atacá con clic izquierdo, Golpe poderoso con clic derecho, Torbellino con Q y Piel de hierro
        con E.
      </p>
      <label className="combat-toggle">
        <input
          checked={showDamageNumbers}
          onChange={(event) => setShowDamageNumbers(event.target.checked)}
          type="checkbox"
        />
        Mostrar números de daño
      </label>
      <button
        onClick={() => {
          manuallyPaused.current = true;
          runtime.current?.pause();
        }}
        type="button"
      >
        Pausar
      </button>
      <button
        onClick={() => {
          manuallyPaused.current = false;
          runtime.current?.resume();
        }}
        type="button"
      >
        Reanudar
      </button>
      <button disabled={checkpointPending} onClick={() => void checkpoint()} type="button">
        Guardar punto de control
      </button>
      {checkpointError === undefined ? null : <p aria-live="polite">{checkpointError}</p>}
      {import.meta.env.DEV ? <output data-testid="game-dev-overlay">runtime local</output> : null}
    </section>
  );
}
