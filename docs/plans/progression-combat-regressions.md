# Progresión local y combate sin kite — corrección de regresiones

## Objetivo del usuario

La expedición de prueba debe acreditar la experiencia de los enemigos derrotados, mostrar el nivel y
los puntos disponibles, permitir asignar atributos y mantener a los enemigos en su posición de
combate sin retroceder automáticamente.

## Estado actual

El servidor ya tiene `ProgressionService` y `EnemyRewardService`, pero `/bruto-preview` funciona sin
sesión y sólo acumulaba un contador visual (`experienceEarned`). Ese contador no alimentaba una hoja
de personaje ni podía entregar puntos de atributo. Además, el adaptador local derivaba
`keepDistance` desde `ranged`, por lo que arqueros y chamanes se alejaban al acercarse el Guardián.

## Alcance

- Añadir una progresión local versionada para la preview, persistida en `localStorage`.
- Aplicar XP de cada enemigo derrotado a nivel, XP de nivel y puntos de atributo.
- Exponer una hoja local de personaje desde la partida y permitir asignar atributos.
- Mantener `keep_distance` como capacidad futura explícita, pero desactivarla en los enemigos actuales.
- Agregar pruebas unitarias y de UI para XP, nivel, asignación y movimiento.

## Fuera de alcance

- No reemplazar la autoridad del servidor online.
- No cambiar la curva de balance ni las recompensas del servidor.
- No agregar árboles de habilidades nuevos en esta corrección.

## Arquitectura afectada

- `apps/web/src/game/local-progression.ts` contiene la reducción local sobre la misma curva de
  `@brecha/shared`.
- `GameIsland` aplica sólo eventos de derrota locales en modo preview y guarda el snapshot.
- `Character` usa el API existente cuando hay cuenta y el adaptador local cuando el ID es preview.
- `resolveEnemyMovementStyle` y la autoridad de enemigos sólo consideran `keep_distance` como orden
  explícita de retroceso.

## Consideraciones multiplayer y persistencia

La preview local no tiene autoridad remota: su snapshot se identifica con `local-progression.v1` y
queda aislado por `characterId` en `localStorage`. Las cuentas autenticadas siguen usando
`ProgressionService`, `EnemyRewardService` y sus transacciones server-side. No hay migración Prisma.

## Milestones

- [x] Implementar reducción local de XP y persistencia.
- [x] Conectar derrotas locales con nivel/puntos y exponer hoja de personaje.
- [x] Desactivar kite implícito de enemigos actuales y conservar el tag explícito para futuras zonas.
- [x] Agregar regresiones y ejecutar typecheck, tests, lint, build y smoke.

## Progreso

- [x] 2026-08-05: código y pruebas implementados.
- [x] 2026-08-05: suite completa (71 archivos/324 tests), integración (7 archivos/30 tests), typecheck, lint, build, formato, diff y smoke HTTP verificados; el build conserva sólo el warning conocido del chunk runtime grande.

## Criterios de aceptación

- Derrotar enemigos en `/bruto-preview` aumenta la XP total y la barra.
- Al alcanzar 100 XP aparece nivel 2 y tres puntos disponibles.
- El botón `+` de la hoja local aumenta el atributo y reduce un punto.
- Los cinco enemigos del catálogo no retroceden al entrar en rango.

## Trabajo pendiente

Conectar el runtime jugable autenticado a comandos WebSocket y reconciliación de snapshots sigue
siendo el siguiente hito online del Paso 20.
