# Checklist de publicación — La Brecha Oscura

Usar esta lista en cada publicación de staging o producción. Guardar los resultados y el commit
desplegado junto al incidente o registro de release; nunca pegar secretos en ellos.

## Preflight

- [ ] Confirmar commit, `GAME_DATA_VERSION` y `ProtocolVersion`.
- [ ] Confirmar que `deploy/staging.env`/los secretos del proveedor no contienen valores de ejemplo.
- [ ] Confirmar `STAGING_API_URL`, `STAGING_WEB_ORIGIN` y `APP_ORIGIN` con el origen público exacto.
- [ ] Ejecutar `pnpm staging:env:check` contra el archivo de secretos real.
- [ ] Confirmar que el proveedor termina TLS o habilitar el perfil Caddy con DNS y puertos 80/443.
- [ ] Ejecutar `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm test:integration`.
- [ ] Ejecutar `pnpm build` y `pnpm validate:assets`.

## Base y aplicación

- [ ] Crear `pnpm staging:backup` y verificar el `.sha256`.
- [ ] Ejecutar `pnpm staging:restore:smoke` sobre el dump recién creado.
- [ ] Levantar `docker compose --env-file deploy/staging.env -f docker-compose.staging.yml up -d --build`.
- [ ] Confirmar migraciones y seed en los logs del servicio `migrate`.
- [ ] Confirmar estado healthy de `postgres`, `server` y `web`.
- [ ] Ejecutar `pnpm staging:smoke` con las URLs públicas configuradas.
- [ ] Ejecutar `pnpm staging:multiplayer:smoke` con dos clientes/usuarios de prueba aislados.
- [ ] Abrir dos clientes autenticados y comprobar party, combate, WebSocket y aislamiento de lobby.
- [ ] Activar, reiniciar y reclamar modo ausente; verificar que el progreso no depende del proceso cliente.

## Después de publicar

- [ ] Revisar `/health`, logs estructurados, errores de WebSocket y métricas de latencia.
- [ ] Confirmar que no se registran contraseñas, cookies, tokens ni `DATABASE_URL`.
- [ ] Mantener el backup aprobado y el identificador de imagen anterior para rollback.
- [ ] Si falla la aplicación, seguir [`rollback.md`](rollback.md); no ejecutar `prisma migrate reset`.

## Evidencia mínima

Registrar fecha/hora UTC, commit, imagen, URLs (sin credenciales), resultado de cada comando y cualquier
criterio no verificable por falta de infraestructura externa.
