# Estrategia de pruebas

## Estado actual

El Paso 3 añade integración real con PostgreSQL en `pnpm test:integration`. La suite crea una
DB aislada `brecha_test_*`, ejecuta `prisma migrate deploy` y la elimina siempre al finalizar. La
estrategia y evidencia vigente se mantienen en [../testing.md](../testing.md).

El Paso 4 añade pruebas de entrada, UI y PostgreSQL/HTTP/WS. La integración crea una nueva
`brecha_test_*`, migra desde vacío, registra usuarios, verifica hash de sesión/rotación/revocación,
ownership y borrado lógico, y prueba upgrades WebSocket válido, sin cookie, con origen ajeno, token
manipulado, sesión expirada y sesión revocada, sin una sala de juego.

## Responsabilidades por capa

| Capa | Responsabilidad |
| --- | --- |
| Unidad | fórmulas, invariantes, state machines y migraciones puras |
| Integración | repositorios, transacciones, red, reloj y módulos combinados |
| E2E | recorridos jugables críticos |
| Smoke | arranque, escena/mundo mínimo y errores fatales |
| Regresión | reproducir cada bug corregido |

## Flujo

```text
Riesgo → capa mínima → fixture/seed/reloj → acciones
→ aserciones + logs → limpieza → evidencia
```

Controlar RNG, tiempo, IDs y red. Evitar sleeps; esperar estados observables. Mantener artefactos de fallo acotados y sin secretos.

## Recorridos críticos

Crear personaje/clase, entrar, mover, combatir, loot/equipo, nivel/habilidad, guardar/cargar, desconectar/reconectar, reclamar idle, dungeon/jefe y dos jugadores cuando existan.

Para el Paso 7, `packages/shared/src/combat.test.ts` cubre fórmulas, límites, recursos, cooldowns,
Piel de hierro, Sed de batalla, decaimiento y geometría. `combat-controller.test.ts` cubre ventana,
deduplicación y restricción de retroceso; el smoke de navegador de inputs, HUD y lifecycle queda como
evidencia final antes de cerrar el paso.

## Límites

E2E no reemplaza unidades. Tests no deben depender de servicios productivos ni contenido aleatorio sin seed. Un sistema inexistente se marca pendiente.

## Riesgos

Flakiness, fixtures compartidos, puertos colisionados, limpieza incompleta, asserts de UI frágiles, errores de consola ignorados y tests que sólo prueban mocks.

## Validación requerida

Ejecutar prueba nueva, suite relacionada y smoke. Informar comando, exit code, seed, duración, artefactos y huecos.

## Persistencia

La integración cubre `SAVE-01` de forma parcial (round trip de agregado), migración desde DB
vacía, seed dos veces, rechazo de save desconocido, replay secuencial/concurrente, conflicto de
hash y rollback de saldo insuficiente. `SAVE-02` queda completo cuando exista una versión V2 con
fixture V1→V2; no se simula una migración inexistente.

## Skills relacionadas

- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)
- [game-architect](../../.agents/skills/game-architect/SKILL.md)
- [performance-2d](../../.agents/skills/performance-2d/SKILL.md)
