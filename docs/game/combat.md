# Combate

## Estado actual

Paso 7 está completado (`guardian-combat.1`, `GAME_DATA_VERSION`/`BALANCE_VERSION` `2026.07.30.1`).
En el Paso 14 ya existe una primera capa autoritativa: `CombatAuthority` recibe
`COMBAT_INTENT` por WebSocket, deriva el Guardián autenticado, valida ownership, objetivo, alcance,
cooldown, Furia y estado, y resuelve la habilidad server-side con RNG determinista. Slash y Golpe
poderoso seleccionan por arco y límite de objetivos; Torbellino usa radio y no requiere target;
Piel de hierro es self-targeted y devuelve su ventana de reducción. El servidor muta vida/estado y
posición y knockback opcional de enemigos en `ActiveInstanceRegistry`, devuelve `COMBAT_RESULT` idempotente por
`operationId` con `hits[]` y replica el snapshot a toda la party. El cliente no envía daño, vida,
posición del enemigo ni cooldown.

`@brecha/shared/combat` conserva fórmulas y estado temporal puro; `LocalCombatController` resuelve
maniquíes estáticos y un hazard data-driven (`hazard.corrupted_pulse`, no letal, sin detección/
navegación/aggro), y Phaser sólo presenta input, animación y feedback. El daño saliente y el
**entrante** son ambos reales: `applyIncomingDamage` conecta vida, Furia por daño recibido, Piel de
hierro y Sed de batalla al juego en ejecución, no sólo a los tests. El RNG de combate es
determinista y seedeado (`@brecha/shared/random`), y la selección de blancos ordena por distancia
real en vez de depender del orden de inserción del `Map`. El bloque multiplayer es todavía parcial:
las cuatro habilidades del Guardián se validan server-side y se replican por party. `CombatAuthority`
programa los impactos según `impactMs`/`tickOffsetsMs`; Slash y Golpe poderoso devuelven primero un
`COMBAT_RESULT` `pending` y el timer autoritativo de 50 ms emite el resultado final al llegar el reloj.
Torbellino resuelve su primer tick y agenda los restantes. Los reintentos por `operationId` devuelven
el último resultado almacenado sin volver a aplicar daño. `EnemyAuthority` ya ejecuta en el mismo
tick la FSM server-side, persecución/leash, melee, proyectiles, telégrafos y curación de aliados para
los cinco perfiles; cleanup/respawn continuo ya conserva la animación de muerte y un punto seguro.
Faltan recompensas/loot, persistencia y resolución completa de encuentros.

Cuando la vida del Guardián llega a cero, el dominio conserva un estado derribado no terminal:
`tryActivateAbility` rechaza nuevas habilidades con `reason: downed`, mientras el runtime detiene
movimiento y AUTO, muestra la animación/tilt de caída y el HUD expone el aviso `DERRIBADO`. La
interacción de reanimación se resuelve en el tick/instancia: el servidor elige un compañero derribado,
conserva `effectCharacterId` en el recibo, cancela la interacción si el actor recibe daño y aplica
vida/estado una sola vez mediante `InteractionEffectService`. Las recompensas de la expedición aún
pertenecen al dominio posterior de loot.

El orden de resolución es: validar costo/cooldown → reservar Furia/cooldown → abrir ventana por reloj
→ seleccionar por arco/radio (ordenado por distancia, tie-break por id) → programar `impactMs`/
`tickOffsetsMs` → resolver daño/armadura/crítico en el tick → deduplicar impacto → actualizar HUD y
emitir evento de presentación. El reloj se congela durante pausa; los resultados no dependen de un
callback visual. La presentación
(`combat-presentation.ts`) deriva frameRate y frames de `GAME_DATA.animations`, y valida que el
`hitFrame` de cada animación siga alineado con el `impactMs` real de la habilidad — no hay literales
de tiempo fuera de `packages/game-data`.

La configuración jugable actual no define `knockbackPx` para `powerStrike`, por lo que los golpes
no alejan a los mobs. La primitiva de knockback sigue disponible para futuras habilidades que la
necesiten. El `possessed_archer` genera un `EnemySpawnedProjectile` con dirección, velocidad,
alcance y radio de impacto autoritativos; Phaser lo presenta como una flecha orientada.

### CorrecciÃ³n de kite en la preview

Los enemigos actuales no retroceden por ser `ranged`: `keepDistance` sÃ³lo se activa con la
etiqueta explÃ­cita `keep_distance`. Esto mantiene la capacidad para futuras zonas sin hacer que
los mobs del Bosque Corrupto se alejen del jugador.

## Datos del Paso 2

Las habilidades y los estados de animación se describen como datos, incluidos eventos de frame. El
tuning de daño, cooldown y atacante enemigo proviene de `@brecha/game-data`; la muerte/respawn,
recompensa y los eventos visuales de red que aún no están conectados permanecen pendientes y no deben
inventarse en la UI.

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
