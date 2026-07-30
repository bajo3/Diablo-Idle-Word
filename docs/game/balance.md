# Balance

## Estado actual

El Paso 7 introduce únicamente tuning de combate `PROVISIONAL` y versionado
`guardian-combat.1`; no representa balance definitivo. El snapshot de nivel 1 usa Vida 220, Armadura
25, daño base 20–24 y crítico 7,5 %. Las fórmulas y los límites exactos viven en
`GAME_DATA.guardianCombat` y están cubiertos con RNG controlado.

## Datos del Paso 2

`game-data` fija únicamente los números establecidos por GOAL: calibración 300 s, mínimo 600 s, cap 8 h, eficiencia 0.8, 1–4 jugadores, escalado 0.65/0.15 y frames 64/128. Todo tuning de combate no cuantificado se marca `TBD`.

## Responsabilidades

Definir y medir XP/tiempo por nivel, DPS, vida efectiva, TTK, supervivencia, escalado, economía por hora, rarezas, costos, inflación y relación activo/idle.

## Flujo de datos

```text
Hipótesis + configuración versionada + escenario/seed
→ simulación reproducible → distribución/métricas
→ cambio mínimo → nueva simulación + prueba jugable
→ reporte antes/después
```

## Límites

Balance modifica datos y fórmulas acordadas, no redefine arquitectura. Cada sistema posee su comportamiento; balance aporta valores medibles. La telemetría futura debe respetar privacidad.

## Riesgos

Optimizar sólo la media, una clase o endgame; cambiar varias variables a la vez; inflación; idle dominante; caps invisibles; resultados sin seed o versión.

## Pruebas requeridas

Escenarios por clase/build/nivel, percentiles, extremos, activo/idle, fuentes/sumideros, seeds repetibles y reporte con valor anterior/nuevo, razón, riesgo y resultado.

## Skills relacionadas

- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [combat-system](../../.agents/skills/combat-system/SKILL.md)
- [loot-and-items](../../.agents/skills/loot-and-items/SKILL.md)
- [idle-progression](../../.agents/skills/idle-progression/SKILL.md)
