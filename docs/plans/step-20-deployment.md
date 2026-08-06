# Paso 20 — Staging, despliegue y recuperación reproducibles

## Objetivo del usuario

Dejar el juego listo para validarse fuera de localhost con un entorno de staging reproducible,
cliente web, API Fastify, WebSocket, PostgreSQL, migraciones, seed controlado, backups, health checks,
CI y un procedimiento explícito de rollback/recuperación.

## Estado actual

El monorepo tiene seis workspaces pnpm, build de producción para web/servidor, Prisma 7, Docker Compose
local para PostgreSQL, migraciones SQL versionadas y scripts de backup/restore smoke. `apps/server`
escucha en `SERVER_HOST/SERVER_PORT`, usa `APP_ORIGIN` para CORS y cookies seguras en `NODE_ENV=production`.
El cliente Vite fija `VITE_API_URL` durante build. No existían imágenes de producción, compose de
staging, proxy TLS ni workflow CI versionado.

## Alcance

- Compose de staging aislado con PostgreSQL, migrator/seed one-shot, API y frontend estático.
- Dockerfiles reproducibles para Node 24 y nginx, configuración SPA y health checks.
- Plantilla de variables sin secretos, configuración de CORS/API/orígenes y perfil TLS opcional con Caddy.
- Smoke de staging para HTML, favicon, health/protocolo y API configurable.
- Workflow CI con instalación congelada, formato, lint, typecheck, pruebas, integración PostgreSQL y build.
- Documentación de migraciones, seed, backup, rollback, recuperación y checklist de publicación.

El flujo de partida guarda el snapshot de progresión al volver al Pueblo; esto queda cubierto por la
misma ruta autenticada antes de compartir el staging con testers.

## Fuera de alcance

- Crear una cuenta de cloud, dominio, certificados reales o secretos del usuario.
- Desplegar automáticamente a producción desde este entorno local.
- Cambiar el esquema Prisma, fórmulas de balance o el protocolo de juego.

## Arquitectura afectada

```text
Browser ──HTTPS──> Caddy (perfil tls, opcional)
   │                  ├──> nginx/web (SPA estática)
   └──HTTPS/WS────> Fastify/server ──> PostgreSQL
                         ▲
              migrate/seed one-shot antes de servir
```

El servidor conserva autoridad de sesión, gameplay, comercio, recompensas y guardado. El frontend
recibe `VITE_API_URL` en build; `APP_ORIGIN` debe coincidir exactamente con el origen público. Caddy
termina TLS y reenvía WebSocket sin cambiar el protocolo.

## Skills requeridas

- `game-architect`: límites entre web, API, DB y proxy.
- `multiplayer-authority`: CORS, cookies, WebSocket y dos clientes remotos.
- `save-and-migrations`: migraciones, seed, backup, restore y rollback.
- `automated-playtesting`: CI y smoke reproducible sin secretos.

## Archivos relevantes

- `docker-compose.staging.yml`: servicios y dependencias de staging.
- `deploy/Dockerfile.server`, `deploy/Dockerfile.web`: imágenes reproducibles.
- `deploy/nginx/staging.conf`, `deploy/Caddyfile`: SPA y TLS opcional.
- `deploy/staging.env.example`: configuración pública/documentada sin credenciales reales.
- `.dockerignore`, `.github/workflows/ci.yml` (incluye validación de contrato de staging),
  `scripts/staging-smoke.mjs`,
  `scripts/staging-multiplayer-smoke.mjs`, `scripts/validate-staging-env.mjs`.
- `docs/deployment/staging.md`, `docs/deployment/rollback.md`, `README.md`.

## Modelo de datos y persistencia

No se cambia el modelo. El servicio `migrate` ejecuta `prisma migrate deploy`; `seed` corre después,
una sola vez por arranque del stack, y es idempotente por IDs estables. Los backups se generan fuera
del contenedor con SHA-256 y el restore smoke usa una base `brecha_restore_*` efímera. Un rollback de
aplicación no revierte migraciones automáticamente: primero se detiene el tráfico, se restaura backup
si corresponde y sólo se aplica una migración hacia adelante compatible.

## Seguridad y multiplayer

Las cookies son `Secure` en producción; CORS acepta sólo `APP_ORIGIN`, el proxy conserva `Upgrade` y
`Connection` para WS, y no se exponen secretos al cliente. El smoke remoto valida health/API; los dos
clientes y la autoridad de gameplay siguen cubiertos por integración PostgreSQL/WebSocket.

## Rendimiento y operación

El health check de API usa `/health` y el de nginx `/`; el contenedor de migración debe completar antes
de iniciar la API. Los puertos host son configurables (`STAGING_WEB_PORT`, `STAGING_API_PORT`,
`STAGING_DB_PORT`) para coexistir con desarrollo. Caddy sólo se habilita con el perfil `tls` y dominios
reales; sin ello, staging local usa HTTP explícito.

## Decisiones

- 2026-08-05 — Compose separado del entorno local para no mezclar volúmenes ni puertos; alternativa
  descartada: sobrecargar `docker-compose.yml` con perfiles ambiguos.
- 2026-08-05 — Migración y seed son un servicio one-shot dependiente de DB healthy; alternativa
  descartada: ejecutar seed dentro del proceso HTTP en cada request/restart.
- 2026-08-05 — Caddy es perfil opcional de TLS; no se inventan dominios/certificados. Sin un dominio
  real no se puede afirmar HTTPS remoto, pero la ruta reproducible queda documentada.
- 2026-08-05 — CI usa PostgreSQL de servicio y los mismos comandos locales; no se agregan proveedores
  cloud ni secretos.

## Milestones

1. Auditoría y plan: completado.
2. Artefactos staging/TLS/CI: completado.
3. Migración, seed, health, backup y smoke: completado en staging local reproducible.
4. Verificación completa, documentación y cierre: parcial; falta ejecutar CI en un proveedor y
   validar dos clientes desde una red pública con dominio, TLS y secretos reales.

## Progreso

- [x] Auditar manifiestos, entrada Fastify, Vite, Prisma, Compose y backup/restore.
- [x] Crear imágenes y compose staging aislado.
- [x] Añadir plantillas de entorno, proxy, health checks y smoke.
- [x] Añadir smoke de dos sesiones autenticadas por WebSocket.
- [x] Añadir validación de placeholders, secretos, CORS y TLS del entorno.
- [x] Añadir CI y checklist de publicación/rollback.
- [x] Ejecutar validaciones y actualizar `GOAL.md`.

## Pruebas

```text
docker compose -f docker-compose.staging.yml --env-file deploy/staging.env.example config --quiet
pnpm staging:env:check
pnpm staging:smoke
pnpm staging:backup
pnpm staging:restore:smoke
pnpm db:migrate:deploy
pnpm db:seed
pnpm db:backup
pnpm db:restore:smoke
pnpm test
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

CI debe ejecutar además el workflow en `.github/workflows/ci.yml` con PostgreSQL de servicio. Los
smokes no deben imprimir `DATABASE_URL`, passwords, cookies ni tokens.

## Criterios de aceptación

- Compose de staging valida y arranca DB/API/web con migración y seed controlados.
- HTML, favicon, `/health`, versión de protocolo, CORS y WebSocket son comprobables con URLs configuradas.
- CI reproduce instalación, pruebas y build desde cero sin secretos.
- Backup, checksum, restore aislado y rollback están documentados y probados.
- Se explicita qué parte queda pendiente por falta de dominio/certificado/infraestructura externa.

## Resultados

- `docker compose --env-file deploy/staging.env.example -f docker-compose.staging.yml config --quiet`: OK.
- Perfil TLS/Caddy: `docker compose ... --profile tls config --quiet`: OK con hosts de verificación;
  certificados reales no se solicitan sin dominio público.
- Build de imágenes `server`, `migrate` y `web`: OK; Prisma Client generado y build web/server completado.
- Staging local: PostgreSQL healthy, 12 migraciones reproducibles, seed idempotente, API y nginx healthy.
- `pnpm staging:smoke`: OK (`/`, favicon, `/health`, protocolo 1, `gameDataVersion` 2026.08.04.4 y CORS).
- `pnpm staging:backup`: OK; dump custom con SHA-256 guardado en `backups/staging/` (ignorado por Git).
- `pnpm staging:restore:smoke`: OK; restauración efímera verificó 12 migraciones y 1 usuario seed.
- Smoke LAN contra `192.168.0.154`: web 200, API healthy, CORS correcto y
  `pnpm staging:multiplayer:smoke` verificó dos usuarios autenticados, party de 2 miembros, instancia
  compartida de 2 jugadores y broadcast de movimiento por WebSocket.
- `pnpm staging:env:check`: rechazó el template inseguro y aceptó configuraciones controladas local y
  TLS con URLs HTTPS coherentes; no imprimió passwords ni `DATABASE_URL`.
- Suite del repositorio: `pnpm test` 69 archivos/306 tests, integración 7 archivos/30 tests, además de
  `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build` y `pnpm validate:assets`: todo OK.
- Advertencia conocida: Vite informa que el chunk runtime supera 500 kB; no bloquea el despliegue.

## Trabajo pendiente

El despliegue público real y la prueba con usuarios desde redes externas requieren un proveedor,
dominio, DNS, certificados y secretos suministrados por el propietario del proyecto; no se inventan
durante esta sesión. El acceso LAN ya está verificado. Tras recibirlos, ejecutar el checklist sin
modificar el contrato de juego. El repositorio no tiene un remote Git configurado, por lo que el
workflow no puede observarse en un proveedor CI desde este workspace.

## Estado

[-] Implementación local completa. Queda pendiente infraestructura externa para dos usuarios desde
redes públicas, certificados/secretos reales y una ejecución observada del workflow en GitHub Actions.
