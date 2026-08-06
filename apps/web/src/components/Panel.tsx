/**
 * Panel: contenedor "marco ornamentado" reutilizable del kit de UI.
 * Mismo marco para inventario, personaje, habilidades, lobby, etc.
 */
import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export type PanelVariant = 'default' | 'sunken' | 'floating' | 'ornate';

export function Panel({
  title,
  eyebrow,
  children,
  style,
  actions,
  className,
  variant = 'default',
  ariaLabel,
}: {
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  style?: CSSProperties;
  actions?: ReactNode;
  className?: string;
  variant?: PanelVariant;
  ariaLabel?: string;
}) {
  const headingId = useId();
  return (
    <section
      aria-label={ariaLabel}
      aria-labelledby={title ? headingId : undefined}
      className={['ui-panel', `ui-panel--${variant}`, className].filter(Boolean).join(' ')}
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        ...style,
      }}
    >
      {(title || eyebrow || actions) && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {eyebrow && (
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--fs-caption)',
                  letterSpacing: '0.18em',
                  color: 'var(--text-dim)',
                  textTransform: 'uppercase',
                }}
              >
                {eyebrow}
              </span>
            )}
            {title && (
              <h2
                id={headingId}
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-display)',
                  fontSize: 'var(--fs-h2)',
                  color: 'var(--text-strong)',
                  letterSpacing: '0.04em',
                }}
              >
                {title}
              </h2>
            )}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
