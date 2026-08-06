/**
 * Gateway: la puerta de entrada al mundo, con la estética de un MMO clásico (Lineage, MU).
 *
 * No es "una partida": La Brecha Oscura es un mundo persistente y esta pantalla lo enmarca como
 * tal — un portal al que se entra, no un menú de nivel. Por eso el arte ocupa toda la ventana, el
 * formulario vive dentro de un marco ornamentado y el vocabulario habla de *entrar al mundo*.
 *
 * Los `label`, roles y textos de acción se mantienen estables porque son el contrato accesible que
 * verifica App.test.tsx; lo que cambia acá es la presentación, no el flujo de sesión.
 */
import type { FormEvent, ReactNode } from 'react';

import { Icon } from '../components/Icon';

export type GatewayConnection = 'connecting' | 'online' | 'offline' | 'degraded' | 'maintenance';

const CONNECTION_LABEL: Record<GatewayConnection, string> = {
  connecting: 'Conectando con La Brecha Oscura…',
  degraded: 'Conexión degradada',
  maintenance: 'Servidor en mantenimiento',
  offline: 'Sin conexión',
  online: 'En línea',
};

/** Marco compartido: fondo del santuario, viñeta y un panel central con esquinas ornamentadas. */
export function GatewayFrame({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
  return (
    <main className="gateway">
      <div aria-hidden="true" className="gateway-backdrop" />
      <div aria-hidden="true" className="gateway-vignette" />
      <section className="gateway-frame" data-wide={wide ? 'true' : 'false'}>
        <div aria-hidden="true" className="gateway-corner gateway-corner--tl" />
        <div aria-hidden="true" className="gateway-corner gateway-corner--tr" />
        <div aria-hidden="true" className="gateway-corner gateway-corner--bl" />
        <div aria-hidden="true" className="gateway-corner gateway-corner--br" />
        {children}
      </section>
    </main>
  );
}

export function GatewayCrest({ subtitle }: { subtitle: string }) {
  return (
    <header className="gateway-crest">
      <span aria-hidden="true" className="gateway-crest-mark">
        <Icon name="helm" size={44} />
      </span>
      <h1 className="gateway-wordmark">LA BRECHA OSCURA</h1>
      <p className="gateway-tagline">{subtitle}</p>
      <div aria-hidden="true" className="gateway-rule" />
    </header>
  );
}

export function GatewayConnectionStatus({ state }: { state: GatewayConnection }) {
  return (
    <p className="gateway-connection" data-connection-state={state}>
      <span className={`gateway-connection-dot gateway-connection-dot--${state}`} />
      {CONNECTION_LABEL[state]}
    </p>
  );
}

/**
 * Estados de transición del portal (arranque, conexión caída, mantenimiento, estado del servidor).
 * Comparten marco con el login para que la entrada al mundo se lea como una sola pantalla que
 * cambia de mensaje, y no como una sucesión de pantallas de error de otro programa.
 */
export function GatewayMessage({
  connection,
  title,
  body,
  action,
}: {
  connection: GatewayConnection;
  title?: string;
  body?: string;
  action?: Readonly<{ label: string; onClick: () => void }>;
}) {
  return (
    <GatewayFrame>
      <GatewayCrest subtitle="Un mundo que sigue girando aunque no estés" />
      {title === undefined ? null : <h2 className="gateway-heading">{title}</h2>}
      {body === undefined ? null : <p className="gateway-body">{body}</p>}
      {action === undefined ? null : (
        <button className="gateway-submit" onClick={action.onClick} type="button">
          {action.label}
        </button>
      )}
      <GatewayConnectionStatus state={connection} />
    </GatewayFrame>
  );
}

export function Gateway({
  mode,
  connection,
  busy,
  notice,
  email,
  password,
  displayName,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onSubmit,
  onToggleMode,
  onStatus,
}: {
  mode: 'login' | 'register';
  connection: GatewayConnection;
  busy: boolean;
  notice: string | undefined;
  email: string;
  password: string;
  displayName: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleMode: () => void;
  onStatus: () => void;
}) {
  return (
    <GatewayFrame>
      <GatewayCrest subtitle="Un mundo que sigue girando aunque no estés" />
      {/* El encabezado accesible del formulario: la marca de arriba es decorativa. */}
      <h2 className="gateway-heading">Entrá a la brecha</h2>
      <form className="gateway-form" onSubmit={onSubmit}>
        {mode === 'register' ? (
          <label className="gateway-field">
            <span>Nombre visible</span>
            <input
              onChange={(event) => onDisplayNameChange(event.target.value)}
              required
              value={displayName}
            />
          </label>
        ) : null}
        <label className="gateway-field">
          <span>Correo</span>
          <input
            autoComplete="email"
            onChange={(event) => onEmailChange(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>
        <label className="gateway-field">
          <span>Contraseña</span>
          <input
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        <button className="gateway-submit" disabled={busy} type="submit">
          {mode === 'login' ? 'Ingresar' : 'Crear cuenta'}
        </button>
      </form>
      <div className="gateway-links">
        <button className="gateway-link" onClick={onToggleMode} type="button">
          {mode === 'login' ? 'Crear cuenta' : 'Ya tengo cuenta'}
        </button>
        <span aria-hidden="true" className="gateway-link-sep" />
        <button className="gateway-link" onClick={onStatus} type="button">
          Estado del servidor
        </button>
      </div>
      {notice === undefined ? null : (
        <p aria-live="polite" className="gateway-notice">
          {notice}
        </p>
      )}
      <GatewayConnectionStatus state={connection} />
    </GatewayFrame>
  );
}
