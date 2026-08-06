# ExecPlan — Paso 15: recompensas multiplayer y loot privado

## Objetivo

Cerrar las recompensas de derrota del Bosque Corrupto sin duplicaciones: cada personaje recibe sus
propios recursos/objeto, la dificultad de la instancia se resuelve en servidor y el jugador puede
consultar un informe histórico privado.

## Estado

Completado en esta sesión. El Paso 16 permanece sin iniciar y el Paso 10 continúa postergado por
el pivote del Bosque infinito.

## Decisiones

- `EnemyRewardService` sigue siendo la frontera transaccional: ownership, `RewardLog`, inventario,
  XP y recursos se escriben con aislamiento `Serializable`.
- El hash canónico incluye dificultad y tamaño de party. Los valores se derivan de la instancia,
  no de un campo confiable del cliente.
- Los drops usan la semilla de `operationId`, se asignan al inventario del personaje receptor y el
  evento lleva `visibility: private`.
- La fórmula de dificultad vive en `GAME_DATA.balance`: salud `1 + 0.65 × (jugadores - 1)`, daño
  `1 + 0.15 × (jugadores - 1)`, con multiplicador Veterano 1.25/1.15.
- `/api/characters/:characterId/rewards/recent` comprueba ownership y la pantalla `/resultados`
  consume sólo ese endpoint.

## Implementación

- [x] Generación determinista e inserción atómica de loot individual.
- [x] Evento privado y consulta histórica acotada al personaje propio.
- [x] Escalado normal/veterano para oleada, ataques y respawn.
- [x] Replay por operación y conflicto por hash.
- [x] Pruebas unitarias de fórmula/respawn y prueba PostgreSQL concurrente.
- [x] Pantalla web de resultados con dificultad, recursos, nivel y objeto.
- [x] GOAL, documentación de dominio y registro de progreso actualizados.

## Verificación

- `pnpm test -- --run`
- `pnpm test:integration`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- Smoke autenticado: `/partida` → botón `RESULTADOS` → `/resultados`; historial propio visible.

## Riesgos y seguimiento

El tuning sigue marcado provisional y debe revisarse con métricas de TTK/DPS en el Paso 19. Los
efectos visuales authored y capas finales de sprites pertenecen al Paso 18; el modo offline reutiliza
las tablas y restricciones de este paso cuando se abra el Paso 16.
