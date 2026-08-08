import { useEffect, useState } from 'react';
import { characterClassDisplayName } from '@brecha/shared';

import { ApiError, gameApi, type ProgressionSnapshot } from '../api';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { Panel } from '../components/Panel';

/**
 * Picks an icon by keyword in the ability's id/name rather than one hardcoded ending — every
 * class's abilities ("cleave", "power_strike", "iron_skin"...) get a plausible glyph instead of
 * everything non-slash defaulting to sparkles.
 */
function iconForSkill(skill: ProgressionSnapshot['skills'][number]): IconName {
  const key = `${skill.abilityId} ${skill.displayName}`.toLowerCase();
  if (skill.kind === 'passive') return 'sparkles';
  if (/cleave|axe/.test(key)) return 'axe';
  if (/slash|strike|blade|thrust|stab/.test(key)) return 'sword';
  if (/skin|shield|guard|ward/.test(key)) return 'shield';
  if (/rush|thirst|blood|rage|fury/.test(key)) return 'fury';
  if (/heal|life|vital/.test(key)) return 'heart';
  if (/whirlwind|storm|cyclone/.test(key)) return 'target';
  return 'sparkles';
}

export function Skills({
  characterId,
  onBack,
}: {
  characterId: string | undefined;
  onBack: () => void;
}) {
  const [snapshot, setSnapshot] = useState<ProgressionSnapshot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (characterId === undefined) return;
    let active = true;
    void gameApi
      .progression(characterId)
      .then((result) => active && setSnapshot(result.progression))
      .catch((reason: unknown) => active && setError(errorText(reason)));
    return () => {
      active = false;
    };
  }, [characterId]);

  const mutate = async (action: () => Promise<{ receipt: { snapshot: ProgressionSnapshot } }>) => {
    setBusy(true);
    setError(undefined);
    try {
      setSnapshot((await action()).receipt.snapshot);
    } catch (reason: unknown) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };
  const op = () =>
    globalThis.crypto?.randomUUID?.() ??
    `skill:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  if (characterId === undefined) return <Empty onBack={onBack} />;
  if (snapshot === undefined && error === undefined)
    return <Empty onBack={onBack} message="Cargando habilidades…" />;
  return (
    <main style={screenStyle}>
      <header style={headerStyle}>
        <div>
          <span className="eyebrow">
            HABILIDADES · {snapshot ? characterClassDisplayName(snapshot.class) : 'GUARDIÁN'} ·
            NIVEL {snapshot?.level ?? 1}
          </span>
          <h1 style={titleStyle}>Barra de habilidades</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Desbloqueá técnicas por nivel y guardá tu build en el servidor.
          </p>
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 16 }}>
          <Panel
            eyebrow={
              snapshot.class === 'BARBARIAN' && snapshot.skills.some((skill) => skill.branchId)
                ? 'Rama · Canto de sangre'
                : 'Catálogo de habilidades'
            }
            title="Habilidades"
          >
            <div style={{ display: 'grid', gap: 10 }}>
              {snapshot.skills.map((skill) => (
                <SkillRow
                  key={skill.abilityId}
                  skill={skill}
                  slot={firstFreeSlot(snapshot)}
                  busy={busy}
                  characterId={characterId}
                  onMutate={mutate}
                  op={op}
                />
              ))}
            </div>
          </Panel>
          <Panel eyebrow="Build persistida" title="Barra activa" variant="ornate">
            <div style={{ display: 'grid', gap: 8 }}>
              {[0, 1, 2, 3].map((slot) => {
                const skill = snapshot.skills.find((entry) => entry.barSlot === slot);
                return (
                  <div key={slot} style={filledSlotStyle(skill !== undefined)}>
                    <span style={keybindChipStyle}>{slot + 1}</span>
                    <Icon
                      name={skill ? iconForSkill(skill) : 'lock'}
                      size={18}
                      style={{ color: skill ? 'var(--accent)' : 'var(--text-dim)' }}
                    />
                    <strong style={{ color: skill ? 'var(--text-strong)' : 'var(--text-dim)' }}>
                      {skill?.displayName ?? 'Ranura vacía'}
                    </strong>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>
      ) : null}
    </main>
  );
}

function SkillRow({
  skill,
  slot,
  busy,
  characterId,
  onMutate,
  op,
}: {
  skill: ProgressionSnapshot['skills'][number];
  slot: number;
  busy: boolean;
  characterId: string;
  onMutate: (
    action: () => Promise<{ receipt: { snapshot: ProgressionSnapshot } }>,
  ) => Promise<void>;
  op: () => string;
}) {
  const unlocked = skill.unlocked;
  return (
    <article
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        background: skill.equipped
          ? 'color-mix(in srgb, var(--accent) 10%, var(--surface-2))'
          : 'var(--surface-2)',
        border: `1px solid ${skill.equipped ? 'var(--accent)' : 'var(--border-dim)'}`,
        opacity: unlocked ? 1 : 0.75,
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <span
        style={{
          position: 'relative',
          width: 38,
          height: 38,
          flex: '0 0 auto',
          display: 'grid',
          placeItems: 'center',
          border: '1px solid var(--border-strong)',
          background: unlocked ? 'var(--surface-sunken)' : 'var(--surface-1)',
          color: unlocked ? 'var(--accent)' : 'var(--text-dim)',
          filter: unlocked ? 'none' : 'grayscale(0.6)',
        }}
      >
        <Icon name={iconForSkill(skill)} size={22} />
        {!unlocked && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: -1,
              display: 'grid',
              placeItems: 'center',
              background: 'rgb(6 8 10 / 55%)',
            }}
          >
            <Icon name="lock" size={16} style={{ color: 'var(--text-dim)' }} />
          </span>
        )}
      </span>
      <div style={{ flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <strong>{skill.displayName}</strong>
          {unlocked && skill.kind !== 'passive' && skill.level > 0 && (
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                color: 'var(--text-dim)',
                letterSpacing: '0.06em',
              }}
            >
              NV. {skill.level}
            </span>
          )}
        </span>
        <p style={{ margin: '3px 0 0', color: 'var(--text-muted)', fontSize: 12 }}>
          {skill.description}
        </p>
        <small style={{ color: 'var(--text-dim)' }}>
          {skill.kind === 'passive'
            ? 'Pasiva · no ocupa ranura'
            : unlocked
              ? 'Desbloqueada'
              : `Se desbloquea en nivel ${skill.unlockLevel}`}
        </small>
      </div>
      {skill.kind === 'passive' ? (
        <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>Pasiva</span>
      ) : !unlocked ? (
        <Button
          disabled={busy}
          onClick={() =>
            void onMutate(() =>
              gameApi.learnSkill({ characterId, abilityId: skill.abilityId, operationId: op() }),
            )
          }
          size="sm"
        >
          Aprender
        </Button>
      ) : skill.equipped ? (
        <Button
          disabled={busy}
          onClick={() =>
            void onMutate(() =>
              gameApi.setSkillBar({
                characterId,
                abilityId: skill.abilityId,
                barSlot: null,
                operationId: op(),
              }),
            )
          }
          size="sm"
          variant="ghost"
        >
          Quitar
        </Button>
      ) : (
        <Button
          disabled={busy}
          onClick={() =>
            void onMutate(() =>
              gameApi.setSkillBar({
                characterId,
                abilityId: skill.abilityId,
                barSlot: slot,
                operationId: op(),
              }),
            )
          }
          size="sm"
        >
          Equipar
        </Button>
      )}
    </article>
  );
}

function firstFreeSlot(snapshot: ProgressionSnapshot) {
  const used = new Set(
    snapshot.skills.map((skill) => skill.barSlot).filter((slot): slot is number => slot !== null),
  );
  return [0, 1, 2, 3].find((slot) => !used.has(slot)) ?? 0;
}
function errorText(reason: unknown) {
  return reason instanceof ApiError ? reason.code : 'No se pudo cargar la build.';
}
function Empty({
  onBack,
  message = 'Seleccioná un personaje para abrir habilidades.',
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
const screenStyle = {
  minHeight: '100vh',
  padding: '24px clamp(16px, 4vw, 48px)',
  background:
    'radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--ambient-moss) 22%, transparent), transparent 40rem), var(--surface-0)',
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
function filledSlotStyle(filled: boolean) {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    border: `1px solid ${filled ? 'var(--accent)' : 'var(--border-dim)'}`,
    background: filled ? 'color-mix(in srgb, var(--accent) 8%, var(--surface-2))' : 'transparent',
    color: 'var(--text-muted)',
  } as const;
}
const keybindChipStyle = {
  display: 'grid',
  placeItems: 'center',
  width: 20,
  height: 20,
  flex: '0 0 auto',
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  color: 'var(--text-dim)',
  border: '1px solid var(--border-dim)',
  background: 'var(--surface-sunken)',
} as const;
