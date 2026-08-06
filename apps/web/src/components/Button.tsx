/**
 * Button reutilizable con variantes del sistema de diseño.
 * Botón base: React nativo, sin libs externas.
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const VARIANT: Record<ButtonVariant, { background: string; border: string; color: string }> = {
  primary: {
    background: 'var(--accent)',
    border: 'var(--accent-bright)',
    color: 'var(--surface-0)',
  },
  secondary: { background: 'var(--surface-2)', border: 'var(--border)', color: 'var(--text)' },
  danger: {
    background: 'var(--surface-2)',
    border: 'var(--danger)',
    color: 'var(--danger-bright)',
  },
  ghost: { background: 'transparent', border: 'transparent', color: 'var(--text-muted)' },
};

const SIZE: Record<ButtonSize, CSSProperties> = {
  sm: { minHeight: 36, padding: '7px 12px', fontSize: 'var(--fs-small, var(--fs-body))' },
  md: { minHeight: 44, padding: '10px 16px', fontSize: 'var(--fs-body)' },
  lg: { minHeight: 52, padding: '12px 20px', fontSize: 'var(--fs-heading, var(--fs-body))' },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  className,
  icon,
  iconPosition = 'start',
  style,
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconPosition?: 'start' | 'end';
  children: ReactNode;
}) {
  const v = VARIANT[variant];
  return (
    <button
      {...props}
      className={['ui-button', `ui-button--${variant}`, `ui-button--${size}`, className]
        .filter(Boolean)
        .join(' ')}
      data-size={size}
      data-variant={variant}
      style={{
        alignItems: 'center',
        display: 'inline-flex',
        gap: 8,
        justifyContent: 'center',
        fontFamily: 'var(--font-body)',
        fontSize: 'var(--fs-body)',
        fontWeight: 600,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        cursor: props.disabled ? 'not-allowed' : 'pointer',
        opacity: props.disabled ? 0.55 : 1,
        borderRadius: 'var(--radius-sm)',
        background: v.background,
        border: `1px solid ${v.border}`,
        color: v.color,
        ...SIZE[size],
        ...style,
      }}
      type={type}
    >
      {icon && iconPosition === 'start' ? <span aria-hidden="true">{icon}</span> : null}
      <span>{children}</span>
      {icon && iconPosition === 'end' ? <span aria-hidden="true">{icon}</span> : null}
    </button>
  );
}
