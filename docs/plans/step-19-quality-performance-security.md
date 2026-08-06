# Paso 19 — Calidad, rendimiento y seguridad verificables

## Objetivo del usuario

Dejar el juego preparado para sesiones reales: validación y autorización consistentes, protección
contra abuso, recompensas idempotentes, rendimiento medido en cliente y servidor, reconexión segura,
logs útiles y controles internos desactivados en producción.

## Estado actual

El servidor Fastify es autoritativo para party, instancia, combate, enemigos y recompensas. Las
mutaciones HTTP exigen origen permitido, JSON y sesión; el WebSocket exige origen y sesión, valida
cada envelope con Zod, secuencia monotónica y una ventana de 120 comandos por usuario/minuto.
Credenciales usan una ventana de 5 intentos por IP+email. `RewardLog` y los servicios de interacción,
progresión, inventario, pueblo y modo ausente persisten `operationId` + hash para replay idempotente.
El cliente tiene un harness opt-in de 40 enemigos, pools de VFX y métricas de frame/heap.

La auditoría inicial detectó dos ajustes necesarios antes de cerrar el paso:

1. El limiter de credenciales tenía un `Map` sin límite de claves; entradas únicas podían crecer sin
   acotación aunque cada ventana expirase.
2. El query `enemyStress` se podía activar en una build de producción; las herramientas internas no
   deben cambiar el escenario ni publicar métricas fuera de desarrollo.

## Alcance

- Limitar y probar la memoria de los rate limiters.
- Gating de stress/debug exclusivamente a desarrollo.
- Auditar validación, autorización, deduplicación, logs y límites de transporte.
- Medir frame time, heap, entidades, pools de efectos/audio, red y escenarios de cuatro jugadores.
- Verificar reconexión, sesión prolongada, cierre en modo ausente y recuperación de servidor.
- Revisar accesibilidad semántica y foco de las pantallas existentes.
- Registrar evidencia y cerrar únicamente los criterios comprobados en `GOAL.md`.

## Fuera de alcance

- Despliegue/staging, secretos, HTTPS y CI (Paso 20).
- Nuevas mecánicas, zonas o contenido de juego (Pasos 20–21/backlog).
- Cambiar fórmulas de balance o presupuestos sin un perfil comparable.

## Arquitectura afectada

- `apps/server/src/auth/rate-limiter.ts`: ventana fija con capacidad máxima de claves.
- `apps/server/src/app.ts`: límites HTTP/WS, CORS, ownership, snapshots y logs.
- `apps/server/src/persistence/*`: transacciones y ledger durable de operaciones.
- `apps/web/src/game/sim/enemy-stress.ts` y `runtime.ts`: harness de desarrollo.
- `docs/game/performance.md`, `docs/game/multiplayer.md`, `docs/testing.md`: contratos y evidencia.

## Skills requeridas

- `game-architect`: límites entre transporte, dominio y presentación.
- `multiplayer-authority`: validación, ownership, reconexión e idempotencia.
- `save-and-migrations`: ledger durable y recuperación sin duplicar recompensas.
- `performance-2d`: presupuesto de frame, memoria, entidades y pools.
- `automated-playtesting`: pruebas de regresión, integración y smoke.

## Modelo de datos

No hay migración. El limiter es memoria efímera y se reinicia con el proceso. Las recompensas y
operaciones existentes conservan sus IDs, hashes, `RewardLog` y transacciones serializables.

## Flujo de ejecución

Entrada HTTP/WS → origen/sesión → límite de tráfico → Zod estricto → ownership/estado disponible →
regla autoritativa → operación idempotente/transacción → snapshot/evento → métrica acotada/log útil.

## Consideraciones multiplayer

El servidor sigue siendo autoridad. El cliente sólo envía intención; cada conexión mantiene secuencia
monotónica y el estado se recupera desde snapshots al reconectar. Los cuatro jugadores comparten una
instancia y un tick de enemigos. Los rate limiters son por proceso; el Paso 20 deberá sustituirlos por
almacenamiento compartido antes de escalar horizontalmente.

## Consideraciones de persistencia

No se modifica el formato persistente. `RewardLog`, ledgers de interacción/progresión/inventario,
modo ausente y operaciones de pueblo siguen siendo replayables y transaccionales. Reiniciar el
servidor sólo pierde métricas y estado de instancia en memoria, no recompensas ya confirmadas.

## Consideraciones de rendimiento

Se repite el harness `/bruto-preview?enemyStress=40` y el escenario normal con la misma build. Se
registran p50/p95/p99 de frame, p95 de `update`, heap disponible, entidades, ocupación/capacidad de
pools, audio y snapshots. El objetivo provisional es 60 FPS (frame ≤16,67 ms) y no superar los pools
contractuales; los valores dependen del navegador/hardware y no sustituyen perfil de dispositivo bajo.

## Riesgos

- Limiter por proceso no coordina réplicas (alto impacto, baja probabilidad local): documentar como
  requisito de Paso 20 y no presentar el resultado como protección distribuida.
- Heap del navegador no está disponible en Firefox (medio): registrar `unavailable` y usar frame/pools.
- Advertencia de teardown de Firefox al destruir Phaser durante navegación (bajo): comprobar que no
  sea `pageerror`, error de `window` ni request fallido; mantener cleanup idempotente.
- Escenarios largos reales exceden el tiempo de CI (medio): usar pruebas deterministas y smoke con
  estados observables, sin sleeps arbitrarios.

## Decisiones

- 2026-08-04 — Mantener ventana fija, pero con capacidad máxima y rechazo fail-closed de nuevas claves
  para evitar crecimiento de memoria y que rotar identificadores evada el límite. Alternativa descartada:
  eviction de claves activas.
- 2026-08-04 — El stress harness queda gated por `import.meta.env.DEV`; producción conserva sólo la
  escena normal y no publica métricas internas.
- 2026-08-04 — No agregar dependencias de seguridad o APM; la instrumentación acotada existente y
  los tests de integración cubren el objetivo del Paso 19.

## Milestones

1. Auditoría y plan: completado.
2. Correcciones de limiter y gating de herramientas: completado.
3. Perfil cliente/servidor y escenarios multiplayer: completado.
4. Verificación, documentación y cierre del Paso 19: completado.

## Progreso

- [x] Inspeccionar GOAL, reglas, rutas, esquemas, ledgers y harness de rendimiento.
- [x] Hacer bounded el rate limiter y probar fail-closed/ventanas.
- [x] Desactivar el stress harness en producción y agregar regresión.
- [x] Ejecutar suites, mediciones y escenarios de seguridad/rendimiento.
- [x] Actualizar GOAL y documentación con resultados reproducibles.

## Pruebas

```text
pnpm exec vitest run apps/server/src/auth/contracts.test.ts apps/web/src/game/sim/enemy-stress.test.ts
pnpm test
pnpm test:integration
pnpm typecheck
pnpm lint
pnpm build
pnpm format:check
```

El smoke de navegador debe comprobar `/bruto-preview`, `?enemyStress=40`, `/ajustes`, consola,
requests fallidos, dataset de métricas y ausencia de stress en una build de producción.

## Criterios de aceptación

- No existe crecimiento ilimitado de claves en el limiter y los intentos se bloquean por ventana.
- Los comandos no confiables no atraviesan Zod/ownership/estado; las recompensas repetidas no duplican
  moneda, experiencia ni objetos.
- El cliente mantiene el presupuesto provisional en normal y stress; pools y métricas permanecen
  acotados.
- Cuatro jugadores, reconexión, modo ausente y reinicio tienen evidencia automatizada o documentada.
- Las herramientas internas no se activan en producción y los errores operativos conservan contexto.

## Resultados

- `FixedWindowRateLimiter` valida capacidades, elimina entradas expiradas y rechaza nuevas claves
  cuando alcanza 10.000 entradas; 5 pruebas unitarias cubren ventana, fail-closed y argumentos.
- El stress harness y Arcade debug usan `import.meta.env.MODE === 'development'`; la build de
  producción probada con Chrome/Firefox ignoró `enemyStress=40` y mantuvo tres enemigos.
- Logs inesperados incluyen `requestId`, método/URL y contexto de gameplay sin payload. Los ledgers
  existentes conservan hashes/operaciones y las suites cubren replay sin doble recompensa.
- `pnpm test`: 69 archivos/306 pruebas; `pnpm test:integration`: 7 archivos/30 pruebas; typecheck,
  lint, build, assets y formato correctos.
- Perfil Chrome stress (40 enemigos): 600 muestras, frame p50/p95/p99 5,5/5,7/5,8 ms, update p95
  0,3 ms, heap 93.115.695 B, pools dentro de capacidad y audio pico 4. Firefox normal funciona; su
  stress headless p95 27,78 ms y heap no expuesto quedan como riesgo de hardware/driver.
- Smoke de accesibilidad en diez rutas: un `main`, botones con nombre y campos etiquetados. El smoke
  de producción no tuvo `pageerror` ni request fallido con el servidor configurado; los 401 de sesión
  anónima son esperados y Firefox sólo muestra advertencia de teardown al navegar.
- 200 solicitudes locales a `/health`: p50 0,344 ms, p95 0,765 ms, p99 1,080 ms, máximo 28,481 ms.

## Trabajo pendiente

El límite distribuido por proceso, staging/CI y perfiles de dispositivo bajo quedan para el Paso 20.

## Estado

Completado. Las mediciones de Firefox stress y el rate limit distribuido quedan como riesgos
documentados para perfilar hardware y desplegar múltiples réplicas en el Paso 20.
