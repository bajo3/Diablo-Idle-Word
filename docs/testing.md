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

## Convenciones

- Mantener tests deterministas y sin red externa.
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
