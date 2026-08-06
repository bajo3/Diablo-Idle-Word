import { useEffect, useState } from 'react';

import { Button } from '../components/Button';
import { Icon } from '../components/Icon';
import {
  publishGameSettings,
  readGameSettings,
  sanitizeGameSettings,
  type GameSettings,
} from '../settings';

export function Settings({ onBack }: { onBack: () => void }) {
  const [settings, setSettings] = useState<GameSettings>(() => readGameSettings());
  useEffect(() => {
    publishGameSettings(settings);
  }, [settings]);
  const toggle = (key: 'sound' | 'music' | 'reducedMotion') =>
    setSettings((current) => sanitizeGameSettings({ ...current, [key]: !current[key] }));
  const setVolume = (
    key: 'masterVolume' | 'musicVolume' | 'ambienceVolume' | 'sfxVolume' | 'uiVolume',
    value: number,
  ) => setSettings((current) => sanitizeGameSettings({ ...current, [key]: value }));
  return (
    <main className="ui-settings-screen" style={screenStyle}>
      <header style={headerStyle}>
        <div>
          <span className="eyebrow">PUEBLO · AJUSTES</span>
          <h1 style={titleStyle}>Configuración</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Preferencias locales del navegador.
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          Volver al pueblo
        </Button>
      </header>
      <section style={panelStyle} aria-label="Preferencias">
        <SettingRow
          label="Efectos de sonido"
          icon="sparkles"
          value={settings.sound}
          onToggle={() => toggle('sound')}
        />
        <SettingRow
          label="Música"
          icon="ring"
          value={settings.music}
          onToggle={() => toggle('music')}
        />
        <SettingRow
          label="Reducir movimiento"
          icon="shield"
          value={settings.reducedMotion}
          onToggle={() => toggle('reducedMotion')}
        />
        <VolumeRow
          label="Volumen general"
          value={settings.masterVolume}
          onChange={(value) => setVolume('masterVolume', value)}
        />
        <VolumeRow
          label="Música"
          value={settings.musicVolume}
          onChange={(value) => setVolume('musicVolume', value)}
        />
        <VolumeRow
          label="Efectos"
          value={settings.sfxVolume}
          onChange={(value) => setVolume('sfxVolume', value)}
        />
        <VolumeRow
          label="Ambiente"
          value={settings.ambienceVolume}
          onChange={(value) => setVolume('ambienceVolume', value)}
        />
        <VolumeRow
          label="Interfaz"
          value={settings.uiVolume}
          onChange={(value) => setVolume('uiVolume', value)}
        />
      </section>
    </main>
  );
}

function VolumeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label style={rowStyle}>
      <span style={{ flex: 1 }}>{label}</span>
      <input
        aria-label={label}
        max={1}
        min={0}
        onChange={(event) => onChange(Number(event.target.value))}
        step={0.05}
        style={{ accentColor: 'var(--accent)', width: 180 }}
        type="range"
        value={value}
      />
      <output style={{ minWidth: 42, textAlign: 'right' }}>{Math.round(value * 100)}%</output>
    </label>
  );
}

function SettingRow({
  label,
  icon,
  value,
  onToggle,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]['name'];
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={rowStyle}>
      <Icon name={icon} size={22} style={{ color: 'var(--accent)' }} />
      <span style={{ flex: 1 }}>{label}</span>
      <Button
        size="sm"
        variant={value ? 'primary' : 'ghost'}
        aria-pressed={value}
        onClick={onToggle}
      >
        {value ? 'Activado' : 'Desactivado'}
      </Button>
    </div>
  );
}
const screenStyle = {
  minHeight: '100vh',
  padding: '24px clamp(16px, 4vw, 48px)',
  background: 'var(--surface-0)',
  color: 'var(--text)',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
} as const;
const headerStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 16,
} as const;
const titleStyle = {
  margin: '6px 0',
  fontFamily: 'var(--font-display)',
  color: 'var(--text-strong)',
  letterSpacing: '0.04em',
} as const;
const panelStyle = {
  maxWidth: 720,
  display: 'grid',
  gap: 8,
  padding: 16,
  background: 'var(--surface-1)',
  border: '1px solid var(--border-dim)',
} as const;
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  background: 'var(--surface-2)',
  border: '1px solid var(--border-dim)',
} as const;
