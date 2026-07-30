---
name: game-balance
description: Analiza y ajusta curvas de experiencia, daño, vida, economía, drops, progresión activa e idle mediante métricas y simulaciones. Usar para cambios numéricos de balance. No usar para redefinir arquitectura.
---

# Purpose

Tomar decisiones numéricas reproducibles mediante métricas, simulaciones y comparaciones antes/después.

# Trigger conditions

Usar al cambiar experiencia, vida, daño, economía, drops, costos, progresión activa/idle o diferencias entre clases. Combinar con la skill del sistema y con `automated-playtesting`.

# Do not use when

No usar para redefinir arquitectura ni para cambios sin hipótesis medible. No declarar equilibrio a partir de una única build o promedio.

# Required context

1. Inspeccionar `AGENTS.md`, `GAME_DESIGN.md`, `docs/game/balance.md`, configuraciones, telemetría, simulaciones y pruebas.
2. Localizar fórmulas de experiencia, combate, enemigos, drops, economía e idle.
3. Leer [métricas de balance](references/balance-metrics.md) y [guía de scripts](scripts/README.md).
4. Confirmar audiencia, etapa de progreso, versión de datos, semillas y métricas objetivo.

# Workflow

1. Formular hipótesis y métrica afectada.
2. Capturar valor anterior, distribución y escenario base.
3. Definir valor nuevo, razón, riesgo y resultado esperado.
4. Simular múltiples clases, builds, niveles, seeds y percentiles.
5. Comparar tiempo por nivel, DPS, vida efectiva, TTK, supervivencia y economía por hora.
6. Revisar activo frente a idle, rendimientos decrecientes, caps y dominancia.
7. Aplicar el cambio mínimo, ejecutar regresión y documentar antes/después.

# Architecture rules

- Mantener números en configuración versionada y separar fórmulas de presentación.
- Usar simulaciones deterministas y seeds registradas.
- Medir distribuciones y percentiles, no sólo medias.
- Separar fuentes y sumideros de moneda.
- Definir segmentos por nivel, dificultad, clase y build.

# Implementation rules

- Medir curva de experiencia, tiempo por nivel, DPS, vida efectiva, TTK y supervivencia.
- Medir escalado de enemigos/jefes, oro/XP/objetos/rareza/materiales por hora y costos de mejora.
- Vigilar inflación, diferencias entre clases, builds dominantes, caps y rendimientos decrecientes.
- Registrar siempre métrica, antes, después, razón, riesgo, prueba y resultado esperado.
- No agregar dependencias sólo para simular; usar el lenguaje existente o un formato portable.
- Si no hay código, definir dataset, fórmulas y escenarios antes de elegir herramienta.

# Validation

- Ejecutar simulaciones reproducibles con seeds y tamaño de muestra documentados.
- Probar extremos, builds débiles/fuertes, niveles inicial/final y activo/idle.
- Comparar resultados esperados con pruebas de integración o telemetría disponible.
- Mostrar comandos, versión de configuración, tabla antes/después y limitaciones.

# Required output

Entregar hipótesis, métricas, valores antes/después, distribución, seeds, pruebas, riesgos, impacto económico y recomendación reversible.

# Definition of done

Completar cuando el cambio sea medible, reproducible, documentado, cubra segmentos y extremos, no introduzca dominancia obvia y las regresiones relevantes pasen.

# Related documentation

- [Métricas de balance](references/balance-metrics.md)
- [Scripts de simulación](scripts/README.md)
- [Balance](../../../docs/game/balance.md)
- [Diseño del juego](../../../GAME_DESIGN.md)

