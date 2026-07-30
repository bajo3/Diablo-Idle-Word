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
