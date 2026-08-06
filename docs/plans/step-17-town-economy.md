# ExecPlan — Pueblo completo y economía

## Objetivo del usuario

Completar el ciclo del Guardián desde el pueblo: consultar la economía persistente, comprar y
vender objetos, guardar y retirar objetos del cofre, entrar al portal de expedición/modo ausente y
completar u omitir un tutorial que pueda repetirse.

## Estado actual

El pueblo existe como una pantalla visual con datos mock y un dock incompleto. El inventario ya
posee operaciones server-side idempotentes para equipar, desequipar, favorito y venta, pero no hay
catálogo de comerciante, compra, cofre persistente, snapshot de pueblo ni estado de tutorial. El
servidor mantiene autoridad sobre Character, InventoryItem, Equipment, RewardLog y progreso.

## Alcance

- Snapshot server-side de pueblo con personaje, recursos, portal, comerciante, cofre y tutorial.
- Catálogo de comerciante versionado con objetos básicos y precios configurables.
- Compra atómica e idempotente con generación de ítems determinista y ledger económico.
- Venta existente integrada al ledger económico y visible desde el comerciante.
- Cofre persistente con capacidad, depósito/retiro atómico, ownership y replay seguro.
- Navegación completa del dock: comerciante, cofre, ajustes, expedición y modo ausente.
- Tutorial inicial con iniciar, completar, omitir y repetir, guardado en estado persistente.
- Pruebas de unidad/integración/UI y documentación de economía/guardado/arquitectura.

## Fuera de alcance

No se agregan nuevas regiones, crafting, mejoras de objetos, trade entre jugadores ni el pipeline
final de arte/audio del Paso 18. El portal sólo habilita el contenido ya disponible del Bosque
Corrupto.

## Arquitectura afectada

`TownService` expone el snapshot y tutorial; `InventoryService` conserva las transacciones de
compra, venta y cofre; `town-catalog.ts` contiene datos de stock. React sólo envía intenciones y
renderiza snapshots. `RewardLog` registra las variaciones de oro y `CharacterTownOperation` hace
idempotentes las mutaciones de tutorial. `CharacterChest` conserva objetos serializados y
versionados, sin duplicar una instancia durante el movimiento.

## Skills requeridas

`game-architect` para límites y navegación, `loot-and-items` para generación y contenedores,
`save-and-migrations` para cofre/tutorial y migración, `game-balance` para precios/sumideros y
`automated-playtesting` para compra, cofre, navegación y tutorial.

## Archivos relevantes

- `apps/server/prisma/schema.prisma` y `apps/server/prisma/migrations/20260804050000_town_economy/`
- `apps/server/src/persistence/town-catalog.ts`, `town-service.ts`, `inventory-service.ts`
- `apps/server/src/app.ts` y `apps/server/src/persistence/*integration.test.ts`
- `apps/web/src/api.ts`, `App.tsx`, `screens/Town.tsx`, `Merchant.tsx`, `Chest.tsx`, `Settings.tsx`
- `docs/game/items-and-loot.md`, `docs/game/balance.md`, `docs/game/saves.md`,
  `docs/game/architecture.md` y `docs/game/testing.md`

## Modelo de datos

`CharacterChest` es una fila por personaje con `schemaVersion`, `revision`, capacidad y un array
JSON validado de `ItemInstance` + favorito. `CharacterTownOperation` conserva hash, tipo y
resultado de comandos de tutorial. El estado tutorial vive dentro de `CharacterProgress.state` con
ID y estado explícitos. Todas las instancias mantienen IDs estables, seed y versión del generador.

## Flujo de ejecución

UI autenticada → ruta HTTP → ownership/availability → validación server-side → transacción
Serializable → RewardLog/InventoryOperation/TownOperation → snapshot/receipt → UI.

## Consideraciones multiplayer

El servidor es la única autoridad para saldo, stock, instancia, capacidad y tutorial. Las
operaciones aceptan `operationId`, rechazan hashes distintos y son seguras ante reintentos,
desconexión y concurrencia. Un personaje no disponible no puede mutar inventario, economía ni
tutorial.

## Consideraciones de persistencia

La migración agrega tablas y filas iniciales de cofre sin modificar instancias existentes. El
movimiento de un objeto elimina/crea dentro de la misma transacción; si falla, la versión anterior
queda intacta. El estado de progreso existente se conserva al actualizar sólo la clave `tutorial`.

## Consideraciones de rendimiento

El snapshot de pueblo usa una lectura transaccional acotada. El cofre no supera 80 instancias y el
catálogo es inmutable en memoria; no se agregan consultas por frame ni polling continuo.

## Riesgos

- Inflación por precios bajos: medir saldo por hora y mantener precios configurables.
- Corrupción del JSON del cofre: validar antes de leer y rechazar datos inválidos sin sobrescribir.
- Doble compra o retiro: ledger por `operationId` y transacción Serializable.
- Pérdida visual por navegación: todos los cambios retornan snapshot completo y la UI confirma.

## Decisiones

- 2026-08-04: reutilizar `InventoryOperation` para compra/venta/cofre y `RewardLog` para cada delta
  monetario, en lugar de crear un ledger económico paralelo.
- 2026-08-04: guardar el cofre como contenedor JSON versionado para mantener los IDs de instancia y
  evitar una migración destructiva del modelo `InventoryItem`.
- 2026-08-04: guardar tutorial dentro de `CharacterProgress.state` y proteger sus comandos con
  `CharacterTownOperation`; no se persiste estado visual temporal.

## Milestones

1. Migración, catálogo y servicios server-side.
2. Rutas, snapshots y pruebas de persistencia/economía.
3. Pantallas y navegación del pueblo.
4. Tutorial, documentación, smoke y cierre del paso.

## Progreso

- [x] Auditar GOAL, arquitectura, modelos, servicios, UI y pruebas existentes.
- [x] Implementar migración, catálogo y servicios de pueblo/economía/cofre.
- [x] Exponer rutas y contratos HTTP idempotentes.
- [x] Integrar pantallas y navegación completa del pueblo.
- [x] Probar, documentar y marcar Paso 17.

## Pruebas

Unitarias para precios, catálogo, hashes y validación de cofre; integración PostgreSQL para compra,
venta, depósito/retiro, capacidad, replays, concurrencia, tutorial y persistencia; UI para navegar
el dock y confirmar operaciones. Ejecutar `pnpm test -- --run`, `pnpm test:integration`,
`pnpm typecheck`, `pnpm lint`, `pnpm build`, Prettier y `git diff --check`.

## Criterios de aceptación

- El jugador completa el ciclo pueblo → comerciante/cofre → portal → expedición/modo ausente.
- Compra, venta y movimientos del cofre son persistentes, atómicos y no duplicables.
- El tutorial se puede iniciar, completar, omitir y repetir sin bloquear navegación.
- No quedan pantallas del dock sin salida y los recursos muestran el saldo autoritativo.

## Resultados

Se completó con compra/venta y cofre idempotentes, tutorial persistente y rutas autenticadas. La
suite unitaria/UI quedó en 65 archivos y 293 tests; las pruebas de integración dirigidas cubren
servicios (2 tests) y HTTP (1 test), y la suite completa retorna exit code 0. Typecheck, lint y
formato pasan; el build también finalizó correctamente, con sólo el warning conocido del chunk
runtime grande.

## Trabajo pendiente

Paso 18 — arte, audio y feedback queda fuera de este plan y sólo se abrirá después de cerrar este
paso según `GOAL.md`.
