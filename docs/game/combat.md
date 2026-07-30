# Combate

## Estado actual

Paso 7 completado (`guardian-combat.1`, `GAME_DATA_VERSION`/`BALANCE_VERSION` `2026.07.30.1`).
`@brecha/shared/combat` conserva fórmulas y estado temporal puro; `LocalCombatController` resuelve
maniquíes estáticos y un hazard data-driven (`hazard.corrupted_pulse`, no letal, sin detección/
navegación/aggro), y Phaser sólo presenta input, animación y feedback. El daño saliente y el
**entrante** son ambos reales: `applyIncomingDamage` conecta vida, Furia por daño recibido, Piel de
hierro y Sed de batalla al juego en ejecución, no sólo a los tests. El RNG de combate es
determinista y seedeado (`@brecha/shared/random`), y la selección de blancos ordena por distancia
real en vez de depender del orden de inserción del `Map`. Todavía no existen enemigos, IA, loot,
persistencia de combate ni autoridad multiplayer — eso es Paso 8 en adelante.

El orden de resolución es: validar costo/cooldown → reservar Furia/cooldown → abrir ventana por reloj
→ seleccionar por arco/radio (ordenado por distancia, tie-break por id) → resolver daño/armadura/
crítico → deduplicar impacto → actualizar HUD y emitir evento de presentación. El reloj se congela
durante pausa; los resultados no dependen de un callback visual. La presentación
(`combat-presentation.ts`) deriva frameRate y frames de `GAME_DATA.animations`, y valida que el
`hitFrame` de cada animación siga alineado con el `impactMs` real de la habilidad — no hay literales
de tiempo fuera de `packages/game-data`.

## Datos del Paso 2

Las habilidades y los estados de animación se describen como datos, incluidos eventos de frame. No existe resolución de daño ni fórmula activa: el tuning no cuantificado permanece `TBD`.

## Responsabilidades

- Validar ataques, recursos, cooldowns, alcance y estados.
- Resolver hit, daño, mitigación, crítico, efectos, muerte y aggro.
- Emitir eventos de dominio para presentación, red y recompensas.
- Mantener hitboxes/hurtboxes separadas del sprite.

No pertenecen aquí la animación, el HUD, la persistencia directa ni la concesión final de loot.

## Flujo de datos

```text
Intención → validación autoritativa → cast/costo → impacto
→ fórmula/estados → salud/muerte → eventos → replicación/presentación
```

Usar un reloj y RNG inyectables. Aplicar el orden de fórmula y redondeo definido en la referencia de la skill.

## Límites

El cliente puede anticipar feedback, nunca decidir daño ni cooldown. La animación representa una transición, no crea el estado. Combate consulta stats/equipo mediante contratos y publica muerte; loot y progresión consumen el evento.

## Riesgos

Divergencia numérica, números mágicos, callbacks visuales como autoridad, efectos no limpiados, muerte doble, proyectiles huérfanos y abusos de latencia.

## Pruebas requeridas

Fórmulas con ejemplos numéricos y extremos; costo/cooldown/interrupción; estados y stacking; hitbox/proyectil; muerte/respawn; aggro; paquetes repetidos o inválidos online.

## Skills relacionadas

- [combat-system](../../.agents/skills/combat-system/SKILL.md)
- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)
