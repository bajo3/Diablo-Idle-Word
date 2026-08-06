/**
 * Town: pueblo / hub central.
 * Área con NPCs clicables (Herrero, Guardián del Portal, Exploradora),
 * barra superior de oro/materiales/nivel y dock inferior de accesos.
 * Transcripción del kit DC, ajustada para encajar con el router existente.
 */
import { useEffect, useState } from 'react';

import { ApiError, gameApi, type TownSnapshot } from '../api';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { DOCK, TOWN_NPCS } from '../data/mockData';

const TOP_BAR = {
  background: 'color-mix(in srgb, var(--surface-0) 94%, transparent)',
  borderBottom: '1px solid var(--border-dim)',
  backdropFilter: 'blur(6px)',
} as const;

export function Town({
  characterName,
  level,
  gold,
  materials,
  characterId,
  onDock,
  onBack,
}: {
  characterName: string;
  level: number;
  gold: number;
  materials: number;
  characterId?: string;
  onDock: (key: string) => void;
  onBack: () => void;
}) {
  const [town, setTown] = useState<TownSnapshot>();
  const [error, setError] = useState<string>();
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialBusy, setTutorialBusy] = useState(false);
  useEffect(() => {
    if (characterId === undefined) return;
    let active = true;
    void gameApi
      .town(characterId)
      .then((result) => {
        if (!active) return;
        setTown(result.town);
        setTutorialOpen(result.town.tutorial.status === 'NOT_STARTED');
      })
      .catch((reason: unknown) => active && setError(errorText(reason)));
    return () => {
      active = false;
    };
  }, [characterId]);
  const currentName = town?.characterName ?? characterName;
  const currentLevel = town?.level ?? level;
  const currentGold = town?.gold ?? gold;
  const currentMaterials = town?.materials ?? materials;
  const tutorialAction = async (action: 'start' | 'complete' | 'skip' | 'replay') => {
    if (characterId === undefined) {
      setTutorialOpen(false);
      return;
    }
    setTutorialBusy(true);
    try {
      const result = await gameApi.updateTownTutorial({
        characterId,
        operationId: operationId(),
        tutorialId: 'town-intro.v1',
        action,
      });
      setTown(result.receipt.town);
      setTutorialOpen(action === 'start' || action === 'replay');
    } catch (reason: unknown) {
      setError(errorText(reason));
    } finally {
      setTutorialBusy(false);
    }
  };
  return (
    <main
      className="ui-town-screen"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface-0)',
        color: 'var(--text)',
      }}
    >
      {/* Barra superior: identidad + oro/nivel */}
      <header
        style={{
          ...TOP_BAR,
          position: 'sticky',
          top: 0,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '12px 24px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: 'var(--text-strong)',
            }}
          >
            LA BRECHA OSCURA
          </span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              letterSpacing: '0.16em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
            }}
          >
            PUEBLO · {currentName}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 18, marginLeft: 'auto', alignItems: 'center' }}>
          <Resource kind="gem" color="var(--accent)" label={`Nivel ${currentLevel}`} />
          <Resource kind="ring" color="var(--gold)" label={`${format(currentGold)} oro`} />
          <Resource
            kind="shard"
            color="var(--text-muted)"
            label={`${format(currentMaterials)} materiales`}
          />
          <Button variant="ghost" onClick={onBack}>
            Salir
          </Button>
        </div>
      </header>

      {/* Escenario ilustrado + NPCs clicables */}
      <div
        className="ui-town-stage"
        style={{
          position: 'relative',
          flex: 1,
          minHeight: 460,
          backgroundImage:
            'linear-gradient(180deg, rgb(4 8 10 / 20%), rgb(4 8 7 / 62%)), url("/assets/backgrounds/village-square.webp")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      >
        {TOWN_NPCS.map((npc) => (
          <button
            key={npc.name}
            type="button"
            onClick={() => onDock(npc.name)}
            style={{
              all: 'unset',
              cursor: 'pointer',
              position: 'absolute',
              left: npc.x,
              top: npc.y,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {/* Avatar placeholder: silueta de personaje */}
            <span
              aria-hidden="true"
              style={{
                width: 70,
                height: 70,
                display: 'grid',
                placeItems: 'center',
                color: npc.name === 'Herrero' ? 'var(--gold)' : 'var(--accent)',
                background:
                  'repeating-linear-gradient(45deg, var(--surface-2), var(--surface-2) 6px, var(--surface-3) 6px, var(--surface-3) 12px)',
                border: '1px dashed var(--border-strong)',
                boxShadow: '0 10px 24px rgb(0 0 0 / 45%)',
              }}
            >
              <Icon
                name={
                  npc.name === 'Herrero'
                    ? 'anvil'
                    : npc.name === 'Guardián del Portal'
                      ? 'portal'
                      : 'map'
                }
                size={34}
              />
            </span>
            <span style={{ fontWeight: 600, color: 'var(--text-strong)', fontSize: 13 }}>
              {npc.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{npc.role}</span>
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-mono)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: npc.tagFg,
                background: npc.tagBg,
                border: `1px solid ${npc.tagBd}`,
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {npc.tag}
            </span>
          </button>
        ))}
      </div>

      {/* Dock inferior de accesos */}
      <footer
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 20,
          display: 'flex',
          gap: 8,
          padding: '10px 16px',
          background: 'color-mix(in srgb, var(--surface-0) 92%, transparent)',
          borderTop: '1px solid var(--border-dim)',
          backdropFilter: 'blur(6px)',
          justifyContent: 'center',
        }}
      >
        {DOCK.map((d) => (
          <DockButton key={d.label} entry={d} onClick={() => onDock(d.key)} />
        ))}
      </footer>
      {error ? (
        <p role="alert" style={{ margin: 12, color: 'var(--danger-bright)' }}>
          {error}
        </p>
      ) : null}
      {town && town.tutorial.status !== 'NOT_STARTED' ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 16px' }}>
          <Button
            disabled={tutorialBusy}
            variant="ghost"
            onClick={() => void tutorialAction('replay')}
          >
            Repetir tutorial del pueblo
          </Button>
        </div>
      ) : null}
      {tutorialOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="town-tutorial-title"
          style={tutorialBackdropStyle}
        >
          <section style={tutorialStyle}>
            <span className="eyebrow">GUÍA DEL PUEBLO</span>
            <h2 id="town-tutorial-title" style={{ margin: '6px 0' }}>
              Tres pasos para sobrevivir
            </h2>
            <ol style={{ color: 'var(--text-muted)', lineHeight: 1.7, paddingLeft: 20 }}>
              <li>Visitá al comerciante para comprar equipo o vender botín protegido.</li>
              <li>Usá el cofre para liberar espacio sin perder las instancias.</li>
              <li>El portal lleva al Bosque Corrupto y al modo ausente calibrado.</li>
            </ol>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {town?.tutorial.status === 'NOT_STARTED' ? (
                <Button disabled={tutorialBusy} onClick={() => void tutorialAction('start')}>
                  Ver tutorial
                </Button>
              ) : null}
              <Button
                disabled={tutorialBusy}
                variant="primary"
                onClick={() => void tutorialAction('complete')}
              >
                Marcar como visto
              </Button>
              <Button
                disabled={tutorialBusy}
                variant="ghost"
                onClick={() => void tutorialAction('skip')}
              >
                Omitir
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function operationId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `town:${Date.now()}:${Math.random().toString(36).slice(2)}`
  );
}
function format(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}
function errorText(reason: unknown): string {
  return reason instanceof ApiError ? reason.code : 'No se pudo cargar el estado del pueblo.';
}

function Resource({
  kind,
  color,
  label,
}: {
  kind: Parameters<typeof Icon>[0]['name'];
  color: string;
  label: string;
}) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Icon name={kind} size={16} style={{ color }} />
      <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>
    </span>
  );
}

function DockButton({ entry, onClick }: { entry: (typeof DOCK)[number]; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${entry.label} (${entry.key})`}
      style={{
        cursor: 'pointer',
        width: 64,
        height: 64,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        background: 'var(--surface-2)',
        border: '1px solid var(--border-dim)',
        borderRadius: 'var(--radius)',
        color: 'var(--text-muted)',
        position: 'relative',
      }}
    >
      <Icon name={dockIcon(entry.kind)} size={24} style={{ color: entry.color }} />
      <span style={{ fontSize: 10, letterSpacing: '0.04em' }}>{entry.label}</span>
      <span
        style={{
          position: 'absolute',
          top: 4,
          right: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 9,
          color: 'var(--text-dim)',
        }}
      >
        {entry.key}
      </span>
      {entry.badge && (
        <span
          style={{
            position: 'absolute',
            top: 3,
            left: 3,
            background: 'var(--corruption)',
            color: 'var(--text-strong)',
            fontSize: 9,
            fontWeight: 700,
            minWidth: 14,
            height: 14,
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 3px',
          }}
        >
          {entry.badge}
        </span>
      )}
    </button>
  );
}

function dockIcon(kind: string): IconName {
  const icons: Record<'chest' | 'gem' | 'sword' | 'potion' | 'ring' | 'shard', IconName> = {
    chest: 'inventory',
    gem: 'sparkles',
    sword: 'sword',
    potion: 'potion',
    ring: 'ring',
    shard: 'shard',
  };
  return icons[kind as keyof typeof icons] ?? 'sparkles';
}

const tutorialBackdropStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 40,
  display: 'grid',
  placeItems: 'center',
  padding: 20,
  background: 'rgb(0 0 0 / 68%)',
  backdropFilter: 'blur(4px)',
} as const;
const tutorialStyle = {
  width: 'min(560px, 100%)',
  padding: 24,
  background: 'var(--surface-1)',
  border: '1px solid var(--accent)',
  boxShadow: '0 24px 80px rgb(0 0 0 / 60%)',
} as const;
