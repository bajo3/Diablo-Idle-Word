# Staging reproducible

Este entorno no contiene secretos ni crea un dominio. Sirve para validar el mismo artefacto que CI en
una red distinta de localhost cuando el operador proporciona variables y DNS.

## Arranque local aislado

```powershell
Copy-Item deploy/staging.env.example deploy/staging.env
# Editar deploy/staging.env: password y, si aplica, URLs públicas.
pnpm staging:env:check
docker compose --env-file deploy/staging.env -f docker-compose.staging.yml up -d --build
$env:STAGING_WEB_URL='http://127.0.0.1:8080'
$env:STAGING_API_HEALTH_URL='http://127.0.0.1:3002'
$env:STAGING_WEB_ORIGIN='http://127.0.0.1:8080'
pnpm staging:smoke
pnpm staging:multiplayer:smoke
pnpm staging:backup
pnpm staging:restore:smoke
```

`migrate` aplica `prisma migrate deploy` y ejecuta el seed idempotente antes de que `server` quede
healthy. El volumen es `staging_postgres_data`, separado del Compose de desarrollo. Para detenerlo:

```powershell
docker compose --env-file deploy/staging.env -f docker-compose.staging.yml down
```

No usar `down -v` salvo que se quiera destruir expresamente la base de staging.

`pnpm staging:env:check` no imprime secretos y falla si detecta placeholders, contraseña débil,
origen CORS inconsistente o URLs HTTP cuando `STAGING_REQUIRE_TLS=1`. El archivo de ejemplo está
deliberadamente diseñado para fallar esta validación hasta copiarlo a `deploy/staging.env` y completar
los valores administrados por el proveedor.

`pnpm staging:backup` genera un dump custom en `backups/staging/` y su checksum SHA-256. El comando
`pnpm staging:restore:smoke` verifica el checksum, restaura el último dump en una base efímera dentro
del contenedor PostgreSQL, comprueba el historial completo de migraciones y la presencia del usuario
seed, y elimina la base efímera al terminar. El directorio está ignorado por Git.

`pnpm staging:multiplayer:smoke` registra dos usuarios efímeros, crea dos personajes, abre dos
WebSockets autenticados y verifica party, readiness, instancia compartida y broadcast de movimiento.
Ejecutarlo contra una base de verificación y eliminar su volumen al terminar; no usarlo contra
producción.

## TLS y URLs remotas

Con DNS apuntando al host y puertos 80/443 disponibles, configurar `STAGING_WEB_HOST` y
`STAGING_API_HOST` con nombres reales y ejecutar:

```powershell
docker compose --env-file deploy/staging.env -f docker-compose.staging.yml --profile tls up -d
```

Caddy obtiene/renueva certificados y conserva WebSocket mediante `reverse_proxy`. El frontend debe
construirse con `STAGING_API_URL=https://api.<dominio>` y el servidor con
`STAGING_WEB_ORIGIN=https://<dominio>`. Si el proveedor ya termina TLS, no iniciar Caddy: reenviar
`Upgrade`/`Connection` al servicio `server` y usar HTTPS en ambas URLs.

## CI

`.github/workflows/ci.yml` usa PostgreSQL 17 como servicio y ejecuta instalación congelada, formato,
lint, typecheck, migraciones, seed, tests unitarios/integración y build. No imprime `DATABASE_URL` ni
usa secretos del repositorio.

## Operación

El checklist operativo está en [`release-checklist.md`](release-checklist.md).

- API: `GET /health` devuelve protocolo, versión de datos y `status: ok`.
- Estado público: `GET /api/status` exige el `Origin` configurado para comprobar CORS.
- Web: raíz `/` y `/favicon.svg` deben responder 200; nginx reenvía rutas SPA a `index.html`.
- WebSocket: `/ws` usa la misma URL/API, cookie segura y origen público; su autoridad se prueba en
  `pnpm test:integration` con clientes autenticados.
