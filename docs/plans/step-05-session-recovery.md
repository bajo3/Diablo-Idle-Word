# Paso 5 — sesión recuperable y estado de conexión

## Objetivo del usuario

La aplicación web puede restaurar de forma segura la identidad tras recargar, informar el estado
del servicio y permitir que una persona vuelva a intentar una operación sin duplicar mutaciones.

## Estado actual

El Paso 4 entrega cookie de sesión opaca, perfiles y Guardianes protegidos. Este paso añade sólo
el ciclo de vida web: no crea gameplay, economía ni contratos de partida.

## Alcance

- Estados discriminados de sesión y arranque de vuelo único.
- Introspección `GET /api/auth/session` sin rotación.
- Rutas `/`, `/guardianes` y `/estado`; la ruta de Guardianes exige sesión.
- Transporte HTTP con timeout, abort, clasificación y reintento limitado sólo para lecturas.
- Estado público `/api/status`, modo mantenimiento y exclusión de mutaciones protegidas.
- Guard de acciones concurrentes e intención reutilizable para reintentos manuales.
- Pruebas de UI, transporte, servicio e integración PostgreSQL.

## Fuera de alcance

Partidas, WebSocket de juego, recuperación de contraseña, cola offline, reintento automático de
mutaciones y nuevos endpoints económicos. El cierre del navegador es un estado desconocido para
el cliente: no se envía logout ni se altera el personaje.

## Arquitectura afectada

`apps/web/src/session.ts` orquesta estado de sesión sin conocer React UI. `api.ts` delimita HTTP y
clasifica fallos; `action-runner.ts` evita reentradas. `App.tsx` sólo renderiza los estados y las
rutas. En servidor, `app.ts` expone disponibilidad y aplica mantenimiento antes de los casos de
uso mutables; el servidor mantiene la autoridad sobre perfil y personajes.

## Skills requeridas

- `game-architect`: límites entre pantalla, sesión, HTTP y servidor.
- `multiplayer-authority`: evitar que reintentos del cliente dupliquen estado autoritativo.
- `automated-playtesting`: pruebas de StrictMode, recuperación, fallos y mutaciones.

## Modelo de datos y persistencia

No hay migración ni modificación de datos. Las sesiones existentes continúan con expiración y
revocación del Paso 4; consultar una sesión no crea, rota ni revoca una fila.

## Flujo de ejecución

Carga web → una consulta concurrente de estado e identidad → mantenimiento, anónimo, autenticado o
error recuperable. La identidad autenticada consulta Guardianes. Una lectura puede repetirse una
vez sólo tras `offline`, `timeout` o `unreachable`; una mutación no se reintenta automáticamente.
La persona decide reintentar con el mismo `operationId` o iniciar una intención nueva.

## Consideraciones multiplayer y rendimiento

No hay partida multiplayer todavía. El servidor es la fuente de disponibilidad y de los DTOs. El
arranque coalescido evita peticiones duplicadas bajo React StrictMode; no se agrega trabajo por
frame, listeners persistentes ni polling.

## Decisiones

- 2026-07-29: la sesión se introspecciona sin rotar la cookie para que solicitudes concurrentes no
  invaliden unas a otras. Login y registro conservan la rotación del Paso 4.
- 2026-07-29: `navigator.onLine` sólo evita una petición evidentemente offline; la disponibilidad
  efectiva se confirma con `/api/status`.
- 2026-07-29: mantenimiento no impide salud, estado, registro, login o logout; bloquea operaciones
  protegidas que cambian estado.

## Progreso

- [x] Estados, navegación, introspección, errores de red y acción de vuelo único implementados.
- [x] Estado público, modo mantenimiento y pruebas de servidor implementados.
- [x] Matriz completa ejecutada y evidencia registrada.

## Pruebas

- UI: StrictMode inicia una única restauración y bloquea la ruta protegida anónima.
- Transporte: reintento de lecturas y ausencia de retry automático de mutaciones.
- Integración: dos introspecciones simultáneas devuelven 200, no envían cookie y no alteran la
  sesión; mantenimiento devuelve 503 para mutaciones y mantiene `/api/status` público.
- Matriz final: instalación congelada, formato, lint, typecheck, unitarias, integración, build y
  migración/seed.

## Criterios de aceptación

La recarga conserva una sesión válida sin flicker a una pantalla anónima; una caída muestra un
error recuperable; una mutación no se duplica desde el cliente; `/estado` refleja mantenimiento y
los Guardianes no muestran acciones incompatibles con su disponibilidad.

## Resultados

Auditoría final 2026-07-29, exit code 0: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`,
`pnpm test` (10 archivos, 32 pruebas), `pnpm build` y `pnpm test:integration` (2 archivos, 12
pruebas PostgreSQL). `pnpm db:migrate:deploy` no encontró migraciones pendientes y `pnpm db:seed`
se ejecutó dos veces de forma idempotente. Las nuevas pruebas comprueban logout explícito, edición
de perfil, cancelación/confirmación única de borrado, estado offline recuperable, router `popstate`
y promesa única por acción.

## Trabajo pendiente

Paso 6 integrará Phaser; no forma parte de este plan.
