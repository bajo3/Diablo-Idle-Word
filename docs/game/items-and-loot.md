# Objetos y loot

## Estado actual

El vertical slice del Paso 11 esta implementado para enemigos y modo online: el catalogo versionado
define 25 objetos MVP, 12 afijos, cuatro rarezas y una tabla de drop del Bosque Corrupto. El generador
en `packages/shared/src/items.ts` es determinista y auditable (`generationSeed`, `generatorVersion` y
`source`).

`InventoryService` es la autoridad para consultar, equipar, desequipar, marcar favorito y vender.
Valida ownership, slots, protecciones y capacidad en transacciones serializables; el ledger
`InventoryOperation` hace replay seguro por `operationId` y hash canonico. `Inventory.tsx` consume el
snapshot real, incluyendo equipo, oro, capacidad y stats derivados calculados en servidor.

`EnemyRewardService` elige y genera el drop dentro de la misma transaccion que XP/oro/materiales y
`RewardLog`. `REWARD_GRANTED` transporta el item privado (si existe), marca `visibility: private` y
`dropStatus`; repetir la operacion nunca crea otra instancia. La pantalla autenticada
`/resultados` consulta unicamente los logs del personaje propio.

## Modelo y flujo

```text
fuente + tabla + nivel + seed
  -> ItemInstance validada
  -> InventoryItem persistido
  -> equipo/protecciones
  -> stats derivados server-side
  -> snapshot REST / evento privado
```

`definitionId` es estable y viene de `@brecha/game-data`; `instanceId` es unico. Los datos de
generacion se guardan en `itemData`/`generationData`. `Inventory.revision` cambia con cada mutacion.

## Contenido provisional

- 10 armas, 10 piezas de armadura y 5 accesorios.
- 12 afijos repartidos en offense, defense, utility y corruption.
- `item.weapon.corrupted_guardian` es el legendario de jefe con drop 1% provisional.
- Rarezas: common 80, magic 15, rare 4, legendary 1; todos los numeros son tuning provisional y
  deben balancearse en el Paso 2 antes de produccion.

## Persistencia y multiplayer

La migracion `20260804040000_inventory_operations` es aditiva. Ownership siempre se resuelve por
`characterId + userId`; el cliente no puede proponer definiciones, estadisticas, oro ni precio. Un
conflicto de hash devuelve 409 y un retry identico devuelve el snapshot guardado.

## Pruebas y deuda

Cubiertos: semillas reproducibles, referencias de catalogo, conteo de contenido, ownership,
equipamiento, stats derivados, favorito, proteccion de venta, replay y migracion de PostgreSQL. La
capacidad llena devuelve `inventory_full` sin insertar filas nuevas.

Pendiente deliberado: capas authored por frame para cada arma/armadura, stacking/consumibles,
crafting y balance estadistico final. El runtime ya muestra un overlay placeholder
de arma/armadura derivado del equipo confirmado por servidor; no se presenta como arte final. Las
capas authored se implementaran en Paso 18 o tras cerrar el GOAL.

## Pueblo, comerciante y cofre (Paso 17)

El stock del comerciante vive en `apps/server/src/persistence/town-catalog.ts` con versión
`town.mvp.1`. Cada compra valida `stockId`, precio, capacidad y saldo en el servidor, genera una
instancia con seed `merchant:<stockId>:<operationId>` y escribe un `RewardLog` con `source`
`merchant_buy`. La venta usa el mismo ledger con `source` `merchant_sell`; el cliente nunca envía
precio, definición, rareza ni estadísticas.

`CharacterChest` es un contenedor persistente de 80 espacios. Depósito y retiro preservan el
`instanceId`, seed, generador, afijos y favorito; una transacción Serializable elimina y crea la
instancia sólo dentro del mismo commit. `InventoryOperation` guarda el snapshot completo para que
un retry devuelva el resultado anterior sin duplicar objetos.

## Skills relacionadas

- [loot-and-items](../../.agents/skills/loot-and-items/SKILL.md)
- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [save-and-migrations](../../.agents/skills/save-and-migrations/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
