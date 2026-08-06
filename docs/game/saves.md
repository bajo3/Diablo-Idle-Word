# Guardado y migraciones

## Checkpoint V1 del Paso 6

`{operationId, schemaVersion: 1, characterId, sceneId, checkpointId}` es una intención estricta.
El servidor autentica ownership, selección, disponibilidad y mantenimiento; ignora coordenadas y
recompensas cliente, persiste recibo propio con hash y devuelve el mismo resultado ante replay.

## Estado actual

El Paso 3 incorpora PostgreSQL autoritativo con Prisma 7.9.1. El formato mínimo admitido es
`formatVersion: 1`, `inventorySchemaVersion: 1` y `awaySnapshotSchemaVersion: 1`; el migrador rechaza explícitamente una versión desconocida. Consultar el
[modelo de datos](../data-model.md) y el [ExecPlan del Paso 3](../plans/step-03-persistence.md).

El Paso 4 agrega migración aditiva para hash de credencial, sesiones revocables, selección de
personaje y borrado lógico. No modifica el envelope del guardado V1 ni sus versiones; los nuevos
campos son datos de cuenta separados del save de personaje.

### Checkpoint de entrada al Pueblo

Al pulsar PUEBLO desde una partida autenticada, el cliente envía sólo la intención V1 del checkpoint
(`operationId`, personaje, escena y `checkpointId: town:entry`). `CheckpointService` comprueba
ownership/selección/disponibilidad dentro de una transacción, actualiza `lastSeenAt`/`revision` y
guarda en `CharacterCheckpointReceipt.serverState` un envelope `saveVersion: 2` con XP/nivel/puntos
del personaje y el snapshot de progreso del Bosque derivado del servidor. Un replay devuelve el
recibo original y no suma experiencia ni modifica dos veces la revisión.

## Progreso persistente del Bosque (Paso 9)

`CharacterForestProgress` es un agregado separado de `CharacterProgress`: el primero guarda la
progresión del Bosque y el segundo conserva la XP/atributos del personaje. La migración
`20260804000000_forest_progress_persistence` crea una fila por personaje existente y usa un snapshot
JSON con `formatVersion: 1`, `stateSchemaVersion: 1`, `dataVersion`, `balanceVersion`, `revision` y
`savedAtServerMs` en el DTO. El payload serializa `countedDefeats` como un array ordenado; al cargar,
`@brecha/shared` lo valida contra la curva actual y reconstruye el `ReadonlySet` inmutable.

`ForestProgressRepository` sólo lee personajes propios y guarda estados producidos por el servidor.
Cada escritura exige `expectedRevision`, ejecuta una transacción `Serializable` y rechaza una revisión
obsoleta; no existe un endpoint que acepte un snapshot arbitrario del cliente. La ruta GET
`/api/characters/:characterId/forest-progress` permite hidratar la partida autenticada. La mutación
de derrotas y sus recompensas sigue pendiente del transporte autoritativo del juego y no se simula
con una escritura de cliente.

La versión V1 tiene un migrador explícito que rechaza formatos desconocidos. Los cambios futuros deben
agregar migraciones secuenciales y conservar la revisión/backup de la capa de persistencia existente.

Las interacciones autorizadas usan las migraciones `20260804010000_interaction_authority_receipts`,
`20260804020000_interaction_contract_v2` y `20260804030000_interaction_effects`.
`CharacterInteractionState` conserva objetivos `oneShot` consumidos y cooldowns en estado V2;
`CharacterInteractionReceipt` guarda la decisión exacta, hash de intención, duración y `resultId`;
`CharacterInteractionEffect` registra una sola vez la finalización del efecto, distinguiendo
`APPLIED` de autorizaciones `PENDING_DOMAIN` (por ejemplo, loot que todavía depende del Paso 11/17).
El servicio de autoridad exige posición/estado del tick server-side; no existe una ruta de escritura
para posiciones, recompensas o snapshots enviados por el navegador. Las filas V1 se migran agregando
cooldowns vacíos sin alterar recibos existentes.

## Responsabilidades

- DTO persistente con versión, IDs, revisión y payload validado, separado de Prisma.
- Repositorio server-side con verificación de ownership y transacciones serializables.
- Migraciones SQL versionadas, backups y recuperación de desarrollo verificable.
- Migraciones secuenciales y compatibilidad.
- Auditoría de monedas, inventario y recompensas.

## Flujo de datos

```text
Dominio → DTO actual → validar → transacción Serializable
→ migración SQL versionada → lectura/verificación

Datos antiguos → detectar versión → migraciones N→N+1
→ validar → backup → persistir nueva revisión
```

## Límites

No serializar escenas/UI ni caches. El dominio no conoce archivos o base de datos. El cliente no es autoridad de partidas online. Todo cambio persistente incrementa versión, migra, prueba y documenta.

## Riesgos

Sobrescritura concurrente, archivo truncado, defaults que destruyen el original, IDs duplicados, downgrade, migración parcial y datos derivados inconsistentes.

## Backup de desarrollo

`pnpm db:backup` usa `pg_dump` dentro del contenedor Docker y escribe un dump custom + SHA-256 en
`backups/dev/`. Sólo acepta `localhost`/`127.0.0.1` y la DB `brecha_oscura`.
`pnpm db:restore:smoke` verifica hash y nombre, restaura en una base efímera `brecha_restore_*`,
consulta con Prisma y la elimina. Nunca usar estos scripts para una DB productiva.

## Pruebas requeridas

Round trip, cada paso de migración, cadena completa, campos faltantes, corrupción, fallo de
escritura, revisión conflictiva, backup/restore y datos sensibles. El Paso 3 cubre DB vacía,
seed idempotente, agregado, rechazo de versión, economía repetida/concurrente y rollback.

## Skills relacionadas

- [save-and-migrations](../../.agents/skills/save-and-migrations/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)

## Modo ausente (Paso 16)

`AwayCalibration`, `AwaySession` y `AwayResult` ya están cubiertos por la migración de
fortalecimiento `20260730000000_strengthen_persistence_invariants`. El flujo usa sus campos V1 de
snapshot, semilla, tasas, cap, versiones y estados; no introduce datos enviados por el cliente ni
requiere una migración nueva. `AwayResult.result` conserva el informe y los objetos acreditados,
mientras `RewardLog` conserva el recibo económico `away-claim:<resultId>`. Una segunda pestaña lee el
ledger y obtiene el mismo receipt sin duplicar XP, monedas u objetos.

## Pueblo y cofre (Paso 17)

La migración `20260804050000_town_economy` agrega `CharacterChest` (una fila por personaje,
`schemaVersion: 1`, `revision`, capacidad y items JSON validados) y `CharacterTownOperation` para
replays del tutorial. La migración crea cofres vacíos para personajes existentes y no modifica
`InventoryItem` ni sus IDs.

Mover un objeto entre mochila y cofre se ejecuta en una transacción Serializable: se verifica
ownership, equipo, capacidad y la instancia completa; si falla, el contenedor original permanece
intacto. El tutorial se guarda en `CharacterProgress.state.tutorial` preservando otras claves y
cada cambio incrementa `CharacterProgress.revision` y `Character.revision`. Compras y ventas
persisten también un delta de oro en `RewardLog`.
