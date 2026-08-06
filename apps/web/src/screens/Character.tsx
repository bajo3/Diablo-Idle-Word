import { useEffect, useState } from 'react';
import { characterClassDisplayName } from '@brecha/shared';

import { ApiError, gameApi, type ProgressionSnapshot } from '../api';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import { Panel } from '../components/Panel';
import {
  allocateLocalAttribute,
  loadLocalProgression,
  resetLocalAttributes,
  saveLocalProgression,
} from '../game/local-progression';

const ATTRIBUTES = [
  ['strength', 'Fuerza', 'sword'],
  ['dexterity', 'Destreza', 'target'],
  ['intelligence', 'Inteligencia', 'sparkles'],
  ['vitality', 'Vitalidad', 'heart'],
] as const;

export function Character({
  characterId,
  onBack,
  local = false,
}: {
  characterId: string | undefined;
  onBack: () => void;
  local?: boolean;
}) {
  const [snapshot, setSnapshot] = useState<ProgressionSnapshot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (characterId === undefined) return;
    if (local) {
      setSnapshot(loadLocalProgression(characterId));
      setError(undefined);
      return;
    }
    let active = true;
    void gameApi
      .progression(characterId)
      .then((result) => active && setSnapshot(result.progression))
      .catch((reason: unknown) => active && setError(errorText(reason)));
    return () => {
      active = false;
    };
  }, [characterId, local]);

  const allocate = async (attribute: keyof ProgressionSnapshot['attributes']) => {
    if (characterId === undefined || snapshot === undefined || snapshot.attributePoints < 1) return;
    setBusy(true);
    setError(undefined);
    try {
      if (local) {
        const next = allocateLocalAttribute(snapshot, attribute);
        if (next === snapshot) return;
        saveLocalProgression(next);
        setSnapshot(next);
        return;
      }
      const result = await gameApi.allocateAttribute({
        characterId,
        attribute,
        amount: 1,
        operationId: operationId(),
      });
      setSnapshot(result.receipt.snapshot);
    } catch (reason: unknown) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (
      characterId === undefined ||
      snapshot === undefined ||
      !window.confirm('¿Restablecer atributos por el costo indicado?')
    )
      return;
    setBusy(true);
    setError(undefined);
    try {
      if (local) {
        const next = resetLocalAttributes(snapshot);
        saveLocalProgression(next);
        setSnapshot(next);
        return;
      }
      const result = await gameApi.resetAttributes({ characterId, operationId: operationId() });
      setSnapshot(result.receipt.snapshot);
    } catch (reason: unknown) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  if (characterId === undefined) return <Empty onBack={onBack} />;
  if (snapshot === undefined && error === undefined)
    return <Empty onBack={onBack} message="Cargando personaje…" />;

  return (
    <main className="ui-character-screen" style={screenStyle}>
      <header style={headerStyle}>
        <div>
          <span className="eyebrow">
            PERSONAJE · {snapshot ? characterClassDisplayName(snapshot.class) : 'GUARDIÁN'}
          </span>
          <h1 style={titleStyle}>
            Hoja del {snapshot ? characterClassDisplayName(snapshot.class) : 'Guardián'}
          </h1>
          {snapshot ? (
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              Nivel {snapshot.level} · {snapshot.experience.toLocaleString('es-AR')} EXP
            </p>
          ) : null}
        </div>
        <Button variant="ghost" onClick={onBack}>
          Volver
        </Button>
      </header>
      {error ? (
        <p role="alert" style={{ color: 'var(--danger-bright)' }}>
          {error}
        </p>
      ) : null}
      {snapshot ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 360px)',
            gap: 16,
          }}
        >
          <Panel eyebrow="Progresión" title="Atributos" variant="ornate">
            <div style={xpTrackStyle} aria-label="Experiencia del personaje">
              <span
                style={{ width: `${percentage(snapshot.xpInLevel, snapshot.xpToNextLevel)}%` }}
              />
            </div>
            <p style={{ color: 'var(--text-muted)', margin: '8px 0 18px', fontSize: 12 }}>
              {snapshot.xpInLevel} / {snapshot.xpToNextLevel || 'MAX'} EXP · Puntos disponibles:{' '}
              <strong>{snapshot.attributePoints}</strong>
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {ATTRIBUTES.map(([key, label, icon]) => (
                <div key={key} style={attributeRowStyle}>
                  <Icon name={icon as never} size={22} />
                  <span style={{ flex: 1 }}>{label}</span>
                  <strong>{snapshot.attributes[key]}</strong>
                  <button
                    disabled={busy || snapshot.attributePoints < 1}
                    onClick={() => void allocate(key)}
                    type="button"
                    aria-label={`Aumentar ${label}`}
                    style={plusStyle}
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
            <Button
              disabled={busy}
              onClick={() => void reset()}
              variant="ghost"
              style={{ marginTop: 18 }}
            >
              Restablecer atributos · {snapshot.level * 100} oro
            </Button>
          </Panel>
          <Panel eyebrow="Estadísticas derivadas" title="Estado de combate">
            <div style={{ display: 'grid', gap: 10 }}>
              <Stat label="Vida máxima" value={snapshot.derivedStats.maxHealth} />
              <Stat
                label="Daño físico"
                value={`${snapshot.derivedStats.physicalDamageMin}–${snapshot.derivedStats.physicalDamageMax}`}
              />
              <Stat label="Armadura" value={snapshot.derivedStats.armor} />
              <Stat
                label="Crítico"
                value={`${snapshot.derivedStats.criticalChancePercent.toFixed(1)}%`}
              />
              <Stat
                label="Velocidad de ataque"
                value={`${snapshot.derivedStats.attackSpeedPercent.toFixed(1)}%`}
              />
            </div>
            <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 18 }}>
              Build {snapshot.buildFingerprint.slice(0, 12)}…
            </p>
          </Panel>
        </div>
      ) : null}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-dim)',
        paddingBottom: 8,
      }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Empty({
  onBack,
  message = 'Seleccioná un personaje para abrir la hoja.',
}: {
  onBack: () => void;
  message?: string;
}) {
  return (
    <main style={screenStyle}>
      <p>{message}</p>
      <Button variant="ghost" onClick={onBack}>
        Volver
      </Button>
    </main>
  );
}

function errorText(reason: unknown): string {
  return reason instanceof ApiError ? reason.code : 'No se pudo cargar la progresión.';
}
function operationId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `progression:${Date.now()}:${Math.random().toString(36).slice(2)}`
  );
}
function percentage(value: number, max: number) {
  return max <= 0 ? 100 : Math.min(100, Math.max(0, (value / max) * 100));
}

const screenStyle = {
  minHeight: '100vh',
  padding: '24px clamp(16px, 4vw, 48px)',
  background: 'var(--surface-0)',
  color: 'var(--text)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
} as const;
const headerStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
} as const;
const titleStyle = {
  margin: '6px 0',
  fontFamily: 'var(--font-display)',
  color: 'var(--text-strong)',
  letterSpacing: '0.04em',
} as const;
const xpTrackStyle = {
  height: 8,
  background: 'var(--surface-3)',
  border: '1px solid var(--border-dim)',
  overflow: 'hidden',
} as const;
const attributeRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '10px 12px',
  background: 'var(--surface-2)',
  border: '1px solid var(--border-dim)',
} as const;
const plusStyle = {
  width: 28,
  height: 28,
  border: '1px solid var(--accent)',
  background: 'transparent',
  color: 'var(--accent)',
  cursor: 'pointer',
  fontSize: 18,
} as const;
