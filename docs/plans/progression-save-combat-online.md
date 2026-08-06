# Guardado de progreso, combate legible y preparación online

## Objetivo del usuario

Conservar la experiencia/nivel del personaje, guardar al volver al Pueblo en cualquier momento,
evitar que los enemigos sean empujados por los golpes y mostrar un proyectil de flecha para el
Arquero poseído. Dejar el flujo listo para pruebas online con amigos sin guardar secretos ni
afirmar un despliegue público que todavía depende de proveedor, dominio y TLS reales.

## Estado actual

- `EnemyRewardService` ya aplica XP, oro, materiales y drops por enemigo en una transacción
  serializable, deduplicada por `operationId`/`enemyId`.
- `GameIsland` obtiene el snapshot de progresión al entrar, pero el botón PUEBLO navegaba sin
  ejecutar el checkpoint.
- El checkpoint V1 sólo guardaba una coordenada fija y no exponía el snapshot de XP/progresión.
- El runtime local mostraba el proyectil del arquero como un círculo naranja y la habilidad
  `powerStrike` tenía `knockbackPx`, por lo que alejaba a los enemigos.
- Staging, Docker, CORS, health checks, backups y CI ya existen en `docs/plans/step-20-deployment.md`.

## Alcance

- Guardado idempotente al entrar al Pueblo con snapshot server-side de progresión y Bosque.
- Barra/contador visible de XP ganada durante la sesión local, sin convertirla en autoridad online.
- Mantener XP por mob en servidor y documentar su deduplicación.
- Retirar el knockback de la configuración jugable del Guardián, manteniendo las primitivas puras
  disponibles para otras habilidades futuras.
- Dibujar la flecha del Arquero como un objeto pooled, orientado según la dirección autoritativa.
- Actualizar documentación, GOAL y checklist de staging para compartir una build de prueba.

## Fuera de alcance

- No aceptar XP, daño, posición ni estado enviados por el navegador.
- No crear proveedor cloud, dominio, DNS, certificados ni secretos reales.
- No convertir la vista `/bruto-preview` offline en una partida persistente: sirve como vitrina; la
  persistencia real requiere sesión autenticada y PostgreSQL.
- No cambiar la curva de balance ni mezclar XP del Bosque con XP del personaje.

## Arquitectura afectada

```text
Derrota server-side -> EnemyRewardService (transacción/idempotencia)
                    -> CharacterProgress + RewardLog + REWARD_GRANTED

PUEBLO -> GameIsland checkpoint -> CheckpointService (ownership + snapshot V2)
       -> CharacterCheckpointReceipt

Runtime Phaser -> presentación de flecha/feedback; no decide daño ni XP online
```

## Skills requeridas

- `game-architect`: límites entre runtime, API, servidor y persistencia.
- `save-and-migrations`: envelope versionado, atomicidad y replay del checkpoint.
- `combat-system`: knockback y proyectil separados de presentación.
- `enemy-and-dungeon-generator`: ataque ranged y limpieza de proyectiles.
- `multiplayer-authority`: XP y posición siguen siendo server-side.
- `automated-playtesting`: regresiones y smoke local/staging.

## Modelo de datos y persistencia

No se agrega una columna: `CharacterCheckpointReceipt.serverState` sigue siendo JSON, pero el
payload pasa a `saveVersion: 2` e incluye `progression` y `forestProgress` validados/derivados del
servidor. La operación continúa siendo `schemaVersion: 1`, idempotente por `operationId`; los
reintentos devuelven el recibo original. El `RewardLog` y `CharacterProgress` siguen siendo la
fuente durable de la XP; el checkpoint sólo registra el estado observado al salir.

## Consideraciones multiplayer

El servidor deriva ownership, XP, nivel, oro, materiales y estado del Bosque. El cliente sólo envía
la intención de checkpoint y el botón PUEBLO no puede aportar coordenadas ni recompensas. La
preparación online usa el compose de staging existente y exige `APP_ORIGIN`, cookie segura, CORS y
WebSocket sobre HTTPS antes de compartirlo públicamente.

## Milestones

- [x] Crear plan y auditar el flujo actual.
- [x] Guardar snapshot server-side al entrar al Pueblo y probar replay.
- [x] Mostrar XP de sesión y mantener XP por mob autoritativa.
- [x] Eliminar knockback jugable de `powerStrike` y agregar regresión.
- [x] Renderizar flecha ranged con pool y conservar limpieza/impacto.
- [x] Ejecutar tests, typecheck, lint, build y documentar staging.

## Trabajo pendiente

- Ejecutar `docs/deployment/staging.md` con una contraseña administrada y, para acceso externo,
  dominio/DNS/TLS reales.
- Conectar el runtime a comandos WebSocket de movimiento/combate como siguiente hito online; la
  autoridad server-side ya está cubierta por los contratos existentes.

## Resultados

- `CheckpointService` guarda `saveVersion: 2`, `lastSeenAt`, revisión, progresión y Bosque en la
  misma transacción; los reintentos de `operationId` devuelven el recibo existente.
- PUEBLO dispara `checkpointId: town:entry` antes de navegar; el runtime conserva un contador de
  EXP de sesión visible y la XP autoritativa por mob sigue en `EnemyRewardService`/`RewardLog`.
- `powerStrike` ya no tiene `knockbackPx` en el catálogo jugable; la regresión web y la autoridad
  server-side verifican que las posiciones de los mobs permanezcan estables.
- El proyectil del Arquero usa un pool de polígonos con forma de flecha y rotación derivada de la
  dirección pura del proyectil; el impacto y el cleanup no cambian.
- Verificación: `pnpm test` (70 archivos, 319 tests), `pnpm test:integration` (7 archivos, 30 tests),
  `pnpm typecheck`, `pnpm lint`, `pnpm build`, Prettier focalizado, `git diff --check` y smoke HTTP
  200 en web raíz, `/bruto-preview` y `/health`.
