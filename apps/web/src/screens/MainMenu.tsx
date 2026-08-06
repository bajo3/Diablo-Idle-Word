/**
 * MainMenu: menú de inicio con logo, botones y estado del servidor.
 * Pantalla del kit de UI "La Brecha Oscura".
 */
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

export function MainMenu({
  onPlay,
  onContinue,
  onSettings,
  onCredits,
  onStatus,
  hasSession,
  serverStatus,
  notice,
}: {
  onPlay: () => void;
  onContinue?: (() => void) | undefined;
  onSettings?: (() => void) | undefined;
  onCredits?: (() => void) | undefined;
  onStatus: () => void;
  hasSession: boolean;
  serverStatus?: string | undefined;
  notice?: string | undefined;
}) {
  return (
    <main
      className="ui-main-menu"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        background:
          'radial-gradient(circle at 50% 18%, color-mix(in srgb, var(--ambient-moss) 40%, transparent), transparent 36rem), var(--surface-0)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Silueta de brecha / corrupción al fondo */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '38%',
          left: '50%',
          width: '320px',
          height: '60vh',
          transform: 'translateX(-50%)',
          background:
            'linear-gradient(to bottom, transparent, color-mix(in srgb, var(--corruption) 28%, transparent) 40%, transparent)',
          filter: 'blur(8px)',
          animation: 'lbo-rift 7s ease-in-out infinite',
        }}
      />
      <style>{`@keyframes lbo-rift{0%,100%{opacity:.5;transform:translateX(-50%) scaleY(1)}50%{opacity:.85;transform:translateX(-50%) scaleY(1.06)}}`}</style>

      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          zIndex: 1,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 86,
            height: 86,
            color: 'var(--accent)',
            border: '1px solid var(--border)',
            background: 'radial-gradient(circle, var(--surface-3), var(--surface-sunken))',
            boxShadow:
              '0 0 0 4px color-mix(in srgb, var(--accent) 10%, transparent), 0 18px 42px rgb(0 0 0 / 45%)',
          }}
        >
          <Icon name="helm" size={56} />
        </div>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-caption)',
            letterSpacing: '0.3em',
            color: 'var(--text-dim)',
            textTransform: 'uppercase',
          }}
        >
          ARPG · Fantasía oscura
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(2.5rem, 6vw, 4.2rem)',
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-strong)',
            textAlign: 'center',
          }}
        >
          LA BRECHA OSCURA
        </h1>
        <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: 'var(--fs-body)' }}>
          El bosque crece sobre lo que el guardián ya no protege.
        </p>
      </header>

      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          width: 'min(320px, 80vw)',
          zIndex: 1,
        }}
      >
        <Button
          icon={<Icon name={hasSession ? 'play' : 'portal'} size={18} />}
          variant="primary"
          onClick={onPlay}
          style={{ padding: '14px 18px', fontSize: '15px' }}
        >
          {hasSession ? 'Continuar' : 'Jugar'}
        </Button>
        {hasSession && onContinue && (
          <Button icon={<Icon name="play" size={16} />} variant="secondary" onClick={onContinue}>
            Entrar a partida
          </Button>
        )}
        {onSettings && (
          <Button icon={<Icon name="settings" size={16} />} variant="ghost" onClick={onSettings}>
            Ajustes
          </Button>
        )}
        {onCredits && (
          <Button icon={<Icon name="sparkles" size={16} />} variant="ghost" onClick={onCredits}>
            Créditos
          </Button>
        )}
      </nav>

      {notice ? (
        <p aria-live="polite" style={{ color: 'var(--text-muted)', margin: 0, zIndex: 1 }}>
          {notice}
        </p>
      ) : null}

      <footer style={{ display: 'flex', alignItems: 'center', gap: 10, zIndex: 1 }}>
        <span
          aria-hidden="true"
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent)',
            animation: 'lbo-pulse 2.4s ease-in-out infinite',
          }}
        />
        <button
          onClick={onStatus}
          type="button"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--fs-caption)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          {serverStatus ?? 'Estado del servidor'}
        </button>
        <style>{`@keyframes lbo-pulse{0%,100%{opacity:.35}50%{opacity:1}}`}</style>
      </footer>
    </main>
  );
}
