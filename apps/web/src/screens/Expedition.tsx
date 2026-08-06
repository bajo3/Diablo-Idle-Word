import { useState } from 'react';

import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';

export type ExpeditionDifficulty = 'normal';
export type ExpeditionZoneId = 'corrupted-forest' | 'sunken-ruins';

type ExpeditionZone = Readonly<{
  id: ExpeditionZoneId;
  available: boolean;
  name: string;
  subtitle: string;
  description: string;
  icon: IconName;
  levelRange: string;
  reward: string;
  backgroundPath: string;
}>;

const ZONES: readonly ExpeditionZone[] = [
  {
    id: 'corrupted-forest',
    available: true,
    name: 'Bosque Corrupto',
    subtitle: 'La frontera que nunca deja de crecer',
    description:
      'Derrotá enemigos, acumulá experiencia y avanzá por oleadas sin una derrota terminal.',
    icon: 'leaves',
    levelRange: 'Niveles 1–20',
    reward: 'XP del Bosque · oro · materiales',
    backgroundPath: '/assets/backgrounds/corrupted-forest.webp',
  },
  {
    id: 'sunken-ruins',
    available: false,
    name: 'Ruinas Sumergidas',
    subtitle: 'El pantano que guarda otra brecha',
    description: 'Nueva zona en preparación: terreno acuático, ruinas y rutas de exploración.',
    icon: 'map',
    levelRange: 'Próximamente',
    reward: 'Recompensas de expedición',
    backgroundPath: '/assets/backgrounds/sunken-ruins.webp',
  },
];

export function Expedition({
  characterName,
  onBack,
  onEnter,
}: {
  characterName: string;
  onBack: () => void;
  onEnter: (selection: { zoneId: ExpeditionZoneId; difficulty: ExpeditionDifficulty }) => void;
}) {
  const [selectedZone, setSelectedZone] = useState<ExpeditionZoneId>('corrupted-forest');
  const [difficulty, setDifficulty] = useState<ExpeditionDifficulty>('normal');
  const zone = ZONES.find((candidate) => candidate.id === selectedZone) ?? ZONES[0]!;

  return (
    <main
      className="ui-expedition-screen"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        padding: '24px clamp(16px, 4vw, 56px)',
        backgroundImage:
          'linear-gradient(180deg, rgb(5 7 13 / 24%), rgb(5 7 13 / 86%)), url("/assets/backgrounds/portal-shrine.webp")',
        backgroundColor: 'var(--surface-0)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        imageRendering: 'pixelated',
        color: 'var(--text)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          borderBottom: '1px solid var(--border-dim)',
          paddingBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            aria-hidden="true"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 48,
              height: 48,
              color: 'var(--accent)',
              border: '1px solid var(--border)',
              background: 'var(--surface-2)',
            }}
          >
            <Icon name="portal" size={28} />
          </span>
          <div>
            <p
              style={{
                margin: 0,
                color: 'var(--text-dim)',
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--fs-caption)',
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              Expedición · {characterName}
            </p>
            <h1
              style={{
                margin: '4px 0 0',
                color: 'var(--text-strong)',
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
              }}
            >
              Elegí tu destino
            </h1>
          </div>
        </div>
        <Button icon={<Icon name="chevron-left" size={18} />} onClick={onBack} variant="ghost">
          Volver al pueblo
        </Button>
      </header>

      <section aria-labelledby="expedition-zones-title" style={{ display: 'grid', gap: 12 }}>
        <div>
          <p
            style={{
              margin: 0,
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-caption)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            Zona disponible
          </p>
          <h2 id="expedition-zones-title" style={{ margin: '4px 0 0' }}>
            Expediciones
          </h2>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {ZONES.map((candidate) => {
            const active = candidate.id === selectedZone;
            return (
              <button
                aria-pressed={active}
                disabled={!candidate.available}
                key={candidate.id}
                onClick={() => {
                  if (candidate.available) setSelectedZone(candidate.id);
                }}
                type="button"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '56px 1fr',
                  gap: 14,
                  alignItems: 'start',
                  textAlign: 'left',
                  padding: 18,
                  color: 'var(--text)',
                  backgroundImage: `linear-gradient(135deg, rgb(7 10 12 / ${active ? 30 : 58}%), rgb(7 10 12 / 88%)), url("${candidate.backgroundPath}")`,
                  backgroundColor: active ? 'var(--surface-3)' : 'var(--surface-1)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border-dim)'}`,
                  boxShadow: active
                    ? '0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent)'
                    : 'none',
                  cursor: candidate.available ? 'pointer' : 'not-allowed',
                  opacity: candidate.available ? 1 : 0.72,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    display: 'grid',
                    placeItems: 'center',
                    width: 56,
                    height: 56,
                    color: active ? 'var(--accent)' : 'var(--text-muted)',
                    background: 'rgb(6 9 11 / 72%)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <Icon name={candidate.available ? candidate.icon : 'lock'} size={30} />
                </span>
                <span style={{ display: 'grid', gap: 7 }}>
                  <strong style={{ color: 'var(--text-strong)', fontSize: 'var(--fs-heading)' }}>
                    {candidate.name}
                  </strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>
                    {candidate.subtitle}
                  </span>
                  <span style={{ color: 'var(--text)', fontSize: 'var(--fs-body)' }}>
                    {candidate.description}
                  </span>
                  <span
                    style={{
                      color: 'var(--accent)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--fs-caption)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {candidate.levelRange} · {candidate.reward}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section
        aria-labelledby="expedition-difficulty-title"
        style={{
          display: 'grid',
          gap: 12,
          padding: 18,
          background: 'var(--surface-1)',
          border: '1px solid var(--border-dim)',
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              color: 'var(--text-dim)',
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-caption)',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
            }}
          >
            Dificultad
          </p>
          <h2 id="expedition-difficulty-title" style={{ margin: '4px 0 0' }}>
            Preparación de la expedición
          </h2>
        </div>
        <div
          role="radiogroup"
          aria-label="Dificultad de la expedición"
          style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              border: '1px solid var(--accent)',
              background: 'color-mix(in srgb, var(--accent) 10%, var(--surface-2))',
              cursor: 'pointer',
            }}
          >
            <input
              checked={difficulty === 'normal'}
              name="expedition-difficulty"
              onChange={() => setDifficulty('normal')}
              type="radio"
              value="normal"
            />
            <span>
              <strong>Normal</strong>
              <small style={{ display: 'block', color: 'var(--text-muted)' }}>
                Disponible ahora
              </small>
            </span>
          </label>
          <span
            aria-disabled="true"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 14px',
              color: 'var(--text-dim)',
              border: '1px dashed var(--border-dim)',
            }}
          >
            <Icon name="lock" size={18} />
            <span>
              <strong>Corrupción intensa</strong>
              <small style={{ display: 'block' }}>Se desbloquea más adelante</small>
            </span>
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            paddingTop: 8,
            borderTop: '1px solid var(--border-dim)',
          }}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: 'var(--fs-small)' }}>
            Destino: <strong style={{ color: 'var(--text-strong)' }}>{zone.name}</strong> ·{' '}
            <strong style={{ color: 'var(--accent)' }}>Normal</strong>
          </span>
          <Button
            icon={<Icon name="sword" size={18} />}
            onClick={() => onEnter({ zoneId: zone.id, difficulty })}
            variant="primary"
          >
            Entrar a la expedición
          </Button>
        </div>
      </section>
    </main>
  );
}
