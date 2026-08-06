import { type ReactNode, useState } from 'react';
import { characterClassDisplayName } from '@brecha/shared';

import { guardianCombatTuning } from './combat-controller';
import { POTION } from './presentation';
import type { GameHudSnapshot, GameRuntime } from './runtime';
import type { ProgressionSnapshot } from '../api';
import { Icon, type IconName } from '../components/Icon';
import {
  UI_BUFFS,
  UI_CHAT,
  UI_LOOT_LOG,
  UI_NOTIFICATIONS,
  UI_RESOURCES,
  type UiPartyMember,
  type UiResource,
  type UiTone,
} from '../data/uiPresentation';

type AbilityKey = 'slash' | 'powerStrike' | 'whirlwind' | 'ironSkin';
type CompactPanel = 'bonuses' | 'party' | 'chat' | 'notifications';

type GameHudOverlayProps = {
  hud: GameHudSnapshot;
  progression?: ProgressionSnapshot;
  /** Server-owned currencies. When absent (anonymous preview) the reference fixtures stand in. */
  resources?: readonly UiResource[];
  partyMembers?: readonly UiPartyMember[];
  stage: ReactNode;
  runtime: GameRuntime | undefined;
  showDamageNumbers: boolean;
  onShowDamageNumbersChange: (value: boolean) => void;
  autoBattle: boolean;
  onAutoBattleChange: (value: boolean) => void;
  onPause?: () => void;
  onResume?: () => void;
  onCheckpoint: () => void;
  checkpointPending: boolean;
  checkpointError?: string | undefined;
  onOpenInventory?: (() => void) | undefined;
  onOpenResults?: (() => void) | undefined;
  onOpenCharacter?: (() => void) | undefined;
  onOpenTown?: (() => void) | undefined;
  onExit?: (() => void) | undefined;
};

const ABILITY_SLOTS: readonly {
  key: AbilityKey;
  abilityId: string;
  name: string;
  icon: IconName;
  bind: string;
  cooldownMs: number;
  tone: UiTone;
}[] = [
  {
    key: 'ironSkin',
    abilityId: 'ability.guardian.iron_skin',
    name: 'Piel de hierro',
    icon: 'shield',
    bind: 'E',
    cooldownMs: guardianCombatTuning.abilities.ironSkin.cooldownMs,
    tone: 'accent',
  },
  {
    key: 'powerStrike',
    abilityId: 'ability.guardian.power_strike',
    name: 'Golpe poderoso',
    icon: 'sparkles',
    bind: 'RMB',
    cooldownMs: guardianCombatTuning.abilities.powerStrike.cooldownMs,
    tone: 'blue',
  },
  {
    key: 'slash',
    abilityId: 'ability.guardian.slash',
    name: 'Tajo',
    icon: 'sword',
    bind: 'LMB',
    cooldownMs: guardianCombatTuning.abilities.slash.cooldownMs,
    tone: 'danger',
  },
  {
    key: 'whirlwind',
    abilityId: 'ability.guardian.whirlwind',
    name: 'Torbellino',
    icon: 'fury',
    bind: 'Q',
    cooldownMs: guardianCombatTuning.abilities.whirlwind.cooldownMs,
    tone: 'corruption',
  },
];

export function GameHudOverlay({
  hud,
  progression,
  resources,
  partyMembers,
  stage,
  runtime,
  showDamageNumbers,
  onShowDamageNumbersChange,
  autoBattle,
  onAutoBattleChange,
  onOpenInventory,
  onOpenResults,
  onOpenCharacter,
  onOpenTown,
  onExit,
}: GameHudOverlayProps) {
  const [chatTab, setChatTab] = useState<'chat' | 'system'>('chat');
  const [compactPanel, setCompactPanel] = useState<CompactPanel>('bonuses');
  const [draft, setDraft] = useState('');
  const healthPct = percentage(hud.health, hud.maxHealth);
  const furyPct = percentage(hud.fury, hud.maxFury);
  const connectionTone: UiTone =
    hud.connection === 'online' ? 'accent' : hud.connection === 'offline' ? 'danger' : 'gold';
  const connectionLabel = {
    online: 'EN LÍNEA',
    degraded: 'CONEXIÓN DÉBIL',
    offline: 'SIN CONEXIÓN',
    maintenance: 'MANTENIMIENTO',
  }[hud.connection];
  // Keep the reference UI populated before the first event, then replace fixtures with bounded
  // event-driven feedback as soon as local combat or the server produces a result.
  const lootLog = hud.lootLog.length > 0 ? hud.lootLog : UI_LOOT_LOG;
  const notifications = hud.notifications.length > 0 ? hud.notifications : UI_NOTIFICATIONS;
  const chatLines =
    chatTab === 'chat' ? UI_CHAT : UI_CHAT.filter((line) => line.author === '[Sistema]');
  const activeAbilitySlots =
    progression === undefined
      ? ABILITY_SLOTS
      : progression.skills
          .filter((skill) => skill.equipped && skill.unlocked)
          .sort((a, b) => (a.barSlot ?? 0) - (b.barSlot ?? 0))
          .map((skill) => ABILITY_SLOTS.find((slot) => slot.abilityId === skill.abilityId))
          .filter((slot): slot is (typeof ABILITY_SLOTS)[number] => slot !== undefined);

  return (
    <section
      aria-label="Mundo"
      className="game-shell"
      data-compact-panel={compactPanel}
      data-enemies-alive={hud.enemiesAlive}
      data-camera-zoom={hud.cameraZoom.toFixed(6)}
      data-forest-level={hud.forestLevel}
      data-forest-wave-index={hud.forestWaveIndex}
      data-forest-wave-size={hud.forestWaveSize}
      data-guardian-state={hud.downed ? 'downed' : 'active'}
    >
      <header className="gs-topbar">
        <div className="gs-brand">
          <span className="gs-brand-mark" aria-hidden="true">
            <Icon name="helm" size={30} />
          </span>
          <div className="gs-brand-text">
            <span className="gs-brand-name">LA BRECHA OSCURA</span>
            <span className="gs-brand-sub">RPG IDLE</span>
          </div>
        </div>
        <div className="gs-resources" aria-label="Recursos de cuenta">
          {(resources ?? UI_RESOURCES).map((resource) => (
            <span
              className={`gs-res gs-tone-${resource.tone}`}
              key={resource.id}
              title={resource.label}
            >
              <Icon name={resource.icon} size={17} />
              <span className="gs-res-val">{resource.value}</span>
            </span>
          ))}
        </div>
        <nav aria-label="Navegación del mundo" className="gs-nav">
          <NavTile icon="menu" label="MENÚ" onClick={onExit} />
          <NavTile icon="town" label="PUEBLO" onClick={onOpenTown} />
          <NavTile icon="user" label="PERSONAJE" onClick={onOpenCharacter} />
          <NavTile icon="inventory" label="INVENTARIO" onClick={onOpenInventory} />
          <NavTile icon="notification" label="RESULTADOS" onClick={onOpenResults} />
          <NavTile icon="eye" label="HUD" />
        </nav>
      </header>

      <div className="gs-vitals">
        <div className="gs-vitals-id">
          <span className="gs-avatar" aria-hidden="true">
            <Icon name="shield" size={28} />
          </span>
          <div className="gs-vitals-name">
            <span className="gs-char-name">
              {progression ? characterClassDisplayName(progression.class) : 'Guardián'}
            </span>
            <span className="gs-char-sub">Nv. {progression?.level ?? 1} · Bosque Corrupto</span>
          </div>
        </div>
        <VitalBar kind="hp" label="VIDA" value={hud.health} max={hud.maxHealth} pct={healthPct} />
        <VitalBar kind="fury" label="FURIA" value={hud.fury} max={hud.maxFury} pct={furyPct} />
        {progression ? (
          <div
            aria-label="Experiencia del personaje"
            aria-valuemax={progression.xpToNextLevel}
            aria-valuemin={0}
            aria-valuenow={progression.xpInLevel}
            className="gs-character-xp"
            role="progressbar"
          >
            <span className="gs-character-xp-label">NIVEL {progression.level}</span>
            <div className="gs-character-xp-track">
              <span
                style={{
                  width: `${percentage(progression.xpInLevel, progression.xpToNextLevel)}%`,
                }}
              />
            </div>
            <small>
              {progression.xpInLevel.toLocaleString('es-AR')} /{' '}
              {progression.xpToNextLevel > 0
                ? progression.xpToNextLevel.toLocaleString('es-AR')
                : 'MAX'}{' '}
              EXP
            </small>
          </div>
        ) : null}
        <div aria-label="Experiencia ganada en esta sesión" className="gs-session-xp">
          <span>EXP SESIÓN</span>
          <strong>+{hud.experienceEarned.toLocaleString('es-AR')}</strong>
        </div>
      </div>

      <div className="gs-stage">
        {stage}
        <div className="gs-overlay">
          <nav aria-label="Paneles compactos del HUD" className="gs-compact-panel-nav">
            {partyMembers !== undefined && partyMembers.length > 0 ? (
              <button
                aria-pressed={compactPanel === 'party'}
                onClick={() => setCompactPanel('party')}
                type="button"
              >
                PARTY
              </button>
            ) : null}
            {(
              [
                ['chat', 'CHAT'],
                ['bonuses', 'BUFFS'],
                ['notifications', 'AVISOS'],
              ] as const
            ).map(([panel, label]) => (
              <button
                aria-pressed={compactPanel === panel}
                key={panel}
                onClick={() => setCompactPanel(panel)}
                type="button"
              >
                {label}
              </button>
            ))}
          </nav>
          <div className="gs-zone-chip">
            <Icon name="map" size={14} /> BOSQUE CORRUPTO · NIVEL {hud.forestLevel} · OLEADA{' '}
            {hud.forestWaveIndex + 1}
          </div>

          {hud.downed ? (
            <div aria-live="assertive" className="gs-downed-banner" role="status">
              <strong>HAS CAÍDO</strong>
              <span>Esperá una reanimación o regresá al pueblo a recuperarte.</span>
              {onOpenTown === undefined ? null : (
                <button className="gs-downed-town" onClick={onOpenTown} type="button">
                  <Icon name="town" size={18} />
                  VOLVER AL PUEBLO
                </button>
              )}
            </div>
          ) : null}

          <aside aria-label="Bonificaciones activas" className="gs-bonuses gs-panel-float">
            <div className="gs-panel-heading">BONIFICACIONES ACTIVAS</div>
            {UI_BUFFS.map((buff) => (
              <div className="gs-bonus" key={buff.id}>
                <Icon className={`gs-tone-${buff.tone}`} name={buff.icon} size={17} />
                <span>{buff.label}</span>
                <time>{buff.remaining}</time>
              </div>
            ))}
          </aside>

          {partyMembers !== undefined && partyMembers.length > 0 ? (
            <aside aria-label="Party" className="gs-party gs-panel-float">
              <div className="gs-panel-heading">PARTY</div>
              {partyMembers.map((member) => (
                <div className="gs-party-member" key={member.id}>
                  <span className={`gs-party-icon gs-tone-${member.tone}`}>
                    <Icon name={member.icon} size={26} />
                  </span>
                  <div className="gs-party-body">
                    <div className="gs-party-name">
                      <strong>{member.name}</strong>
                      <span>Nv. {member.level}</span>
                    </div>
                    <ProgressBar
                      className="gs-party-health"
                      label={`${member.health} / ${member.maxHealth}`}
                      value={member.health}
                      max={member.maxHealth}
                    />
                    <ProgressBar
                      className="gs-party-resource"
                      label={`${member.resource} / ${member.maxResource}`}
                      value={member.resource}
                      max={member.maxResource}
                    />
                  </div>
                </div>
              ))}
            </aside>
          ) : null}

          <div className="gs-loot-log" aria-live="polite">
            {lootLog.map((entry) => (
              <span className={`gs-tone-${entry.tone}`} key={entry.id}>
                {entry.label}
              </span>
            ))}
          </div>

          <aside aria-label="Chat" className="gs-chat gs-panel-float">
            <div className="gs-chat-tabs">
              <button
                aria-selected={chatTab === 'chat'}
                onClick={() => setChatTab('chat')}
                type="button"
              >
                CHAT
              </button>
              <button
                aria-selected={chatTab === 'system'}
                onClick={() => setChatTab('system')}
                type="button"
              >
                SISTEMA
              </button>
            </div>
            <div className="gs-chat-lines">
              {chatLines.map((line) => (
                <p className={`gs-tone-${line.tone}`} key={line.id}>
                  <strong>{line.author}</strong> {line.text}
                </p>
              ))}
            </div>
            <form
              className="gs-chat-compose"
              onSubmit={(event) => {
                event.preventDefault();
                setDraft('');
              }}
            >
              <input
                aria-label="Escribir un mensaje"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Escribe un mensaje…"
                value={draft}
              />
              <button aria-label="Enviar mensaje" type="submit">
                <Icon name="chevron-right" size={18} />
              </button>
            </form>
          </aside>

          <aside aria-label="Notificaciones" className="gs-notifications gs-panel-float">
            <div className="gs-panel-heading">NOTIFICACIONES</div>
            {notifications.map((notification) => (
              <div className={`gs-notification gs-tone-${notification.tone}`} key={notification.id}>
                <Icon name={notification.icon} size={20} />
                <div>
                  <strong>{notification.title}</strong>
                  <small>{notification.detail}</small>
                </div>
              </div>
            ))}
          </aside>

          <div className="gs-skill-dock" aria-label="Habilidades y cooldowns">
            {activeAbilitySlots.map((slot) => {
              const remaining = hud.cooldownRemainingMs[slot.key];
              const fraction = cooldownFraction(remaining, slot.cooldownMs);
              const active = slot.key === 'ironSkin' && hud.ironSkinActive;
              return (
                <button
                  aria-label={`${slot.name} (${slot.bind})`}
                  className={`gs-skill gs-tone-${slot.tone}`}
                  data-active={active ? 'true' : 'false'}
                  data-downed={hud.downed ? 'true' : 'false'}
                  data-on-cooldown={remaining > 0 ? 'true' : 'false'}
                  disabled={hud.downed}
                  key={slot.key}
                  onClick={() => runtime?.activate?.(slot.key)}
                  title={`${slot.name} (${slot.bind})`}
                  type="button"
                >
                  <Icon name={slot.icon} size={30} />
                  {remaining > 0 ? (
                    <span className="gs-skill-sweep" style={{ height: `${fraction * 100}%` }} />
                  ) : null}
                  {remaining > 0 ? (
                    <span className="gs-skill-cd">{formatCooldown(remaining)}</span>
                  ) : null}
                  <span className="gs-skill-name">{slot.name}</span>
                  <span className="gs-skill-key">{slot.bind}</span>
                </button>
              );
            })}
            <button
              aria-label="Combate automático"
              aria-pressed={autoBattle}
              className="gs-skill gs-auto"
              data-on={autoBattle ? 'true' : 'false'}
              data-downed={hud.downed ? 'true' : 'false'}
              disabled={hud.downed}
              onClick={() => onAutoBattleChange(!autoBattle)}
              title="Combate automático"
              type="button"
            >
              <Icon name="sparkles" size={28} />
              <span className="gs-skill-name">AUTO</span>
              <span className="gs-skill-key">A</span>
            </button>
            <button
              aria-label={`Poción de vida (X) · ${hud.potionCharges} restantes`}
              className="gs-skill gs-potion"
              data-downed={hud.downed ? 'true' : 'false'}
              data-on-cooldown={hud.potionCooldownRemainingMs > 0 ? 'true' : 'false'}
              disabled={hud.downed || hud.potionCharges === 0}
              onClick={() => runtime?.drinkPotion?.()}
              title="Poción de vida (X)"
              type="button"
            >
              <Icon name="potion" size={28} />
              {hud.potionCooldownRemainingMs > 0 ? (
                <span
                  className="gs-skill-sweep"
                  style={{
                    height: `${cooldownFraction(hud.potionCooldownRemainingMs, POTION.cooldownMs) * 100}%`,
                  }}
                />
              ) : null}
              {hud.potionCooldownRemainingMs > 0 ? (
                <span className="gs-skill-cd">{formatCooldown(hud.potionCooldownRemainingMs)}</span>
              ) : null}
              <span className="gs-skill-quantity">×{hud.potionCharges}</span>
              <span className="gs-skill-key">X</span>
            </button>
          </div>

          <div className={`gs-conn gs-tone-${connectionTone}`}>
            <span className="gs-conn-dot" />
            <span className="gs-conn-label">{connectionLabel}</span>
            <span className="gs-conn-ping">34 ms</span>
          </div>

          <div className="gs-controls">
            <label className="gs-toggle">
              <input
                aria-label="Mostrar números de daño"
                checked={showDamageNumbers}
                onChange={(event) => onShowDamageNumbersChange(event.target.checked)}
                type="checkbox"
              />
              Daño
            </label>
          </div>

          {hud.paused ? <div className="gs-pause-veil">EN PAUSA</div> : null}
        </div>
      </div>
    </section>
  );
}

function NavTile({
  icon,
  label,
  onClick,
}: {
  icon: IconName;
  label: string;
  onClick?: (() => void) | undefined;
}) {
  return (
    <button className="gs-nav-tile" onClick={onClick} title={label} type="button">
      <Icon name={icon} size={20} />
      <span className="gs-nav-label">{label}</span>
    </button>
  );
}

function VitalBar({
  kind,
  label,
  value,
  max,
  pct,
}: {
  kind: 'hp' | 'fury';
  label: string;
  value: number;
  max: number;
  pct: number;
}) {
  return (
    <div className="gs-vital" data-kind={kind}>
      <span className="gs-vital-label">{label}</span>
      <div className="gs-vital-bar">
        <div className="gs-vital-fill" style={{ width: `${pct}%` }} />
        <span className="gs-vital-text">
          {value} / {max}
        </span>
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  max,
  label,
  className,
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
}) {
  return (
    <div aria-label={label} className={`gs-progress ${className ?? ''}`}>
      <span style={{ width: `${percentage(value, max)}%` }} />
      <small>{label}</small>
    </div>
  );
}

function percentage(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(100, (value / max) * 100));
}

function cooldownFraction(remainingMs: number, totalMs: number): number {
  if (totalMs <= 0) return 0;
  return Math.max(0, Math.min(1, remainingMs / totalMs));
}

function formatCooldown(ms: number): string {
  const seconds = ms / 1000;
  return seconds < 10 ? `${seconds.toFixed(1)}s` : `${Math.ceil(seconds)}s`;
}
