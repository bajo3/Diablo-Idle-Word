# Multiplayer

## Checkpoint local y autoridad

El checkpoint no replica una partida ni acepta estado espacial desde el navegador. Es una operación
idempotente por `operationId`, con hash de intención y configuración/posición derivada en servidor;
la red futura deberá recuperar ese recibo, no un snapshot local.

## Estado actual

Existen cliente y servidor mínimos, pero todavía no hay transporte multiplayer. GOAL.md fija cooperación para 1 a 4 jugadores y autoridad de servidor; el protocolo sigue pendiente del prototipo. Consultar [../networking.md](../networking.md).

El Paso 4 incorpora el perímetro de autenticación WebSocket en `/ws`: el upgrade exige `Origin`
permitido y la misma cookie de sesión opaca activa que HTTP; la identidad se deriva de PostgreSQL.
Sólo confirma autenticación y rechaza mensajes de gameplay. Salas, reconexión y simulación siguen
pendientes del Paso 13.

## Responsabilidades

- Autenticar sesión y autorizar acciones.
- Simular estado compartido en servidor.
- Versionar mensajes, snapshots y operaciones.
- Sincronizar con interpolación/predicción/reconciliación apropiadas.
- Recuperar estado tras reconexión.
- Aplicar límites, idempotencia, replay protection y auditoría.

## Flujo de datos

```text
Input cliente + secuencia → comando autenticado → validación servidor
→ mutación autoritativa → snapshot/delta → interpolación/presentación
```

Las transacciones usan ID de operación y persistencia atómica. La reconexión solicita snapshot/cursor; nunca sube una verdad local.

## Límites

Cliente: intención y feedback reversible. Servidor: movimiento válido, combate, loot, inventario, monedas, comercio, recompensas y guardado. Transporte no contiene reglas de dominio.

## Riesgos

Trust del cliente, replay, spam, versiones incompatibles, snapshots con datos privados, double-spend, comandos fuera de orden y operaciones ambiguas tras desconexión.

## Pruebas requeridas

Dos clientes, latencia/pérdida, out-of-order, replay, rate limiting, reconexión, versión inválida, movimiento imposible, daño falsificado y desconexión durante transacción.

## Skills relacionadas

- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [game-architect](../../.agents/skills/game-architect/SKILL.md)
- [performance-2d](../../.agents/skills/performance-2d/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)
