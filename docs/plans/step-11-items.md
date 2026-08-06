# Paso 11 — Inventario, equipamiento y botín autoritativos

## Objetivo del usuario

Entregar el primer vertical slice de objetos del ARPG: drops individuales generados por el servidor,
inventario persistente, equipamiento/desequipamiento, favorito y venta idempotentes, con un panel que
consume datos reales y muestra la comparación de estadísticas.

## Estado actual

El esquema Prisma ya contiene `Inventory`, `InventoryItem` y `Equipment`, pero no había catálogo de
definiciones, generador, comandos ni rutas. La pantalla `Inventory.tsx` usaba fixtures. `RewardLog`
ya hace replay de recompensas de recursos y será la transacción que alojará el drop de enemigo.

## Alcance

- Catálogo versionado: 10 armas, 10 piezas de armadura, 5 accesorios, 12 afijos y un legendario de jefe.
- Generador determinista con semilla, rareza, afijos y versión de generador.
- Servicio de inventario server-side con ownership, revisión, capacidad y ledger de operaciones.
- Equipar/desequipar/favorito/venta y snapshot enriquecido para la UI.
- Drop de enemigo incluido de forma atómica en `RewardLog`, sin duplicar en replay.
- Adaptador de API y panel de inventario real, manteniendo el layout visual existente.
- Pruebas de catálogo, generación, ownership, idempotencia, capacidad, equipamiento y venta.

## Fuera de alcance

Capas cosméticas completas, cambios de sprite por pieza, comerciante/cofre, árbol de habilidades,
balance definitivo y drops del modo ausente. Esos entregables permanecen en los pasos 12, 17 y 18.

## Arquitectura afectada

`@brecha/shared` define contratos y generación pura; `@brecha/game-data` contiene sólo datos
versionados; `apps/server` valida intención, ejecuta transacciones serializables y emite eventos;
`apps/web` sólo envía comandos y renderiza snapshots confirmados.

## Skills requeridas

`game-architect`, `loot-and-items`, `game-balance`, `save-and-migrations` y
`automated-playtesting`. Se combinan porque el cambio cruza contratos, economía, persistencia y UI.

## Modelo de datos

- `ItemDefinitionId` identifica una definición inmutable del catálogo.
- `ItemInstanceId` identifica una instancia única; su semilla, fuente, nivel, rareza y afijos quedan
  auditables en `generationData`/`itemData`.
- `Inventory.revision` y `InventoryItem.revision` avanzan en cada mutación.
- `InventoryOperation` (migración aditiva) guarda `operationId`, hash canónico y resultado para
  replay/conflicto.
- `RewardLog.payload` conserva el drop generado junto al recibo de XP/oro/materiales.

## Flujo de ejecución

1. Cliente envía `operationId` y la intención mínima.
2. Servidor autentica usuario y resuelve `characterId`; nunca confía en stats, slot o precio del
   cliente.
3. Servicio valida definición, ownership, favoritos/equipo, capacidad y revisión dentro de una
   transacción serializable.
4. Persiste el cambio y el ledger; un retry con el mismo hash devuelve exactamente el resultado.
5. API devuelve snapshot confirmado; WebSocket comunica drops/recompensas privados.

## Consideraciones multiplayer

El servidor es la única autoridad. Equipar o vender desde dos clientes compite por la misma revisión;
la transacción serializable y el ledger evitan duplicación. La reconexión obtiene el snapshot actual.

## Consideraciones de persistencia

La migración es aditiva y versionada. Drops y recursos se escriben en la misma transacción para que un
replay de `RewardLog` no regenere objetos. Backups y restauración siguen los procedimientos de Paso 3.

## Consideraciones de rendimiento

Las operaciones de inventario son comandos puntuales; no se consulta la base por frame. El snapshot
limita la cantidad a la capacidad del inventario y la UI evita polling continuo.

## Riesgos

- Catálogo mal referenciado: validación de IDs, slots y rangos en `validateGameData`.
- Duplicación por retry: hash canónico, `operationId` único y `RewardLog` atómico.
- Venta de objeto equipado/favorito: rechazo explícito y prueba de regresión.
- Inventario lleno: resultado estable sin crear una instancia huérfana.

## Decisiones

- 2026-08-04: usar el catálogo de datos como fuente única; no aceptar definiciones desde React.
- 2026-08-04: generar con RNG seedable y guardar la versión para reproducibilidad.
- 2026-08-04: incluir el drop en la transacción de recompensa de enemigo; no crear una segunda cola
  eventual en este vertical slice.

## Milestones

- [x] M1: contratos compartidos, generador y catálogo mínimo.
- [x] M2: persistencia y comandos de inventario idempotentes (`InventoryOperation`, migración y
      `InventoryService`).
- [x] M3: drops atomizados con recompensas y eventos (`RewardLog` + `REWARD_GRANTED`).
- [x] M4: panel real, comparación, regresiones E2E, smoke autenticado y overlays visuales
      provisionales derivados del loadout server-side.
- [x] M5: verificación completa y actualización de `GOAL.md`; las capas authored por frame quedan
      como mejora visual del Paso 18 sin bloquear el vertical slice.

## Progreso

- [x] 2026-08-04: `packages/shared/src/items.ts` y pruebas deterministas.
- [x] 2026-08-04: catálogo con 25 definiciones, 12 afijos, tabla de enemigo y configuración de
      rarezas; validación de referencias y rangos.
- [x] 2026-08-04: migración `20260804040000_inventory_operations`, rutas REST y operaciones
      serializables con pruebas de ownership, replay, favorito y protección de venta.
- [x] 2026-08-04: drops deterministas dentro de `EnemyRewardService`, payload de red y feed de HUD.
- [x] 2026-08-04: `equipment-visual.ts` deriva arma/armadura desde `InventorySnapshot`; los
      overlays de Phaser comparten el origen 92x92, siguen facing/profundidad y exponen un atributo
      de smoke sin tocar combate.
- [x] 2026-08-04: smoke autenticado en `http://localhost:5173/partida` con un mandoble equipado;
      inventario 1/40, stats server-side y screenshot con arma visible.
- [x] Siguiente: el Paso 11 queda cerrado; las capas authored por frame, validación pixel-perfect
      por sprite y reemplazo de overlays quedan documentados para el Paso 18.

## Pruebas

Ejecutar `pnpm exec vitest run packages/shared/src/items.test.ts packages/game-data/src/validation.test.ts`,
`pnpm test:integration`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `git diff --check`.

## Criterios de aceptación

- El catálogo valida y genera instancias reproducibles con el mismo seed.
- Equipar un objeto propio cambia el snapshot de stats; un objeto ajeno se rechaza.
- Retry idéntico devuelve el mismo recibo sin duplicar filas, oro ni objetos.
- La pantalla de inventario muestra el snapshot server-side y sus comandos actualizan tras confirmación.

## Resultados

Se completará por milestone, con comandos y conteos reales al cerrar cada bloque.

## Trabajo pendiente

Las capas authored de arma/armadura por animación y dirección siguen deliberadamente fuera de este
vertical slice y quedan asignadas al Paso 18. Los overlays actuales son placeholders reemplazables:
no definen hitboxes, daño ni stats.
