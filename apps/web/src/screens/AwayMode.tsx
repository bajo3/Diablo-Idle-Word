import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { ApiError, gameApi, type AwayStatus } from '../api';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

const CALIBRATION_SECONDS = 300;

export function AwayMode({
  characterId,
  characterName,
  onBack,
  autoReturn = false,
}: {
  characterId?: string;
  characterName: string;
  onBack: () => void;
  autoReturn?: boolean;
}) {
  const [status, setStatus] = useState<AwayStatus>();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [difficulty, setDifficulty] = useState<'normal' | 'veteran'>('normal');
  const autoReturnStarted = useRef(false);

  const refresh = useCallback(async () => {
    if (characterId === undefined) return;
    try {
      const result = await gameApi.awayStatus(characterId);
      setStatus(result.away);
      setNowMs(Date.now());
      setError(undefined);
    } catch (caught) {
      setError(errorText(caught));
    }
  }, [characterId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    if (status?.session?.state === 'ACTIVE' || status?.calibration?.state === 'RUNNING') {
      const timer = window.setInterval(() => void refresh(), 10_000);
      return () => window.clearInterval(timer);
    }
    return undefined;
  }, [refresh, status?.calibration?.state, status?.session?.state]);

  const calibrationRemaining = useMemo(() => {
    const started = status?.calibration?.startedAtServerMs;
    if (started === undefined) return CALIBRATION_SECONDS;
    const serverOffset = (status?.serverNowMs ?? nowMs) - nowMs;
    return Math.max(0, CALIBRATION_SECONDS - Math.floor((nowMs + serverOffset - started) / 1000));
  }, [nowMs, status?.calibration?.startedAtServerMs, status?.serverNowMs]);
  const awayElapsed = useMemo(() => {
    const started = status?.session?.startedAtServerMs;
    if (started === undefined) return 0;
    const serverOffset = (status?.serverNowMs ?? nowMs) - nowMs;
    return Math.max(0, Math.floor((nowMs + serverOffset - started) / 1000));
  }, [nowMs, status?.serverNowMs, status?.session?.startedAtServerMs]);

  const run = async (
    action: () => Promise<{ away?: AwayStatus; receipt?: { result?: unknown } }>,
  ) => {
    setBusy(true);
    try {
      const result = await action();
      if (result.away !== undefined) setStatus(result.away);
      else await refresh();
      setError(undefined);
    } catch (caught) {
      setError(errorText(caught));
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const calibration = status?.calibration;
  const result = status?.result;
  const hasActive = status?.session?.state === 'ACTIVE';
  const pending = result?.state === 'PENDING';
  useEffect(() => {
    if (characterId !== undefined && autoReturn && hasActive && !autoReturnStarted.current) {
      autoReturnStarted.current = true;
      void run(() =>
        gameApi.returnAway({ characterId, operationId: newOperationId('character-open') }),
      );
    }
  }, [autoReturn, characterId, hasActive, run]);
  if (characterId === undefined) {
    return <EmptyAway characterName={characterName} onBack={onBack} />;
  }
  return (
    <main
      className="shell"
      style={{
        minHeight: '100vh',
        backgroundImage:
          'linear-gradient(180deg, rgb(5 8 12 / 28%), rgb(5 8 12 / 82%)), url("/assets/backgrounds/explorer-outpost.webp")',
        backgroundColor: 'var(--surface-0)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        imageRendering: 'pixelated',
      }}
    >
      <section className="panel dashboard" style={{ maxWidth: 900, margin: '0 auto' }}>
        <header className="panel-header">
          <div>
            <p className="eyebrow">Modo ausente · {characterName}</p>
            <h1>Preparar una expedición persistente</h1>
            <p>
              El servidor mide tu rendimiento real durante 5:00 y luego calcula el regreso sin
              simular frames.
            </p>
          </div>
          <Button icon={<Icon name="chevron-left" size={18} />} onClick={onBack} variant="ghost">
            Volver
          </Button>
        </header>
        {error ? (
          <p className="notice" role="alert">
            {error}
          </p>
        ) : null}
        <section style={{ display: 'grid', gap: 14 }} aria-live="polite">
          <div className="card-grid">
            <article className="card">
              <p className="eyebrow">Zona</p>
              <h2>Bosque Corrupto</h2>
              <p>Farmeo continuo · dificultad normal o veterano · cap inicial de 8 horas.</p>
              <label>
                Zona de farmeo
                <select aria-label="Zona de calibración" disabled value="corrupted_forest">
                  <option value="corrupted_forest">Bosque Corrupto</option>
                </select>
              </label>
              <label>
                Dificultad
                <select
                  aria-label="Dificultad de calibración"
                  disabled={calibration?.state === 'RUNNING' || hasActive}
                  onChange={(event) => setDifficulty(event.target.value as 'normal' | 'veteran')}
                  value={difficulty}
                >
                  <option value="normal">Normal</option>
                  <option value="veteran">Veterano</option>
                </select>
              </label>
            </article>
            <article className="card">
              <p className="eyebrow">Estado durable</p>
              <strong>{status?.availability ?? 'Cargando…'}</strong>
              <p>
                {calibration?.buildFingerprint
                  ? `Build ${calibration.buildFingerprint.slice(0, 10)}…`
                  : 'Todavía no hay calibración.'}
              </p>
            </article>
          </div>
          {calibration?.state === 'RUNNING' ? (
            <article className="notice">
              <h2>Calibrando rendimiento real</h2>
              <p className="away-timer">{formatDuration(calibrationRemaining)}</p>
              <p>
                Podés seguir combatiendo. Cambiar equipo, habilidades, zona o dificultad invalida la
                muestra.
              </p>
              <Button
                disabled={busy || calibrationRemaining > 0}
                onClick={() =>
                  void run(() =>
                    gameApi.completeAwayCalibration({ characterId, calibrationId: calibration.id }),
                  )
                }
              >
                {calibrationRemaining > 0 ? 'Esperar 5:00 válidos' : 'Completar calibración'}
              </Button>
            </article>
          ) : calibration?.state === 'VALID' ? (
            <article className="notice">
              <h2>Muestra lista para activar</h2>
              <Rates calibration={calibration} />
              <Button
                disabled={busy}
                onClick={() => {
                  if (window.confirm('¿Activar esta build durante un máximo de 8 horas?'))
                    void run(() =>
                      gameApi.activateAway({
                        characterId,
                        calibrationId: calibration.id,
                        operationId: newOperationId('activate'),
                      }),
                    );
                }}
              >
                Activar modo ausente
              </Button>
            </article>
          ) : hasActive ? (
            <article className="notice">
              <h2>El Guardián está farmeando</h2>
              <p>
                {formatDuration(awayElapsed)} transcurridos · el servidor conserva la sesión aunque
                cierres el navegador.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    gameApi.returnAway({ characterId, operationId: newOperationId('return') }),
                  )
                }
              >
                Volver y calcular recompensas
              </Button>
            </article>
          ) : pending ? (
            <article className="notice">
              <h2>Informe listo para reclamar</h2>
              <Report report={result.report} />
              <Button
                disabled={busy}
                onClick={() => void run(() => gameApi.claimAway(characterId))}
              >
                Reclamar una vez
              </Button>
            </article>
          ) : result?.state === 'CLAIMED' ? (
            <article className="notice">
              <h2>Recompensa entregada</h2>
              <Report report={result.report} />
              <p>{result.claimedItems.length} objeto(s) nuevo(s) guardado(s) en el inventario.</p>
              <Button onClick={onBack}>Volver al pueblo</Button>
            </article>
          ) : calibration?.state === 'INVALID' ? (
            <article className="notice">
              <h2>Muestra invalidada</h2>
              <p>{invalidReason(calibration.invalidReason)}</p>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    gameApi.startAwayCalibration({
                      characterId,
                      operationId: newOperationId('calibrate'),
                      zoneId: 'corrupted_forest',
                      difficulty,
                    }),
                  )
                }
              >
                Preparar una nueva muestra
              </Button>
            </article>
          ) : (
            <article className="notice">
              <h2>Listo para calibrar</h2>
              <p>
                Elegí tu build real, entrá al bosque y medí cinco minutos antes de activar el modo
                ausente.
              </p>
              <Button
                disabled={busy}
                onClick={() =>
                  void run(() =>
                    gameApi.startAwayCalibration({
                      characterId,
                      operationId: newOperationId('calibrate'),
                      zoneId: 'corrupted_forest',
                      difficulty,
                    }),
                  )
                }
              >
                Preparar modo offline
              </Button>
            </article>
          )}
        </section>
      </section>
    </main>
  );
}

function Rates({ calibration }: { calibration: NonNullable<AwayStatus['calibration']> }) {
  return (
    <p>
      Estimación por hora: {calibration.estimatePerHour.experience} XP ·{' '}
      {calibration.estimatePerHour.gold} oro · {calibration.estimatePerHour.materials} materiales ·{' '}
      {calibration.estimatePerHour.enemies} enemigos.
    </p>
  );
}

function Report({ report }: { report: NonNullable<NonNullable<AwayStatus['result']>['report']> }) {
  return (
    <p>
      {formatDuration(report.computedSeconds)} computables · +{report.rewards.experience} XP · +
      {report.rewards.gold} oro · +{report.rewards.materials} materiales ·{' '}
      {report.generatedItemsByRarity.common +
        report.generatedItemsByRarity.magic +
        report.generatedItemsByRarity.rare}{' '}
      objetos.
    </p>
  );
}

function EmptyAway({ characterName, onBack }: { characterName: string; onBack: () => void }) {
  return (
    <main className="shell">
      <section className="panel">
        <p className="eyebrow">Modo ausente · {characterName}</p>
        <h1>Seleccioná un Guardián</h1>
        <p>Elegí un personaje disponible para preparar una calibración.</p>
        <Button onClick={onBack}>Volver</Button>
      </section>
    </main>
  );
}

function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)
    .toString()
    .padStart(2, '0')}:${(safe % 60).toString().padStart(2, '0')}`;
}

function newOperationId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `away:${prefix}:${random}`;
}

function errorText(error: unknown): string {
  if (error instanceof ApiError && error.code === 'calibration_incomplete')
    return 'Todavía no pasaron los 5:00 válidos.';
  if (error instanceof ApiError && error.code === 'conflict')
    return 'El estado cambió en otra pestaña. Actualicé la pantalla.';
  return 'No se pudo actualizar el modo ausente. Reintentá.';
}

function invalidReason(reason: string | undefined): string {
  if (reason === 'BUILD_CHANGED') return 'La build cambió durante la muestra.';
  if (reason === 'INSUFFICIENT_ACTIVITY') return 'No hubo actividad de combate suficiente.';
  if (reason === 'IMPOSSIBLE_RATE') return 'La tasa de recompensas no es posible y fue descartada.';
  return 'La muestra no cumple las reglas del servidor.';
}
