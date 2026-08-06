# Arquitectura del juego

## Paso 6 — isla Phaser

React conserva sesión, rutas y API. `GameIsland` es el único puente hacia un runtime Phaser con
`pause`, `resume`, `destroy` y `setConnection`; las escenas consumen sólo manifiesto, input local y
callbacks de HUD. Phaser no importa React, HTTP ni Prisma. El checkpoint es una intención versionada
que se envía desde React; coordenadas y configuración proceden exclusivamente del servidor.

## Estado actual

En el Paso 18, `GameAudioMixer` y los adaptadores VFX viven en presentación: consumen eventos/estado
ya validado, nunca escriben salud, cooldowns, inventario o persistencia. `settings.ts` sólo guarda
preferencias locales (volúmenes, silencio y movimiento reducido) y las comunica al runtime mediante
un evento de UI; no es una fuente de autoridad de gameplay.

La selección de clase vive en `@brecha/shared` y se persiste como enum Prisma aditivo. La UI envía
un ID; el servidor valida ownership, crea el progreso inicial y devuelve el mismo ID en cada snapshot.
Mientras las siete opciones compartan el perfil de Guardián no se agregan condicionales de combate ni
se duplican fórmulas. En Phaser, la escena no crea cuerpos de colisión para decoración: sólo conserva
los límites del mundo y las validaciones autoritativas de knockback, evitando que un sprite de fondo
pueda trabar al jugador.

Los Pasos 1 y 2 fijaron el monorepo pnpm, React/Vite, Node/Fastify, TypeScript estricto y los paquetes `@brecha/shared`/`@brecha/game-data`. La arquitectura vigente y sus decisiones se documentan en [../architecture.md](../architecture.md); `GOAL.md` sigue siendo la fuente principal.

## Contratos del Paso 2

`@brecha/shared` ofrece tipos derivados de Zod y `@brecha/game-data` el catálogo inmutable. Cliente y servidor consumen los mismos símbolos; ninguna capa visual o de infraestructura entra en esos paquetes.

## Responsabilidades

```text
Input/UI → Casos de uso → Dominio → Eventos/resultados
   ↑                         ↓
Render ← adaptadores      Repositorios/red
```

- Dominio: combate, stats, inventario, loot y progresión sin dependencias visuales.
- Aplicación: coordinar comandos, transacciones y eventos.
- Infraestructura: motor, transporte, reloj, RNG, almacenamiento y telemetría.
- Presentación: escenas, HUD, animación, audio e input.
- Servidor: verdad compartida, validación y persistencia.
- Cliente: intención, predicción reversible y presentación.

El Paso 3 agrega `apps/server/src/persistence`: contratos de aplicación, repositorios y servicios
dependen de un adaptador Prisma/PostgreSQL. `@brecha/shared` permanece sin Prisma; migraciones y
cliente generado son detalles de infraestructura del servidor.

El Paso 4 añade `auth/`, `characters/` y adaptadores HTTP/WS en `app.ts`. `auth/` entrega un
principal ya autenticado; los servicios de personajes reciben sólo ese `userId`, nunca uno enviado
por la UI. La selección durable usa el ownership de base y React consume DTOs HTTP, sin importar
Prisma ni contener reglas de autorización.

El contrato reusable de interacción vive en `@brecha/shared`: targets versionados declaran sus
precondiciones y resultado, mientras el ledger V2 mantiene consumos/cooldowns sin depender de Phaser.
`InteractionAuthorityService` es el adaptador server-side; la UI sólo transforma `F` en intención y
renderiza el recibo. Los efectos concretos (loot, diálogo y reanimación) no se ejecutan desde la
presentación.

El primer bloque multiplayer usa `PartyRegistry` como autoridad process-local de lobby y
`ActiveInstanceRegistry` como autoridad process-local del tick. El lobby sólo acepta intenciones
autenticadas y genera snapshots; al iniciar, sus miembros se materializan en un estado de instancia
compartido. `PartyRegistry` aplica cleanup por TTL sin persistir snapshots visuales en PostgreSQL: la
persistencia social durable queda separada para un hito posterior, mientras que la reconexión dentro
del TTL recupera el snapshot autoritativo.

`EnemyAuthority` consume ese mismo tick para ejecutar una sola simulación PvE por `instanceId`.
Conserva estado de FSM, spawn/leash, cooldowns, proyectiles y telégrafos fuera de la UI; delega daño
del Guardián a `CombatAuthority` y sólo publica el resultado mediante snapshots. La presentación puede
mostrar `aiState`, pero nunca decide el impacto ni la vida.

`ActiveInstanceState.objectives` pertenece a la misma frontera autoritativa. En el Bosque infinito
contiene el objetivo de nivel 1→20 (`InstanceObjectiveState`), se valida por ID único y rango, y se
replica junto con `INSTANCE_SNAPSHOT`; el cliente sólo renderiza el progreso. La XP/recompensa que
avanza ese objetivo se conectará al dominio de recompensas sin convertir el snapshot en una fuente de
verdad persistente. El mismo límite se aplica a reanimación: `revive-authority.ts` elige el
destinatario derribado, el recibo durable conserva `effectCharacterId` y el tick aplica vida/estado
una sola vez; el navegador nunca puede escribir ese cambio.

## Presentación de eventos autoritativos (Paso 14)

`apps/web/src/game/game-session.ts` mantiene el transporte WebSocket autenticado separado del
runtime: sólo decodifica JSON, limita el tamaño de cada mensaje y reintenta con backoff acotado. No
envía comandos ni copia tokens. `game-events.ts` aplica `ServerEventSchema` antes de producir
`UiLootEntry`/`UiNotification`; `GameRuntime.applyServerEvent` incorpora esos datos a un feed
deduplicado y limitado a ocho entradas. `GameHudOverlay` consume ese snapshot y conserva fixtures
únicamente como fallback visual antes del primer evento.

La misma ruta sirve para `REWARD_GRANTED`, `COMBAT_RESULT` derrotado, efectos de interacción,
interrupciones y rechazos. XP, oro, materiales, daño, vida, drops e inventario nunca se calculan en
este adaptador: el cliente sólo presenta el resultado que el servidor ya validó. El preview local
usa `localDefeatPresentation` para probar la misma forma de UI sin simular autoridad de red.

## Límites

Mantener módulos para combat, classes, inventory/items, loot, idle, PvE/dungeons, multiplayer y saves. Compartir IDs y contratos versionados, no referencias internas. El UI no muta entidades directamente; el guardado no serializa nodos/objetos del motor sin DTO.

## Flujo de datos

1. Un adaptador convierte input o mensaje en comando.
2. Aplicación autentica/autoriza y carga estado.
3. Dominio valida invariantes y produce resultado/eventos.
4. Repositorio confirma cambios atómicos.
5. Red replica snapshot/delta y presentación reacciona.

## Decisiones

- Stack y estructura física: pnpm monorepo con React/Vite, Node/Fastify, `@brecha/shared`, `@brecha/game-data` y configuración TypeScript estricta.
- Usar separación conceptual dominio/aplicación/infraestructura/presentación.
- Mantener servidor autoritativo para estado compartido.
- Exigir ExecPlan para cambios grandes.
- El mapa mundial idle se implementará después del GOAL actual como catálogo de `ZoneDefinition`
  versionado: React selecciona una zona, `shared` valida requisitos/genera encuentros deterministas,
  el servidor posee progreso/recompensas y Phaser sólo adapta la zona activa. El modo offline usará
  cálculo agregado por tiempo de servidor, no simulación por frame.

El detalle de milestones, invariantes y pruebas está en
[`docs/plans/post-goal-world-map-idle.md`](../plans/post-goal-world-map-idle.md).

## Pueblo y economía (Paso 17)

`TownService` posee el snapshot del hub, el catálogo expuesto y las transiciones del tutorial;
`InventoryService` posee compra, venta y transferencia de instancias al cofre. `town-catalog.ts`
es configuración inmutable server-side. React sólo expresa `stockId`, `itemId` y `operationId`, y
renderiza recibos. `RewardLog`, `InventoryOperation` y `CharacterTownOperation` son ledgers separados
por responsabilidad; no se introdujo estado económico en Phaser ni en la UI.

## Riesgos

Elegir prematuramente un motor, compartir modelos persistentes con UI, crear un Player monolítico, depender de estado global o duplicar fórmulas entre cliente y servidor.

## Pruebas requeridas

Pruebas de funciones puras, contratos entre módulos, round trip de DTO, autoridad de comandos y smoke de arranque cuando exista runtime. Agregar detección de ciclos si el stack la soporta.

## Skills relacionadas

- [game-architect](../../.agents/skills/game-architect/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)
