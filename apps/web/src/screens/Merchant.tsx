import { useEffect, useState } from 'react';

import {
  ApiError,
  gameApi,
  type InventoryItemSnapshot,
  type InventorySnapshot,
  type MerchantStockSnapshot,
  type TownSnapshot,
} from '../api';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { Panel } from '../components/Panel';

type Tab = 'buy' | 'sell';
const RARITY_COLOR: Record<string, string> = {
  common: 'var(--text-muted)',
  magic: 'var(--blue)',
  rare: 'var(--accent)',
  legendary: 'var(--gold)',
};

export function Merchant({
  characterId,
  onBack,
}: {
  characterId: string | undefined;
  onBack: () => void;
}) {
  const [town, setTown] = useState<TownSnapshot>();
  const [inventory, setInventory] = useState<InventorySnapshot>();
  const [tab, setTab] = useState<Tab>('buy');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (characterId === undefined) return;
    let active = true;
    setError(undefined);
    void Promise.all([gameApi.town(characterId), gameApi.inventory(characterId)])
      .then(([townResult, inventoryResult]) => {
        if (!active) return;
        setTown(townResult.town);
        setInventory(inventoryResult.inventory);
      })
      .catch((reason: unknown) => active && setError(errorText(reason)));
    return () => {
      active = false;
    };
  }, [characterId]);

  const mutateInventory = async (
    action: () => Promise<{ receipt: { snapshot: InventorySnapshot } }>,
  ) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await action();
      setInventory(result.receipt.snapshot);
      setTown((current) =>
        current === undefined
          ? current
          : {
              ...current,
              gold: result.receipt.snapshot.gold,
              inventory: {
                occupied: result.receipt.snapshot.items.length,
                capacity: result.receipt.snapshot.capacity,
              },
            },
      );
    } catch (reason: unknown) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };
  const op = () =>
    globalThis.crypto?.randomUUID?.() ??
    `merchant:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  if (characterId === undefined) return <Empty onBack={onBack} />;
  if (town === undefined || inventory === undefined)
    return <Empty onBack={onBack} message={error ?? 'Cargando comerciante…'} />;

  return (
    <main style={screenStyle} className="ui-merchant-screen">
      <header style={headerStyle}>
        <div>
          <span className="eyebrow">PUEBLO · COMERCIANTE</span>
          <h1 style={titleStyle}>La Balanza Rota</h1>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Compra equipo básico y convertí el botín en oro sin perder instancias.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <strong style={{ color: 'var(--gold)' }}>Oro {format(town.gold)}</strong>
          <Button variant="ghost" onClick={onBack}>
            Volver al pueblo
          </Button>
        </div>
      </header>
      {error ? (
        <p role="alert" style={{ color: 'var(--danger-bright)' }}>
          {error}
        </p>
      ) : null}
      <div
        style={{ display: 'flex', gap: 8 }}
        role="tablist"
        aria-label="Operaciones del comerciante"
      >
        <Button variant={tab === 'buy' ? 'primary' : 'ghost'} onClick={() => setTab('buy')}>
          Comprar
        </Button>
        <Button variant={tab === 'sell' ? 'primary' : 'ghost'} onClick={() => setTab('sell')}>
          Vender botín
        </Button>
      </div>
      {tab === 'buy' ? (
        <Panel eyebrow="Stock server-side" title="Objetos básicos" variant="ornate">
          <div style={gridStyle}>
            {town.merchant.items.map((stock) => (
              <BuyCard
                key={stock.stockId}
                stock={stock}
                disabled={
                  busy || inventory.items.length >= inventory.capacity || town.gold < stock.price
                }
                onBuy={() => {
                  if (!window.confirm(`¿Comprar ${stock.displayName} por ${stock.price} oro?`))
                    return;
                  void mutateInventory(() =>
                    gameApi.buyItem({ characterId, stockId: stock.stockId, operationId: op() }),
                  );
                }}
              />
            ))}
          </div>
        </Panel>
      ) : (
        <Panel eyebrow="Inventario" title="Vender objetos" variant="ornate">
          {inventory.items.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No tenés objetos para vender.</p>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {inventory.items.map((item) => (
                <SellRow
                  key={item.instanceId}
                  item={item}
                  busy={busy}
                  onSell={() => {
                    if (!window.confirm(`¿Vender ${item.displayName} por ${item.sellValue} oro?`))
                      return;
                    void mutateInventory(() =>
                      gameApi.sellItem({ characterId, itemId: item.instanceId, operationId: op() }),
                    );
                  }}
                />
              ))}
            </div>
          )}
        </Panel>
      )}
    </main>
  );
}

function BuyCard({
  stock,
  disabled,
  onBuy,
}: {
  stock: MerchantStockSnapshot;
  disabled: boolean;
  onBuy: () => void;
}) {
  return (
    <article style={cardStyle}>
      <span style={{ ...iconStyle, color: RARITY_COLOR[stock.rarity] }}>
        <Icon name={itemIcon(stock.type)} size={30} />
      </span>
      <div style={{ display: 'grid', gap: 4, flex: 1 }}>
        <strong>{stock.displayName}</strong>
        <small style={{ color: 'var(--text-muted)' }}>
          Nivel {stock.itemLevel} · Poder {stock.itemPowerRange[0]}–{stock.itemPowerRange[1]}
        </small>
        <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>
          {stock.price} oro
        </span>
      </div>
      <Button size="sm" disabled={disabled} onClick={onBuy}>
        Comprar
      </Button>
    </article>
  );
}

function SellRow({
  item,
  busy,
  onSell,
}: {
  item: InventoryItemSnapshot;
  busy: boolean;
  onSell: () => void;
}) {
  const protectedItem = item.favorite || item.equippedSlot !== undefined;
  return (
    <article style={cardStyle}>
      <span style={{ ...iconStyle, color: RARITY_COLOR[item.rarity] }}>
        <Icon name={itemIcon(item.type)} size={26} />
      </span>
      <div style={{ display: 'grid', gap: 3, flex: 1 }}>
        <strong>{item.displayName}</strong>
        <small style={{ color: 'var(--text-muted)' }}>
          {item.rarity} · Poder {item.itemPower}
          {protectedItem ? ' · protegido' : ''}
        </small>
      </div>
      <Button variant="danger" size="sm" disabled={busy || protectedItem} onClick={onSell}>
        Vender · {item.sellValue}
      </Button>
    </article>
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
function format(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}
function errorText(reason: unknown): string {
  return reason instanceof ApiError ? reason.code : 'No se pudo cargar el comerciante.';
}
function Empty({
  onBack,
  message = 'Seleccioná un personaje para abrir el comerciante.',
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
  backgroundImage:
    'linear-gradient(180deg, rgb(5 7 8 / 34%), rgb(5 7 8 / 78%)), url("/assets/backgrounds/blacksmith-forge.webp")',
  backgroundColor: 'var(--surface-0)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundAttachment: 'fixed',
  imageRendering: 'pixelated',
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
const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 10,
} as const;
const cardStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  background: 'var(--surface-2)',
  border: '1px solid var(--border-dim)',
} as const;
const iconStyle = {
  width: 48,
  height: 48,
  display: 'grid',
  placeItems: 'center',
  background: 'var(--surface-sunken)',
  border: '1px solid var(--border)',
} as const;
