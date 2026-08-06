import { useEffect, useState } from 'react';

import { ApiError, gameApi, type RewardResult } from '../api';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';

function amount(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function label(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

function date(value: number): string {
  return new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(value),
  );
}

export function RewardResults({
  characterId,
  onBack,
}: {
  characterId: string | undefined;
  onBack: () => void;
}) {
  const [results, setResults] = useState<RewardResult[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (characterId === undefined) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setError(undefined);
    void gameApi
      .recentRewards(characterId)
      .then((response) => {
        if (active) setResults(response.results);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof ApiError ? reason.code : 'No se pudieron cargar los resultados.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [characterId]);

  if (characterId === undefined)
    return (
      <EmptyState message="Selecciona un personaje para ver sus resultados." onBack={onBack} />
    );

  return (
    <main
      className="ui-reward-results-screen"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '24px clamp(16px, 4vw, 48px)',
        background: 'var(--surface-0)',
        color: 'var(--text)',
      }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
      >
        <div>
          <span
            style={{
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-caption)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            Recompensas privadas
          </span>
          <h1
            style={{
              margin: '4px 0 0',
              color: 'var(--text-strong)',
              fontFamily: 'var(--font-display)',
            }}
          >
            Resultados de la expedición
          </h1>
        </div>
        <Button icon={<Icon name="chevron-left" size={18} />} onClick={onBack} variant="ghost">
          Volver
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            color: 'var(--danger-bright)',
            border: '1px solid var(--danger-bright)',
            padding: '10px 12px',
          }}
        >
          {error}
        </div>
      ) : null}
      {loading ? <p aria-live="polite">Cargando resultados...</p> : null}
      {!loading && results.length === 0 ? (
        <EmptyState inline message="Todavia no hay recompensas de enemigos para mostrar." />
      ) : null}
      <div style={{ display: 'grid', gap: 12 }}>
        {results.map((result) => (
          <Panel
            key={result.operationId}
            eyebrow={`${result.difficulty === 'veteran' ? 'Veterano' : 'Normal'} · ${result.partySize} jugador${result.partySize === 1 ? '' : 'es'}`}
            title={`${label(result.archetype)} · Bosque nivel ${result.forestLevel}`}
            variant="ornate"
            actions={
              <time dateTime={new Date(result.createdAtMs).toISOString()}>
                {date(result.createdAtMs)}
              </time>
            }
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 10,
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
              }}
            >
              <span style={{ color: 'var(--blue)' }}>+{amount(result.experienceDelta)} EXP</span>
              <span style={{ color: 'var(--gold)' }}>+{amount(result.goldDelta)} oro</span>
              <span style={{ color: 'var(--corruption)' }}>
                +{amount(result.materialsDelta)} materiales
              </span>
              {result.drop ? (
                <span
                  style={{
                    color: result.drop.rarity === 'legendary' ? 'var(--gold)' : 'var(--accent)',
                  }}
                >
                  Objeto: {label(result.drop.definitionId)} · {result.drop.rarity} · POD{' '}
                  {result.drop.itemPower}
                </span>
              ) : (
                <span style={{ color: 'var(--text-muted)' }}>
                  {result.dropStatus === 'inventory_full' ? 'Inventario lleno' : 'Sin drop'}
                </span>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </main>
  );
}

function EmptyState({
  message,
  onBack,
  inline = false,
}: {
  message: string;
  onBack?: () => void;
  inline?: boolean;
}) {
  return (
    <div
      style={{
        ...(inline ? {} : { minHeight: '100vh', padding: 24 }),
        display: 'grid',
        placeItems: 'center',
        gap: 12,
        color: 'var(--text-muted)',
      }}
    >
      <p>{message}</p>
      {onBack ? <Button onClick={onBack}>Volver</Button> : null}
    </div>
  );
}
