# Objetos y loot

## Estado actual

Existen catálogo de tipos, slots, rarezas, IDs, seeds y snapshots de equipo. Inventario, instancias, afijos, tablas, monedas, crafting y economía ejecutable siguen `TBD`.

## Datos del Paso 2

Existen contratos para tipos, slots, rarezas, snapshots de equipo, IDs y seeds. El catálogo centraliza las diez categorías de objeto y cuatro rarezas sin crear instancias, afijos ni tablas de drop.

## Responsabilidades

- Catálogo: definiciones base y reglas.
- Generador: rareza, afijos, rangos, pesos, seed y versión.
- Inventario/equipo: propiedad, capacidad, stacking y slots.
- Transacciones: pickup, equipar, vender, destruir, mejorar y transferir.
- Persistencia: instancias únicas y migraciones.

La presentación sólo localiza y muestra una instancia validada.

## Flujo de datos

```text
Fuente + tabla + nivel + seed → ItemInstance validada
→ grant transaccional → inventario → cálculo de stats → save/snapshot
```

Cada instancia usa `definition_id` estable e `instance_id` único. Las operaciones sensibles usan `operation_id`.

## Límites

Loot decide qué instancia proponer; inventario decide si puede poseerse; equipo aplica reglas de slot; stats calcula efectos; servidor confirma propiedad y mutación.

## Riesgos

Duplicación por reintento, seeds como IDs, afijos incompatibles, tabla sesgada, venta concurrente, cálculo final persistido y confiado, inflación.

## Pruebas requeridas

Seeds fijas para común/raro/legendario, distribución por tier, inventario lleno, stacking, equipo, bloqueo, mejora, reintentos, concurrencia, migración y ausencia de duplicación.

## Skills relacionadas

- [loot-and-items](../../.agents/skills/loot-and-items/SKILL.md)
- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [save-and-migrations](../../.agents/skills/save-and-migrations/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
