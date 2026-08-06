# Plan de continuacion para Luna: UI, enemigos y pantallas

Este documento es el handoff operativo para continuar el proyecto despues de la integracion visual
del kit de UI. `GOAL.md` sigue siendo la fuente principal de verdad. Si este plan contradice
`GOAL.md`, manda `GOAL.md` y este archivo se corrige en la misma sesion.

La regla de ejecucion es estricta: trabajar solo en el primer milestone incompleto, implementarlo,
probarlo y verificarlo en el navegador antes de iniciar el siguiente. Al cerrar cada sesion, marcar
los checkboxes que tengan evidencia real y agregar una fila al registro de progreso de `GOAL.md`.

## Objetivo pedido por el usuario

1. Hacer mas grande la pantalla principal de juego. Chat, party y barra de habilidades deben quedar
   dentro del recuadro jugable, con un tamano legible; no se permite resolverlo reduciendo toda la
   interfaz con `transform: scale(...)`.
2. Mantener enemigos activos todo el tiempo mediante spawn, muerte, limpieza y respawn continuo.
3. Terminar los flujos de Personaje, Inventario, Habilidades, Expedicion, Modo ausente,
   Comerciante, Cofre y Ajustes.
4. Mejorar sprites y efectos de ataque. Se permiten assets temporales generados, pero deben estar
   identificados como placeholders y respetar el pipeline del proyecto.

## Estado real al 2026-08-03

### Ya realizado y verificado

- La referencia `La Brecha Oscura UI completa (1).zip` fue traducida a tokens, componentes e
  iconos SVG inline reutilizables.
- Existen Menu, Pueblo e Inventario navegables y un HUD React superpuesto a Phaser.
- El HUD muestra vida, Furia, cooldowns y conexion desde el runtime real. Party, chat, recursos,
  buffs, loot y notificaciones siguen siendo fixtures de presentacion.
- El combate local del Guardian, AUTO, pausa, checkpoint y feedback basico de golpes funcionan.
- El nucleo puro de enemigos existe en `packages/shared` y `packages/game-data`: FSM, deteccion,
  steering, separacion, proyectiles, telegrafos, elites, habilidades por comportamiento y ledger de
  recompensa deduplicado.
- `apps/web/src/game/sim/enemy-sim.ts` ya conecta movimiento y ataque generico al runtime. La escena
  usa una composicion de cinco tipos mediante el director de spawn: Esbirro, Arquero, Chaman, Bruto
  y Bestia. El Bruto tiene arte propio; los demas reutilizan temporalmente el Guardian con tint.
- El nucleo puro del Bosque infinito, su tuning de niveles 1 a 20, validacion y planificador
  determinista de oleadas existen y ya se consumen desde Phaser sin recrear el director.
- Ultima verificacion registrada para la integracion UI: `pnpm typecheck`, `pnpm test` (32 archivos,
  175 tests), `pnpm build` y smoke de navegador desktop/mobile. Es evidencia historica; Luna debe
  volver a ejecutar la validacion correspondiente despues de cada cambio.

### Lo que NO esta terminado

- El Milestone 1 de layout del HUD quedó implementado y verificado en desktop, notebook y mobile;
  el Milestone 2 del Paso 8 quedó cerrado con evidencia de ciclo de vida, habilidades, estados
  visuales, pooling y stress.
- El director puro ya coordina spawn inicial, muerte, cleanup diferido y respawn seguro. El runtime
  retira la entidad del controlador, sprites, sombras, tweens y mapas, y deduplica la recompensa XP.
  Los estados visuales aplicables al ciclo de enemigo, el pooling y el stress de 30-40 están
  verificados; `downed/reviving` quedan reservados al ciclo de vida del Guardián.
- La composicion de Phaser rota los cinco tipos (Esbirro, Arquero, Chaman, Bruto y Bestia) y sus
  perfiles de habilidad ya llegan al adaptador visual: melee, proyectil, curacion, area telegrafiada
  y explosion telegrafiada. El runtime usa pools dedicados de proyectiles, telegraphs y bursts, con
  caps de seguridad y reset completo.
- Inventario consume snapshots y operaciones persistentes reales; el Pueblo sigue siendo
  principalmente presentacion y todavia no tiene economia de comerciante/cofre.
- No existen pantallas funcionales de Personaje, Habilidades, Modo ausente, Comerciante, Cofre o
  Ajustes. Expedicion ya tiene una pantalla navegable; el boton Ajustes del menu abre actualmente
  Estado del servidor.
- Party y chat reales no pertenecen al alcance actual. El HUD puede conservar su composicion visual,
  pero no debe presentarlos como sistemas online terminados.

Hay texto historico desactualizado en `GOAL.md` y `docs/plans/step-08-enemies-ai.md` que todavia
afirma que no existe adaptador de Phaser o que el Bruto es estatico. El codigo actual descrito arriba
es la realidad; al cerrar el Paso 8, Luna debe corregir esas lineas sin borrar el historial util.

## Limites de arquitectura

- React compone pantallas, accesibilidad y HUD. Phaser renderiza mundo, personajes y VFX. La logica
  de combate, spawn, progresion y economia no vive en componentes React ni en tweens.
- El spawner se disena como nucleo puro determinista con reloj y RNG inyectables. El adaptador de
  Phaser crea y destruye visuales a partir de eventos del nucleo.
- Las preferencias puramente locales pueden incluir volumen, movimiento reducido, numeros de dano y
  disposicion del HUD. Inventario, build, recompensas, modo ausente, compras y cofres son autoridad
  del servidor y usan operaciones idempotentes.
- Un evento visual nunca causa dano ni entrega recompensas. Solo representa un resultado ya resuelto
  por el dominio.
- No agregar dependencias para resolver layout, spawn o VFX basicos. React, CSS, Phaser y los helpers
  existentes alcanzan para estos milestones.

## Orden obligatorio de trabajo

### Milestone 1 - Agrandar y contener la pantalla principal

Este es el primer trabajo que Luna debe ejecutar. Es una correccion transversal de presentacion y no
autoriza adelantar sistemas de dominio posteriores.

- [x] Hacer que `.game-shell` use el alto y ancho disponibles del viewport sin margenes que achiquen
      innecesariamente el area jugable.
- [x] Mantener topbar y vitals compactos, y asignar el espacio restante a `.gs-stage`.
- [x] Asegurar que canvas, `.gs-overlay`, party, chat, notificaciones y skill dock sean hijos
      visualmente contenidos por `.gs-stage`; ningun panel puede quedar cortado fuera del marco.
- [x] Eliminar el `transform: scale(0.86)` aplicado a los paneles en el breakpoint de 860 px.
- [x] En desktop, mantener party a la derecha, chat abajo a la izquierda y habilidades abajo al
      centro, todos a tamano normal. El centro de combate debe conservar una zona despejada.
- [x] En 1280x720, si no entra todo abierto, usar un modo compacto real (tabs, drawer o panel
      colapsable) con controles accesibles; no escalar una copia ilegible.
- [x] En mobile, usar drawers/tabs para paneles secundarios y mantener las habilidades tactiles con
      objetivo minimo de 44 px. No intentar mostrar simultaneamente todos los paneles desktop.
- [x] Conservar foco visible, labels ARIA, navegacion por teclado y `prefers-reduced-motion`.
- [x] Agregar tests de estructura/interaccion que cubran apertura y cierre del modo compacto.
- [x] Verificar visualmente 1280x720, 1440x900 y 1920x1080, mas un viewport mobile. No debe haber
      overflow horizontal, solapamientos destructivos ni un segundo canvas.

Archivos iniciales:

- `apps/web/src/game/GameHudOverlay.tsx`
- `apps/web/src/game/GameIsland.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/game/GameHudOverlay.test.tsx`
- `apps/web/src/game/GameIsland.test.tsx`

Criterio de cierre: el usuario ve una pantalla principal claramente mas grande, y party, chat y
habilidades estan dentro del recuadro sin haber sido reducidos mediante escala CSS.

### Evidencia Milestone 1 (sesion 2026-08-03)

- `GameHudOverlay` agrega navegacion compacta accesible (PARTY, CHAT, BUFFS y AVISOS) para
  viewports menores a 860 px. El panel seleccionado se muestra a tamano legible y no se renderizan
  simultaneamente todos los secundarios.
- CSS usa `100dvh`, stage absoluto contenido y canvas al 100% del area restante. Se retiro la
  escala `0.86`; los skills conservan objetivos tactiles de al menos 44 px.
- Smoke de navegador: 1440x900, 1280x720, 1920x1080 y 390x844. En todos: `contained=true`,
  `collisions=[]`, `scrollWidth=clientWidth` y un solo canvas. En mobile se probo cambiar PARTY a
  CHAT y se verifico que el panel anterior se oculta sin solapamiento.
- Verificacion automatica: `pnpm exec vitest run apps/web/src/game/GameHudOverlay.test.tsx` (4/4),
  `pnpm test` (32 archivos, 176 tests), `pnpm --filter @brecha/web typecheck`, `pnpm build` y
  Prettier sobre los archivos tocados.
- Milestone 1 cerrado. El siguiente milestone permitido es el respawn continuo del Paso 8.

### Milestone 2 - Cerrar el Paso 8 con enemigos y respawn continuo

No iniciar el Paso 9 ni pantallas de dominio hasta cerrar este milestone.

- [x] Extraer un `EnemySpawnDirector` puro y determinista. Su configuracion define `minActive`,
      `maxActive`, `respawnDelayMs`, `cleanupDelayMs`, puntos seguros, composicion, prefijo de IDs y
      RNG seedeado.
- [x] Agregar al controlador una operacion explicita de retiro de enemigo. Debe limpiar target,
      impactos pendientes y cualquier referencia asociada sin afectar otra instancia.
- [x] Usar IDs de instancia monotonicamente unicos por run. Nunca reciclar un ID muerto.
- [x] Al recibir `targetDefeated`, registrar la recompensa una vez, iniciar el estado/feedback de
      muerte y programar limpieza. El reemplazo espera cleanup y respawn configurados.
- [x] Al limpiar, destruir sprite, sombra, tweens/listeners y los registros en `enemies`,
      `dummyVisuals`, `dummyShadows` y el controlador.
- [x] Mantener al menos `minActive` enemigos durante la partida y nunca superar `maxActive`.
      El runtime ejecuta el ciclo automaticamente y los tests cubren 200 muertes consecutivas.
- [x] Elegir puntos fuera de obstaculos, dentro del mundo y a distancia segura del Guardian. La
      seleccion es reproducible con el mismo seed y rechaza candidatos inseguros.
- [x] Conectar los cinco perfiles por comportamiento: melee, proyectil, curacion de aliados, area
      telegrafiada y explosion telegrafiada. El dano solo resuelve al final del telegrafo.
- [x] Conectar estados visuales minimos `idle`, `walk`, `attack`, `hit`, `death`; se permite fallback
      temporal documentado cuando un spritesheet no exista.
- [x] Agregar pooling o limites para proyectiles, telegrafos y efectos. No crear objetos por frame.
- [x] Corregir el estado del Paso 8 en `GOAL.md` y el ExecPlan viejo con evidencia actual.

#### Evidencia parcial Milestone 2 (sesion 2026-08-03)

- `packages/shared/src/enemy-spawn.ts` implementa el director determinista y
  `packages/shared/src/enemy-spawn.test.ts` cubre llenado inicial, demora cleanup/respawn, puntos
  inseguros y 200 muertes sin registros huerfanos.
- `LocalCombatController.removeDummy` es idempotente y tiene prueba de regresion para impactos
  pendientes; `runtime.ts` conecta el director al ciclo Phaser y mantiene `data-enemies-alive` para
  smoke sin depender de estado visual.
- Verificacion automatica de la sesion actual: `pnpm test` (34 archivos, 186 tests), `pnpm lint`, typecheck de web y
  shared, `pnpm build` y Prettier check.
- Smoke IAB en `http://127.0.0.1:5174/bruto-preview` con AUTO: muestras de enemigos
  `3 -> 2 -> 3` (tambien `1 -> 3` al encadenar muertes), `aria-pressed=true`, cero errores y cero
  warnings de consola. Se reinicio Vite para invalidar el bundle viejo de `@brecha/shared`.
- Ajuste de lectura de combate solicitado: `CAMERA_ZOOM` pasa de `1.6` a `1.6 / 1.3` en
  `apps/web/src/game/presentation.ts`, mostrando aproximadamente 30% mas mundo sin cambiar el
  seguimiento del Guardian. La constante queda cubierta por `runtime.test.ts`.
- Pendiente para cerrar el milestone: pooling y escenario real de 30-40 enemigos con p95/memoria;
  los estados mínimos ya están conectados con fallback.

#### Ajuste de cámara cenital (sesión 2026-08-04)

- `CAMERA_DISTANCE_FACTOR` pasó a `1.55` (`CAMERA_ZOOM ≈ 1.032258`) para mostrar más mundo desde
  arriba.
- El Guardian inicia en el centro del mundo de prueba y la cámara usa `startFollow` inmediato,
  deadzone cero y offset cero; así el personaje permanece visible y seguido también al acercarse a
  los bordes.
- `runtime.test.ts` fija las constantes de zoom/seguimiento; typecheck, build y smoke de navegador
  pasaron sin errores de consola.

Pruebas minimas:

- misma seed + mismos comandos produce la misma secuencia de spawn;
- respawn respeta demora, minimo y maximo;
- 200 muertes consecutivas no dejan targets, sprites ni listeners huerfanos;
- el mismo evento de muerte repetido no duplica XP ni agenda dos reemplazos;
- un punto invalido se rechaza o busca alternativa segura;
- Chamán elige un aliado valido y Bestia/Bruto nunca hacen dano antes del aviso;
- smoke real con AUTO: matar, ver desaparecer y reaparecer enemigos varias veces;
- escenario de 30 a 40 enemigos con frame p95 provisional menor o igual a 16.7 ms y memoria estable.

Archivos iniciales:

- `apps/web/src/game/combat-controller.ts`
- `apps/web/src/game/runtime.ts`
- `apps/web/src/game/sim/enemy-sim.ts`
- nuevo modulo puro bajo `packages/shared/src/`
- datos de composicion bajo `packages/game-data/src/`
- `docs/plans/step-08-enemies-ai.md`

#### Evidencia wiring de habilidades (sesion 2026-08-03)

- `EnemyRecord` resuelve el perfil desde los tags de `GAME_DATA` y el runtime invoca el resolver
  puro para los cinco comportamientos. El adaptador aplica daño ya mitigado una sola vez, cura
  aliados con clamp, abre/resuelve telegraphs en su tick anunciado y mueve proyectiles por las
  primitivas compartidas.
- Proyectiles y telegraphs tienen caps locales (`24` y `12`) para proteger la preview; esto no
  marca como terminado el pendiente de pooling ni reemplaza la medicion de 30-40 entidades.
- Se agregaron pruebas para los cinco perfiles, cooldown de habilidad, daño resuelto, clamp de
  curacion y multiplicador de Piel de hierro. Smoke IAB en `bruto-preview` con AUTO mantuvo
  `data-enemies-alive=3`, `cameraZoom=1.230769`, un canvas y cero errores/warnings de consola.
- Proximo pendiente exclusivo del milestone: pooling y stress de 30-40 entidades. No iniciar el
  Milestone 3/Paso 9.

#### Evidencia estados visuales (sesion 2026-08-04)

- `apps/web/src/game/sim/enemy-visual-state.ts` mantiene un latch de presentación para `hit`
  (temporal) y `death` (terminal hasta cleanup), sin mutar el estado de combate.
- `runtime.ts` mapea IA a `idle/walk/attack`, reinicia ataques mediante tokens de acción y dispara
  la reacción `hit` en `damageApplied`; al derrotar, conserva `death` hasta que `EnemySpawnDirector`
  ordena la limpieza. `pickAnimation` mantiene fallback a `idle` para `root_brute` y cualquier arte
  parcial.
- Se agregó el contrato `data-enemy-visual-states` al canvas para smoke: se observó
  `idle:3,walk:0,attack:0,hit:0,death:0` al iniciar y `idle:2,walk:0,attack:1,hit:0,death:0`
  durante AUTO, con un canvas y cero errores/warnings. Las transiciones `hit/death` quedan cubiertas
  por pruebas puras del latch; el siguiente pendiente es cerrar estados visuales avanzados.

#### Evidencia pooling y stress (sesion 2026-08-04)

- `apps/web/src/game/sim/object-pool.ts` implementa leases acotados, rechazo de doble release y
  reset completo; `runtime.ts` preasigna `24` visuales de proyectil, `12` de telegraph y `64`
  de burst. Al agotarse un pool, se recicla el efecto mas antiguo o se omite solo el feedback
  visual; nunca se crea un `GameObject` durante `update()`.
- El preview acepta `?enemyStress=40` sin alterar la escena normal de 3 enemigos. Usa una grilla
  determinista de puntos seguros, mantiene `data-enemies-alive=40` y expone ocupacion de pools,
  intervalos RAF p50/p95/p99, p95 del callback de update y heap usado mediante atributos `data-*`.
- Smoke final con un canvas: control de 3 enemigos (`?enemyStress=3`) p95 RAF `5.700 ms`, update
  p95 `0.200 ms`, heap `123504090`; stress de 40 enemigos p95 RAF `5.700 ms`, p99 `5.800 ms`,
  update p95 `0.500 ms`, heap `158770075`, `600` muestras. En combate AUTO los pools siguieron
  dentro de capacidad (`projectiles:0/24`, `telegraphs:1/12`, `bursts:0/64`) y la escena mantuvo
  40 enemigos.
- Verificacion automatica de esta sesion: `pnpm test` (37 archivos, 196 tests), `pnpm lint`,
  typecheck web, `pnpm build`, Prettier check y `git diff --check`. En ese corte quedaban los
  estados visuales avanzados, que se cerraron en la evidencia siguiente.

#### Evidencia mapeo visual avanzado (sesion 2026-08-04)

- `enemyAiVisualState` cubre los nueve estados de IA y traduce `detect` a `interacting`,
  `use_ability` a `casting/channeling` segun el perfil y `patrol/retreat` a `moving`; el evento
  `knockback` activa una reaccion temporal independiente de `hit`.
- `mapState`/`pickAnimation` siguen siendo la frontera de arte: los clips que no existen usan el
  fallback estable (`root_brute` vuelve a `idle` para `hit/death/knockback`). Esto cierra las
  animaciones placeholder; los clips finales dedicados quedan como mejora opcional. `downed/reviving`
  no se simulan para enemigos porque el director crea una instancia nueva al respawn.
- `enemy-visual-state.test.ts` queda en 4/4 y el smoke `?enemyStress=40` expone
  `data-enemy-visual-advanced` con los 11 contadores sin alterar el canvas ni la autoridad de
  combate. Los clips dedicados son una mejora opcional del Paso 18 cuando el presupuesto de arte
  lo permita.

#### Cierre del Milestone 2 (sesion 2026-08-04)

- El Paso 8 queda cerrado en `GOAL.md`: los cinco perfiles (`melee_strike`, `ranged_shot`,
  `heal_allies`, `area_attack` y `telegraphed_explosion`) tienen wiring local, telegraph o
  proyectil cuando corresponde, y tests de resolucion/deduplicacion.
- El adaptador visual cubre `idle`, `moving`, `attacking`, `casting`, `channeling`, `interacting`,
  `stunned`, `knocked_back` y `dead`; `downed/reviving` no aplican al enemigo local porque la muerte
  es terminal y el respawn crea una instancia nueva. Los clips ausentes usan fallback explicito.
- `possessed_archer` ahora usa el arte generado de `ranger` (incluye `hit` y `death`); `root_brute`
  conserva su arte propio y los otros tres tipos mantienen tintes de placeholder documentados.
- Evidencia final: `pnpm test` (37 archivos, 197 tests), `pnpm lint`, typecheck web, `pnpm build`,
  Prettier, `git diff --check` y smoke IAB normal/stress con un canvas, respawn continuo y pools
  dentro de capacidad. El unico aviso conocido es el chunk grande de Vite en build.

#### Avance del núcleo del Milestone 3 (sesion 2026-08-04)

- M1-M4 del Paso 9 ya estaban cubiertos por `packages/shared/src/endless-forest.ts` y
  `packages/game-data`. M5 agrega `packages/shared/src/forest-waves.ts`, un planificador puro que
  escala `waveSize`, mezcla la composición con seed explícita y emite `spawnKey` reproducible para
  el adaptador.
- `pnpm exec vitest run packages/shared/src/endless-forest.test.ts packages/shared/src/forest-waves.test.ts packages/game-data/src/validation.test.ts`
  pasa 18/18; la suite completa queda en 38 archivos y 200 tests. Lint, typecheck web, build y
  `git diff --check` también pasan. El único aviso de formato global es el markdown generado bajo
  `.zcode/plans/`, fuera del alcance de este plan.
- El Milestone 3 sigue abierto para persistir el progreso. La instanciación de oleadas y Expedición
  ya están conectadas y no se avanzan pantallas posteriores.

#### Wiring de progreso y HUD (sesion 2026-08-04)

- `runtime.ts` inicializa `ForestProgressState` con `GAME_DATA.endlessForest`, aplica cada derrota
  deduplicada al recibir `targetDefeated` y publica `forestLevel`, `forestXpInLevel` y
  `forestXpToAdvance` en `GameHudSnapshot`. No duplica la recompensa existente: ambos contratos
  comparten el mismo `enemyInstanceId` y el director sigue siendo la puerta de muerte.
- `GameHudOverlay` reemplaza el `0%` de maqueta por porcentaje, umbral, nivel y atributos
  `data-forest-*` para smoke. Test unitario cubre nivel 2, `125 / 300` y el chip de zona.
- Smoke IAB en `http://127.0.0.1:5174/bruto-preview`: un canvas; estado inicial `nivel=1,
0/100`; tras activar AUTO, `nivel=1, 10/100`, `aria-pressed=true`. El renderer reportó avisos
  repetidos de pérdida de contexto WebGL durante la recarga, sin errores de JavaScript; queda como
  riesgo del entorno del preview, no del contrato de progreso.
- Verificación automática posterior: `pnpm test` (38 archivos, 200 tests), `pnpm lint`, typecheck
  web, `pnpm build`, Prettier focalizado y `git diff --check`. El chunk runtime grande de Vite sigue
  siendo el único warning de build conocido.
- `EnemySpawnDirector.configureWave` cambia capacidad/composición sin resetear la secuencia
  monotónica `enemy:N`, ni las ventanas de cleanup/respawn. `runtime.ts` crea la oleada inicial con
  tamaño 3 y al subir de nivel prepara el plan siguiente y actualiza el HUD con el nuevo índice.
- Verificación automática posterior: `pnpm test` (40 archivos, 205 tests), `pnpm lint`, typecheck
  web, `pnpm build`, Prettier focalizado y `git diff --check`. El preview inicial expone un canvas,
  `nivel=1`, `oleada=3` y la cámara alejada; AUTO llegó a nivel 2, oleada 4 y `36/230` XP.
- El Milestone 3 sigue abierto por la instancia/tick y los efectos de dominio de interacción; el
  contrato, preview, persistencia y autoridad de intención ya están conectados. La pantalla
  Expedición ya está conectada al Portal/dock E y al preview local.
- Smoke IAB de esta sesión: `/expedicion` muestra una zona funcional y dificultad Normal; Volver
  lleva a `/pueblo`; Entrar navega a `/bruto-preview` con un canvas, nivel 1 y oleada 3; AUTO alcanza
  nivel 2, oleada 4 y 36/230 XP; consola sin errores ni warnings.
- Base transversal adelantada: `packages/shared/src/interaction.ts` define el contrato puro e
  idempotente para NPC, cofre y reanimación; cinco tests cubren radio, disponibilidad, `oneShot`,
  request inválida y replay/conflicto. No reemplaza el wiring de pantallas ni la autoridad/persistencia
  que se implementarán en los Milestones 4-8.

#### Prioridades posteriores confirmadas (no iniciar todavía)

Cuando se cierre el GOAL completo, el usuario pidió continuar con este orden de producto:

1. Loot y objetos reales (Milestone 4/Paso 11): drops únicos, rarezas, afijos, inventario,
   equipamiento y estadísticas derivadas autoritativas.
2. Experiencia del personaje, niveles, stats y árbol de habilidades (Milestone 5/Paso 12), sin
   confundirlo con la progresión de nivel del Bosque del Milestone 3.
3. Ciudad/Pueblo completo (Milestone 7/Paso 17): comerciante, cofre, portal, modo ausente,
   economía idempotente y navegación completa.
4. Efectos, sprites y feedback (Milestone 9/Paso 18): VFX de ataque/impacto/muerte, audio, cambios
   visuales de equipo, pooling y legibilidad.
5. Mapa mundial y nuevas zonas idle: catálogo de zonas desbloqueables, biomas, encuentros, seeds,
   recompensas activas/offline y navegación de mapa. Seguir `docs/plans/post-goal-world-map-idle.md`.

Estas prioridades son backlog posterior: no habilitan saltar la instancia/tick ni los efectos de
dominio pendientes del Paso 9.

### Milestone 3 - Cerrar el Paso 9: Bosque infinito y Expedición

- [x] Reusar `packages/shared/src/endless-forest.ts`; no duplicar sus formulas en Phaser.
- [x] Generar planes puros de oleada con `packages/shared/src/forest-waves.ts`: `waveSize` por nivel,
      composicion seedeada, claves estables y replay determinista.
- [x] Instanciar oleadas por nivel usando el director del Milestone 2, conservando IDs monotónicos y
      ventanas de cleanup/respawn al reconfigurar el plan.
- [x] Conectar la muerte deduplicada con `ForestProgressState.applyDefeat`; el runtime aplica el
      reward una sola vez por `enemyInstanceId` al recibir `targetDefeated`.
- [x] Mostrar nivel y progreso reales en el HUD, reemplazando el `0%` de presentacion.
- [x] Crear pantalla Expedicion para elegir zona/dificultad disponible y entrar/salir de forma
      coherente. `apps/web/src/screens/Expedition.tsx` ofrece Bosque Corrupto + Normal, deja
      Corrupcion intensa bloqueada y entrega una seleccion estable al router; Pueblo (portal y dock
      E) abre la pantalla, y entrar/salir no duplica el runtime Phaser.
- [x] Verificar avance 1 -> 2, escalado de composicion y reentrada sin duplicacion de progreso.
      Smoke confirma nivel 2/oleada 4; `endless-forest-runtime.test.ts` recorre 1→20 con XP del
      catalogo y las pruebas del director preservan IDs monotónicos.
- [x] Conectar `applyInteraction` al runtime y a la entrada `F` para NPC, cofre y reanimación, sin
      mutar el ledger en UI y conservando replay/conflicto por `operationId`. Smoke: el cofre inicial
      acepta `F`, el ledger queda en `1`, el prompt desaparece y no se duplica el canvas; no hay loot
      ni recompensa de servidor en este preview.
- [x] Persistir `ForestProgressState` con versión/migración y pruebas antes de abrir pantallas de
      dominio posteriores. `CharacterForestProgress` tiene migración SQL/backfill, envelope V1,
      validación de curva y repositorio server-side con ownership, revisión optimista y transacción
      `Serializable`; la integración cubre round-trip y conflicto de revisión.
- [x] Cerrar el estado no terminal del Guardián a 0 vida: habilidades y movimiento quedan bloqueados,
      AUTO se detiene, el runtime usa el estado visual `downed`/death y el HUD muestra `DERRIBADO`.
      La reanimación efectiva se agenda en el tick de instancia y se registra en el ledger durable.

#### Wiring local de interaccion (sesion 2026-08-04)

El adaptador local de preview en `apps/web/src/game/interaction-runtime.ts` y `runtime.ts` conecta
`F` con targets visuales de cofre, NPC y reanimacion, conserva el ledger fuera de React y publica
`data-interaction-*` para smoke. No entrega loot ni reemplaza la autoridad/persistencia del servidor.

#### Persistencia V1 del Bosque (sesion 2026-08-04)

`packages/shared/src/forest-progress-save.ts` define el envelope y migrador V1; el array de derrotas
se ordena al serializar y se reconstruye como `ReadonlySet` validado contra la curva. La migración
`20260804000000_forest_progress_persistence` crea/backfillea `CharacterForestProgress`, y
`ForestProgressRepository` prueba carga, guardado, ownership y rechazo de revisiones obsoletas.
La API sólo expone GET para hidratar; la mutación de derrotas/recompensas sigue siendo server-side.

#### Adaptador server-side de interacción (sesion 2026-08-04)

`InteractionCommandSchema` recibe sólo `schemaVersion`, `operationId`, `zoneId` y `targetId`.
`InteractionAuthorityService` deriva el actor de la sesión, toma posición/estado del tick como
contexto interno, usa `CORRUPTED_FOREST_INTERACTION_TARGETS` desde `@brecha/game-data` y persiste
estado V2 con `oneShot`/cooldowns más recibos exactos por operación. El contrato compartido declara
duración, estados permitidos, interrupción por daño, autoridad, `resultId` y texto de UI. Las pruebas
cubren aceptación, replay distante, consumo, conflicto, estado, interrupción, cooldown y rechazo por
alcance. El WebSocket acepta `INTERACT_INTENT` sobre posición/estado del tick de instancia, con rate
limit y secuencia, emite `INSTANCE_SNAPSHOT` y agenda la finalización. `InteractionEffectService`
registra reanimación/diálogo una sola vez; loot queda como autorización pendiente hasta el dominio de
objetos.

#### Contrato reusable V2 de interacción (sesión 2026-08-04)

Se completaron los campos declarativos exigidos por GOAL: estado permitido, duración, interrupción
por daño, autoridad, `resultId`, cooldown y UI. `applyInteraction` normaliza defaults, expone
`startedAtMs`/`completesAtMs`, conserva un ledger V2 con cooldowns y rechaza estado/interrupción/
cooldown de forma determinista. `20260804020000_interaction_contract_v2` migra filas V1 sin borrar
recibos. La suite quedó en 44 archivos/223 pruebas unitarias y 2 archivos/17 integraciones.

#### Estado visual del Guardián derribado (sesión 2026-08-04)

`tryActivateAbility` rechaza intentos cuando la vida es 0 con `reason: downed`. El runtime fuerza
velocidad cero, detiene AUTO, conserva el target de reanimación y cambia el actor a `downed`/death;
`GameHudOverlay` expone `data-guardian-state="downed"`, el aviso `DERRIBADO` y controles de combate
deshabilitados. La recuperación y sus efectos económicos no se resuelven localmente: permanecen en
el pendiente de instancia/tick autoritativo.

#### Estado autoritativo de instancia (sesión 2026-08-04)

`packages/shared/src/instance.ts` define el estado puro versionado de una instancia activa y sus
transiciones de reloj/tick, movimiento normalizado, límites de mundo y estados de jugador.
`ActiveInstanceRegistry` lo conserva en memoria por personaje, valida ownership/zona/dificultad y el
WebSocket ya procesa `MOVE_INTENT`; `INTERACT_INTENT` toma posición/estado desde ese tick y ambos
comandos reciben `INSTANCE_SNAPSHOT`. `InteractionEffectService` registra finalizaciones una sola vez:
reanimación/diálogo se aplican y el cofre deja autorización `PENDING_DOMAIN` hasta el dominio de loot.
La party básica ya sincroniza hasta cuatro miembros y snapshots compartidos; combate, enemigos,
limpieza durable y reconexión completa siguen pendientes. Verificación de la sesión: 48 archivos/
245 pruebas unitarias y 2 archivos/20 integraciones.

#### Party y sincronización de jugadores (sesión 2026-08-04)

- `packages/shared/src/party.ts` y `network.ts` versionan snapshots de party y las intenciones de
  crear, unirse, readiness, iniciar y salir. El contrato limita el snapshot a cuatro miembros y no
  acepta identidad, lista ni estado final desde el cliente.
- `apps/server/src/gameplay/party-registry.ts` implementa lobby process-local con código único,
  ownership, capacidad, transferencia de líder, readiness, bloqueo al iniciar y rechazo de joins
  posteriores. `ActiveInstanceRegistry` ahora comparte un único estado/tick/revisión entre todos los
  miembros y permite leave seguro.
- `/ws` autentica los comandos, emite `PARTY_SNAPSHOT`, materializa la party en una instancia común y
  retransmite `INSTANCE_SNAPSHOT` a los sockets conectados. La integración de dos clientes cubre
  create/join/ready/start, movimiento compartido y reconexión del líder con snapshot autoritativo.
- Verificación: `pnpm test` (48 archivos/245 pruebas), `pnpm test:integration` (2 archivos/20
  integraciones), typecheck server y Prettier focalizado. El cleanup TTL y la reconexión de lobby ya
  están cubiertos; la persistencia social durable y la resolución completa de enemigos siguen fuera.

#### Snapshot inicial de enemigos (sesión 2026-08-04)

`ActiveInstanceState`/`InstanceSnapshot` incluyen una lista validada de hasta 64 enemigos. El servidor
genera la oleada inicial del Bosque con `createForestWave`, seed estable por `instanceId` y tuning de
nivel 1; todos los miembros de una party observan la misma lista, vida, posición y revisión. El
cliente no puede enviar ni reemplazar enemigos. Esto cierra sólo la sincronización inicial: IA,
ataques, daño, muerte, cleanup y respawn siguen como trabajo de combate/encuentros.

#### Cleanup y reconexión de lobby (sesión 2026-08-04)

`PartyRegistry` registra actividad server-side y expone `cleanupExpired(nowMs, connectedUserIds)`.
Los lobbies se eliminan tras 15 minutos sin actividad sólo si ningún miembro está conectado; la
limpieza se dispara al conectar, al procesar comandos y mediante un intervalo sin mantener vivo el
proceso. Una desconexión del líder no muta el lobby: una nueva conexión autenticada recupera el mismo
código, líder, readiness y revisión. La persistencia social durable continúa deliberadamente fuera
de este hito porque el lobby es estado temporal y el tick no se serializa en PostgreSQL.

Verificación focalizada: `party-registry.test.ts` (4/4) y prueba WebSocket de autenticación/party
(11/11).

#### Ataque autoritativo mínimo (sesión 2026-08-04)

`apps/server/src/gameplay/combat-authority.ts` conecta `COMBAT_INTENT` con el estado compartido:
valida ownership, habilidad, cooldown, Furia, estado, objetivo y alcance; resuelve daño/crit con
RNG determinista, selecciona por arco/radio, aplica múltiples impactos y knockback, devuelve un
resultado replayable por `operationId` y expone la ventana de Piel de hierro/Torbellino. La prueba
WebSocket de dos clientes verifica que `COMBAT_RESULT.hits[]` y el snapshot con la vida mutada
llegan a toda la party. Esta entrada queda supersedida por el bloque de impactos diferidos siguiente;
siguen pendientes IA y ataques enemigos, muerte/respawn y recompensas.

Verificación: `pnpm test` (48 archivos/245 pruebas), `pnpm test:integration` (2 archivos/20
integraciones), `pnpm lint`, `pnpm typecheck` y `pnpm build` correctos; Vite mantiene sólo el warning
conocido del chunk runtime grande.

#### Impactos diferidos por tick (sesión 2026-08-04)

`CombatAuthority` conserva una cola server-side por personaje y expone `advance(characterId, nowMs,
instances)`. Slash y Golpe poderoso seleccionan objetivos al aceptar el cast y resuelven su daño en
`impactMs`; Torbellino resuelve el primer tick y agenda los offsets restantes desde `tickOffsetsMs`.
El WebSocket ejecuta `advance` antes de cada comando y además usa un intervalo `unref` de 50 ms para
resolver impactos aunque el jugador no envíe otra intención. La respuesta inicial lleva `pending: true`
e `impactAtMs`; cada actualización conserva `operationId`, muta sólo el estado vigente del servidor y
replica `COMBAT_RESULT`/`INSTANCE_SNAPSHOT` a toda la party. Un replay devuelve la versión más reciente
sin volver a aplicar daño. Los objetivos quedan bloqueados al cast para que la autoridad no dependa de
una selección del cliente durante el retraso.

Verificación: `pnpm exec vitest run apps/server/src/gameplay/combat-authority.test.ts packages/shared/src/contracts.test.ts`
(10/10); `pnpm test` (48 archivos/245 pruebas); `pnpm test:integration` (2 archivos/20 pruebas,
incluido resultado pendiente/final para dos clientes); `pnpm lint`, `pnpm typecheck`, `pnpm build`,
Prettier focalizado y `git diff --check` correctos. El build conserva únicamente el warning conocido
del chunk runtime grande de Vite.

#### Autoridad de enemigos y ataques PvE (sesión 2026-08-04)

`apps/server/src/gameplay/enemy-authority.ts` conecta la FSM y el steering puros con la instancia
activa. Cada instancia se procesa una sola vez por intervalo aunque tenga varios personajes; el
servidor conserva `aiState`, spawn/leash, cooldown y entidades pendientes por enemigo. La acción se
deriva de los tags del catálogo: melee resuelve con la fórmula compartida, el Arquero crea un
proyectil que impacta contra la posición actual, Bruto/Bestia abren telégrafos con resolución diferida
y Chamán cura al aliado más herido. `CombatAuthority` es el único que muta vida/Furia/Iron Skin del
Guardián; la red sólo recibe snapshots server-side. El tuning de atacante (daño, nivel y críticos)
vive en `EnemyAttackTuning` y elevó `GAME_DATA_VERSION`/`BALANCE_VERSION` a `2026.08.04.1`.

Verificación focalizada: `enemy-authority.test.ts` (3/3), incluyendo determinismo melee, proyectil
con impacto posterior y bloqueo sobre Guardián derribado. Verificación completa: `pnpm test` (49
archivos/248 pruebas), `pnpm test:integration` (2 archivos/20 pruebas), `pnpm lint`, `pnpm typecheck`,
`pnpm build`, Prettier focalizado y `git diff --check`. Falta conectar telegraphs/proyectiles a un
evento visual de red, además de muerte/respawn, cleanup, recompensas y loot autoritativos.

#### Muerte, cleanup y respawn autoritativos (sesión 2026-08-04)

Los impactos de `CombatAuthority` guardan `deadAtMs` en la entidad. `EnemyAuthority` mantiene al
enemigo muerto durante `cleanupDelayMs` (500 ms por defecto), cancela acciones/proyectiles/telégrafos
pendientes, lo retira del snapshot y programa el reemplazo después de `respawnDelayMs` (1500 ms).
Los reemplazos reciben un ID monotónico por instancia, vida del catálogo y un punto elegido de forma
determinista fuera del `safeSpawnRadiusPx` de jugadores y enemigos activos. El intervalo server-side
publica snapshots para cleanup/spawn; el cliente no puede adelantar ni fabricar una entidad.

Verificación: `enemy-authority.test.ts` (4/4) cubre muerte, ventana de cleanup, liberación de slot,
ID de respawn, punto seguro y determinismo. Suite: `pnpm test` (49 archivos/249 pruebas),
`pnpm test:integration` (2 archivos/20 pruebas), `pnpm lint`, typecheck, build, Prettier y
`git diff --check` correctos. El ledger de XP/recompensas y loot siguen deliberadamente pendientes.

#### Sincronización de objetivos del Bosque (sesión 2026-08-04)

La decisión de `GOAL.md` §0.1 retira los altares y el jefe de la expedición activa. Para que el
cliente no fabrique ni duplique objetivos, `packages/shared/src/instance.ts` agrega
`InstanceObjectiveState`: ID estable, modo `endless_forest`, estado, progreso y target. La lista
server-side viaja en `INSTANCE_SNAPSHOT`; `ActiveInstanceRegistry` la conserva para todos los
miembros y reconexiones, valida unicidad y rechaza progreso sobre el target. El servidor inicia el
Bosque con el objetivo de nivel 1→20; la XP/recompensa que mueve el nivel permanece en el dominio de
recompensas posterior y no se simula con datos inventados.

Verificación: `packages/shared/src/instance.test.ts` y `apps/server/src/gameplay/instance-registry.test.ts`
(16/16), más el flujo WebSocket de party (`auth.integration.test.ts`, 11/11), que comprueba la misma
lista para los dos jugadores. La suite completa queda en 49 archivos/252 pruebas; integración en
2 archivos/20 pruebas, con lint, typecheck y build correctos.

#### Reanimación autoritativa (sesión 2026-08-04)

La reanimación ya no se resuelve sólo en el preview. `revive-authority.ts` selecciona el compañero
derribado más cercano server-side y `InteractionAuthorityService` guarda ese destinatario en el
recibo como `effectCharacterId`, por lo que un retry después de reconectar no puede cambiar el
objetivo. `ActiveInstanceRegistry` conserva la interacción pendiente, compara la vida del actor al
inicio con la vida al completar y marca daño como interrupción, incluso cuando el golpe y la
finalización ocurren en el mismo tick. El timer autoritativo usa `advanceWithEvents`, aplica el efecto
durable una sola vez y replica `INTERACTION_EFFECT`/`INTERACTION_INTERRUPTED` más el snapshot a todos
los miembros de la party.

Verificación: `revive-authority.test.ts` (3/3), `instance-registry.test.ts` (8/8), persistencia de
interacciones (9/9), suite completa 51 archivos/261 pruebas e integración 2 archivos/20 pruebas.

#### Reconexión, cierre de sesión y métricas (sesión 2026-08-04)

La reconexión del transporte queda cerrada para la instancia process-local: al abrir un nuevo
WebSocket con la misma sesión, el servidor reproduce `PARTY_SNAPSHOT` y `INSTANCE_SNAPSHOT` con
`requestId: session`; no usa estado del cliente y conserva la revisión, objetivos, jugadores y
enemigos de la instancia. El timer continúa avanzando impactos de combate e interacciones aunque
el actor no envíe otro comando. Los lobbies sin sockets se mantienen 15 minutos por defecto y sólo
se eliminan al vencer el TTL; las parties `ACTIVE` no aceptan miembros tardíos.

El Bosque infinito no tiene victoria/derrota terminal: el estado `downed` del Guardián se recupera
con reanimación autoritativa; XP/oro/materiales de las derrotas ya se entregan por `REWARD_GRANTED`
y el loot como objeto pertenece a los Pasos 11/15. `TrafficMetrics`
instrumenta mensajes y bytes en ambos sentidos, tasas y p95 acotado de snapshots; el endpoint
autenticado `GET /api/metrics/network` expone una ventana de 60 s sin payloads ni IDs.

Verificación focalizada: `party-registry.test.ts` (4/4), `instance-registry.test.ts` (8/8),
`traffic-metrics.test.ts` (3/3), integración WebSocket de reconexión (lobby y partida activa),
suite completa 51 archivos/261 pruebas e integración 2 archivos/20 pruebas. No abrir Paso 15 ni
inventario/loot hasta que el checklist restante del Paso 14 y su verificación completa estén
actualizados.

#### Recompensa individual de enemigo (sesion 2026-08-04)

`EnemyRewardService` valida actor/personaje, calcula la progresion con `forest-enemy-reward.1`,
actualiza Character/CharacterProgress/CharacterForestProgress y registra `RewardLog` dentro de una
transaccion serializable. El hash protege replay/conflicto; los IDs de transporte y `sourceId` usan
digests acotados para respetar `VarChar(128)`. El servidor emite `REWARD_GRANTED` por destinatario
con XP/oro/materiales como strings y `replayed`; no crea objetos ni acepta cantidades del cliente.
La integracion usa un fixture de vida reducida unicamente para hacer determinista la derrota del
arnes. Las instancias de loot, drops privados y pantalla de resultados siguen pendientes del
Milestone 4.

#### Presentación de eventos autoritativos (sesión 2026-08-04)

`game-session.ts` conecta el WebSocket autenticado del servidor, descarta JSON sobre el límite y
reintenta con backoff acotado hasta desmontar la isla. `game-events.ts` aplica `ServerEventSchema` y
traduce `REWARD_GRANTED`, derrotas, efectos, interrupciones y rechazos a notificaciones/loot
visibles. `GameRuntime.applyServerEvent` y `GameHudSnapshot` mantienen un feed deduplicado y
acotado a ocho entradas; el HUD usa fixtures sólo antes del primer evento. El preview local genera
la misma forma mediante `localDefeatPresentation`, sin convertir cantidades locales en autoridad.

Verificación: `game-events.test.ts` (3/3), `game-session.test.ts` (2/2), `GameHudOverlay.test.tsx`
(6/6), `GameIsland.test.tsx` (4/4) y typecheck web correcto. Con esto el Paso 14 queda cerrado;
los objetos/drop instances y la pantalla de resultados siguen en este Milestone 4.

### Milestone 4 - Paso 11: Inventario, equipamiento y botin

- [x] Mantener el diseno visual actual, pero reemplazar `mockData.ts` por un adaptador tipado de datos
      reales.
- [x] Implementar inventario persistente, equipar/desequipar, comparacion, favorito y venta con
      validacion de ownership en servidor.
- [x] Generar loot con IDs unicos, rareza y afijos desde datos versionados.
- [x] Hacer atomicas e idempotentes las operaciones. Reintentar una request no duplica ni pierde
      objetos.
- [x] Equipar cambia estadisticas reales; el smoke ya muestra overlays placeholder de arma/armadura
      derivados del loadout server-side. Las capas authored por frame quedan pendientes del Paso 18.

### Milestone 5 - Paso 12: Personaje y Habilidades

- [x] Crear pantalla Personaje con nivel, EXP, atributos derivados, puntos disponibles, equipo y
      comparacion. No calcular stats definitivos en React.
- [x] Crear pantalla Habilidades con activas, pasivas, requisitos, puntos y barra equipada.
- [x] Centralizar curva de EXP, costos y prerequisitos en datos versionados.
- [x] Guardar la build en servidor y validar que el cliente no gaste puntos inexistentes.
- [x] Reusar la barra actual del HUD como consumidor de la build real.

### Milestone 6 - Paso 16: Modo ausente

- [ ] Implementar la calibracion autoritativa de 5 minutos definida en `GOAL.md`.
- [ ] Congelar un snapshot de build; cambios posteriores no alteran el calculo.
- [ ] Calcular en servidor con limite inicial de 8 horas y eficiencia provisional de 80 por ciento.
- [ ] Crear pantalla Preparar modo ausente, estimacion, estado en curso e informe/reclamo.
- [ ] Persistir antes de mostrar y reclamar en transaccion idempotente. El reloj del cliente no se usa.

### Milestone 7 - Paso 17: Comerciante, Cofre y ciclo del Pueblo

- [x] Definir contrato compartido de interacción (`packages/shared/src/interaction.ts`) V2 con
      recibos por `operationId`, razones de rechazo, estados, duración, interrupción, autoridad,
      resultado, cooldown y ledger inmutable para NPC/cofre/reanimación/extensiones.
- [ ] Comerciante: catalogo versionado, comprar/vender atomico, confirmaciones y registro economico.
- [ ] Cofre: mover objetos entre inventario y almacenamiento sin perder ni duplicar. Si tiene una
      recompensa aleatoria, la resuelve el servidor con `operationId`; nunca `Math.random` en UI.
- [ ] Portal: enlazar con Expedicion y acceso al Modo ausente.
- [ ] Completar navegacion sin callejones: toda pantalla tiene salida clara al Pueblo o al juego.

### Milestone 8 - Ajustes funcionales

La carcasa visual puede disenarse antes, pero solo se considera funcional cuando controla sistemas
reales.

- [ ] Corregir el boton Ajustes para que no abra Estado del servidor.
- [ ] Separar ajustes locales (volumen, numeros de dano, movimiento reducido, modo de HUD) de futuras
      preferencias de perfil.
- [ ] Persistir ajustes locales con version y defaults seguros; un valor corrupto vuelve al default.
- [ ] Permitir silenciar audio y reducir efectos sin cambiar reglas de combate.

### Milestone 9 - Paso 18: sprites, VFX, audio y pulido

- [ ] Reemplazar placeholders segun prioridad: silueta/lectura del ataque, muerte, enemigos comunes,
      luego cosmetica secundaria.
- [ ] Mantener manifiestos, pivote de pies estable y direcciones/estados definidos por `GOAL.md`.
- [ ] Separar VFX de hitboxes y timestamps de impacto.
- [ ] Validar licencias, tamano de descarga, pooling y legibilidad con muchos enemigos.

### Milestone 10 - Mapa mundial y nuevas zonas idle (post-GOAL)

- [ ] Definir y validar `ZoneDefinition` versionado, requisitos, biomas, encounters y reward profiles.
- [ ] Crear mapa mundial con zonas bloqueadas/desbloqueadas y entrada estable a Expedición.
- [ ] Implementar una segunda zona como vertical slice con seed, spawn seguro, presupuesto y
      recompensa antes de producir más contenido.
- [ ] Separar progreso de zona, nivel del personaje y nivel del Bosque; no duplicar fórmulas.
- [ ] Reusar el cálculo agregado del modo ausente con tiempo de servidor, cap, versión e
      idempotencia; no simular cada frame offline.
- [ ] Verificar conectividad, balance, reconexión, replay/claim y stress de entidades.

El ExecPlan autocontenido está en `docs/plans/post-goal-world-map-idle.md` y no se inicia hasta
cerrar los Milestones 3–9 según `GOAL.md`.

## Matriz de pantallas para no confundir maqueta con sistema terminado

| Pantalla     | Estado actual                                         | Fuente final                               | Paso que la habilita |
| ------------ | ----------------------------------------------------- | ------------------------------------------ | -------------------: |
| Juego/HUD    | Funcional parcial; party/chat/recursos son fixtures   | Snapshot del runtime y DTOs del servidor   |            8, 9, 13+ |
| Personaje    | Snapshot real con atributos y stats derivados         | Stats, nivel, build y equipo autoritativos |                   12 |
| Inventario   | Snapshot persistente; overlays visuales provisionales | Inventario persistente                     |                   11 |
| Habilidades  | Catalogo, requisitos, barra y build persistida        | Catalogo y build persistida                |                   12 |
| Expedicion   | Portal/ruta de presentacion                           | Progreso del Bosque y selector valido      |                    9 |
| Modo ausente | No existe                                             | Sesion y calculo del servidor              |                   16 |
| Comerciante  | NPC visual, sin economia                              | Catalogo y transacciones del servidor      |                   17 |
| Cofre        | Acceso visual, sin almacenamiento                     | Inventario/almacenamiento persistentes     |              11 y 17 |
| Ajustes      | Boton redirige a Estado                               | Preferencias locales versionadas           |                18/19 |

## Actualizacion de cierre del Milestone 5 / Paso 12 (2026-08-04)

El Milestone 5 queda cerrado: `/personaje` y `/habilidades` consumen snapshots reales; la curva
1–10, los costos y los requisitos viven en `GAME_DATA.progression`; `ProgressionService` valida
ownership, puntos y habilidades, guarda cada cambio con replay idempotente y el HUD consume las
ranuras equipadas. La evidencia y el siguiente bloque (Paso 15: recompensas/loot privado) estan en
`GOAL.md` y `docs/plans/step-12-character-progression.md`. Las capas authored de sprites siguen
siendo deuda visual del Paso 18.

## Decision sobre sprites y efectos

PixelLab no es obligatorio. Luna/Codex puede generar mientras tanto conceptos, retratos, texturas de
particulas y sprites placeholder. La limitacion es que un generador de imagen general no garantiza
consistencia exacta entre todos los frames, direcciones y pivotes de una animacion.

Estrategia aprobada:

1. Para prototipo inmediato, conservar el Bruto generado y los placeholders tintados, o generar
   placeholders temporales claramente etiquetados.
2. Mejorar ya los ataques con Phaser: arcos, trails, flashes de impacto, particulas, telegrafos,
   hit-stop corto, shake moderado y tint. Esto no requiere PixelLab ni sprites nuevos.
3. Para arte de produccion, usar un flujo consistente por frames (PixelLab, Aseprite/manual u otra
   herramienta determinista), luego procesar por `scripts/pixellab-process-character.mjs` o un
   importador equivalente que emita el mismo contrato de manifiesto.
4. Nunca acoplar IDs del dominio a nombres de archivo temporales. Cambiar arte no debe cambiar
   balance, hitboxes ni IDs de enemigo.

Contrato visual minimo para placeholders:

- cuatro direcciones logicas; se permite generar tres y espejar este/oeste;
- 64x64 como base y 128x128 para grandes/jefes, salvo manifiesto justificado;
- pivote estable en los pies y hitbox independiente del alpha del sprite;
- enemigo: `idle`, `walk`, `attack`, `special`, `hit`, `stunned`, `death`, con fallback explicito;
- telegrafo visible antes de cada ataque peligroso y paleta distinguible del terreno.

## Comandos de verificacion por sesion

Ejecutar los relevantes al milestone y registrar resultados exactos:

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Ademas, hacer smoke en navegador sin errores nuevos de consola o red. Para UI guardar los viewports
verificados; para spawn observar varios ciclos de muerte/respawn; para persistencia probar retry y
doble envio de la misma operacion.

## Riesgos a vigilar

- Achicar paneles con escala CSS oculta el problema de layout y empeora accesibilidad.
- Reutilizar IDs de enemigo puede duplicar recompensa o mezclar impactos pendientes.
- Destruir solo el sprite deja targets muertos, maps y listeners acumulados.
- Conectar todas las pantallas a fixtures da apariencia de avance sin cerrar dominio ni autoridad.
- Generar cada animacion con prompts independientes provoca flicker, pivotes variables y siluetas
  incompatibles.
- Muchos tweens, particles o objetos creados por frame rompen el presupuesto de 30 a 40 enemigos.
- Comerciante, Cofre o Modo ausente resueltos en cliente permiten duplicacion y manipulacion.

## Progreso de este ExecPlan

- [x] Auditar el estado actual de UI, rutas, enemigos, assets y planes anteriores.
- [x] Documentar lo realizado, la deuda real y el orden de dependencias.
- [x] Milestone 1: agrandar y contener la pantalla principal.
- [x] Milestone 2: cerrar Paso 8 con ciclo continuo de enemigos.
- [x] Milestone 3: cerrar Paso 9 y Expedición (el minimapa y los puntos de control quedan
      postergables; el Bosque infinito no tiene fin terminal).
- [x] Milestone 4: Inventario/equipamiento/botin (dominio, UI real, overlays provisionales, contrato
      de compatibilidad y smoke autenticado implementados; arte authored queda para Paso 18).
- [x] Milestone 5: Personaje/Habilidades.
- [ ] Milestone 6: Modo ausente.
- [ ] Milestone 7: Comerciante/Cofre/Pueblo.
- [ ] Milestone 8: Ajustes funcionales.
- [ ] Milestone 9: arte, VFX, audio y pulido.
- [ ] Milestone 10: mapa mundial y nuevas zonas idle (post-GOAL).
- [ ] Recorrido completo y documentacion final.

## Instruccion concreta para Luna

Empezá leyendo `GOAL.md`, este archivo, `docs/plans/ui-ux-reference-integration.md` y
`docs/plans/step-08-enemies-ai.md`. Los Milestones 1 y 2 ya están cerrados con evidencia. La
sesión actual completó pooling, stress, mapeo avanzado, placeholders y el arte existente del
Arquero; los clips dedicados restantes son una mejora opcional del Paso 18. El Milestone 3/Paso 9
queda cerrado en alcance vigente; el Paso 14 también queda cerrado con recompensas de recursos y
presentación de eventos verificadas. El bloque siguiente al Paso 11 fue el Milestone 5/Paso 12,
que ya está cerrado; el siguiente bloque activo es el Paso 15 de recompensas/loot privado.
Al cerrar cada bloque, marcar unicamente los checkboxes con evidencia y agregar la fila de progreso.
El dominio de drops/inventario, los overlays provisionales, el contrato de compatibilidad y el smoke
autenticado ya estan implementados. El Milestone 5/Paso 12 queda cerrado con sus pantallas,
contratos, autoridad y smoke; el siguiente bloque activo es el Paso 15 de recompensas/loot privado.
Las capas authored por frame quedan documentadas como mejora del Paso 18.
