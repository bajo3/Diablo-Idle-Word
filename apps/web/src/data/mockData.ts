/**
 * Datos de ejemplo para las pantallas del kit de UI (Menú, Pueblo, Inventario).
 * Transcripción del modelo de datos del artifact DC.
 * Es MOCK: cuando el backend de inventario/pueblo exista, estos tipos se
 * reemplazan por los de `@brecha/shared` y los datos vienen del servidor.
 */
import type { GlyphKind } from '../components/Glyph';

export type Rarity = 'comun' | 'magico' | 'raro' | 'legendario' | 'corrupto';

export const RARITY_COLOR: Record<Rarity, string> = {
  comun: 'var(--rarity-comun)',
  magico: 'var(--rarity-magico)',
  raro: 'var(--rarity-raro)',
  legendario: 'var(--rarity-legendario)',
  corrupto: 'var(--rarity-corrupto)',
};

export const RARITY_LABEL: Record<Rarity, string> = {
  comun: 'Común',
  magico: 'Mágico',
  raro: 'Raro',
  legendario: 'Legendario',
  corrupto: 'Corrupto',
};

export type ItemCategory = 'arma' | 'armadura' | 'accesorio' | 'consumible' | 'material';

export interface Affix {
  text: string;
  color: string;
}

export interface Item {
  name: string;
  type: string;
  rarity: Rarity;
  power: number;
  kind: GlyphKind;
  category: ItemCategory;
  slot?: string;
  quantity?: number;
  affixes: Affix[];
  flavor?: string;
}

export const ITEMS: Item[] = [
  {
    name: 'Hacha Bifronte',
    type: 'Arma a dos manos',
    rarity: 'legendario',
    power: 236,
    kind: 'axe',
    category: 'arma',
    slot: 'Arma principal',
    affixes: [
      { text: '+42 Fuerza', color: 'var(--text)' },
      { text: '+18% daño físico', color: 'var(--text-muted)' },
      { text: '+9% prob. crítico', color: 'var(--warning)' },
      { text: '+120 daño de corrupción', color: 'var(--corruption)' },
      { text: 'Al matar: +5 Furia', color: 'var(--accent)' },
    ],
    flavor: 'Forjada dos veces, rota una. El herrero no habla de la segunda.',
  },
  {
    name: 'Daga Silente',
    type: 'Arma secundaria',
    rarity: 'magico',
    power: 74,
    kind: 'sword',
    category: 'arma',
    slot: 'Mano secundaria',
    affixes: [
      { text: '+16 Destreza', color: 'var(--text)' },
      { text: '+7% velocidad de ataque', color: 'var(--text-muted)' },
    ],
    flavor: 'Ligera como una hoja seca.',
  },
  {
    name: 'Yelmo del Bosque',
    type: 'Casco',
    rarity: 'comun',
    power: 41,
    kind: 'helm',
    category: 'armadura',
    slot: 'Casco',
    affixes: [
      { text: '+9 Vitalidad', color: 'var(--text)' },
      { text: '+24 armadura', color: 'var(--text-muted)' },
    ],
    flavor: 'Musgo donde debería haber acero.',
  },
  {
    name: 'Peto de Placas Corroído',
    type: 'Pechera',
    rarity: 'magico',
    power: 88,
    kind: 'chest',
    category: 'armadura',
    slot: 'Pechera',
    affixes: [
      { text: '+21 Vitalidad', color: 'var(--text)' },
      { text: '+62 armadura', color: 'var(--text-muted)' },
      { text: '-4% velocidad de movimiento', color: 'var(--danger-bright)' },
    ],
    flavor: 'Aguanta. Eso es todo lo que hace.',
  },
  {
    name: 'Guanteletes del Herrero',
    type: 'Guantes',
    rarity: 'comun',
    power: 33,
    kind: 'glove',
    category: 'armadura',
    slot: 'Guantes',
    affixes: [
      { text: '+7 Fuerza', color: 'var(--text)' },
      { text: '+18 armadura', color: 'var(--text-muted)' },
    ],
    flavor: 'Huelen a fragua fría.',
  },
  {
    name: 'Botas de Marcha Larga',
    type: 'Botas',
    rarity: 'magico',
    power: 52,
    kind: 'boot',
    category: 'armadura',
    slot: 'Botas',
    affixes: [
      { text: '+11 Destreza', color: 'var(--text)' },
      { text: '+6% velocidad de movimiento', color: 'var(--accent)' },
    ],
    flavor: 'Han cruzado la brecha tres veces.',
  },
  {
    name: 'Amuleto de la Brecha',
    type: 'Amuleto',
    rarity: 'legendario',
    power: 210,
    kind: 'gem',
    category: 'accesorio',
    slot: 'Amuleto',
    affixes: [
      { text: '+34 Inteligencia', color: 'var(--text)' },
      { text: '+22% daño de corrupción', color: 'var(--corruption)' },
      { text: 'Absorbe 8% del daño recibido', color: 'var(--accent)' },
    ],
    flavor: 'Late cuando el bosque calla.',
  },
  {
    name: 'Anillo de Ceniza',
    type: 'Anillo',
    rarity: 'raro',
    power: 120,
    kind: 'ring',
    category: 'accesorio',
    slot: 'Anillo 1',
    affixes: [
      { text: '+19 Fuerza', color: 'var(--text)' },
      { text: '+14% daño de fuego', color: '#c4622d' },
    ],
    flavor: 'Tibio al tacto, siempre.',
  },
  {
    name: 'Anillo Musgoso',
    type: 'Anillo',
    rarity: 'comun',
    power: 28,
    kind: 'ring',
    category: 'accesorio',
    slot: 'Anillo 2',
    affixes: [{ text: '+6 Vitalidad', color: 'var(--text)' }],
    flavor: 'Alguien lo perdió hace mucho.',
  },
  {
    name: 'Poción de Vida Mayor',
    type: 'Consumible',
    rarity: 'comun',
    power: 0,
    kind: 'potion',
    category: 'consumible',
    quantity: 12,
    affixes: [
      { text: 'Restaura 640 de vida', color: 'var(--accent)' },
      { text: 'Recarga 45 s', color: 'var(--text-muted)' },
    ],
    flavor: 'Sabe a raíces hervidas.',
  },
  {
    name: 'Poción de Furia',
    type: 'Consumible',
    rarity: 'magico',
    power: 0,
    kind: 'potion',
    category: 'consumible',
    quantity: 4,
    affixes: [{ text: '+50 Furia al instante', color: 'var(--corruption)' }],
    flavor: 'Quema al bajar.',
  },
  {
    name: 'Fragmento de Corrupción',
    type: 'Material',
    rarity: 'corrupto',
    power: 0,
    kind: 'shard',
    category: 'material',
    quantity: 34,
    affixes: [{ text: 'Reforja afijos de corrupción', color: 'var(--corruption)' }],
    flavor: 'No lo mires demasiado tiempo.',
  },
  {
    name: 'Esquirla de Hierro',
    type: 'Material',
    rarity: 'comun',
    power: 0,
    kind: 'shard',
    category: 'material',
    quantity: 8,
    affixes: [{ text: 'Mejora armadura en el Herrero', color: 'var(--text-muted)' }],
    flavor: '',
  },
  {
    name: 'Cuerno Astillado',
    type: 'Material',
    rarity: 'magico',
    power: 0,
    kind: 'shard',
    category: 'material',
    quantity: 3,
    affixes: [{ text: 'Componente de expedición', color: 'var(--rarity-magico)' }],
    flavor: '',
  },
  {
    name: 'Escudo de Roble Musgoso',
    type: 'Mano secundaria',
    rarity: 'magico',
    power: 96,
    kind: 'shield',
    category: 'armadura',
    slot: 'Escudo',
    affixes: [
      { text: '+18 Vitalidad', color: 'var(--text)' },
      { text: '+44 armadura', color: 'var(--text-muted)' },
      { text: '+8% prob. de bloqueo', color: 'var(--accent)' },
    ],
    flavor: 'El roble creció sobre el escudo, no al revés.',
  },
];

/** Inventario del personaje: por ahora par hardcoded para demostración. */
export const EQUIPPED: Record<string, Item> = {
  Casco: ITEMS[2]!,
  Pechera: ITEMS[3]!,
  Guantes: ITEMS[4]!,
  Botas: ITEMS[5]!,
  'Arma principal': {
    name: 'Espada del Vigía Caído',
    type: 'Arma a una mano',
    rarity: 'raro',
    power: 148,
    kind: 'sword',
    category: 'arma',
    slot: 'Arma principal',
    affixes: [
      { text: '+22 Fuerza', color: 'var(--text)' },
      { text: '+12% daño físico', color: 'var(--text-muted)' },
      { text: '+6% prob. crítico', color: 'var(--warning)' },
      { text: '+18% daño a élites', color: 'var(--rarity-magico)' },
    ],
    flavor: 'Aún señala el paso que ya nadie vigia.',
  },
  Escudo: ITEMS[14]!,
  Amuleto: ITEMS[6]!,
  'Anillo 1': ITEMS[7]!,
  'Anillo 2': ITEMS[8]!,
};

export const EQUIP_SLOTS_LEFT = ['Casco', 'Pechera', 'Guantes', 'Botas'] as const;
export const EQUIP_SLOTS_RIGHT = [
  'Arma principal',
  'Escudo',
  'Amuleto',
  'Anillo 1',
  'Anillo 2',
] as const;

export const QUICK_STATS = [
  { k: 'Vida', v: '1.720', c: 'var(--danger-bright)' },
  { k: 'Armadura', v: '438', c: 'var(--text-muted)' },
  { k: 'Daño', v: '184-241', c: 'var(--text)' },
  { k: 'Crítico', v: '21%', c: 'var(--warning)' },
] as const;

/** Dock inferior del pueblo. key = tecla de acceso rápido. */
export interface DockEntry {
  label: string;
  key: string;
  kind: GlyphKind;
  color: string;
  badge?: string;
}

export const DOCK: DockEntry[] = [
  { label: 'Personaje', key: 'C', kind: 'chest', color: 'var(--accent)' },
  { label: 'Inventario', key: 'I', kind: 'chest', color: 'var(--text-muted)' },
  { label: 'Habilidades', key: 'H', kind: 'gem', color: 'var(--corruption)' },
  { label: 'Expedición', key: 'E', kind: 'sword', color: 'var(--accent)' },
  { label: 'Ausente', key: 'A', kind: 'potion', color: 'var(--rarity-magico)' },
  { label: 'Comerciante', key: 'M', kind: 'ring', color: 'var(--warning)' },
  { label: 'Cofre', key: 'B', kind: 'shard', color: 'var(--text-muted)', badge: '3' },
  { label: 'Ajustes', key: 'ESC', kind: 'gem', color: 'var(--text-dim)' },
];

export interface TownNpc {
  name: string;
  role: string;
  x: string;
  y: string;
  tag: string;
  tagFg: string;
  tagBg: string;
  tagBd: string;
}

export const TOWN_NPCS: TownNpc[] = [
  {
    name: 'Herrero',
    role: 'Mejora y reforja',
    x: '190px',
    y: '330px',
    tag: 'Mejora lista',
    tagFg: 'var(--gold)',
    tagBg: 'color-mix(in srgb, var(--gold) 12%, transparent)',
    tagBd: 'color-mix(in srgb, var(--gold) 45%, transparent)',
  },
  {
    name: 'Guardián del Portal',
    role: 'Expedición y modo ausente',
    x: '550px',
    y: '300px',
    tag: 'Recompensa',
    tagFg: 'var(--gold-bright)',
    tagBg: 'color-mix(in srgb, var(--gold) 18%, transparent)',
    tagBd: 'color-mix(in srgb, var(--gold) 60%, transparent)',
  },
  {
    name: 'Exploradora',
    role: 'Rutas y contratos',
    x: '910px',
    y: '340px',
    tag: '2 contratos',
    tagFg: 'var(--accent)',
    tagBg: 'color-mix(in srgb, var(--accent) 12%, transparent)',
    tagBd: 'color-mix(in srgb, var(--accent) 45%, transparent)',
  },
];

/** Árboles del pueblo (siluetas para ambientación). */
export const TOWN_TREES: { x: string; y: string; w: string; h: string; c: string }[] = [
  { x: '20px', y: '150px', w: '110px', h: '260px', c: '#0d110d' },
  { x: '120px', y: '190px', w: '80px', h: '200px', c: '#101510' },
  { x: '1120px', y: '150px', w: '120px', h: '270px', c: '#0d110d' },
  { x: '1040px', y: '200px', w: '80px', h: '190px', c: '#101510' },
  { x: '250px', y: '120px', w: '60px', h: '170px', c: '#121812' },
  { x: '960px', y: '120px', w: '60px', h: '170px', c: '#121812' },
];
