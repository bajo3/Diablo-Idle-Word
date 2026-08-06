import type { IconName } from '../components/Icon';

/**
 * Fixture de presentación para la UI de referencia.
 *
 * Estos datos no son estado del personaje ni autoridad del servidor: sólo llenan los paneles que
 * todavía no tienen un contrato de dominio (party, buffs, chat, loot y notificaciones). Cuando
 * esos sistemas existan, el adaptador podrá reemplazarlos sin cambiar los componentes visuales.
 */
export type UiTone = 'accent' | 'gold' | 'blue' | 'corruption' | 'danger' | 'muted';

export type UiResource = Readonly<{
  id: string;
  label: string;
  value: string;
  icon: IconName;
  tone: UiTone;
}>;

export type UiBuff = Readonly<{
  id: string;
  label: string;
  remaining: string;
  icon: IconName;
  tone: UiTone;
}>;

export type UiPartyMember = Readonly<{
  id: string;
  name: string;
  level: number;
  role: string;
  icon: IconName;
  health: number;
  maxHealth: number;
  resource: number;
  maxResource: number;
  tone: UiTone;
}>;

export type UiChatLine = Readonly<{
  id: string;
  author: string;
  text: string;
  tone: UiTone;
}>;

export type UiLootEntry = Readonly<{
  id: string;
  label: string;
  tone: UiTone;
}>;

export type UiNotification = Readonly<{
  id: string;
  title: string;
  detail: string;
  icon: IconName;
  tone: UiTone;
}>;

export const UI_RESOURCES: readonly UiResource[] = Object.freeze([
  { id: 'gold', label: 'Oro', value: '125.430', icon: 'gold', tone: 'gold' },
  { id: 'crystals', label: 'Cristales', value: '2.450', icon: 'gem', tone: 'blue' },
  { id: 'shards', label: 'Esquirlas', value: '350', icon: 'shard', tone: 'corruption' },
  { id: 'leaves', label: 'Hojas', value: '1.250', icon: 'leaves', tone: 'accent' },
]);

export const UI_BUFFS: readonly UiBuff[] = Object.freeze([
  { id: 'xp', label: 'EXP +25%', remaining: '23:45', icon: 'experience', tone: 'accent' },
  { id: 'gold', label: 'ORO +15%', remaining: '23:45', icon: 'gold', tone: 'gold' },
  {
    id: 'forest',
    label: 'Bendición del bosque',
    remaining: '02:14',
    icon: 'sparkles',
    tone: 'accent',
  },
]);

export const UI_PARTY: readonly UiPartyMember[] = Object.freeze([
  {
    id: 'vaelin',
    name: 'Vaelin',
    level: 13,
    role: 'Guardián',
    icon: 'shield',
    health: 204,
    maxHealth: 220,
    resource: 85,
    maxResource: 120,
    tone: 'blue',
  },
  {
    id: 'brann',
    name: 'Brann',
    level: 13,
    role: 'Vanguardia',
    icon: 'sword',
    health: 176,
    maxHealth: 250,
    resource: 60,
    maxResource: 100,
    tone: 'muted',
  },
  {
    id: 'lyria',
    name: 'Lyria',
    level: 13,
    role: 'Arcanista',
    icon: 'gem',
    health: 132,
    maxHealth: 180,
    resource: 120,
    maxResource: 150,
    tone: 'accent',
  },
]);

export const UI_CHAT: readonly UiChatLine[] = Object.freeze([
  {
    id: 'system-welcome',
    author: '[Sistema]',
    text: 'Bienvenido a La Brecha Oscura',
    tone: 'accent',
  },
  {
    id: 'system-blessing',
    author: '[Sistema]',
    text: 'Bendición del bosque activa',
    tone: 'accent',
  },
  { id: 'brann', author: 'Brann', text: '¡Vamos con todo!', tone: 'muted' },
  { id: 'vaelin', author: 'Vaelin', text: 'Casi lo tengo', tone: 'muted' },
  { id: 'loot', author: 'Brann', text: 'Buen loot 🔥', tone: 'gold' },
]);

export const UI_LOOT_LOG: readonly UiLootEntry[] = Object.freeze([
  { id: 'gold', label: '+ 124 Oro', tone: 'gold' },
  { id: 'scale', label: '+ 1 Escama corrupta', tone: 'corruption' },
  { id: 'xp', label: '+ 26 EXP', tone: 'blue' },
]);

export const UI_NOTIFICATIONS: readonly UiNotification[] = Object.freeze([
  {
    id: 'mission',
    title: 'Misión completada',
    detail: 'Recompensa disponible',
    icon: 'check',
    tone: 'gold',
  },
  {
    id: 'item',
    title: '¡Nuevo objeto obtenido!',
    detail: 'Épico · Anillo de Sombras',
    icon: 'gem',
    tone: 'corruption',
  },
]);

export const UI_SKILLS: readonly {
  id: string;
  label: string;
  icon: IconName;
  tone: UiTone;
  key: string;
}[] = Object.freeze([
  { id: 'iron', label: 'Piel de hierro', icon: 'shield', tone: 'muted', key: '1' },
  { id: 'power', label: 'Golpe poderoso', icon: 'sparkles', tone: 'blue', key: '2' },
  { id: 'slash', label: 'Tajo', icon: 'sword', tone: 'danger', key: '3' },
  { id: 'whirlwind', label: 'Torbellino', icon: 'fury', tone: 'accent', key: '4' },
]);
