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
- 2026-07-31 (smoke test PixelLab → gaps de integración confirmados con arte real): se generó
  `root_brute` (único enemigo 128px del catálogo) vía `POST /v2/create-character-v3` desde cero
  (pixen → v3, `template_id:"mannequin"`, `view:"low top-down"`, `seed:4201`, 128×128, sin fondo).
  Costo verificado: **3 generaciones** por personaje base (no 1). El arte es legítimo y fiel al
  Bruto de raíces (humanoide de bark/raíces, ojos verdes brillantes, fondo transparente, canvas
  248×248 con padding para animación). El ZIP export v3.1 entregó: `Idle/rotations/{8dirs}.png`
  (una imagen compuesta por dirección, NO un spritesheet) + `metadata.json` con
  `states[0].frames.rotations` + `.animations:{}`. **Tres gaps concretos confirmados contra el
  pipeline actual** (antes de quemar créditos en walk/attack): (1) `pixellab-process-character.mjs`
  asume `animations[state][dir]=[framePaths...]` (lista), pero el estado base entrega
  `rotations[dir]="single.png"` (un archivo) y `animations:{}` — explotaría en `framePaths.map`
  (línea 58); está hecho para personajes con animaciones ya agregadas, no para el idle base.
  (2) El validador `apps/web/src/game/assets.ts` exige 16 frames compartidos / 4 dirs / 4 frames
  por (estado,dir) — layout del placeholder del Guardián; PixelLab da 8 dirs × 1 frame estático
  por estado. Incompatible sin reescribir validador **y** `runtime.ts`. (3) `state_name:"Idle"`
  (capital) vs catálogo `idle` (minúscula) — mapeo de naming. Balance PixelLab tras la prueba:
  37/40 generaciones restantes. `character_id: 30be0b1d-2633-4cec-ba44-13a57cb72379` (vive en la
  cuenta, re-descargable). Token usado pasó sólo inline (no en archivos); **rotar tras usar**.
- 2026-07-31 (Bruto completo + adaptador funcionando): el primer hallazgo (3 gaps de integración)
  se corrigió al descubrir que **ya existe un contrato separado para arte PixelLab real**:
  `apps/web/src/game/pixellab-characters.ts` (`PixelLabCharacter`, con `darkKnight` ya cargado en
  runtime). NO hace falta tocar el validador placeholder `assets.ts` ni su layout 4×4 — ese es
  para el Guardián placeholder; los enemigos van por el camino `PixelLabCharacter`, que soporta
  frame counts variables, 3 dirs generadas (north/south/east, west espeja east), y estados
  separados. El Bruto se generó completo: base (3 gen, idle 8 dirs × 1 frame) + `walk` template
  (10 gen, 8 dirs × 6 frames) + `cross-punch` template (14 gen, 8 dirs × 6 frames) = **27 gen
  totales**, balance 13/40 restante. `cross-punch` reemplaza al inexistente `attack` (la API da la
  lista de templates válidos al 422 sin cobrar — útil para no quemar generaciones a ciegas). ZIP
  export v3.1 confirmado: `Idle/rotations/{8dirs}.png` + `Idle/animations/{walking|
cross_punch_attack}/{8dirs}/frame_00{0-5}.png` + `metadata.json`. **`pixellab-process-character.mjs`
  extendido** (sin romper el uso existente del Guardián/Ranger): `--three-dir` reduce 8→3 dirs,
  `--state-map=A=B` renombra estados del ZIP al contrato (`walking`→`walk`, `cross_punch_attack`→
  `basic_attack`), e idle se sintetiza desde `rotations` si no viene en `animations`. Probado contra
  el ZIP real: produjo 9 spritesheets + manifiesto en `apps/web/public/assets/characters/root_brute/`
  con formato idéntico al de `dark_knight`. Costo de ejecutar el script: `jimp` no es dep del repo
  (el script es offline, como confirma `dark_knight` ya commiteado); se instala efímeramente en un
  temp dir fuera del workspace. **Sigue sin wiring a Phaser para el Bruto** — falta declarar un
  `PixelLabCharacter` para él y conectarlo al adaptador de enemigos (punto pendiente abajo).
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
- [x] Completado (2026-07-30, parcial; corregido 2026-08-05): 8.4 (parte 2) mapeo real de
      comportamientos. `resolveEnemyMovementStyle` sólo deriva `keepDistance` de la etiqueta
      explícita `keep_distance`; `ranged` selecciona el perfil de ataque, pero no hace retroceder
      al enemigo por sí solo. Los cinco enemigos actuales (`possessed_archer` y `dark_shaman`
      incluidos) quedan en `close`; una futura zona puede optar por kite declarando
      `keep_distance`. Sigue siendo dato → comportamiento, nunca id → comportamiento.
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
- [x] Completado (2026-08-04): 8.8 matriz de pruebas y presupuesto de rendimiento. 123 pruebas
      verdes cubren todo el núcleo puro (8.1-8.7); nuevo test de presupuesto de rendimiento en
      `enemy-simulation.test.ts` — 40 enemigos × 60 ticks (1 segundo simulado a 60 Hz) con
      separación entre todos ellos corre en ~56ms de cómputo puro, muy por debajo del presupuesto.
      **No** cerrado en el corte histórico: faltaban el smoke real de navegador y el adaptador de
      Phaser. El wiring posterior y el smoke de 30-40 se documentan en las entradas 2026-08-03/04.
- [x] Completado (2026-08-04): cierre visual y de rendimiento de 8.8. El adaptador cubre los
      estados de enemigo aplicables (`idle/moving/attacking/casting/channeling/interacting/stunned/
knocked_back/dead`), usa fallback seguro para arte parcial y deja `downed/reviving` al ciclo
      de vida del Guardián. `ObjectPool` preasigna proyectiles/telegraphs/bursts y el smoke
      `?enemyStress=40` verificó 600 muestras, p95/p99 y memoria estable.
- [x] Completado (2026-07-30): comportamientos específicos por enemigo (parte lógica pura, camino
      (a) de "Trabajo pendiente"). Nuevo `packages/shared/src/enemy-abilities.ts`: capa de abilities
      que decide _qué hace un enemigo_ en `attack`/`use_ability` (la FSM ya decidía el estado, y
      `stepEnemy` el movimiento). Cinco perfiles data-driven: `melee_strike`, `ranged_shot`
      (Arquero: spawna proyectil hacia el blanco), `heal_allies` (Chamán: cura al aliado con menor
      % de vida, tie-break por id para determinismo, ignora aliados casi full), `area_attack` (Bruto:
      abre telégrafo + aturde), `telegraphed_explosion` (Bestia: anuncia su explosión antes de dañar).
      Reusa `resolveAttack` simétrico y `targetWithinRadius`; daño de área/explosión se resuelve en
      el tick de resolución vía `resolveEnemyTelegraph`, nunca durante la ventana de aviso. Nunca
      deriva del id del enemigo. 16 tests nuevos. `resolveEnemyAbilityProfile` en `game-data` mapea
      los `behaviors` tags de los 5 enemigos reales a su perfil con prioridad explícita (heal > area >
      explosion > ranged > melee); 5 tests nuevos (3 de los 5 enemigos reales + 2 de prioridad).
      Nuevo `enemyAbilityTuning` en el catálogo (radios, multiplicadores, telegraphMs) con
      `GAME_DATA_VERSION`/`BALANCE_VERSION` → `2026.07.30.3`. 155 tests totales verdes,
      typecheck/lint/format:check/build limpios. **Sigue sin wiring a Phaser** (requiere la decisión
      de assets del usuario) — el objetivo de este milestone era desbloquear los criterios de
      aceptación de comportamiento (Chamán prioriza aliados, Bestia no explota sin señal, Bruto
      área/aturdimiento) sin tocar sprites, y eso quedó cumplido a nivel lógica pura y probada.
- [x] Completado (2026-07-30): verificación del modo idle (auto-battle). El commit `83485b8`
      (sesión previa, Claude Code) dejó el modo idle cableado en `runtime.ts`/`GameIsland.tsx` pero
      **sin verificación en vivo**: el panel del navegador in-app dejó de renderizar a mitad de esa
      sesión y no se pudo confirmar visualmente. Esta sesión lo cerró por **test determinista** en
      vez de ojo humano: nuevo `apps/web/src/game/runtime-idle.test.ts` reproduce el bucle de
      decisión exacto de `runtime.ts` (`autoBattle` → dummy vivo más cercano → moverse →
      `activate('slash')` al estar en rango y sin cooldown) contra el `LocalCombatController` real,
      y verifica que tras ~6s de ticks el Guardián cierra la distancia, gasta furia, cicla el
      cooldown de slash y daña al dummy — todo sin input del jugador. 3 tests nuevos (cierre de
      gap + furia/cooldown, no-op con todo muerto, selección del dummy más cercano). 158 tests
      totales verdes. La verificación visual en navegador real sigue pendiente del usuario (el IAB
      no despacha clicks en esta sesión), pero el comportamiento que el idle depende de está probado
      y queda en CI de forma reproducible.
- [x] Completado (2026-07-31): primer enemigo con arte propio wireado a Phaser. `root_brute` (el
      único enemigo 128px del catálogo) se generó completo en PixelLab (27 gen: 3 base + 10 walk +
      14 cross-punch como attack), se procesó con `pixellab-process-character.mjs` extendido, y se
      integró a la presentación sin tocar el validador placeholder ni `runtime.ts`'s layout del
      Guardián. Cambios: `pixellab-characters.ts` declara `rootBrute: PixelLabCharacter` (248×248,
      idle/walk/basic_attack), `animations` pasó a `Partial` con nuevo helper `pickAnimation` que
      hace fallback a `idle` cuando una animación mapeada no existe (el Bruto no tiene hit/death);
      `enemy-visuals.ts` añade `character?` opcional a `EnemyVisual` (cuando está, el dummy usa el
      arte propio sin tint; cuando no, sigue el camino darkKnight+tint — los otros 4 enemigos sin
      tocar); `runtime.ts` precarga/crea animaciones de los enemigos con character via
      `enemyCharactersToLoad()` (recorre el catálogo, así añadir arte a otro enemigo sólo toca
      `enemy-visuals.ts`) y `addDummy` resuelve `visual.character ?? this.character`. 3 tests
      nuevos (root_brute 3 anims a 248×248 + fallback pickAnimation, enemy-visuals character
      asignado). **169 tests totales verdes**, typecheck/lint/format/build limpios. El dummy
      root_brute ahora muestra el coloso de raíces en vez del Guardián tintado (verificación visual
      pendiente del usuario en navegador real, como ya pasaba con darkKnight). Sigue siendo un dummy
      estático del TestScene — el adaptador `apps/web/src/game/sim/` que instancie `stepEnemy` real
      es trabajo posterior.
- [x] Completado (2026-08-03, adaptador de habilidades): `apps/web/src/game/sim/enemy-sim.ts`
      ahora deriva `EnemyAbilityProfile` y cooldown desde `GAME_DATA`; `runtime.ts` conecta los cinco
      perfiles al resolver puro. Proyectiles se mueven/impactan por `projectilePositionAt` y
      `projectileHitsTarget`; áreas y explosiones abren telegraph visible y resuelven únicamente en
      el tick final; el Chamán cura aliados con clamp y el Bruto aplica stun local. Se añadió
      `applyResolvedDamageTaken` para evitar doble mitigación y caps temporales de 24 proyectiles /
      12 telegraphs. Pruebas específicas: 47/47 verdes; smoke IAB AUTO sin errores/warnings. Quedan
      estados visuales avanzados para cerrar 8.8.

- [x] Completado (2026-08-04, estados visuales mínimos): `apps/web/src/game/sim/enemy-visual-state.ts`
      agrega el contrato puro de mapeo `idle/walk/attack` y latches temporales `stunned→hit` /
      terminales `dead→death`. El runtime reinicia ataques por token sin reiniciar la animación en
      cada frame, conserva `death` hasta retirar la entidad y hace fallback a `idle` cuando el
      personaje no tiene el clip solicitado (por ejemplo `root_brute` no tiene `hit/death`). El
      atributo `data-enemy-visual-states` queda sólo como contrato de smoke. 3 tests nuevos;
      targeted 24/24; smoke IAB inicial `idle:3` y AUTO `attack:1`, un canvas y cero
      errores/warnings. Pendientes: estados de ciclo de vida no aplicables al enemigo local
      (`downed/reviving`) y animaciones dedicadas más allá del fallback de PixelLab.
- [x] Completado (2026-08-04, pooling y stress): `apps/web/src/game/sim/object-pool.ts` entrega
      leases acotados y reset completo; `runtime.ts` preasigna pools de `24` proyectiles, `12`
      telegraphs y `64` bursts, recicla el mas antiguo al alcanzar capacidad y nunca crea un
      `GameObject` dentro de `update()`. El harness `?enemyStress=40` mantiene 40 enemigos con
      puntos seguros deterministas y publica metricas `data-*`: baseline de 3 enemigos p95 RAF
      `5.700 ms`/update p95 `0.200 ms`/heap `123504090`, stress p95 RAF `5.700 ms`/p99 `5.800 ms`/
      update p95 `0.500 ms`/heap `158770075`, 600 muestras. 7 tests nuevos; suite total 37/196.
      Restan clips dedicados y los estados de ciclo de vida no aplicables al enemigo local.
- [x] Completado (2026-08-04, mapeo visual avanzado): `enemyAiVisualState` ahora cubre los nueve
      estados de IA (`patrol/detect/use_ability/retreat` incluidos) y distingue `casting` de
      `channeling` según el perfil; `knockback` tiene una reacción temporal propia. `mapState` y
      `pickAnimation` conservan el fallback seguro para `root_brute` y clips ausentes. 5 tests del
      adaptador cubren el contrato; `downed/reviving` quedan reservados al ciclo de vida de otras
      entidades y no se inventan como estados de enemigo.

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

## Estado actual y cierre (2026-08-04)

El Paso 8 está cerrado en `GOAL.md`. El runtime local instancia los cinco enemigos, mantiene
spawn/cleanup/respawn continuo, resuelve sus cinco perfiles de habilidad y publica los estados
visuales aplicables hasta la limpieza. El Arquero usa el arte `ranger` existente con `hit/death`, el
Bruto usa `root_brute` y los otros tres conservan tintes placeholder explícitos. `downed/reviving`
son estados del ciclo de vida del Guardián y no se fuerzan en enemigos cuya muerte es terminal.

Los clips dedicados de los tres placeholders restantes son una mejora opcional del Paso 18, no un
bloqueo de jugabilidad ni motivo para reabrir el Paso 8. El siguiente paso autorizado por
`GOAL.md` es el Paso 9, pero se inicia en una sesión separada después de esta verificación.

## Trabajo pendiente (historial)

### Actualizacion de estado (2026-08-03)

El adaptador local ya existe en `apps/web/src/game/runtime.ts`: instancia una composición de cinco
tipos, ejecuta el movimiento, retira entidades derrotadas y mantiene un ciclo de cleanup/respawn
seguro mediante `packages/shared/src/enemy-spawn.ts`. También conecta los cinco perfiles de habilidad:
melee, proyectil, curación de aliados, área telegrafiada y explosión telegrafiada. El daño de
telegraph se resuelve sólo al finalizar el aviso; proyectiles y telegraphs tienen caps locales de
seguridad. Los estados visuales mínimos ya están conectados: `idle`, `walk`, `attack`, reacción
`hit` temporal, `knockback` y `death` hasta cleanup, con `casting/channeling/interacting` según IA
y perfil, y fallback a `idle` cuando falta arte. Esta capa todavía no cierra el Paso 8: quedan
clips dedicados opcionales; pooling y stress real de 30-40 entidades ya estan verificados. El
preview usa `CAMERA_ZOOM = 1.6 / 1.3` para mostrar 30% más
mundo alrededor del Guardián, sin alterar la simulación. Las notas históricas de abajo describen el
bloqueo anterior y se conservan para no perder decisiones; para el orden operativo actual manda
`docs/plans/luna-continuation-plan.md`.

Al cerrar esta sesión sin poder cerrar 8.8 del todo, este documento queda como fuente de verdad
para continuar sin releer todo el historial de la sesión que lo escribió. Estado real: el núcleo
puro de 8.0-8.7 y el adaptador local de perfiles están implementados, probados y documentados.
Lo que falta, en orden de bloqueo actual:

El arte propio para los cinco enemigos es una mejora opcional: el runtime usa `PixelLabCharacter`
cuando existe (`root_brute`) y fallback tintado para los demás. Los puntos 1 y 2 siguientes
conservan el historial de assets/Bruto, pero ya no bloquean el adaptador ni el primer pendiente.

1. **Assets de sprite para los 5 enemigos** — el flujo está probado de punta a punta. Generar
   cada personaje base cuesta **3 generaciones** (v3 from-scratch); cada estado de animación extra
   (walk, attack) suma **~8-14 generaciones** vía `/characters/animations` (template mode, 1
   gen/dirección, 8 dirs). Un enemigo completo (idle+walk+attack) cuesta **~27 generaciones**.
   `root_brute` ya está generado completo (27 gen, ver Decisiones). Balance PixelLab: **13/40
   restantes** — alcanza para ~0-1 enemigos más completos, o varios idle-only, o walk+attack del
   Bruto si hiciera falta regenerar. `character_id` del Bruto: `30be0b1d-2633-4cec-ba44-13a57cb72379`.
   1b. **Post-procesador adaptado** (HECHO 2026-07-31): `pixellab-process-character.mjs` extendido con
   `--three-dir` y `--state-map`, e idle sintetizado desde `rotations`. Probado contra el ZIP real
   del Bruto: produce 9 spritesheets + manifiesto en formato `PixelLabCharacter` (idéntico al de
   `dark_knight`). **NO hace falta tocar el validador `assets.ts` ni `runtime.ts` del placeholder
   del Guardián** — los enemigos van por el camino `PixelLabCharacter` ya existente en
   `pixellab-characters.ts` (contrato separado, frame counts variables, 3 dirs generadas). La
   conclusión previa ("hay que reescribir el validador") era prematura: no se había visto
   `pixellab-characters.ts` todavía.
2. **Wiring del Bruto a Phaser** (bloqueo histórico de arte, ya resuelto parcialmente): declarar un `rootBrute:
PixelLabCharacter` en `pixellab-characters.ts` (análogo a `darkKnight`), cargar sus sheets en
   el preloader del `TestScene` (junto a `darkKnight`), y conectarlo al futuro adaptador de
   enemigos (`apps/web/src/game/sim/`). El arte ya está en `public/assets/characters/root_brute/`.
3. **HECHO 2026-08-04:** completar el mapeo `idle/walk/attack/hit/death` y los estados avanzados
   (`interacting`, `casting`, `channeling`, `knockback`) con fallback documentado cuando el
   spritesheet no exista. `downed/reviving` quedan reservados a ciclos de vida que no aplican al
   enemigo local.
4. **HECHO 2026-08-04:** reemplazar los caps temporales por pools de `24/12/64` con reset
   completo y ejecutar stress `?enemyStress=40`; ver evidencia de p95/memoria arriba. Queda el
   cierre de estados avanzados.
5. **Smoke HECHO 2026-08-04:** preview normal y `?enemyStress=40` verificados; el cierre final en
   `GOAL.md` (Estado del Paso 8 → `[x]`, última fila del Registro) queda para la revisión de clips
   dedicados opcionales, no para el funcionamiento del runtime.

**Nota de continuidad (2026-08-03)**: el wiring de perfiles y el smoke local ya fueron autorizados
y ejecutados en el loop actual; el bloque de decisión que sigue es histórico y no debe reabrirse
para los pendientes de estados/pooling.

**Actualizacion 2026-08-04**: pooling, stress y mapeo visual avanzado ya no son pendientes del
adaptador local; quedaron implementados y medidos. El siguiente trabajo opcional es generar clips
dedicados/finales, siempre sin avanzar al Paso 9.

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
