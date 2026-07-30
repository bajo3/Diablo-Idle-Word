# Paso 6 — partida local Phaser aislada y checkpoint autoritativo

## Objetivo del usuario

Permitir abrir una partida local protegida con un Guardián provisional controlable, renderizada por
Phaser sin acoplarse a React ni a la API, y registrar un checkpoint mínimo que el servidor valida.

## Arquitectura y decisiones

React conserva rutas, autenticación y HUD. `GameIsland` monta un único runtime Phaser mediante un
bridge con comandos pequeños (`pause`, `resume`, `destroy`, `setConnection`) y snapshots de HUD.
Las escenas no importan React, API ni Prisma. El endpoint recibe únicamente una intención V1; el
servidor deriva posición/configuración y persiste una recepción idempotente en su propia tabla.

Se usará Phaser `3.90.0` fijado: es la última línea 3.x compatible con Arcade Physics, mientras
Phaser 4.2.1 implicaría una API/migración no necesaria para este paso. Placeholders locales SVG
versionados evitan dependencia de arte externo y su manifiesto conserva dimensiones y procedencia.

## Alcance

- Ruta protegida `/partida`, runtime de ciclo de vida seguro y escenas Boot/Test.
- Movimiento local 8 direcciones, colisiones, cámara, mouse facing, HUD y pausa.
- FSM visual pura, catálogo de cuatro direcciones y capas sincronizadas.
- Manifiesto, cargador y validador de assets placeholder.
- Herramientas DEV y pruebas de ciclo de vida, movimiento, pipeline y rutas.
- Checkpoint V1 idempotente, migración Prisma e integración PostgreSQL.

## Fuera de alcance

Combate, daño, recompensas, guardar en unload, coordenadas aportadas por cliente, red de partida,
Phaser 4 y cualquier funcionalidad del Paso 7.

## Progreso

- [x] Inspección, límites y decisión de dependencia.
- [x] Runtime, assets, persistencia y pruebas completados.
- [x] Matriz final y documentación de resultados.

## Riesgos

- Canvas no disponible en jsdom: el runtime se inyecta y las reglas puras se prueban sin Phaser.
- Cliente hostil: el checkpoint no acepta posición, recompensa ni configuración del cliente.
- Remontajes React: el bridge destruye idempotentemente y la instancia se guarda por elemento.

## Pruebas previstas

FSM/movimiento/validación de manifest; montaje/desmontaje repetido con factory inyectable; ruta
protegida/pública; integración de checkpoint válido, replay, conflicto, ownership, selección,
disponibilidad, mantenimiento y concurrencia.

## Resultados

2026-07-29: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (11 archivos, 34
pruebas), `pnpm test:integration` (2 archivos, 13 pruebas PostgreSQL) y `pnpm build` finalizaron
con exit code 0. La integración verifica checkpoint seleccionado, replay concurrente, conflicto y
rechazo de estado espacial cliente. El runtime Phaser queda en un chunk diferido de 320.55 kB gzip:
no se carga en la pantalla de cuenta, pero requiere presupuesto/perfil real en navegador antes de
aumentar densidad. El smoke visual headless no es viable en jsdom sin canvas nativo.

Completado 2026-07-29: `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`,
`pnpm typecheck`, `pnpm test` (13 archivos, 41 pruebas), `pnpm test:integration` (2 archivos,
13 pruebas PostgreSQL), `pnpm build`, `pnpm db:migrate:deploy`, `pnpm db:seed` dos veces y
backup/restore con SHA-256 finalizaron con exit code 0. La suite web cubre 20 ciclos StrictMode sin
canvas residual, single-flight de checkpoint con reintento de la misma intención, pausa por
visibilidad sin deshacer una pausa manual, capas/animaciones alineadas, frames post-carga y debug
Arcade desactivado en producción. El smoke real en navegador montó un único canvas de 960 × 540,
renderizó las capas y obstáculos sin errores ni warnings, verificó HUD, pausa/reanudación y un ciclo
de desmontaje/remontaje con conteos de canvas `1 → 0 → 1`. El proxy y harness usados para aislar la
política de puertos del navegador se retiraron al terminar.
