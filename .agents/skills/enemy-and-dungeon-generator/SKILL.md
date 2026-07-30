---
name: enemy-and-dungeon-generator
description: Crea enemigos, inteligencia artificial, élites, jefes, oleadas, encuentros, biomas y mazmorras configurables. Usar para contenido PvE y generación de niveles o encuentros. No usar para modificar únicamente estadísticas del jugador.
---

# Purpose

Crear contenido PvE configurable, reproducible, legible, seguro y escalable para juego activo y multiplayer.

# Trigger conditions

Usar para arquetipos, IA, élites, jefes, oleadas, encuentros, biomas, salas o dungeons. Para una dungeon nueva combinar `game-balance`, `performance-2d` y `automated-playtesting`; sumar `multiplayer-authority` en sesiones online.

# Do not use when

No usar para estadísticas del jugador ni balance numérico aislado. No generar contenido sin restricciones, presupuesto o spawn seguro.

# Required context

1. Inspeccionar `AGENTS.md`, `GAME_DESIGN.md`, `docs/game/enemies-and-dungeons.md`, entidades, IA, navegación, combate, generación, red, rendimiento y pruebas.
2. Localizar Enemy, AI, Navigation, Spawn, Encounter, Room, Biome, Dungeon y Reward.
3. Leer [generación de contenido](references/content-generation.md).
4. Confirmar unidades, seed/RNG, límites de entidades, autoridad y convenciones actuales.

# Workflow

1. Definir intención, dificultad, espacio, recompensa y restricciones del contenido.
2. Elegir arquetipo y máquina de estados: detección, patrulla, persecución, ataque, retirada, aggro y leash.
3. Definir navegación y variantes melee, ranged o summoner.
4. Componer élites, modificadores, jefes, fases y telegraphs legibles.
5. Generar salas/biomas/dungeons desde seed con conectividad y restricciones.
6. Asignar presupuesto de enemigos, oleadas, limpieza y spawn seguro.
7. Simular dificultad, estrés y multiplayer; documentar semilla y resultados.

# Architecture rules

- Separar definición, estado de IA, navegación, combate, presentación y recompensa.
- Favorecer composición de comportamientos y modificadores sobre jerarquías rígidas.
- Representar estados y transiciones de IA explícitamente.
- Mantener generación determinista por seed y versión cuando se necesite reproducción.
- Validar conectividad, accesibilidad, espacios de spawn y condiciones de finalización.
- Hacer al servidor autoridad de IA, spawns, muerte y recompensa online.

# Implementation rules

- Definir estadísticas base y escalado como datos; delegar números a `game-balance`.
- Mantener telegraphs sincronizados con ventanas reales de ataque sin convertir la animación en autoridad.
- Limitar invocaciones y entidades activas; limpiar proyectiles, efectos y enemigos huérfanos.
- Evitar spawn sobre jugadores, geometría inválida o áreas sin salida.
- Registrar seed, versión, encuentro y causa de fallo.
- Si no existe el sistema, crear plantilla conceptual y generador mínimo verificable; no producir contenido definitivo en masa.
- Delegar combate, loot, red y rendimiento a sus skills respectivas.

# Validation

- Probar cada estado, transición, pérdida de objetivo, leash y path imposible.
- Probar enemigo normal, élite, jefe con fases, oleada y dungeon con seeds fijas.
- Verificar conectividad, spawn seguro, limpieza, dificultad y presupuesto bajo estrés.
- Probar dos jugadores, reconexión y autoridad si aplica; mostrar seeds, métricas y trazas.

# Required output

Entregar definiciones, estados, restricciones, seeds de reproducción, métricas de dificultad/rendimiento, pruebas, archivos y riesgos.

# Definition of done

Completar cuando el contenido sea reproducible y configurable, no haya estados sin salida, se respeten presupuestos, el spawn sea seguro y las pruebas de recorrido/estrés pasen.

# Related documentation

- [Generación de contenido](references/content-generation.md)
- [Enemigos y dungeons](../../../docs/game/enemies-and-dungeons.md)
- [Balance](../../../docs/game/balance.md)
- [Rendimiento](../../../docs/game/performance.md)

