import { useEffect, useState } from 'react';

import {
  ApiError,
  gameApi,
  type ChestSnapshot,
  type InventoryItemSnapshot,
  type InventorySnapshot,
} from '../api';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { Panel } from '../components/Panel';

const RARITY_COLOR: Record<string, string> = {
  common: 'var(--text-muted)',
  magic: 'var(--blue)',
  rare: 'var(--accent)',
  legendary: 'var(--gold)',
};

export function Chest({
  characterId,
  onBack,
}: {
  characterId: string | undefined;
  onBack: () => void;
}) {
  const [chest, setChest] = useState<ChestSnapshot>();
  const [inventory, setInventory] = useState<InventorySnapshot>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (characterId === undefined) return;
    let active = true;
    void gameApi
      .chest(characterId)
      .then((result) => {
        if (!active) return;
        setChest(result.chest);
        setInventory(result.inventory);
      })
      .catch((reason: unknown) => active && setError(errorText(reason)));
    return () => {
      active = false;
    };
  }, [characterId]);

  const op = () =>
    globalThis.crypto?.randomUUID?.() ??
    `chest:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const move = async (itemId: string, direction: 'deposit' | 'withdraw') => {
    if (characterId === undefined) return;
    if (
      !window.confirm(
        direction === 'deposit'
          ? '¿Guardar este objeto en el cofre?'
          : '¿Retirar este objeto del cofre?',
      )
    )
      return;
    setBusy(true);
    setError(undefined);
    try {
      const result =
        direction === 'deposit'
          ? await gameApi.depositChest({ characterId, itemId, operationId: op() })
          : await gameApi.withdrawChest({ characterId, itemId, operationId: op() });
      setChest(result.receipt.chest);
      setInventory(result.receipt.inventory);
    } catch (reason: unknown) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };

  if (characterId === undefined) return <Empty onBack={onBack} />;
  if (chest === undefined || inventory === undefined)
    return <Empty onBack={onBack} message={error ?? 'Cargando cofre…'} />;
  return (
    <main className="ui-chest-screen" style={screenStyle}>
      <header style={headerStyle}>
        <div>
          <span className="eyebrow">PUEBLO · COFRE</span>
          <h1 style={titleStyle}>Cofre de la guardia</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Guardá equipo sin perder su identidad, semilla ni favoritos.
          </p>
        </div>
        <Button variant="ghost" onClick={onBack}>
          Volver al pueblo
        </Button>
      </header>
      {error ? (
        <p role="alert" style={{ color: 'var(--danger-bright)' }}>
          {error}
        </p>
      ) : null}
      <div style={layoutStyle}>
        <Panel
          eyebrow="Cofre persistente"
          title={`${chest.items.length} / ${chest.capacity}`}
          variant="ornate"
        >
          <ItemList
            items={chest.items}
            actionLabel="Retirar"
            busy={busy}
            onAction={(item) => void move(item.instanceId, 'withdraw')}
          />
        </Panel>
        <Panel eyebrow="Mochila" title={`${inventory.items.length} / ${inventory.capacity}`}>
          <ItemList
            items={inventory.items}
            actionLabel="Guardar"
            busy={busy}
            onAction={(item) => void move(item.instanceId, 'deposit')}
          />
        </Panel>
      </div>
    </main>
  );
}

function ItemList({
  items,
  actionLabel,
  busy,
  onAction,
}: {
  items: InventoryItemSnapshot[];
  actionLabel: string;
  busy: boolean;
  onAction: (item: InventoryItemSnapshot) => void;
}) {
  if (items.length === 0) return <p style={{ color: 'var(--text-muted)' }}>No hay objetos aquí.</p>;
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {items.map((item) => (
        <article key={item.instanceId} style={rowStyle}>
          <Icon name={itemIcon(item.type)} size={24} style={{ color: RARITY_COLOR[item.rarity] }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{item.displayName}</strong>
            <small style={{ display: 'block', color: 'var(--text-muted)' }}>
              {item.rarity} · Poder {item.itemPower}
            </small>
          </div>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || item.equippedSlot !== undefined}
            onClick={() => onAction(item)}
          >
            {actionLabel}
          </Button>
        </article>
      ))}
    </div>
  );
}

function itemIcon(type: string): IconName {
  const icons: Record<string, IconName> = {
    weapon_one_hand: 'sword',
    weapon_two_hand: 'axe',
    shield: 'shield',
    helmet: 'helm',
    chest: 'chest',
    gloves: 'glove',
    boots: 'boot',
    amulet: 'gem',
    ring: 'ring',
    material: 'shard',
  };
  return icons[type] ?? 'shard';
}
function errorText(reason: unknown): string {
  return reason instanceof ApiError ? reason.code : 'No se pudo cargar el cofre.';
}
function Empty({
  onBack,
  message = 'Seleccioná un personaje para abrir el cofre.',
}: {
  onBack: () => void;
  message?: string;
}) {
  return (
    <main style={screenStyle}>
      <p>{message}</p>
      <Button variant="ghost" onClick={onBack}>
        Volver
      </Button>
    </main>
  );
}
const screenStyle = {
  minHeight: '100vh',
  padding: '24px clamp(16px, 4vw, 48px)',
  background: 'var(--surface-0)',
  color: 'var(--text)',
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
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
const layoutStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
} as const;
const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 10,
  background: 'var(--surface-2)',
  border: '1px solid var(--border-dim)',
} as const;
