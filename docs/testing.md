# Estrategia de pruebas

## Paso 1

| Riesgo                              | Capa                     | Evidencia                        |
| ----------------------------------- | ------------------------ | -------------------------------- |
| El servidor no inicia               | Unidad/inyección Fastify | `apps/server/src/app.test.ts`    |
| TypeScript divergente               | Estática                 | `pnpm typecheck`                 |
| Código inválido                     | Estática                 | `pnpm lint`                      |
| Build no reproducible               | Build                    | `pnpm build`                     |
| Cliente/servidor no arrancan juntos | Smoke manual             | `pnpm dev` + HTTP                |
| Compose inválido                    | Infraestructura          | `docker compose config` y health |

## Paso 2

- `pnpm install --frozen-lockfile`: instalación reproducible correcta para los seis workspaces.
- `pnpm format:check`, `pnpm lint` y `pnpm typecheck`: correctos.
- `pnpm test`: 3 archivos y 12 pruebas correctas. Cubre vocabulario de estados, Zod estricto, versiones/campos extra de red, invariantes temporales ausentes, métricas inválidas, compatibilidad de objetos, atributos/habilidades, duplicados, referencias huérfanas, estados de IA, manifest, direcciones/frames y health endpoint consumidor.
- `pnpm build`: compila `shared`, `game-data`, servidor y web.
- Smoke manual: `pnpm dev` respondió HTTP 200 para web y `/health` reportó protocolo 1 y `gameDataVersion` `2026.07.29.1`; los procesos se detuvieron al finalizar.

## Paso 3

- `pnpm install --frozen-lockfile`, `pnpm db:generate`, `prisma format`, `prisma validate`,
  `pnpm format:check`, `pnpm lint`, `pnpm typecheck` y `pnpm build`: exit code 0.
- `pnpm test`: 3 archivos y 12 pruebas correctas. `pnpm test:integration`: 1 archivo y 5 pruebas
  correctas contra PostgreSQL real, sin SQLite, `db push` ni base de producción.
- El harness crea una DB `brecha_test_*`, ejecuta `prisma migrate deploy`, prueba migración vacía,
  seed repetido, aggregate round trip, save V1/rechazo, economía secuencial y concurrente,
  conflicto de hash y rollback; `afterAll` valida el prefijo antes de eliminarla.
- `pnpm db:migrate:deploy` no dejó migraciones pendientes. `pnpm db:seed` se ejecutó dos veces
  manteniendo un único usuario/personaje seed.
- `pnpm db:backup` creó dump custom con SHA-256 y `pnpm db:restore:smoke` verificó/restauró ese
  dump en una DB `brecha_restore_*` efímera sin tocar la fuente.
- Smoke de servidor: `GET /health` devolvió `status: ok`, `protocolVersion: 1` y
  `gameDataVersion: 2026.07.29.1`; se confirmó la limpieza del listener posterior.

## Comandos obligatorios

```text
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm dev
docker compose config
```

## Corrección de auditoría del Paso 3

- `pnpm test`: 4 archivos y 14 pruebas; cubre guards que bloquean host remoto, DB base incorrecta y
  `NODE_ENV=production` en el harness de integración.
- `pnpm test:integration`: 1 archivo y 6 pruebas contra PostgreSQL real. Verifica las doce tablas
  mínimas, CHECKs/FKs/índices críticos, seed doble, aggregate completo, ownership cruzado rechazado,
  save V1/rechazo y economía con recibo inmutable, concurrencia, conflicto y rollback.
- Las migraciones de refuerzo son aditivas: se aplican después de la historia inicial tanto en local
  como desde una DB vacía. No se usa SQLite, `db push` ni una DB productiva.

## Paso 4

- `pnpm test`: valida normalización de email/nombres, límite local de credenciales y una pantalla
  React de acceso/selector con API simulada, además de la regresión del health check.
- `pnpm test:integration`: migra PostgreSQL efímero desde vacío y prueba registro/login no
  enumerable, cookies con sesión hasheada/rotada/revocable, protección de `Origin` + JSON,
  ownership de Guardianes, selección/borrado lógico y WebSocket con sesión válida/inválida.
- El flujo manual mínimo es registrar una cuenta, crear/seleccionar/eliminar un Guardián y confirmar
  que `/ws` sólo acepta la cookie y origen permitidos. Recuperación de sesión al recargar y estados
  de red pertenecen al Paso 5.

## Paso 5

- Cuenta y rutas: logout explícito, actualización de perfil, cancelación/confirmación de borrado,
  estado público y `popstate` de navegación se cubren con UI simulada.
- Conexión y acciones: una mutación offline deja el indicador offline hasta una respuesta exitosa;
  las llamadas concurrentes de la misma acción comparten promesa e invocan el efecto una sola vez.

- UI: `StrictMode` no duplica el bootstrap de sesión y una URL protegida anónima vuelve a la entrada.
- Transporte: las lecturas se reintentan una vez ante fallo transitorio; las mutaciones no tienen
  retry automático; el runner bloquea reentradas y conserva una intención para retry manual.
- Integración: introspecciones concurrentes no emiten `Set-Cookie` ni cambian la fila de sesión;
  `/api/status` permanece accesible y mantenimiento devuelve `503 maintenance` para mutaciones.

## Paso 9 — persistencia y autoridad de interacción del Bosque

- `pnpm test`: 51 archivos y 261 pruebas unitarias/UI, incluyendo el round-trip del envelope V1,
  el contrato V2 de interacción (estado, duración, interrupción, cooldown y resultado), el estado
  no terminal del Guardián derribado y el estado/tick autoritativo de instancia con movimiento
  normalizado, party de cuatro miembros, snapshots/enemigos compartidos y autoridad de combate
  idempotente (cooldown, alcance, Furia, ownership, replay, arco/radio, multiobjetivo,
  self-targeted e impactos diferidos por `impactMs`/`tickOffsetsMs`), además de la FSM/steering y
  ataques server-side de los cinco perfiles de enemigo, cleanup/respawn determinista, objetivos
  server-owned del Bosque (unicidad, rango y réplica a la party) y reanimación autoritativa
  (destinatario persistido, interrupción por daño y finalización idempotente).
- `pnpm test:integration`: 2 archivos y 20 pruebas sobre PostgreSQL efímero, desde migración vacía;
  cubre tabla/backfill, ownership, guardado, revisión obsoleta, ledger idempotente de efectos, ruta
  GET autenticada y los flujos WebSocket de intención, party de dos clientes, snapshots, replay,
  payload no confiable, secuencia obsoleta y un ataque server-side con resultado pendiente/final
  replicado a ambos clientes.
- `pnpm db:generate`, `prisma validate`, `prisma format --check`, `pnpm lint`, `pnpm typecheck` y
  `pnpm build`: correctos. El build conserva sólo el warning conocido del chunk runtime grande de
  Vite; no hay error de compilación.

## Evidencia actual del Paso 14

La recompensa de derrota tiene cobertura de persistencia y transporte: la integracion PostgreSQL
aplica XP/oro/materiales y progreso del Bosque, repite el mismo `operationId` sin duplicar saldos y
rechaza un hash conflictivo; la integracion WebSocket derrota un enemigo en una instancia
autoritativa y recibe `REWARD_GRANTED` con deltas string y `RewardLog` unico. El fixture de enemigo
con vida reducida es exclusivo del arnes y no cambia el catalogo de produccion. Los drops de objetos
siguen fuera de este bloque.

En este corte, la verificacion completa queda en `pnpm test` (53 archivos/268 pruebas) y
`pnpm test:integration` (2 archivos/22 pruebas).

### Presentación de eventos del Paso 14 (2026-08-04)

- `apps/web/src/game/game-events.test.ts` valida `REWARD_GRANTED`, rechaza campos extra/deltas
  negativos y comprueba deduplicación del feed.
- `apps/web/src/game/game-session.test.ts` cubre endpoint `ws/wss`, JSON inválido, límite de
  reconexión y cierre explícito.
- `apps/web/src/game/GameHudOverlay.test.tsx` verifica que loot/notificaciones dinámicos reemplazan
  fixtures, y `GameIsland.test.tsx` conserva ciclo de vida y buffer pre-montaje.
- Ejecución focalizada: `pnpm exec vitest run apps/web/src/game/game-events.test.ts
apps/web/src/game/game-session.test.ts apps/web/src/game/GameHudOverlay.test.tsx
apps/web/src/game/GameIsland.test.tsx` (15/15) y `pnpm --filter @brecha/web typecheck` (0).

`enemy-authority.test.ts` cubre determinismo melee, proyectil con impacto posterior y bloqueo ante
un Guardián derribado. El tick de aplicación avanza la instancia una sola vez por `instanceId`, por lo
que una party de cuatro no multiplica ataques enemigos. Los efectos de área quedan anunciados en la
cola de telégrafos y todavía requieren un evento visual de red para cerrar la presentación.

La reconexión está cubierta por la integración WebSocket de party: el líder se desconecta y vuelve a
recibir `PARTY_SNAPSHOT`/`INSTANCE_SNAPSHOT` autoritativos tanto en lobby como con la instancia
activa; el registro de instancia también prueba que el tick y las interacciones pendientes avanzan
sin un comando nuevo. `traffic-metrics.test.ts` cubre conteo UTF-8, tasas, p95 acotado, reset y
ventanas inválidas. La métrica operativa se consulta con `GET /api/metrics/network` bajo sesión.

## Convenciones

- Mantener tests deterministas y sin red externa.

## Evidencia del Paso 19 — calidad, rendimiento y seguridad (2026-08-04)

- Evidencia del Paso 19 (2026-08-04): `pnpm test` completó 69 archivos y 306 pruebas unitarias/UI;
  `pnpm test:integration` completó 7 archivos y 30 pruebas PostgreSQL, incluyendo ownership,
  transacciones serializables, replay de recompensas/drop, cuatro miembros, lobbies aislados,
  reconexión WebSocket y un modo ausente retomado después de reconstruir el servidor.
- `pnpm typecheck`, `pnpm lint`, `pnpm build` y `pnpm format:check` fueron correctos. La validación de
  assets informó 7 entradas y 848.215 bytes. El rate limiter verifica fail-closed y capacidad
  máxima; el stress harness y Arcade debug quedan gated por `import.meta.env.MODE` en producción.
- El smoke de producción en Chrome/Firefox conserva tres enemigos, cinco sliders de ajustes y no
  publica métricas internas. Los 401 de `/api/auth/session` son la comprobación esperada de sesión
  anónima, no una excepción; Firefox puede mostrar una advertencia de teardown de Phaser al navegar,
  sin `pageerror`, `window.onerror` ni requests fallidos. Diez rutas UI mantuvieron un `main`, botones
  con nombre accesible y campos con `label`/`aria-label`.

## Convenciones (continuaciÃ³n)

- Inyectar reloj, RNG, almacenamiento y transporte cuando aparezcan.
- Evitar sleeps; esperar estados observables.
- Una regresión debe tener una prueba que falle antes del arreglo.
- E2E se reserva para flujos críticos cuando existan pantallas y dominio reales.

## Evidencia de esta sesión

Sesión del 2026-07-29:

- Toolchain: Node `24.15.0`, pnpm `11.9.0`, Docker Engine `29.5.2` y Docker Compose
  `5.1.4`.
- Evidencia histórica del Paso 1: `pnpm install --frozen-lockfile` terminó con exit code 0 para los cuatro proyectos que existían entonces. El Paso 2 verifica seis workspaces.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck` y `pnpm build`: exit code 0.
- `pnpm test`: exit code 0; 1 archivo y 1 prueba pasaron.
- Build web: `190.95 kB` de JavaScript (`60.26 kB` gzip), dentro del presupuesto
  provisional.
- `pnpm dev`: cliente `http://127.0.0.1:5173/` con HTTP 200 y health check
  `http://127.0.0.1:3001/health` con estado `ok`.
- Revisión visual en navegador: título y `h1` correctos, idioma `es`, un único `main`,
  sin desbordamiento horizontal y sin errores ni advertencias de consola.
- `docker compose config --quiet`: exit code 0. PostgreSQL inició y alcanzó estado
  `healthy`; luego se detuvo con `pnpm db:stop`, preservando el volumen local.

No quedaron servidores de desarrollo ni contenedores del proyecto en ejecución.

## Evidencia del Paso 20 — staging y recuperación (2026-08-04)

- `docker-compose.staging.yml` validó con `docker compose ... config --quiet` y construyó las imágenes
  de `migrate`, `server` y `web` desde el lockfile congelado.
- El servicio one-shot aplicó las 12 migraciones y ejecutó el seed idempotente; PostgreSQL, Fastify y
  nginx quedaron `healthy` en los puertos configurables 5433/3002/8080.
- `pnpm staging:smoke` comprobó HTML, favicon, `/health`, protocolo 1, `GAME_DATA_VERSION` y CORS.
- `pnpm staging:backup` creó un dump custom con SHA-256; `pnpm staging:restore:smoke` lo restauró en
  una base efímera, comprobó 12 migraciones y 1 usuario seed y eliminó la base temporal.
- El smoke LAN sobre `192.168.0.154` confirmó que web/API responden fuera de loopback; el smoke
  multiplayer abrió dos sesiones autenticadas, sincronizó una party de dos miembros, creó una
  instancia compartida de dos jugadores y recibió el broadcast de movimiento en ambos WebSockets.
- `pnpm staging:env:check` rechazó el template con placeholders y aceptó fixtures local/TLS con
  secretos sintéticos; la salida sólo mostró hosts y flags, nunca credenciales.
- La batería final (`format:check`, lint, typecheck, 306 tests, 30 tests de integración, build y
  validación de assets) terminó correctamente. Queda pendiente un proveedor real para probar dominio,
  TLS, secretos, CI hospedado y dos clientes desde una red pública.
