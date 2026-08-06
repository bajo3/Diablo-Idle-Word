import type { CSSProperties } from 'react';

/**
 * Iconos de presentacion del kit de La Brecha Oscura.
 *
 * Son SVG inline a proposito: no agregan una dependencia, no dependen de una
 * fuente de iconos y mantienen una caja estable a cualquier densidad de UI.
 * Si `label` no esta presente el icono es decorativo y queda fuera del arbol
 * de accesibilidad; los controles deben aportar su propio nombre visible.
 */
export type IconName =
  | 'sword'
  | 'axe'
  | 'shield'
  | 'helm'
  | 'chest'
  | 'glove'
  | 'boot'
  | 'gem'
  | 'shard'
  | 'ring'
  | 'potion'
  | 'gold'
  | 'leaves'
  | 'town'
  | 'inventory'
  | 'exit'
  | 'home'
  | 'settings'
  | 'chat'
  | 'eye'
  | 'lock'
  | 'bell'
  | 'map'
  | 'target'
  | 'skull'
  | 'heart'
  | 'fury'
  | 'experience'
  | 'user'
  | 'pause'
  | 'play'
  | 'chevron-left'
  | 'chevron-right'
  | 'close'
  | 'check'
  | 'menu'
  | 'sparkles'
  | 'anvil'
  | 'portal'
  | 'notification';

export type IconProps = {
  name: IconName;
  size?: number | string;
  label?: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  strokeWidth?: number;
};

type IconPath = {
  d: string;
  fill?: 'none' | 'currentColor';
  strokeLinecap?: 'butt' | 'round' | 'square';
  strokeLinejoin?: 'miter' | 'round' | 'bevel';
  strokeWidth?: number;
};

const PATHS: Record<IconName, readonly IconPath[]> = {
  sword: [
    { d: 'M14.9 3.1 20.9 3l-.1 6-8.2 8.2' },
    { d: 'm11.6 12.4-8.5 8.5' },
    { d: 'm5.5 15.5 3 3' },
    { d: 'M3.5 20.5 2 22', strokeLinecap: 'round' },
  ],
  axe: [
    { d: 'M12 3v18', strokeLinecap: 'round' },
    { d: 'M12 5c3.5-2 7.4-.9 9 2.7-2.1 2-5 2.9-9 2.3' },
    { d: 'M12 9c-3.5-2-7.4-.9-9 2.7 2.1 2 5 2.9 9 2.3' },
  ],
  shield: [{ d: 'm12 2 7 3v5c0 5.1-3.1 9.6-7 12-3.9-2.4-7-6.9-7-12V5l7-3Z' }],
  helm: [{ d: 'M4 13V9a8 8 0 0 1 16 0v4' }, { d: 'M4 13h16v4H4z' }, { d: 'M12 5v8' }],
  chest: [{ d: 'M4 8h16v12H4z' }, { d: 'M5 8V5h14v3' }, { d: 'M4 12h16' }, { d: 'M12 8v4' }],
  glove: [
    {
      d: 'M7 21a3 3 0 0 1-3-3v-5a1.5 1.5 0 0 1 3 0V8a1.5 1.5 0 0 1 3 0v4V6a1.5 1.5 0 0 1 3 0v6V7a1.5 1.5 0 0 1 3 0v7l1-1a1.5 1.5 0 0 1 2.1 2.1l-3.5 4A4 4 0 0 1 12.6 21H7Z',
    },
  ],
  boot: [{ d: 'M7 3h6v8l3 3h4v5H4v-3l3-2V3Z' }, { d: 'M4 19h16' }],
  gem: [{ d: 'm12 2 8 7-8 13L4 9l8-7Z' }, { d: 'm4 9 16 0' }, { d: 'm8 5 4 4 4-4' }],
  shard: [{ d: 'm8 2 9 2 4 8-9 10-9-5 2-15 3-1Z' }, { d: 'm8 2 4 10 9 0' }],
  ring: [
    { d: 'M12 20a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z' },
    { d: 'M12 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z' },
  ],
  potion: [
    { d: 'M9 3h6M10 3v4l-4 5v5a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-5l-4-5V3' },
    { d: 'M7 13h10' },
  ],
  gold: [
    {
      d: 'm12 2 2.4 6.1 6.6.2-5.1 3.9 1.9 6.3-5.8-3.6-5.8 3.6 1.9-6.3L3 8.3l6.6-.2L12 2Z',
      fill: 'currentColor',
    },
  ],
  leaves: [
    { d: 'M20 4C11 4 5 8 5 14c0 3.3 2.7 6 6 6 6 0 9-7 9-16Z' },
    { d: 'M4 21c3-5 7-8 13-11' },
  ],
  town: [{ d: 'm3 11 9-8 9 8v9H3v-9Z' }, { d: 'M9 20v-6h6v6' }, { d: 'M7 11h.1M12 9h.1M17 11h.1' }],
  inventory: [{ d: 'M4 5h16v15H4z' }, { d: 'M8 5V3h8v2' }, { d: 'M4 10h16' }, { d: 'M9 14h6' }],
  exit: [{ d: 'M10 17l5-5-5-5' }, { d: 'M15 12H3' }, { d: 'M21 3v18H9' }],
  home: [{ d: 'm3 11 9-8 9 8' }, { d: 'M5 10v10h14V10' }, { d: 'M9 20v-6h6v6' }],
  settings: [
    { d: 'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z' },
    {
      d: 'm19.4 15 .1.1 1.4 1.1-2 3.4-1.7-.7-.2.1a7.8 7.8 0 0 1-1.7 1l-.1.2-.2 1.8h-4l-.2-1.8-.2-.1a7.8 7.8 0 0 1-1.7-1l-.2-.1-1.7.7-2-3.4 1.4-1.1.1-.1a8.2 8.2 0 0 1 0-2l-.1-.1-1.4-1.1 2-3.4 1.7.7.2-.1a7.8 7.8 0 0 1 1.7-1l.2-.1.2-1.8h4l.2 1.8.1.1a7.8 7.8 0 0 1 1.7 1l.2.1 1.7-.7 2 3.4-1.4 1.1-.1.1a8.2 8.2 0 0 1 0 2Z',
    },
  ],
  chat: [{ d: 'M4 5h16v11H8l-4 4V5Z' }, { d: 'M8 9h8M8 12h5' }],
  eye: [
    { d: 'M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z' },
    { d: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  ],
  lock: [{ d: 'M6 10h12v10H6z' }, { d: 'M8 10V7a4 4 0 0 1 8 0v3' }],
  bell: [{ d: 'M6 16h12l-1.5-2V9a4.5 4.5 0 0 0-9 0v5L6 16Z' }, { d: 'M10 19h4' }],
  map: [{ d: 'm3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Z' }, { d: 'M9 3v16M15 5v16' }],
  target: [
    { d: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z' },
    { d: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z' },
    { d: 'M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z', fill: 'currentColor' },
  ],
  skull: [
    { d: 'M12 3a7 7 0 0 0-7 7c0 2.8 1.2 4.2 3 5.5V19h8v-3.5c1.8-1.3 3-2.7 3-5.5a7 7 0 0 0-7-7Z' },
    { d: 'M9 10h.1M15 10h.1M10 15h4v2h-4z' },
  ],
  heart: [
    {
      d: 'M20.8 8.7c0 5.2-8.8 10.1-8.8 10.1S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.3a4.7 4.7 0 0 1 8.8 2.4Z',
    },
  ],
  fury: [{ d: 'm13 2-9 11h7l-1 9 9-12h-7l1-8Z', fill: 'currentColor' }],
  experience: [{ d: 'M12 2 15 8l6 .9-4.4 4.4 1 6.2-5.6-3-5.6 3 1-6.2L3 8.9 9 8l3-6Z' }],
  user: [{ d: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z' }, { d: 'M4 21a8 8 0 0 1 16 0' }],
  pause: [{ d: 'M8 5v14M16 5v14', strokeWidth: 3 }],
  play: [{ d: 'm8 5 11 7-11 7V5Z', fill: 'currentColor' }],
  'chevron-left': [{ d: 'm15 5-7 7 7 7' }],
  'chevron-right': [{ d: 'm9 5 7 7-7 7' }],
  close: [{ d: 'm5 5 14 14M19 5 5 19', strokeLinecap: 'round' }],
  check: [{ d: 'm5 12 4 4L19 6', strokeLinecap: 'round' }],
  menu: [{ d: 'M4 7h16M4 12h16M4 17h16', strokeLinecap: 'round' }],
  sparkles: [
    { d: 'm12 2 1.2 6.8L20 10l-6.8 1.2L12 18l-1.2-6.8L4 10l6.8-1.2L12 2Z' },
    { d: 'm19 16 .6 2.4L22 19l-2.4.6L19 22l-.6-2.4L16 19l2.4-.6L19 16Z' },
  ],
  anvil: [{ d: 'M5 20h14M7 16h10M9 16v-4h6v4M4 12h16M6 8h12l-2-4H8L6 8Z' }],
  portal: [{ d: 'M5 20V9a7 7 0 0 1 14 0v11' }, { d: 'M9 20v-6h6v6' }, { d: 'M12 4v4M9 6h6' }],
  notification: [{ d: 'M4 18h16l-2-3V9a6 6 0 0 0-12 0v6l-2 3Z' }, { d: 'M10 21h4' }],
};

export function Icon({
  name,
  size = 24,
  label,
  title,
  className,
  style,
  strokeWidth = 1.7,
}: IconProps) {
  const labelled = label !== undefined;
  return (
    <svg
      aria-hidden={labelled ? undefined : true}
      aria-label={labelled ? label : undefined}
      className={className}
      focusable="false"
      height={size}
      role={labelled ? 'img' : undefined}
      style={{ display: 'inline-block', flex: '0 0 auto', verticalAlign: 'middle', ...style }}
      viewBox="0 0 24 24"
      width={size}
      xmlns="http://www.w3.org/2000/svg"
    >
      {title ? <title>{title}</title> : null}
      {PATHS[name].map((path, index) => (
        <path
          d={path.d}
          fill={path.fill ?? 'none'}
          key={`${name}-${index}`}
          stroke="currentColor"
          strokeLinecap={path.strokeLinecap ?? 'round'}
          strokeLinejoin={path.strokeLinejoin ?? 'round'}
          strokeWidth={path.strokeWidth ?? strokeWidth}
        />
      ))}
    </svg>
  );
}
