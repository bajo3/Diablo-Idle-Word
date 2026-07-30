---
name: performance-2d
description: Analiza y optimiza rendimiento de juegos 2D, FPS, memoria, entidades, partículas, físicas, renderizado y tráfico de red. Usar ante problemas de rendimiento o sistemas con gran cantidad de entidades. No usar para microoptimizaciones sin medición.
---

# Purpose

Optimizar cuellos de botella medidos sin alterar comportamiento ni perseguir métricas irrelevantes.

# Trigger conditions

Usar ante caídas de FPS, frame time alto, memoria creciente, GC, muchas entidades, física/IA costosa o tráfico excesivo. Usar también en dungeons y combates con alta densidad.

# Do not use when

No usar para microoptimizaciones sin perfil ni presupuesto. No cambiar comportamiento sin prueba de regresión.

# Required context

1. Inspeccionar `AGENTS.md`, `docs/game/performance.md`, profiler/configuración, render, física, IA, entidades, red y pruebas.
2. Localizar bucles por frame, timers, eventos, allocaciones, carga/descarga y suscripciones.
3. Leer [presupuesto de rendimiento](references/performance-budget.md).
4. Confirmar dispositivo objetivo, resolución, escena, build y baseline.

# Workflow

1. Definir escenario y presupuesto; medir FPS, percentiles de frame time, memoria y red.
2. Perfilar y atribuir costo por sistema antes de editar.
3. Formular hipótesis y elegir el cambio mínimo.
4. Optimizar, repetir la misma captura y comparar.
5. Ejecutar regresión funcional y estrés en dispositivo bajo.
6. Documentar baseline, resultado, variabilidad y tradeoffs.

# Architecture rules

- Distribuir presupuesto entre render, física, IA, gameplay y red.
- Limitar trabajo por frame y usar frecuencias adecuadas por sistema.
- Aplicar pooling sólo a objetos frecuentes con ciclo de vida claro.
- Usar culling, batching, spritesheets y texture atlases cuando el motor lo aproveche.
- Controlar partículas, luces, sombras, colisiones, pathfinding y agentes activos.
- Limitar frecuencia/tamaño de paquetes y usar interpolación sin esconder autoridad.

# Implementation rules

- Medir allocaciones y garbage collection; liberar recursos, timers y suscripciones.
- Evitar búsquedas globales, creación repetida y listeners duplicados en update loops.
- Validar object pooling contra estado residual.
- Ajustar compresión y carga de texturas sin degradar pixel art inadvertidamente.
- Diseñar escenarios de estrés con entidades, proyectiles, partículas, pathfinding y dos o más clientes.
- Si no existe juego ejecutable, definir presupuestos como objetivos provisionales y puntos de instrumentación; no inventar benchmarks.
- Delegar cambios visuales a `pixel-art-pipeline` y pruebas a `automated-playtesting`.

# Validation

- Capturar antes/después con mismo hardware, build, escena, duración y seed.
- Informar mediana y percentiles, picos de memoria/GC, entidades y bytes/paquetes por segundo.
- Ejecutar regresión de comportamiento y prueba prolongada de leaks.
- Mostrar herramienta, comando/pasos, capturas o métricas y limitaciones.

# Required output

Entregar baseline, perfil, cuello de botella, cambio, métricas antes/después, regresiones ejecutadas y riesgos.

# Definition of done

Completar cuando la mejora supere variabilidad de medición, cumpla o acerque el presupuesto, no cambie reglas, no introduzca leaks y esté respaldada por evidencia.

# Related documentation

- [Presupuesto](references/performance-budget.md)
- [Rendimiento](../../../docs/game/performance.md)
- [Pruebas](../../../docs/game/testing.md)

