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

| Entidad                                          | Invariantes durables                                                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `Character`                                      | Oro/materiales `BIGINT`, cuatro atributos no negativos, `lastSeenAt`, save/revision positivos.                             |
| `Inventory` / `InventoryItem`                    | Capacidad/schema versionados; cada instancia tiene owner, rareza, poder, favorito, afijos, generación y cantidad positiva. |
| `Equipment`                                      | Un slot e item por personaje; FK compuesta `(inventoryItemId, characterId)` impide equipar un item ajeno.                  |
| `CharacterSkill` / `CharacterProgress`           | `equipped` coincide con bar slot 0–3 y requiere unlocked; nivel 1–10, versiones/revisiones.                                |
| `AwayCalibration` / `AwaySession` / `AwayResult` | Build/snapshot/rates/versiones, tiempos y resultados auditables; máximo una sesión ACTIVE por personaje.                   |
| `MissionResult`                                  | `operationId` único pero múltiples ejecuciones por misión; dificultad, outcome, progreso y claim versionados.              |
| `RewardLog`                                      | Operación única, hash SHA-256 canónico interno, source/sourceId, deltas y saldos posteriores de oro/materiales/XP.         |

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

## Versionado y Prisma

El save V1 incluye `formatVersion`, `inventorySchemaVersion: 1` y
`awaySnapshotSchemaVersion: 1`; versiones desconocidas se rechazan. `prisma.config.ts` centraliza
schema, migrations, seed y URL. Prisma 7.9.1 genera el cliente ESM en
`apps/server/src/generated/prisma`, ignorado por Git y reproducido con `pnpm db:generate`.
Las migraciones SQL bajo `apps/server/prisma/migrations` sí se versionan.
