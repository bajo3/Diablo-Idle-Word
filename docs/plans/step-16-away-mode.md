# ExecPlan — Modo ausente basado en calibración

## Objetivo del usuario

Permitir que una build real del Guardián se calibre durante cinco minutos en el Bosque
Corrupto, se active como sesión ausente y, al regresar, produzca un informe y una recompensa
reclamable una sola vez.

## Estado actual

El esquema Prisma contiene `AwayCalibration`, `AwaySession` y `AwayResult`, incluyendo versiones,
snapshot, semilla, cap y estados. El servicio autoritativo, las rutas, el cálculo agregado, la
entrega idempotente y la pantalla de acceso ya están implementados. El servidor recibe `now` como
seam de pruebas; el cliente no es fuente de tiempo ni de recompensas.

## Alcance

- Calibración server-side de 300 segundos exactos, enlazada a zona, dificultad y fingerprint.
- Snapshot de build con atributos, equipo y habilidades antes de activar.
- Activación única con cap de 8 horas y eficiencia del 80 %.
- Cálculo agregado al regresar, con XP/oro/materiales y loot nuevo sin legendarios exclusivos.
- Resultado pendiente persistido antes de mostrarlo y claim serializable/idempotente.
- API y pantalla `/ausente` con estado, contador, estimación, activación, informe y reclamo.
- Pruebas puras, integración de persistencia/rutas y documentación viva.

## Fuera de alcance

No se simulan frames offline, no se agrega una zona nueva, no se implementan misiones/jefes offline
ni se reutiliza un legendario de la muestra como drop.

## Arquitectura afectada

`packages/shared/src/away-calculation.ts` contiene reglas puras. `apps/server/src/persistence/
away-service.ts` valida ownership, toma el reloj server-side, persiste estados y usa `EconomyService`
para el claim. `app.ts` sólo adapta HTTP y preserva la autoridad. La UI consume snapshots y nunca
envía tiempos, métricas ni recompensas.

## Modelo de datos

Se reutilizan las tablas existentes con `schemaVersion: 1`: una calibración por operación, una
sesión activa por personaje mediante `activeMarker`, un resultado único por sesión y `RewardLog`
como ledger económico. Los objetos generados se insertan en el inventario dentro del mismo claim.
No se requiere migración adicional porque los campos necesarios están en la migración de
fortalecimiento 20260730000000.

## Flujo de ejecución

`POST calibration` → snapshot/fingerprint + estado RUNNING → `POST complete` tras 300 s → métricas
de RewardLog y estado VALID/INVALID → `POST activate` → AWAY_FARMING → `POST return` calcula y
persiste PENDING con reloj server-side → `POST claim` aplica economía/loot y libera personaje.

## Consideraciones multiplayer y persistencia

Ownership se valida en cada consulta. Activar, regresar y reclamar usan transacciones serializables,
operaciones idempotentes y hash canónico. El WebSocket rechaza personajes no AVAILABLE para impedir
partidas activas durante calibración/ausencia. Un reinicio reconstruye el estado desde las tres
tablas; nunca se confía en `Date.now()` del navegador.

## Skills requeridas

`idle-progression`, `game-balance`, `save-and-migrations`, `multiplayer-authority`,
`automated-playtesting`, `game-architect`.

## Progreso

- [x] Auditar modelos, contratos, balance y rutas existentes.
- [x] Implementar cálculo puro y servicio de persistencia.
- [x] Exponer rutas y bloqueo de gameplay.
- [x] Agregar pantalla/API de modo ausente.
- [x] Probar, actualizar GOAL.md y cerrar el paso.

## Pruebas y criterios de aceptación

Cubrir duración negativa/cero/cap, actividad cero, build cambiada, reloj cliente ignorado, loot sin
legendario literal, IDs únicos y dos claims concurrentes. El paso sólo se marca completo cuando las
suites unitaria/integración, typecheck, lint, build, formato y smoke autenticado pasan.

## Decisiones

- 2026-08-04: usar RewardLog como fuente de métricas de la muestra para no aceptar contadores del
  navegador; las recompensas activas ya son server-side.
- 2026-08-04: limitar el MVP al Bosque Corrupto y generar loot común/mágico/raro con semilla derivada
  de la sesión y del índice del objeto.

## Resultados

- Servicio autoritativo, rutas HTTP, bloqueo de gameplay y pantalla `/ausente` implementados.
- Recompensa agregada e idempotente, con resultado pendiente persistido antes del reclamo.
- Verificación completa: unitarias/UI, integración dirigida, typecheck, lint, build, formato y diff.

## Trabajo pendiente

El siguiente paso del alcance principal es el Paso 17 — Pueblo completo y economía. Este plan no
incluye ciudad, comerciante, cofre ni nuevas zonas; se mantienen fuera de alcance para evitar
mezclar entregas.
