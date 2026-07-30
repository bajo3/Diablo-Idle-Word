# Paso 8 — enemigos e IA

## Objetivo del usuario

Que existan enemigos reales (cinco tipos + variantes élite) con comportamiento distinto entre sí,
capaces de detectar, perseguir, atacar y dañar al Guardián, y de morir y limpiarse correctamente —
la base sin la cual el Bosque Corrupto (Paso 9) no puede ser una misión jugable de principio a fin.

## Estado actual

El Paso 7 quedó cerrado (`GOAL.md`, fila 2026-07-30 del Registro de progreso): núcleo de combate
puro y determinista en `@brecha/shared/combat.ts`, `LocalCombatController` con daño saliente y
entrante reales, RNG seedeado, targets ordenados por distancia, presentación atada al catálogo.
Existe un hazard estático de prueba (`hazard.corrupted_pulse`) sin detección/navegación/aggro,
deliberadamente fuera del alcance de IA — eso es este paso.

`apps/web/src/game/domain.ts` sólo define 5 de los 11 estados visuales que
`packages/shared/src/visual.ts` ya contempla (`idle|moving|attacking|casting|channeling`, faltan
`interacting|stunned|knocked_back|downed|reviving|dead`). `apps/web/src/game/assets.ts` valida el
manifiesto de assets con un esquema hard-codeado para exactamente el Guardián (4 capas fijas,
64×64, ids `guardian_placeholder_<layer>`) — no puede describir un enemigo ni un jefe de 128×128.
`packages/game-data/src/catalog.ts` define los 5 enemigos sólo como metadata descriptiva
(`id/displayName/behaviors/aiStates`), sin ningún número de tuning (vida, daño, velocidad,
radios). No existe ningún sistema de detección, navegación, proyectiles ni telégrafos.

## Alcance

- 8.0: cimientos — daño simétrico (`resolveAttack`), FSM visual generalizada a 11 estados con
  reglas de prioridad/interrupción, validador de assets generalizado (multi-entidad, 64 o 128px).
- 8.1: modelo de datos de enemigos en `game-data` (tuning completo, versión de balance nueva).
- 8.2: máquina de estados de IA pura (`packages/shared/src/enemy-ai.ts`) + detección con línea de
  visión e histéresis.
- 8.3: navegación simple (seek/flee/arrive + separación), sin A*.
- 8.4: los cinco tipos de enemigo como perfiles de comportamiento data-driven.
- 8.5: proyectiles y telégrafos como entidades de simulación (reutilizables por el jefe del Paso
  10).
- 8.6: al menos dos modificadores élite (Veloz, Resistente), seleccionados con el RNG seedeado.
- 8.7: muerte, limpieza y recompensas pendientes como datos (sin inventario todavía).
- 8.8: matriz de pruebas, presupuesto de rendimiento (30-40 enemigos a 60 FPS) y cierre en GOAL.

El mundo de simulación de paso fijo (`SimulationWorld`, extraer `combat-controller.ts` de un
consumidor de `delta` de Phaser a un step determinista) es la pieza de mayor riesgo de 8.0: se
implementa después de 8.0's dos piezas más seguras (daño simétrico, FSM/assets), migrando primero
los 12 tests existentes de `combat-controller.test.ts` sin cambiarlos, y sólo agregando enemigos
una vez que pasen intactos sobre el nuevo world.

## Fuera de alcance

Mapas/Tiled, misión/altares, sistema de interacción, jefe (Paso 9/10 — aunque 8.5 y 8.2 se
construyen pensando en que el jefe los va a reutilizar). Inventario/loot real, sólo contadores de
recompensa pendiente. Multiplayer/autoridad remota. Balance final: todo tuning de enemigos queda
`PROVISIONAL`, igual que `guardian-combat.1`.

## Arquitectura afectada

- `packages/shared/src/combat.ts`: `resolveAttack` simétrico (atacante/defensor genéricos).
- `packages/shared/src/enemy-ai.ts` (nuevo): FSM pura de IA, sin Phaser ni `Math.random`.
- `packages/shared/src/steering.ts` (nuevo): navegación simple pura.
- `packages/shared/src/visual.ts`: ya define los 11 estados; `apps/web/src/game/domain.ts` debe
  alinearse y agregar las reglas de prioridad/interrupción de GOAL.md §6.1.
- `apps/web/src/game/assets.ts`: validador generalizado a N entidades × N capas × N estados × 4
  direcciones, tamaños 64 o 128.
- `apps/web/src/game/sim/` (nuevo): `world.ts`, `entities.ts`, `projectiles.ts`, `telegraphs.ts` —
  el adaptador entre el core puro y Phaser.
- `packages/game-data/src/catalog.ts` + `schemas.ts`: tuning de enemigos, élites, proyectiles.

## Skills requeridas

- `game-architect`: mantener el core puro sin fugas de Phaser/red.
- `combat-system`: daño simétrico y resolución de impactos reutilizada del Guardián.
- `enemy-and-dungeon-generator` (si existe) / `game-balance`: tuning de enemigos y curva de TTM.
- `automated-playtesting`: fuzz de la FSM, replay determinista.

## Archivos relevantes

- `packages/shared/src/combat.ts`, `combat.test.ts`: núcleo, extendido con `resolveAttack`.
- `packages/shared/src/enemy-ai.ts`, `enemy-ai.test.ts` (nuevos): FSM de IA.
- `packages/shared/src/steering.ts`, `steering.test.ts` (nuevos): navegación.
- `apps/web/src/game/domain.ts`, `domain.test.ts`: FSM visual de 11 estados.
- `apps/web/src/game/assets.ts`: validador generalizado.
- `apps/web/src/game/combat-controller.ts`: base para `SimulationWorld`.
- `packages/game-data/src/catalog.ts`, `schemas.ts`, `validation.ts`: tuning de enemigos/élites.

## Modelo de datos

`GAME_DATA_VERSION`/`BALANCE_VERSION` avanzan de `2026.07.30.1` a `2026.07.30.2` cuando se agregue
tuning de enemigos (Progreso lo registra al ocurrir). Por enemigo: `maxHealth`, `armor`,
`moveSpeedPxPerSec`, `detectRadiusPx`, `loseTargetRadiusPx` (> detectRadiusPx, histéresis),
`leashRadiusPx`, `attack{windupMs,impactMs,recoveryMs,rangePx,arcDegrees,damageMultiplier,
cooldownMs}`, `telegraphMs`, `xpReward`, `animationIds`, `frameSize`.

## Flujo de ejecución

Percepción (posición/distancia/línea de visión) → `decideEnemyIntent` puro → intención (mover /
atacar / usar habilidad) → resolución determinista de daño vía `resolveAttack` → eventos →
presentación. Igual forma que el Guardián: el cliente nunca decide daño.

## Consideraciones multiplayer

No aplica todavía — el core sigue siendo local y determinista, preparado (RNG seedeado, reloj
inyectado, comandos con id) para que el Paso 14 lo eleve a autoridad de servidor sin reescritura.

## Consideraciones de persistencia

No aplica — sin persistencia de combate transitorio en este paso, igual que el Paso 7.

## Consideraciones de rendimiento

Presupuesto GOAL.md: 30-40 enemigos simultáneos a 60 FPS. Medir antes/después de 8.0's
`SimulationWorld` con un escenario de referencia (N enemigos idle) antes de agregar comportamiento.

## Riesgos

- **Refactor de `SimulationWorld`** (más alto): puede reintroducir bugs de timing como los que el
  Paso 7 tuvo que corregir dos veces. Mitigación: migrar los 12 tests existentes sin tocarlos antes
  de agregar una sola línea nueva; sólo entonces sumar enemigos.
- **Selección de objetivo/aliado no determinista** en la IA del Chamán: mitigar con orden explícito
  (fracción de vida, tie-break por id) y un test que lo pruebe directamente.
- **Enemigos atascados en obstáculos**: temporizador de "sin progreso" + waypoint de respawn.
- **Fuga de memoria por entidades muertas no liberadas**: test de 200 muertes con conteo de pools/
  listeners/tweens antes y después.

## Decisiones

- 2026-07-30: perfiles de comportamiento data-driven, no subclases por enemigo (GOAL.md prohíbe
  `if (nombre === ...)`).
- 2026-07-30: sin A* para el MVP; seek/flee/arrive + separación alcanza para "navegación simple".
- 2026-07-30: proyectiles y telégrafos se construyen una sola vez en 8.5 para que el jefe del Paso
  10 los reutilice sin duplicar código.
- 2026-07-30 (revisa la secuencia original de 8.0d): `LocalCombatController` ya es determinista por
  comparación de timestamps absolutos (`impact.at <= now`), no por acumulación de delta — no es lo
  que el riesgo de "8.0d" describía. Extraer un `SimulationWorld` de paso fijo _ahora_, sin ningún
  consumidor real (IA/steering/proyectiles todavía no existen como código), sería diseñar la
  abstracción sin nada concreto contra qué validarla — puro riesgo especulativo, ninguna ganancia.
  Se pospone 8.0d y se funde con 8.2/8.3: el mundo de paso fijo se extrae recién cuando la IA y la
  navegación necesiten integrar posición/velocidad, ahí donde el riesgo de dependencia de framerate
  es real y hay algo concreto (posiciones de enemigos moviéndose) para probar antes/después.
- 2026-07-30 (8.2 parte 2): `stepEnemy` (el `SimulationWorld` fusionado) vive en
  `packages/shared`, no en `apps/web/src/game/sim/` — igual que el resto del núcleo de combate,
  así el Paso 14 (servidor autoritativo) lo reusa sin reescritura. `apps/web/src/game/sim/` queda
  reservado para el adaptador puro de Phaser (instanciar sprites, alimentar `toMs` desde el reloj
  del juego), que llega en 8.4 cuando haya perfiles de enemigo reales que dibujar.

## Milestones

1. 8.0a — daño simétrico (`resolveAttack`) con pruebas de regresión contra `applyDamageTaken`.
2. 8.0b — FSM visual de 11 estados con reglas de prioridad/interrupción.
3. 8.0c — validador de assets generalizado (no específico del Guardián).
4. 8.1 — tuning de enemigos en `game-data` + validación cruzada.
5. 8.2 — FSM de IA pura + detección con histéresis. Incluye extraer `SimulationWorld` de paso fijo
   (ex-8.0d, pospuesto — ver Decisiones) en cuanto haya un consumidor real de posición/velocidad;
   los 12 tests de `combat-controller.test.ts` deben migrar sin cambios y seguir en verde.
6. 8.3 — navegación simple; termina de asentar `SimulationWorld` si 8.2 no lo agotó.
7. 8.4 — los cinco enemigos como perfiles de comportamiento.
8. 8.5 — proyectiles y telégrafos.
9. 8.6 — élites.
10. 8.7 — muerte/limpieza/recompensas pendientes.
11. 8.8 — matriz completa, perf, smoke real, cierre en GOAL.

## Progreso

- [x] Completado (2026-07-30): 8.0a daño simétrico. `resolveAttack` en `packages/shared/src/combat.ts`;
      `resolvePhysicalDamage` delega en él (regresión probada por construcción). 4 tests nuevos.
- [x] Completado (2026-07-30): 8.0b FSM visual de 11 estados. `domain.ts` reusa
      `CharacterAnimationState` de `@brecha/shared` en vez de un union propio más angosto;
      `resolveCharacterState` implementa las reglas de prioridad de GOAL.md 6.1 (`dead` absorbente,
      `downed` bloquea ataques, `stunned` bloquea movimiento+habilidades). 5 tests nuevos. Todavía sin
      wiring en `runtime.ts` — no hay ningún productor real de esos estados hasta 8.4/8.6, wirearlo
      antes sería código muerto.
- [x] Completado (2026-07-30): 8.0c validador de assets generalizado. `AssetManifestEntry` ahora
      lleva `entityId`; `validateAssetManifest` agrupa por entidad (ids/capas globales siguen únicos)
      y admite 64 o 128px. El Guardián conserva su contrato exacto de 4 capas vía `REQUIRED_LAYERS`
      (runtime.ts sigue asumiendo que armor/weapon existen); cualquier otra entidad sólo necesita una
      capa `body`. 3 tests nuevos (multi-entidad válida, entidad sin `body` rechazada, tamaño de frame
      inválido rechazado); las 87 pruebas totales siguen verdes, incluida la reordenación exacta de
      chequeos (capa duplicada antes que id duplicado) que un test existente ya fijaba.
- [x] Decidido (2026-07-30): 8.0d (`SimulationWorld` de paso fijo) se pospone y se funde con 8.2/8.3
      — ver Decisiones. No es un paso pendiente aparte; se retoma dentro de 8.2.
- [x] Completado (2026-07-30): 8.1 tuning de enemigos. Nuevo `enemyTuning` en `game-data`
      (`schemas.ts`/`catalog.ts`/`validation.ts`), separado de `enemies` (descriptivo) igual que
      `guardianCombat`/`guardian`: `maxHealth`, `armor`, `moveSpeedPxPerSec`, `detectRadiusPx`,
      `loseTargetRadiusPx` (histéresis validada > `detectRadiusPx`), `leashRadiusPx`,
      `attack{windupMs,impactMs,recoveryMs,rangePx,arcDegrees,damageMultiplier,cooldownMs}`,
      `telegraphMs`, `xpReward`, `animationIds`/`frameSize` (reservados, sin cross-ref a
      animaciones reales todavía — no hay sprites de enemigo). `GAME_DATA_VERSION`/
      `BALANCE_VERSION` → `2026.07.30.2`. 2 tests nuevos (duplicados rechazados, histéresis
      exigida); 88 tests totales verdes, typecheck/lint/format:check verdes.
- [x] Completado (2026-07-30): 8.2 (parte 1) FSM de IA pura. Nuevo
      `packages/shared/src/enemy-ai.ts` (`decideEnemyState`): 9 estados, `dead` absorbente,
      `stunned` interrumpe y al recuperarse reevalúa desde cero (sin memoria del estado previo),
      leash (`distanceFromSpawnPx > leashRadiusPx`) fuerza `retreat` incluso con blanco en rango,
      detección exige radio + línea de visión pero sostener la persecución sólo exige distancia
      (histéresis vía `loseTargetRadiusPx`), `restState` (`idle`/`patrol`) es un dato de entrada, no
      una decisión hard-codeada por enemigo. 7 tests nuevos. Todavía sin `SimulationWorld` ni
      steering (ver Trabajo pendiente) ni wiring a `runtime.ts` — no hay ningún productor real de
      posición/velocidad de enemigos hasta 8.3/8.4.
- [x] Completado (2026-07-30): 8.3 navegación simple. Nuevo `packages/shared/src/steering.ts`:
      `seek`/`flee`/`arrive` (con frenado lineal dentro de `slowingRadiusPx`) y `separation`
      (empuje ponderado por cercanía, promediado y saturado a `maxSpeed`, ignora vecinos exactos en
      la misma posición para no dividir por cero), más `combineSteering` para sumar y saturar
      cualquier combinación. Sin A*, según lo decidido. 5 tests nuevos; 100 tests totales verdes.
      Todavía sin wiring a `runtime.ts` ni `SimulationWorld` (ver Trabajo pendiente) - son funciones
      puras de posición a velocidad deseada, no hay todavía un tick real que las alimente.
- [x] Completado (2026-07-30): 8.2 (parte 2) `SimulationWorld` fusionado. Nuevo
      `packages/shared/src/enemy-simulation.ts` (`stepEnemy`): compone percepción → `decideEnemyState`
      → velocidad de `steering.ts` (chase = seek+separación, retreat = arrive+separación hacia el
      spawn, el resto queda estático) → posición integrada sobre una ventana `[fromMs, toMs)`
      explícita, mismo patrón que `advanceGuardianCombat` (sin acumulador de delta oculto). Sigue sin
      Phaser — el adaptador de escena (`apps/web/src/game/sim/`) que instancia sprites reales y
      alimenta `toMs` desde el reloj del juego queda para 8.4, cuando existan los cinco perfiles de
      enemigo que realmente lo necesiten. 5 tests nuevos (uno de ellos detectó un error de fixture
      propio durante la verificación, no del código — ver Resultados). 105 tests totales verdes.
- [x] Completado (2026-07-30, parcial): 8.4 (parte 1) diferenciación de comportamiento data-driven.
      Nuevo `EnemyMovementStyle` (`'close' | 'keepDistance'`) en `enemy-simulation.ts`, derivado por
      el caller de `behaviors.includes('keep_distance')` — nunca del id — así que sigue sin
      `if (id === ...)` (GOAL.md 8.4). `close` sostiene posición en rango; `keepDistance` huye si el
      blanco queda a menos de la mitad de `attackRangePx`. La idea original (desviar el punto de
      persecución mientras `chase`) resultó ser código muerto: `decideEnemyState` sólo permanece en
      `chase` mientras `distanceToTargetPx > attackRangePx`, así que un perseguidor nunca puede estar
      dentro de su propio rango durante `chase` — el rediseño lo mueve a `attack`/`use_ability`,
      donde "demasiado cerca" sí es alcanzable. 2 tests nuevos (5 reemplazan intentos fallidos, ver
      Resultados). 107 tests totales verdes. Todavía falta mapear `behaviors` → `movementStyle` para
      los 5 enemigos reales y wirear a `runtime.ts` — parte 2.
- [x] Completado (2026-07-30, parcial): 8.4 (parte 2) mapeo real de comportamientos. Nuevo
      `packages/game-data/src/behavior-profile.ts` (`resolveEnemyMovementStyle`): cualquier enemigo
      con la etiqueta `ranged` o `keep_distance` kitea, el resto presiona en melee — sigue siendo
      dato → comportamiento, nunca id → comportamiento. `EnemyBehaviorSchema` extraído como schema
      nombrado (antes era un enum anónimo inline en `EnemyDefinitionSchema`) para poder tipar la
      función. Probado contra los 5 enemigos reales del catálogo: `possessed_archer` y
      `dark_shaman` (ambos `ranged`) → `keepDistance`; `corrupted_minion`, `root_brute`,
      `unstable_beast` → `close`. 2 tests nuevos; 109 tests totales verdes. Todavía falta el
      wiring a `runtime.ts`/Phaser (instanciar sprites reales, spawnear los 5 tipos) — eso espera a
      tener arte real de enemigo, sigue fuera de alcance de este documento hasta entonces.
- [x] Completado (2026-07-30): 8.5 proyectiles y telégrafos. Nuevo
      `packages/shared/src/projectiles.ts`: `Projectile` (posición por `atMs`, expira al alcanzar
      `maxRangePx`, `projectileHitsTarget` vía `targetWithinRadius`) y `Telegraph` (fase calculada
      con aritmética modular sobre `repeatMs` — `isTelegraphActive`/`telegraphResolvesAt` distinguen
      correctamente la ventana de aviso del hueco inactivo entre ciclos; sin `repeatMs` es un
      telégrafo de un solo disparo). Construido una sola vez para que el jefe del Paso 10 lo
      reutilice. 6 tests nuevos — el primer diseño de `telegraphResolvesAt` (basado en "inicio del
      ciclo actual") fallaba en el hueco entre ciclos (ver Resultados); el segundo, con fase modular,
      pasó los 6 tests sin ajustes. 115 tests totales verdes.
- [x] Completado (2026-07-30): 8.6 modificadores élite. Nuevo `packages/shared/src/elites.ts`:
      `ELITE_MODIFIERS` con `Veloz` (×1.5 velocidad) y `Resistente` (×1.75 vida, +10 armadura),
      `selectEliteModifier` vía el mismo `RandomSource` seedeado que el resto del combate (nunca
      `Math.random`), `applyEliteModifier` genérico sobre cualquier tuning con
      `maxHealth`/`armor`/`moveSpeedPxPerSec`. 4 tests nuevos; 119 tests totales verdes. Todavía sin
      wiring a `game-data`/`runtime.ts` (sin visual/nombre de élite en el HUD todavía) — eso llega
      junto con el resto del wiring de Phaser pendiente.
- [x] Completado (2026-07-30): 8.7 muerte, limpieza y recompensas pendientes. Nuevo
      `packages/shared/src/enemy-lifecycle.ts`: `EnemyRewardLedger` deduplica XP pendiente por
      `enemyInstanceId` (mismo patrón de dedup que `applyBattleThirst`, así un evento de derrota
      repetido/reenviado nunca paga dos veces — sin inventario real todavía, sólo el contador de XP
      pendiente que pide GOAL.md); `isReadyForCleanup` da el momento en que una entidad muerta puede
      liberarse, separado de la muerte misma (inmediata vía `decideEnemyState`) para dejar tiempo a
      una animación de muerte. 3 tests nuevos; 122 tests totales verdes. Sigue sin wiring a
      `runtime.ts` (no hay entidades de enemigo reales que limpiar todavía).
- [-] Parcial (2026-07-30): 8.8 matriz de pruebas y presupuesto de rendimiento. 123 pruebas
  verdes cubren todo el núcleo puro (8.1-8.7); nuevo test de presupuesto de rendimiento en
  `enemy-simulation.test.ts` — 40 enemigos × 60 ticks (1 segundo simulado a 60 Hz) con
  separación entre todos ellos corre en ~56ms de cómputo puro, muy por debajo del presupuesto.
  **No** cerrado: sigue faltando el smoke real de navegador y el cierre en GOAL.md, porque no
  hay assets de sprite de enemigo ni adaptador de Phaser todavía — no hay nada visual que
  probar. `GOAL.md` (Paso 8) se actualizó para reflejar exactamente este estado (tareas
  marcadas `[x]`/`[-]`/`[ ]` una por una, fila nueva en el Registro de progreso), sin marcar el
  paso como completado.
- [ ] Pendiente: el wiring a Phaser de 8.4-8.7 (requiere assets de enemigo) y el cierre real de 8.8.

## Pruebas

- `pnpm test` debe seguir en 77+ tests verdes en todo momento; cada milestone agrega los suyos.
- 8.0a: `resolveAttack` produce los mismos números que `resolvePhysicalDamage`/`applyDamageTaken`
  ya probados (regresión, no una fórmula nueva).
- 8.0d: dos ejecuciones del mismo seed + misma secuencia de comandos producen streams de eventos
  idénticos, tanto a 60 Hz continuos como con un salto de reloj simulando un stall de 2 segundos.

## Criterios de aceptación

Ningún criterio de Paso 7 se rompe (77 tests + smoke siguen verdes). Cada milestone de este
documento queda marcado `[x]` sólo con test o verificación manual nombrada, nunca por intención.

## Resultados

- 2026-07-30 (8.1): tuning numérico completo para los 5 enemigos existentes, ver Progreso. Sin
  sorpresas de arquitectura: el patrón `guardianCombat`/`guardian` ya establecido en Paso 7 se
  extendió limpiamente a `enemyTuning`/`enemies`. Único ajuste durante la verificación: el chequeo
  de "cobertura exacta" que había agregado en `validation.ts` resultó ser código muerto (el schema
  ya garantiza 5 entradas únicas de un enum de exactamente 5 valores, así que la cobertura total es
  automática) — se eliminó en vez de dejarlo sin poder alcanzarse nunca por un test.
- 2026-07-30 (8.2 parte 2): dos de los 5 tests iniciales de `stepEnemy` fallaron en la primera
  corrida, pero el bug estaba en el fixture de test, no en `stepEnemy`: usaban un blanco a 1000px
  con `loseTargetRadiusPx: 320`, así que el enemigo correctamente perdía el blanco y volvía a
  `restState` en vez de perseguir — el comportamiento esperado del test era incorrecto, no el
  código. Corregido acercando el blanco a 300px (dentro del radio de histéresis); los 5 tests
  quedaron verdes sin tocar `stepEnemy`.
- 2026-07-30 (8.4 parte 1): el primer diseño de `keepDistance` desviaba el punto de `seek` durante
  `chase` hacia el borde de `attackRangePx` en vez del blanco exacto. Los tests lo probaban con un
  solo tick grande y fallaron; investigar por qué reveló que el diseño entero era alcanzable en
  cero casos reales — `decideEnemyState` ya garantiza `distanceToTargetPx > attackRangePx` en todo
  momento que el estado sea `chase`, así que el punto desviado y el blanco real siempre están del
  mismo lado (misma dirección de movimiento), sin importar el tick. Se descartó esa rama entera (no
  quedó como código muerto) y se reubicó la lógica en `attack`/`use_ability`, el único estado donde
  "demasiado cerca" es alcanzable de verdad. Los tests se reescribieron para probar exactamente eso.
- 2026-07-30 (8.5): el primer diseño de `Telegraph` calculaba "el inicio del ciclo actual o
  anterior" (`currentCycleStart`) y sumaba `telegraphMs`. Antes de escribir los tests se detectó a
  mano que esto da un `resolvesAt` correcto mientras el ciclo está activo, pero devuelve un valor ya
  pasado durante el hueco inactivo entre ciclos (`repeatMs - telegraphMs` de duración) — un
  consumidor real preguntando "¿cuándo resuelve?" durante ese hueco recibiría una respuesta en el
  pasado. Se reemplazó por aritmética de fase módulo `repeatMs` (`phaseMs`), que distingue
  explícitamente "activo ahora" de "en hueco, la próxima resolución es la del siguiente ciclo". Los
  6 tests pasaron sin ajustes con el segundo diseño.
- 2026-07-30 (8.2 parte 1): la FSM pura (`decideEnemyState`) no necesita `SimulationWorld` para
  existir ni para probarse — es una función de entrada/salida sin reloj ni posición mutable. Se
  implementa y prueba primero; la extracción de `SimulationWorld` queda para cuando el adaptador de
  Phaser (`apps/web/src/game/sim/`) necesite alimentar esta FSM con percepción real tick a tick,
  que es el consumidor concreto que 8.0d necesitaba y no tenía.
- 2026-07-30 (8.3): mismo razonamiento que 8.2 — `steering.ts` es aritmética de vectores pura
  (posición → velocidad deseada), no necesita un mundo de simulación para existir ni para
  probarse. `SimulationWorld` sigue pospuesto hasta el adaptador de Phaser (`apps/web/src/game/sim/`),
  que ahora sí tiene dos consumidores reales y completos (FSM + steering) para integrar en vez de
  uno hipotético.

## Trabajo pendiente

Al cerrar esta sesión sin poder cerrar 8.8 del todo, este documento queda como fuente de verdad
para continuar sin releer todo el historial de la sesión que lo escribió. Estado real: todo el
núcleo puro de 8.0-8.7 está implementado, probado (123 tests) y documentado — FSM de IA, steering,
`SimulationWorld` (`stepEnemy`), mapeo de comportamiento a estilo de movimiento para los 5 enemigos
reales, proyectiles/telégrafos, élites, y ciclo de vida de muerte/recompensas. Lo que falta, en
orden de bloqueo:

1. **Assets de sprite para los 5 enemigos** (bloqueante duro — nada de lo siguiente tiene sentido
   sin esto). Requiere una decisión de presupuesto/plan de PixelLab explícita del usuario, igual
   que se hizo para el Guardián/Ranger en la fase de scaffolding.
2. El adaptador de Phaser (`apps/web/src/game/sim/`: `world.ts`, `entities.ts`, `projectiles.ts`,
   `telegraphs.ts`) que instancia los sprites, corre `stepEnemy` en el `update()` de la escena y
   dibuja proyectiles/telégrafos reales.
3. Comportamientos específicos por enemigo que van más allá de melee-vs-ranged genérico: el Chamán
   priorizando aliados válidos (`heal_allies`/`buff_allies`), la Bestia con su telégrafo de
   explosión atado (`telegraphed_explosion`), el Bruto con área/aturdimiento (`area_attack`/
   `stun`) — los primitivos genéricos ya existen (`projectiles.ts`, `Telegraph`), falta conectarlos
   a estos comportamientos concretos.
4. Smoke real de navegador (equivalente al que cerró el Paso 7) y el cierre final en `GOAL.md`
   (Estado del Paso 8 → `[x]`, última fila del Registro).

**Punto de decisión explícito para el próximo loop**: al llegar acá se le presentaron al usuario
tres caminos posibles y el usuario cortó la pregunta pidiendo en cambio que quedara documentado
(este bloque) — todavía **no eligió** ninguno. No asumir ninguno por defecto; la próxima
continuación de este documento debe preguntar primero. Los tres caminos son:

- (a) **Seguir profundizando lógica pura** de comportamientos específicos por enemigo (punto 3
  arriba: Chamán/Bestia/Bruto) sin tocar sprites — mismo estilo de trabajo que 8.1-8.8, sigue sin
  ser visible en el navegador.
- (b) **Generar sprites de los 5 enemigos vía PixelLab** — desbloquea (a) el adaptador de Phaser y
  (b) que el Paso 8 sea real y jugable. Requiere una decisión de presupuesto/plan de PixelLab del
  usuario (mismo tipo de decisión que la del Guardián/Ranger al inicio de la sesión).
- (c) **Avanzar al Paso 9** (mapa y misión / Bosque Corrupto) dejando el Paso 8 documentado tal
  cual está (bloqueado en assets), para no quedar parado esperando una decisión de assets.
