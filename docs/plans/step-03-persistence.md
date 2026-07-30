# Paso 3 — Persistencia autoritativa versionada

## Objetivo del usuario

Persistir personajes y economía en PostgreSQL sin acoplar el dominio a Prisma, preservando
ownership, versionado, idempotencia, backups de desarrollo y una ruta verificable de recuperación.

## Estado actual

Los Pasos 1 y 2 aportaron monorepo, servidor Fastify y contratos Zod. Este paso añade PostgreSQL
real mediante Prisma 7.9.1 y conserva el cliente generado fuera de control de versiones.

## Alcance

- Schema, migración SQL y seed explícito e idempotente.
- Repositorio de agregado de personaje y servicio de economía serializable con recibo durable.
- Contratos/DTO propios, migrador de save V1 y pruebas reales con DB aislada.
- Backup/restore exclusivamente local de desarrollo.

## Fuera de alcance

Autenticación, endpoints de personajes, gameplay, cálculo/reclamo completo de modo ausente,
multiplayer y cambios del Paso 4 en adelante.

## Arquitectura afectada

`apps/server/src/persistence/contracts.ts` es el límite de aplicación; no importa Prisma.
`database.ts` crea el adaptador PostgreSQL y repositorios/servicios son los únicos consumidores
del cliente generado. `@brecha/shared` continúa libre de infraestructura.

## Skills requeridas

`game-architect`, `save-and-migrations`, `idle-progression`, `multiplayer-authority` y
`automated-playtesting`: separan el agregado y su migración, modelan resultados idle auditables,
protegen monedas contra replay y verifican la implementación con PostgreSQL real.

## Modelo de datos

La especificación y restricciones están en [data-model.md](../data-model.md). `saveVersion=1`,
inventario/snapshot versionados y `revision` aparecen en todo agregado durable. Oro, materiales y
experiencia son `BIGINT`.

## Flujo de ejecución

Intención autenticada futura → caso de uso con actor → verificación de ownership → transacción
Serializable → saldo/revisión + `RewardLog` único → recibo durable. Reintentos devuelven el mismo
recibo persistido si conservan la operación canónica.

## Consideraciones multiplayer

El cliente nunca aporta saldo, recompensa final, hash ni ownership. `operationId` es la clave de
replay; el hash interno evita reutilizarla para un payload distinto. Aún no existe transporte ni autenticación:
los callers futuros deben derivar `actorUserId` de sesión, no del request sin validar.

## Consideraciones de persistencia

Formato mínimo admitido: save V1, con versiones de inventario y snapshot idle. `migrateCharacterSave`
acepta solamente V1 y rechaza versiones desconocidas; al agregar V2 se añadirá un migrador secuencial V1→V2 con fixture. Migrations se
aplican con `prisma migrate deploy`, nunca `db push`.

Backup local: `pnpm db:backup` sólo acepta `localhost`/`127.0.0.1` y `brecha_oscura`, crea un dump
custom en `backups/dev` y SHA-256. `pnpm db:restore:smoke` verifica ambos, restaura sólo a una DB
nueva `brecha_restore_*`, consulta Prisma y la elimina con guardas. No opera producción.

## Riesgos

- Sin autenticación todavía, los handlers futuros deben enlazar identidad de sesión antes de llamar
  repositorios. Señal: acceso directo desde HTTP; mitigación: Paso 4.
- JSON extensible requiere schemas de caso de uso al introducir payloads. Señal: payload ambiguo;
  mitigación: contratos Zod versionados.
- Restore se valida contra Docker local, no contra un proceso de desastre remoto. Señal: cambio de
  plataforma; mitigación: añadir runbook de despliegue cuando exista entorno no local.

## Decisiones

- 2026-07-29: Prisma 7.9.1 con `prisma-client`, output explícito y `@prisma/adapter-pg`; se evita
  el generador implícito/dependiente de versiones previas.
- 2026-07-29: cliente generado ignorado; `db:generate` es requisito reproducible antes de build y
  typecheck.
- 2026-07-29: migraciones aditivas refuerzan constraints/ownership sin reescribir la migración inicial.
- 2026-07-29: `RewardLog.operationId` global único + hash canónico interno + balances posteriores,
  en vez de confiar en retries de red, hash aportado por cliente o last-write-wins.

## Progreso

- [x] Schema PostgreSQL y migración inicial versionada.
- [x] Seed explícito, idempotente y verificable.
- [x] Contratos, repositorio de agregado y migrador V1/rechazo de versión desconocida.
- [x] Economía serializable con ledger, hash interno, recibo inmutable y retries de concurrencia.
- [x] Harness de integración `brecha_test_*`, seed doble y rollback probado.
- [x] Backup y restore smoke local con hash y guardas de nombre.
- [x] Matriz final: instalación frozen, formato, lint, tipos, unidades, integración, build, migración,
      seed, backup/restore y health del servidor verificados el 2026-07-29.

## Pruebas

`pnpm test:integration` crea una base PostgreSQL vacía `brecha_test_*`, usa exclusivamente
`prisma migrate deploy`, prueba seed dos veces, round trip completo, save V1/rechazo, replay de
recibo tras operaciones posteriores, concurrencia, conflicto payload/source, rollback y FKs/checks.
La limpieza se ejecuta en `afterAll` y sólo elimina la DB efímera validada.

## Criterios de aceptación

- Migración desde DB vacía y seed repetido correctos.
- Personaje creado y recuperado sólo por su owner.
- Una operación económica repetida no duplica oro; hash divergente se rechaza.
- Backup y restore verifican integridad sin tocar la DB origen.

## Resultados

El 2026-07-29 finalizaron con exit code 0: `pnpm install --frozen-lockfile`, `pnpm db:generate`,
`prisma format`, `prisma validate`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`
(4 archivos, 14 pruebas), `pnpm test:integration` (1 archivo, 6 pruebas), `pnpm build`, `pnpm
db:migrate:deploy`, dos ejecuciones de `pnpm db:seed`, `pnpm db:backup` y `pnpm
db:restore:smoke`. El endpoint `http://127.0.0.1:3001/health` devolvió `status: ok`, protocolo 1 y
la versión de datos esperada durante el smoke; no se dejó listener de desarrollo al terminar.

## Trabajo pendiente

Paso 4 debe aportar autenticación y endpoints que traduzcan sesión a `actorUserId`; no se adelanta
en este paso.
