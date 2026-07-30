# Rendimiento 2D

## Paso 6

La escena limita la física a un jugador y tres obstáculos estáticos, usa Arcade Physics y no crea
keys/listeners por frame. El runtime se destruye al desmontar; el presupuesto inicial es 60 FPS y
las pruebas verifican normalización/ciclo de vida sin usar benchmarks de tiempo no deterministas.

## Estado actual

Existe una build web mínima, todavía sin escena jugable ni baseline de FPS. Los objetivos provisionales y el presupuesto inicial de descarga están en [../performance-budget.md](../performance-budget.md).

## Responsabilidades

Medir FPS/frame time, memoria/GC, entidades, render, partículas, física, colisiones, navegación, IA, updates, eventos y tráfico de red. Atribuir costo antes de optimizar.

## Flujo

```text
Escenario + hardware + build + seed → baseline/perfil
→ hipótesis → cambio mínimo → misma medición
→ regresión funcional → reporte antes/después
```

## Límites

Render puede aplicar culling/batching sin cambiar simulación. Pooling debe resetear estado. Interpolación no altera autoridad. Los presupuestos por sistema son objetivos revisables.

## Riesgos

Promedios que esconden picos, perfiles distintos antes/después, pooling con estado residual, listeners/timers filtrados, atlas enorme, pathfinding por frame y exceso de snapshots.

## Pruebas requeridas

Combate normal, dungeon densa, jefe con efectos, multiplayer con latencia, sesión prolongada y dispositivo bajo. Informar p50/p95/p99, memoria, GC, entidades y red.

## Skills relacionadas

- [performance-2d](../../.agents/skills/performance-2d/SKILL.md)
- [pixel-art-pipeline](../../.agents/skills/pixel-art-pipeline/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)
