/**
 * Glyph: icono CSS puro (sin assets) basado en clip-path.
 * Transcripción del kit de UI "La Brecha Oscura" (antes sc-glyph).
 * Mantiene el mismo catálogo de formas (sword, axe, shield, helm, chest, ...).
 */
import type { CSSProperties } from 'react';

export type GlyphKind =
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
  | 'potion';

const CLIP: Record<GlyphKind, string> = {
  sword:
    'polygon(50% 0,60% 14%,60% 66%,78% 72%,60% 78%,56% 100%,44% 100%,40% 78%,22% 72%,40% 66%,40% 14%)',
  axe: 'polygon(46% 0,54% 0,54% 22%,86% 30%,92% 60%,54% 62%,54% 100%,46% 100%,46% 62%,8% 60%,14% 30%,46% 22%)',
  shield: 'polygon(50% 0,100% 16%,100% 58%,50% 100%,0 58%,0 16%)',
  helm: 'polygon(20% 8%,80% 8%,92% 46%,84% 92%,58% 92%,58% 62%,42% 62%,42% 92%,16% 92%,8% 46%)',
  chest: 'polygon(24% 4%,76% 4%,96% 22%,86% 40%,88% 96%,12% 96%,14% 40%,4% 22%)',
  glove: 'polygon(18% 26%,42% 6%,58% 6%,82% 26%,82% 78%,60% 96%,40% 96%,18% 78%)',
  boot: 'polygon(28% 4%,62% 4%,64% 62%,96% 78%,96% 96%,20% 96%,20% 40%)',
  gem: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
  shard: 'polygon(20% 0,80% 10%,100% 60%,55% 100%,10% 70%)',
  ring: '',
  potion: '',
};

export function glyphStyle(kind: GlyphKind, color: string): CSSProperties {
  if (kind === 'ring') {
    return { borderRadius: '50%', background: 'transparent', border: `5px solid ${color}` };
  }
  if (kind === 'potion') {
    return { borderRadius: '6px 6px 10px 10px', background: color };
  }
  return { background: color, clipPath: CLIP[kind] };
}

export function Glyph({
  kind,
  color,
  size = 28,
  style,
}: {
  kind: GlyphKind;
  color: string;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        ...glyphStyle(kind, color),
        ...style,
      }}
    />
  );
}
