# Enemigos y dungeons

## Estado actual

Existen definiciones de cinco enemigos, sus estados de IA, Bosque Corrupto y misión. Entidades, IA ejecutable, navegación, generador, dificultad y estética siguen `TBD`.

## Datos del Paso 2

El catálogo contiene Esbirro corrupto, Arquero poseído, Chamán oscuro, Bruto de raíces y Bestia inestable; sus nueve estados mínimos (`idle`, `patrol`, `detect`, `chase`, `attack`, `use_ability`, `retreat`, `stunned`, `dead`), Bosque Corrupto y la misión que requiere tres altares y el jefe. IA y balance ejecutable siguen fuera de alcance.

## Responsabilidades

- Enemigos: stats, estados, detección, persecución, ataque, retirada, leash y muerte.
- Variantes: melee, ranged, summoner, élites y modificadores.
- Jefes: fases, telegraphs, adds, enrage y limpieza.
- Encuentros: oleadas, spawn seguro, dificultad y presupuesto.
- Dungeons: grafo, salas, bioma, seed, restricciones y finalización.

## Flujo de datos

```text
Dungeon ID + seed + versión → grafo/salas validados
→ encuentros por presupuesto → IA autoritativa
→ eventos de muerte/finalización → recompensas
```

## Límites

El generador produce estructura; navegación valida accesibilidad; IA decide comportamiento; combate resuelve ataques; loot concede recompensas; servidor posee el estado online.

## Riesgos

Grafo desconectado, spawn sobre jugador, loops de IA, pathfinding excesivo, combinaciones de élite injustas, fase sin salida, entidades huérfanas y seed no reproducible tras cambios.

## Pruebas requeridas

Seeds mínimas/densas/ramificadas, conectividad, spawn, estados, pérdida de objetivo, leash, jefe por fases, limpieza, estrés y recorrido con dos jugadores.

## Skills relacionadas

- [enemy-and-dungeon-generator](../../.agents/skills/enemy-and-dungeon-generator/SKILL.md)
- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [performance-2d](../../.agents/skills/performance-2d/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)
