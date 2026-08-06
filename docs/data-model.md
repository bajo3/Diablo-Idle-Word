# Modelo de datos — Paso 3

La persistencia vive exclusivamente en `apps/server`. Prisma es infraestructura: `@brecha/shared`
no importa su cliente ni expone sus tipos generados.

## Identidad y sesión (Paso 4)

`User.email` se normaliza (NFKC, trim y minúsculas) antes de persistir. Las cuentas propias usan
`passwordHash` Argon2id; el seed histórico conserva `NULL`, por lo que no constituye una credencial
real ni puede iniciar sesión. `Session` almacena únicamente el SHA-256 de un bearer aleatorio de
256 bits, con vencimiento absoluto, revocación y último uso. El token sin hash aparece sólo en la
cookie HttpOnly de la respuesta.

`CharacterSelection` tiene una fila por usuario y una FK compuesta hacia `(Character.id,
Character.userId)`: una selección no puede pertenecer a otra cuenta ni sobrevivir a un personaje
borrado. `Character.deletedAt` preserva el agregado y el índice parcial permite reutilizar nombres
de Guardianes eliminados sin exponerlos en las consultas normales. Ese índice usa `lower(name)`,
por lo que dos Guardianes activos del mismo usuario no pueden diferir sólo por mayúsculas.

## Agregado y ownership

`User` posee `Character` mediante `Character.userId`. Los repositorios leen por actor + personaje,
por lo que un personaje ajeno no se expone. Cada personaje tiene un inventario y progreso únicos.

| Entidad                                                                                    | Invariantes durables                                                                                                                                                    |
| ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Character`                                                                                | Oro/materiales `BIGINT`, cuatro atributos no negativos, `lastSeenAt`, save/revision positivos.                                                                          |
| `Inventory` / `InventoryItem`                                                              | Capacidad/schema versionados; cada instancia tiene owner, rareza, poder, favorito, afijos, generación y cantidad positiva.                                              |
| `Equipment`                                                                                | Un slot e item por personaje; FK compuesta `(inventoryItemId, characterId)` impide equipar un item ajeno.                                                               |
| `CharacterSkill` / `CharacterProgress`                                                     | `equipped` coincide con bar slot 0–3 y requiere unlocked; nivel 1–10, versiones/revisiones.                                                                             |
| `CharacterForestProgress`                                                                  | Snapshot V1 de nivel/XP/recompensas/derrotas contadas del Bosque, versiones de datos/balance y revisión positiva.                                                       |
| `CharacterInteractionState` / `CharacterInteractionReceipt` / `CharacterInteractionEffect` | Estado V2 de interacciones (`oneShot`, cooldowns), decisiones idempotentes por `operationId` y efectos completados/autorizados con hash, duración, resultado y versión. |
| `AwayCalibration` / `AwaySession` / `AwayResult`                                           | Build/snapshot/rates/versiones, tiempos y resultados auditables; máximo una sesión ACTIVE por personaje.                                                                |
| `MissionResult`                                                                            | `operationId` único pero múltiples ejecuciones por misión; dificultad, outcome, progreso y claim versionados.                                                           |
| `RewardLog`                                                                                | Operación única, hash SHA-256 canónico interno, source/sourceId, deltas y saldos posteriores de oro/materiales/XP.                                                      |

Los CHECKs cubren recursos no negativos, revisiones positivas, cantidades, niveles, slots, estados
de skill y coherencia de tiempos/marcador active. Las migraciones SQL son la fuente de verdad de
estas restricciones.

## Economía e idempotencia

`EconomyService.applyOnce` recibe actor autoritativo, operación, source/sourceId y deltas; nunca
un saldo ni hash aportados por cliente. Calcula una representación estable y SHA-256 internamente,
opera en `Serializable` y persiste un recibo con balances posteriores. Un replay devuelve el mismo
recibo almacenado aunque haya transacciones intermedias. El mismo `operationId` con payload o
source distinto se rechaza; recursos negativos hacen rollback sin ledger. `P2034`/`P2002` tienen
reintentos acotados.

## Progreso persistente del Bosque

`CharacterForestProgress` separa la progresión del Bosque de la XP del personaje. Su snapshot V1 se
define en `packages/shared/src/forest-progress-save.ts`: el array ordenado `countedDefeats` vuelve a
ser un `ReadonlySet` al hidratar y la curva actual valida niveles, umbrales y el estado cap.
`ForestProgressRepository` aplica ownership, control optimista de `revision` y transacciones
`Serializable`; el cliente sólo puede leer el snapshot autenticado. Las recompensas y la mutación de
derrotas requieren todavía un comando autoritativo del servidor.

## Versionado y Prisma

El save V1 incluye `formatVersion`, `inventorySchemaVersion: 1` y
`awaySnapshotSchemaVersion: 1`; versiones desconocidas se rechazan. `prisma.config.ts` centraliza
schema, migrations, seed y URL. Prisma 7.9.1 genera el cliente ESM en
`apps/server/src/generated/prisma`, ignorado por Git y reproducido con `pnpm db:generate`.
Las migraciones SQL bajo `apps/server/prisma/migrations` sí se versionan.

# Addendum Paso 11 — inventario y drops

`InventoryOperation` es el ledger idempotente por personaje: guarda `operationId`, hash canonico,
tipo y snapshot JSON para replay/conflicto de equipar, desequipar, favorito, venta y drops.
`InventoryItem.itemData` conserva la `ItemInstance` generada por seed; `generationData` conserva
seed, version de generador, fuente y nivel. `RewardLog.payload` incluye el drop privado y su estado
(`granted`, `no_drop` o `inventory_full`) para que un replay no vuelva a tirar la tabla.
