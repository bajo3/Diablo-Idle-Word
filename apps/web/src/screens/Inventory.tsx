import { useEffect, useMemo, useState } from 'react';

import { ApiError, gameApi, type InventoryItemSnapshot, type InventorySnapshot } from '../api';
import { Button } from '../components/Button';
import { Icon, type IconName } from '../components/Icon';
import { Panel } from '../components/Panel';

type Filter = 'all' | 'weapon' | 'armor' | 'accessory' | 'material';
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'Todo' },
  { id: 'weapon', label: 'Armas' },
  { id: 'armor', label: 'Armadura' },
  { id: 'accessory', label: 'Accesorios' },
  { id: 'material', label: 'Materiales' },
];
const SLOTS = [
  'helmet',
  'chest',
  'gloves',
  'boots',
  'main_hand',
  'off_hand',
  'amulet',
  'ring_1',
  'ring_2',
] as const;
const RARITY_COLOR: Record<string, string> = {
  common: 'var(--text-muted)',
  magic: 'var(--blue)',
  rare: 'var(--accent)',
  legendary: 'var(--gold)',
};
const RARITY_LABEL: Record<string, string> = {
  common: 'Común',
  magic: 'Mágico',
  rare: 'Raro',
  legendary: 'Legendario',
};

export function Inventory({
  onBack,
  characterId,
}: {
  onBack: () => void;
  characterId: string | undefined;
}) {
  const [snapshot, setSnapshot] = useState<InventorySnapshot>();
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (characterId === undefined) return;
    let active = true;
    setError(undefined);
    void gameApi
      .inventory(characterId)
      .then((result) => {
        if (!active) return;
        setSnapshot(result.inventory);
        setSelectedId(result.inventory.items[0]?.instanceId);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof ApiError ? reason.code : 'No se pudo cargar el inventario.');
      });
    return () => {
      active = false;
    };
  }, [characterId]);

  const visible = useMemo(
    () =>
      (snapshot?.items ?? []).filter((item) => filter === 'all' || categoryFor(item) === filter),
    [filter, snapshot],
  );
  const selected = snapshot?.items.find((item) => item.instanceId === selectedId) ?? visible[0];
  const equippedBySlot = new Map(snapshot?.equipment.map((entry) => [entry.slot, entry.itemId]));
  const selectedEquipment = selected?.equippedSlot;

  const run = async (action: () => Promise<{ receipt: { snapshot: InventorySnapshot } }>) => {
    setBusy(true);
    setError(undefined);
    try {
      const result = await action();
      setSnapshot(result.receipt.snapshot);
    } catch (reason: unknown) {
      setError(reason instanceof ApiError ? reason.code : 'La operación fue rechazada.');
    } finally {
      setBusy(false);
    }
  };
  const op = () =>
    globalThis.crypto?.randomUUID?.() ?? `ui:${Date.now()}:${Math.random().toString(36).slice(2)}`;

  if (characterId === undefined)
    return (
      <EmptyState onBack={onBack} message="Seleccioná un personaje para abrir el inventario." />
    );
  if (snapshot === undefined && error === undefined)
    return <EmptyState onBack={onBack} message="Cargando inventario…" />;

  return (
    <main
      className="ui-inventory-screen"
      style={{
        minHeight: '100vh',
        background: 'var(--surface-0)',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        padding: '24px clamp(16px, 4vw, 48px)',
      }}
    >
      <header
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
      >
        <div>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 'var(--fs-caption)',
              letterSpacing: '0.18em',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
            }}
          >
            Inventario
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--fs-display)',
              color: 'var(--text-strong)',
              letterSpacing: '0.04em',
            }}
          >
            Mochila del Guardián
          </h1>
        </div>
        <Button variant="ghost" onClick={onBack}>
          Volver
        </Button>
      </header>
      {error && (
        <div
          role="alert"
          style={{
            color: 'var(--danger-bright)',
            border: '1px solid var(--danger-bright)',
            padding: '8px 12px',
          }}
        >
          {error}
        </div>
      )}
      <div
        className="ui-inventory-layout"
        style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 360px', gap: 16 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel
            eyebrow="Botín"
            title="Ranuras"
            variant="ornate"
            actions={
              <span
                style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}
              >
                {snapshot?.items.length ?? 0}/{snapshot?.capacity ?? 0}
              </span>
            }
          >
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
              {FILTERS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setFilter(entry.id)}
                  style={{
                    cursor: 'pointer',
                    padding: '5px 10px',
                    fontSize: 11,
                    fontFamily: 'var(--font-body)',
                    textTransform: 'uppercase',
                    background: filter === entry.id ? 'var(--surface-3)' : 'transparent',
                    color: filter === entry.id ? 'var(--text-strong)' : 'var(--text-muted)',
                    border: `1px solid ${filter === entry.id ? 'var(--accent)' : 'var(--border-dim)'}`,
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(var(--slot-size), 1fr))',
                gap: 6,
              }}
            >
              {Array.from({ length: snapshot?.capacity ?? 0 }, (_, index) => {
                const item = visible[index];
                const selectedCell = item?.instanceId === selected?.instanceId;
                return (
                  <button
                    key={index}
                    type="button"
                    disabled={item === undefined}
                    onClick={() => item && setSelectedId(item.instanceId)}
                    title={item?.displayName}
                    style={{
                      cursor: item ? 'pointer' : 'default',
                      width: 'var(--slot-size)',
                      height: 'var(--slot-size)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: item ? 'var(--surface-sunken)' : 'var(--surface-0)',
                      border: `1px solid ${selectedCell ? 'var(--accent)' : item ? RARITY_COLOR[item.rarity] : 'var(--border-dim)'}`,
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: selectedCell
                        ? '0 0 0 1px var(--accent), inset 0 0 18px color-mix(in srgb, var(--accent) 18%, transparent)'
                        : 'none',
                      position: 'relative',
                    }}
                  >
                    {item && (
                      <Icon
                        name={itemIcon(item.type)}
                        size={30}
                        style={{ color: RARITY_COLOR[item.rarity] }}
                      />
                    )}
                    {item?.quantity && item.quantity > 1 ? (
                      <span
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          right: 3,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          color: 'var(--text-strong)',
                        }}
                      >
                        {item.quantity}
                      </span>
                    ) : null}
                    {item?.favorite && (
                      <span
                        aria-label="Favorito"
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: 3,
                          width: 6,
                          height: 6,
                          background: 'var(--gold)',
                          clipPath:
                            'polygon(50% 0,61% 35%,98% 35%,68% 57%,79% 91%,50% 70%,21% 91%,32% 57%,2% 35%,39% 35%)',
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </Panel>
          <Panel
            eyebrow="Detalle"
            title={selected?.displayName ?? 'Sin objeto seleccionado'}
            variant="ornate"
          >
            {selected ? (
              <ItemDetail
                item={selected}
                equipped={selectedEquipment !== undefined}
                onEquip={() =>
                  run(() =>
                    selectedEquipment
                      ? gameApi.unequipItem({
                          characterId,
                          itemId: selected.instanceId,
                          operationId: op(),
                        })
                      : gameApi.equipItem({
                          characterId,
                          itemId: selected.instanceId,
                          operationId: op(),
                        }),
                  )
                }
                onFavorite={() =>
                  run(() =>
                    gameApi.favoriteItem({
                      characterId,
                      itemId: selected.instanceId,
                      favorite: !selected.favorite,
                      operationId: op(),
                    }),
                  )
                }
                onSell={() =>
                  run(() =>
                    gameApi.sellItem({
                      characterId,
                      itemId: selected.instanceId,
                      operationId: op(),
                    }),
                  )
                }
                busy={busy}
              />
            ) : (
              <span style={{ color: 'var(--text-muted)' }}>El inventario está vacío.</span>
            )}
          </Panel>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Panel eyebrow="Personaje" title="Equipo" variant="ornate">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {SLOTS.map((slot) => (
                <EquipRow
                  key={slot}
                  slot={slot}
                  item={snapshot?.items.find(
                    (candidate) => candidate.instanceId === equippedBySlot.get(slot),
                  )}
                />
              ))}
            </div>
          </Panel>
          <Panel eyebrow="Resumen" title="Atributos derivados" variant="ornate">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {Object.entries(snapshot?.derivedStats ?? {}).map(([key, value]) => (
                <div
                  key={key}
                  style={{
                    padding: '8px 10px',
                    background: 'var(--surface-0)',
                    border: '1px solid var(--border-dim)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <span
                    style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase' }}
                  >
                    {key.replaceAll('_', ' ')}
                  </span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: 15 }}>
                    {value}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, color: 'var(--gold)', fontFamily: 'var(--font-mono)' }}>
              Oro {format(snapshot?.gold ?? 0)} · Materiales {format(snapshot?.materials ?? 0)}
            </div>
          </Panel>
        </div>
      </div>
    </main>
  );
}

function ItemDetail({
  item,
  equipped,
  onEquip,
  onFavorite,
  onSell,
  busy,
}: {
  item: InventoryItemSnapshot;
  equipped: boolean;
  onEquip: () => void;
  onFavorite: () => void;
  onSell: () => void;
  busy: boolean;
}) {
  const base = [...item.baseStats, ...item.affixes];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 72,
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--surface-sunken)',
            border: `1px solid ${RARITY_COLOR[item.rarity]}`,
          }}
        >
          <Icon name={itemIcon(item.type)} size={40} style={{ color: RARITY_COLOR[item.rarity] }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
          <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{item.type}</span>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: RARITY_COLOR[item.rarity],
            }}
          >
            {RARITY_LABEL[item.rarity]} · Poder {item.itemPower}
          </span>
          {base.map((stat) => (
            <span key={stat.id} style={{ color: 'var(--text-strong)', fontSize: 13 }}>
              +{stat.value} {stat.stat.replaceAll('_', ' ')}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <Button variant="primary" onClick={onEquip} disabled={busy}>
          {equipped ? 'Desequipar' : 'Equipar'}
        </Button>
        <Button variant="secondary" onClick={onFavorite} disabled={busy}>
          {item.favorite ? 'Quitar favorito' : 'Favorito'}
        </Button>
        <Button variant="danger" onClick={onSell} disabled={busy || item.favorite || equipped}>
          Vender ({item.sellValue})
        </Button>
      </div>
    </div>
  );
}

function EquipRow({ slot, item }: { slot: string; item: InventoryItemSnapshot | undefined }) {
  return (
    <div
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0 8px',
        background: 'var(--surface-0)',
        border: item ? `1px solid ${RARITY_COLOR[item.rarity]}` : '1px dashed var(--border-dim)',
        color: item ? RARITY_COLOR[item.rarity] : 'var(--text-dim)',
        fontSize: 12,
      }}
    >
      {item && (
        <Icon name={itemIcon(item.type)} size={22} style={{ color: RARITY_COLOR[item.rarity] }} />
      )}
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
          {slot}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item?.displayName ?? 'Vacío'}
        </span>
      </div>
    </div>
  );
}

function categoryFor(item: InventoryItemSnapshot): Filter {
  if (item.type.startsWith('weapon')) return 'weapon';
  if (['helmet', 'chest', 'gloves', 'boots'].includes(item.type)) return 'armor';
  if (['ring', 'amulet'].includes(item.type)) return 'accessory';
  return 'material';
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
function EmptyState({ onBack, message }: { onBack: () => void; message: string }) {
  return (
    <main style={{ minHeight: '100vh', padding: 32, color: 'var(--text)' }}>
      <Button variant="ghost" onClick={onBack}>
        Volver
      </Button>
      <p>{message}</p>
    </main>
  );
}
