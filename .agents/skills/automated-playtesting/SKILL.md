---
name: automated-playtesting
description: Diseña y ejecuta pruebas automatizadas, smoke tests, integración y recorridos jugables del juego. Usar después de implementar sistemas o corregir errores. No usar como sustituto de pruebas unitarias específicas.
---

# Purpose

Convertir recorridos jugables críticos y bugs corregidos en evidencia automatizada, reproducible y útil.

# Trigger conditions

Usar después de implementar sistemas, corregir bugs o cambiar flujos críticos. Combinar con todas las skills de dominio afectadas.

# Do not use when

No usar E2E como sustituto de pruebas unitarias de fórmulas ni probar detalles visuales inestables sin contrato. No introducir un framework sin detectar primero el stack.

# Required context

1. Inspeccionar `AGENTS.md`, manifiestos, scripts, pruebas, CI, `docs/game/testing.md` y el sistema cambiado.
2. Localizar puntos de entrada, fixtures, clocks, RNG, red, guardado y logging.
3. Leer [escenarios de prueba](references/test-scenarios.md) y [guía de scripts](scripts/README.md).
4. Confirmar herramientas disponibles, comandos seguros y entorno reproducible.

# Workflow

1. Mapear riesgo a la capa mínima: unidad, integración, E2E, smoke o regresión.
2. Definir precondiciones, acciones, aserciones, limpieza y evidencia.
3. Controlar reloj, RNG, IDs y red; evitar sleeps arbitrarios.
4. Implementar primero prueba que falle cuando sea una regresión.
5. Ejecutar escenario aislado, suite relacionada y smoke de inicio.
6. Capturar logs, consola y errores de red; no ocultar fallos.
7. Documentar comandos, resultados, cobertura y huecos.

# Architecture rules

- Priorizar pruebas unitarias para fórmulas, integración para sistemas, E2E para recorridos críticos, smoke para arranque y regresión para bugs.
- Usar puertos controlables para reloj, RNG, almacenamiento y transporte.
- Separar fixtures de producción y usar IDs/seeds estables.
- Permitir limpieza idempotente y ejecución paralela cuando el stack lo soporte.

# Implementation rules

- Cubrir: iniciar, crear personaje, seleccionar clase, entrar, mover, atacar, usar habilidad, consumir recurso y aplicar cooldown.
- Cubrir: recibir daño, morir, reaparecer, obtener/recoger loot, equipar/desequipar y subir nivel.
- Cubrir: asignar estadísticas, aprender habilidad, guardar/cargar, desconectar/reconectar y reclamar idle.
- Cubrir: entrar a dungeon, derrotar jefe y probar dos jugadores cuando esos sistemas existan.
- Detectar errores de consola/red y ausencia de duplicación.
- Si un sistema no existe, registrar el escenario como pendiente con precondición; no fabricar una implementación.
- No afirmar cobertura de un escenario que no se ejecutó.

# Validation

- Ejecutar la prueba nueva al menos una vez y comprobar que produce evidencia determinista.
- Ejecutar suite relacionada, smoke y lint/formatter configurados.
- Repetir casos sensibles a concurrencia o RNG con seeds declaradas.
- Mostrar comando exacto, exit code, resumen, artefactos y fallos no relacionados.

# Required output

Entregar matriz escenario-capa, pruebas añadidas, comandos, resultados, logs/artefactos relevantes, cobertura pendiente y riesgos de flakiness.

# Definition of done

Completar cuando el riesgo principal tenga prueba en la capa adecuada, el escenario sea reproducible, no haya sleeps frágiles, las suites pasen y los huecos estén explícitos.

# Related documentation

- [Escenarios](references/test-scenarios.md)
- [Scripts de pruebas](scripts/README.md)
- [Estrategia de pruebas](../../../docs/game/testing.md)

