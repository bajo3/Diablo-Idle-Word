export type CombatVfxKind =
  | 'slash'
  | 'power_strike'
  | 'whirlwind'
  | 'impact'
  | 'critical'
  | 'heal'
  | 'buff'
  | 'debuff'
  | 'explosion'
  | 'danger'
  | 'death';

export type CombatVfxDescriptor = Readonly<{
  kind: CombatVfxKind;
  color: number;
  radius: number;
  scale: number;
  durationMs: number;
  depth: number;
  strokeWidth: number;
}>;

const DESCRIPTORS: Readonly<Record<CombatVfxKind, CombatVfxDescriptor>> = Object.freeze({
  slash: {
    kind: 'slash',
    color: 0xa9c09f,
    radius: 26,
    scale: 1.4,
    durationMs: 160,
    depth: 1,
    strokeWidth: 3,
  },
  power_strike: {
    kind: 'power_strike',
    color: 0xe0bf52,
    radius: 18,
    scale: 3,
    durationMs: 280,
    depth: 1,
    strokeWidth: 0,
  },
  whirlwind: {
    kind: 'whirlwind',
    color: 0x8a3ffc,
    radius: 40,
    scale: 1.2,
    durationMs: 420,
    depth: 1,
    strokeWidth: 3,
  },
  impact: {
    kind: 'impact',
    color: 0xd5f1dc,
    radius: 12,
    scale: 1.6,
    durationMs: 180,
    depth: 2,
    strokeWidth: 0,
  },
  critical: {
    kind: 'critical',
    color: 0xffd14a,
    radius: 16,
    scale: 2,
    durationMs: 220,
    depth: 2,
    strokeWidth: 2,
  },
  heal: {
    kind: 'heal',
    color: 0x6fe7a1,
    radius: 18,
    scale: 1.8,
    durationMs: 360,
    depth: 2,
    strokeWidth: 2,
  },
  buff: {
    kind: 'buff',
    color: 0xa9c09f,
    radius: 38,
    scale: 1,
    durationMs: 600,
    depth: 1,
    strokeWidth: 2,
  },
  debuff: {
    kind: 'debuff',
    color: 0xff9a72,
    radius: 26,
    scale: 1.5,
    durationMs: 280,
    depth: 2,
    strokeWidth: 2,
  },
  explosion: {
    kind: 'explosion',
    color: 0xf0a35e,
    radius: 16,
    scale: 2.5,
    durationMs: 260,
    depth: 2,
    strokeWidth: 0,
  },
  danger: {
    kind: 'danger',
    color: 0x8a3ffc,
    radius: 48,
    scale: 1.35,
    durationMs: 260,
    depth: 2,
    strokeWidth: 2,
  },
  death: {
    kind: 'death',
    color: 0x8a3ffc,
    radius: 16,
    scale: 2.5,
    durationMs: 260,
    depth: 2,
    strokeWidth: 0,
  },
});

export const VFX_POOL_CAPACITY = Object.freeze({
  ability: 24,
  impact: 32,
  floatingText: 24,
  projectile: 24,
  telegraph: 12,
  burst: 64,
});

export function combatVfx(kind: CombatVfxKind): CombatVfxDescriptor {
  return DESCRIPTORS[kind];
}

export function durationForMotion(kind: CombatVfxKind, reducedMotion: boolean): number {
  const duration = combatVfx(kind).durationMs;
  return reducedMotion ? Math.min(80, duration) : duration;
}

export function abilityVfxKind(ability: 'slash' | 'powerStrike' | 'whirlwind'): CombatVfxKind {
  if (ability === 'powerStrike') return 'power_strike';
  if (ability === 'whirlwind') return 'whirlwind';
  return 'slash';
}
