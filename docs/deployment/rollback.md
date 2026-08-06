# Rollback y recuperación

El rollback de código y el rollback de datos son operaciones distintas. No se ejecuta `prisma migrate
reset` sobre staging ni se baja una migración automáticamente.

## Antes de publicar

1. Confirmar que el backup tiene `.dump` y `.dump.sha256` y que el hash verifica.
2. Registrar commit, `GAME_DATA_VERSION`, `ProtocolVersion` y número de migración.
3. Ejecutar `pnpm db:restore:smoke` sobre una copia aislada.
4. Guardar el resultado del smoke web/API y el estado de `/health`.

## Rollback de aplicación

1. Marcar `SERVER_STATUS=maintenance` y esperar que terminen operaciones en curso.
2. Detener el servicio web/API o cambiar el proxy a la versión anterior.
3. Volver a desplegar la imagen anterior, sin cambiar la base si el esquema sigue compatible.
4. Ejecutar `GET /health`, `pnpm staging:smoke` y una prueba autenticada de reconexión.
5. Quitar mantenimiento y observar logs/metrics antes de reabrir tráfico.

## Recuperación de datos

Sólo si la versión anterior no puede leer el estado actual:

1. Mantener el proxy en mantenimiento y tomar un backup del estado actual.
2. Restaurar el backup aprobado en una base nueva, nunca sobre la única copia.
3. Verificar checksum, `_prisma_migrations`, conteos y `pnpm db:restore:smoke`.
4. Cambiar `DATABASE_URL` al restore verificado y reiniciar el API.
5. Ejecutar health, smoke y una consulta de progreso/inventario; registrar el incidente.

Las migraciones nuevas deben ser aditivas y compatibles durante el despliegue. Si una migración es
irreversible, requiere backup probado, ventana de mantenimiento y un plan de migración hacia adelante;
el rollback de imagen por sí solo no revierte sus efectos.
