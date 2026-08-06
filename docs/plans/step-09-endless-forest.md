# Paso 9 — Bosque infinito por niveles

## Objetivo del usuario

Avanzar por niveles 1→20 del Bosque Corrupto, cada uno más difícil que el anterior, en un bucle
idle/semi-automático continuo. **Sin victoria ni derrota terminal** por ahora: es un idle RPG
infinito (§0.1, §1). El jugador derrote enemigos → acumule XP → suba de nivel → enfrente oleadas
más grandes y enemigos más duros, sin que la partida termine.

## Estado actual

El Paso 8 dejó el núcleo puro de enemigos completo y probado (FSM de IA, steering, `stepEnemy`,
proyectiles/telégrafos, élites, ciclo de vida, abilities por comportamiento) — ver
`docs/plans/step-08-enemies-ai.md`. El núcleo ya tiene adaptador visual y ciclo continuo en Phaser;
los clips dedicados que falten son una mejora opcional del Paso 18.

La misión finita original de GOAL.md (3 altares → puerta del jefe → Guardián Corrupto →
victoria/derrota → regreso al pueblo) **se reemplazó** por el Bosque infinito en esta sesión
(decisión del usuario registrada en §1, §3, §10.1 y en el Registro de progreso). Eso es un cambio
de visión documental previo a cualquier código, igual que el §0.1.

El modelo de niveles, estado de progreso, escalado validado y generación pura de oleadas ya existen.
`EnemyRewardLedger` (Paso 8.7) deduplica XP pendiente por `enemyInstanceId`; `applyDefeat` lo
convierte en progreso de Bosque idempotente y `createForestWave` produce el plan determinista que
consumirá el adaptador de Phaser/servidor.

## Alcance

- **M1**: modelo de niveles del Bosque infinito en `packages/shared` (puro, determinista).
- **M2**: estado de progreso del Bosque (`ForestProgressState`) + `applyDefeat` idempotente con
  avance de nivel en cascada y clamp en nivel máximo.
- **M3**: escalado por nivel en `game-data` (`endlessForest`), 20 niveles monótonos, bump de
  versión de balance, validación semántica de monotonicidad y secuencia 1-20.
- **M4**: tests de comportamiento (escalado monótono, avance de nivel, idempotencia, cascada,
  clamp, determinismo).
- **M5**: planificador puro de oleadas por nivel (`createForestWave`), con composición seedeada,
  tamaño escalado y claves estables para el adaptador.

## Fuera de alcance

- El bloque puro ya no bloquea el adaptador: `runtime.ts` consume los planes y el HUD publica su
  nivel/oleada. El trabajo visual restante es feedback de presentación y verificación de progresión
  completa, no una dependencia de assets.
- **NO Tiled** — decisión del usuario: el Bosque se define por **datos propios** versionados en
  `game-data`, no por un mapa de Tiled.
- **NO victoria/derrota** — decisión del usuario: idle infinito sin fin de partida por ahora. Si el
  Guardián baja a 0 vida, queda en estado no-terminal pendiente de decisión posterior (no
  morir/respawn todavía).
- **NO jefe / altares / puerta** — postergados.
- **NO inventario/loot real** — los enemigos sólo acumulan XP/oro/materiales pendiente (como hoy
  `EnemyRewardLedger`), sin objetos concretos todavía.
- La instanciación visual de oleadas está conectada: `createForestWave` decide cantidad/composición y
  `EnemySpawnDirector.configureWave` reconfigura el director existente sin resetear IDs, ventanas de
  cleanup ni respawn. El recorrido 1→20 ya está cubierto por el contrato determinista y el smoke
  1→2; queda persistencia posterior.

## Arquitectura afectada

- `packages/shared/src/endless-forest.ts` (nuevo): núcleo puro del Bosque. Sin Phaser, sin red, sin
  persistencia. Reusa el patrón de `packages/shared` (reloj/RNG inyectables no necesarios aquí — la
  progresión por XP es determinista pura, no aleatoria).
- `packages/shared/src/index.ts`: export `./endless-forest.js`.
- `packages/game-data/src/schemas.ts`: `ForestLevelTuningSchema`, `EndlessForestSchema`
  (20 niveles, min 1, max 20).
- `packages/game-data/src/catalog.ts`: `buildEndlessForestLevels()` (escalado monótono) + campo
  `endlessForest` en `GAME_DATA`; bump `GAME_DATA_VERSION`/`BALANCE_VERSION` → `2026.07.30.4`.
- `packages/game-data/src/validation.ts`: validación semántica de monotonicidad y secuencia.
- `GOAL.md`: visión (§1, §3, §10.1, §0.1), Paso 9 reescrito, Registro de progreso.

Límites preservados: el núcleo sigue separado de render/UI/transporte. `ForestProgressState` es un
valor inmutable (`Readonly<{...}>`) devuelto por funciones puras — ningún estado global mutable, sin
despistar al servidor sobre autoridad (cuando el Paso 14 llegue, este estado vivirá en el servidor
y el cliente sólo expresará intención, como ya exige AGENTS.md).

## Skills requeridas

- `game-architect`: mantener el core puro sin fugas de Phaser/red/persistencia; límites coherentes.
- `game-balance`: escalado monótono por nivel (vida/daño/oleada/XP), versionado de balance.
- `idle-progression`: el Bosque es el core loop idle — derrotar enemigos acumula progreso sin
  requiring input activo. Esta es la skill de dominio central del paso.
- `automated-playtesting`: tests de comportamiento del núcleo puro (escalado, idempotencia,
  cascada, clamp, determinismo).

`save-and-migrations` aplica a este hito: el envelope V1 y la migración SQL de
`CharacterForestProgress` mantienen el snapshot fuera del núcleo puro, con validación, revisión
optimista y pruebas de round-trip. `multiplayer-authority` sigue limitado al perímetro: no se inventa
un comando de derrota desde el cliente; la mutación y las recompensas quedan para el transporte
autoritativo.

## Archivos relevantes

- `packages/shared/src/endless-forest.ts` (nuevo): modelo de niveles + estado de progreso + reglas
  de avance. Exporta `ForestLevelTuning`, `ForestProgressionCurve`, `ForestProgressState`,
  `ForestEnemyReward`, `createForestProgressState`, `currentLevelTuning`, `levelTuning`,
  `xpToAdvance`, `applyDefeat`.
- `packages/shared/src/endless-forest.test.ts` (nuevo): 7 tests de comportamiento.
- `packages/shared/src/forest-waves.ts` (nuevo): planificador puro de oleadas escaladas y seedeadas.
- `packages/shared/src/forest-waves.test.ts` (nuevo): 3 tests de tamaño, replay determinista y
  validación de entradas.
- `packages/shared/src/forest-progress-save.ts` y su test: envelope V1, migrador explícito,
  serialización estable de `ReadonlySet` y validación de límites contra la curva.
- `apps/server/src/persistence/forest-progress-repository.ts`: agregado PostgreSQL con ownership,
  revisión optimista y transacción `Serializable`; la ruta GET sólo expone el snapshot autenticado.
- `apps/server/prisma/migrations/20260804000000_forest_progress_persistence/migration.sql`: tabla
  versionada y backfill inicial para personajes existentes.
- `packages/game-data/src/interaction-targets.ts`: catálogo de targets compartido por presentación y
  servidor.
- `apps/server/src/characters/interaction-service.ts`: adaptador de autoridad que enlaza identidad
  y posición del tick server-side con `applyInteraction`, con recibos persistentes por operación.
- `apps/server/prisma/migrations/20260804010000_interaction_authority_receipts/migration.sql`:
  estado consumido y recibos de interacción con replay/conflicto.
- `apps/server/prisma/migrations/20260804020000_interaction_contract_v2/migration.sql`: agrega
  cooldowns al estado de interacción y migra filas V1 sin tocar recibos.
- `packages/shared/src/instance.ts` y `apps/server/src/gameplay/instance-registry.ts`: estado
  autoritativo de instancia, tick monotónico, movimiento normalizado y reanudación por personaje.
- `apps/server/src/characters/interaction-effects.ts` y
  `apps/server/prisma/migrations/20260804030000_interaction_effects/migration.sql`: ledger durable
  idempotente para finalizaciones de interacción; reanimación/diálogo aplicados y loot queda
  `PENDING_DOMAIN` hasta el sistema de objetos de los Pasos 11/17.
- `packages/game-data/src/schemas.ts`: schemas nuevos.
- `packages/game-data/src/catalog.ts`: escalado + bump versión.
- `packages/game-data/src/validation.ts`: chequeo de monotonicidad.
- `packages/game-data/src/validation.test.ts`: test del escalado monótono (1 nuevo).
- `GOAL.md`: visión + Paso 9 + Registro.

## Modelo de datos

### `ForestLevelTuning` (data-driven, por nivel)

```ts
type ForestLevelTuning = Readonly<{
  level: number; // 1..20, secuencial
  enemyHealthMultiplier: number; // monotónico creciente
  enemyDamageMultiplier: number; // monotónico creciente
  waveSize: number; // entero, monotónico creciente
  xpToAdvance: number; // XP necesaria para subir de este nivel al siguiente
}>;
```

### `ForestProgressionCurve`

```ts
type ForestProgressionCurve = Readonly<{
  minimumLevel: number; // 1
  maximumLevel: number; // 20
  levels: readonly ForestLevelTuning[]; // length === maximumLevel - minimumLevel + 1
}>;
```

Invariante validada: `levels[i].level === minimumLevel + i`, y health/damage/waveSize son
monotónicamente no decrecientes. `xpToAdvance` puede tomar cualquier valor no negativo (no se
exige monotonicidad — el último nivel lo deja en unused porque el jugador hace tope ahí).

### `ForestProgressState`

```ts
type ForestProgressState = Readonly<{
  level: number; // nivel actual (1..maximumLevel)
  xpInLevel: number; // XP acumulada dentro del nivel actual
  bestLevel: number; // mejor nivel alcanzado (>= level)
  totalXp: number; // XP total acumulada desde el inicio de la partida
  totalGold: number; // oro pendiente acumulado
  totalMaterials: number; // materiales pendientes acumulados
  countedDefeats: ReadonlySet<string>; // ids de instancia de enemigo ya contados
}>;
```

Invariante clave: **idempotencia por `enemyInstanceId`**. Una misma derrota no paga XP dos veces
(mismo patrón que `EnemyRewardLedger` y la Sed de batalla del Paso 7). `countedDefeats` es el set
deduplicador.

### Versiones

- `GAME_DATA_VERSION`: `2026.07.30.3` → `2026.07.30.4`.
- `BALANCE_VERSION`: `2026.07.30.3` → `2026.07.30.4`.
- `endlessForest.tuningStatus`: `'PROVISIONAL'` — cualquier ajuste de escalado futuro es un cambio
  de balance versionado, no un tweak silencioso (cumple AGENTS.md "No cambiar fórmulas o números
  de balance sin fuente configurable, ejemplos y reporte antes/después").

## Flujo de ejecución

```
derrota de enemigo (enemyInstanceId, xp, gold, materials)
        │
        ▼
applyDefeat(state, reward)
        │
        ├─ ¿enemyInstanceId ∈ countedDefeats?  →  sí: return state sin cambios (idempotencia)
        │                                         no: continúa
        │
        ├─ nuevo estado con countedDefeats ∪ {enemyInstanceId},
        │   xpInLevel + xp, totalXp + xp, totalGold + gold, totalMaterials + materials
        │
        ├─ ¿xpInLevel >= xpToAdvance(level) Y level < maximumLevel?
        │     sí: subir nivel (level + 1, xpInLevel -= xpToAdvance(level))
        │          repetir en cascada mientras se pueda subir (un solo derrota puede subir varios
        │          niveles si el reward es grande)
        │     no: quedarse
        │
        ├─ bestLevel = max(bestLevel, level final)
        │
        └─ return nuevo ForestProgressState (inmutable)
```

Todo determinista: misma entrada + mismo estado → mismo resultado, sin reloj ni RNG. Esto es
deliberado — la progresión por XP no tiene aleatoriedad, así que no necesita `RandomSource`
inyectado (a diferencia del combate y los élites).

## Consideraciones multiplayer

El núcleo sigue siendo local y determinista, pero el adaptador de interacción server-side ya define
la frontera: `InteractionCommandSchema` recibe sólo intención, y `InteractionAuthorityService`
enlaza identidad/posición/estado del tick con el catálogo de `@brecha/game-data`. Cada target declara
duración, estados permitidos, interrupción, autoridad, resultado y cooldown; el ledger V2 persiste
consumos/cooldowns y los recibos incluyen ventana de finalización. El WebSocket acepta sólo
`INTERACT_INTENT` sobre la posición de spawn mantenida en servidor; movimiento y snapshots esperan al
Paso 14. No se acepta posición desde el cliente. La idempotencia por `operationId` y por
`enemyInstanceId` evita replay/duplicación, como exige AGENTS.md.

## Consideraciones de persistencia

El núcleo sigue sin importar Prisma ni conocer transporte. La capa server-side usa
`CharacterForestProgress` con `formatVersion: 1`, `stateSchemaVersion: 1`, `dataVersion`,
`balanceVersion` y `revision`; `forest-progress-save.ts` convierte `ReadonlySet` a un array ordenado
para JSON y valida la reconstrucción contra `GAME_DATA.endlessForest`. `ForestProgressRepository`
aplica ownership, escritura optimista y transacción `Serializable`. La migración crea y rellena la
fila para personajes existentes; un snapshot corrupto o de versión desconocida se rechaza sin
reemplazarlo con defaults.

## Consideraciones de rendimiento

`applyDefeat` es O(1) amortizado para un solo derrota (inserción en Set, comparación), salvo la
cascada de level-ups que es O(niveles subidos) — acotado por `maximumLevel - minimumLevel` = 19 en
el peor caso teórico (un solo derrota que sube de 1 a 20). En práctica las recompensas son
pequeñas respecto a `xpToAdvance`, así que casi siempre sube 0 o 1 nivel. Sin trabajo por frame —
`applyDefeat` se llama por derrota, no por tick. No hay presupuesto de rendimiento relevante en
este paso (a diferencia del Paso 8 con 30-40 enemigos por frame).

## Riesgos

- **Recompensa pagada dos veces por replay/evento duplicado** (el riesgo clásico de idle/multiplayer):
  mitigado por `countedDefeats` con idempotencia por `enemyInstanceId`, probado directamente.
- **`bestLevel` desincronizado de `level`**: el primer diseño usaba `Math.max(next.bestLevel,
next.level)` pero leía `next.level` antes del `+1` del level-up, así que `bestLevel` se quedaba
  un nivel atrás tras subir. Detectado por test, corregido calculando `advancedLevel` primero.
- **Cascada de level-ups infinita o que se salta el máximo**: mitigado por clamp en `maximumLevel`
  y por la condición explícita `level < maximumLevel` antes de subir. Probado con un reward
  gigante que fuerza cascada 1→tope.
- **Escalado no monótono por edición accidental de constantes**: mitigado por validación
  semántica en `validation.ts` que rechaza cualquier catálogo donde un nivel posterior sea más
  fácil que el anterior. Este es el principal valor del chequeo — convierte un bug de balance
  silencioso en un error de build.

## Decisiones

- **2026-07-30**: el Bosque pasa de misión finita (altares/jefe/victoria/derrota) a idle RPG
  infinito por niveles. Decisión del usuario, registrada en §1/§3/§10.1 de GOAL.md antes de
  programar nada. Alternativa considerada: mantener la misión finita y superponerle niveles.
  Descartada porque el idle infinito encaja con el pivote de visión §0.1 mejor que una partida
  con fin.
- **2026-07-30**: datos propios (no Tiled) para el Bosque. Decisión del usuario. El escalado por
  nivel es dato versionado en `game-data`, no un mapa. Alternativa considerada: Tiled con
  propiedades por capa. Descartada por el usuario.
- **2026-07-30**: escalado monótono no estricto (cada nivel ≥ al anterior, no necesariamente >).
  Permite igualdad en algún eje si el balance futuro lo pide, pero el escalado actual es estricto
  en los tres (vida +25%/nivel, daño +10%/nivel, oleada +1/nivel). La validación exige ≥ para no
  acorralar el balance futuro.
- **2026-07-30**: sin victoria/derrota terminal. Decisión del usuario. Si el Guardián baja a 0
  vida, queda en estado no-terminal pendiente de decisión posterior. No se implementa
  morir/respawn ahora.
- **2026-07-30**: núcleo puro primero, wiring a Phaser después. Mismo patrón seguro que los Pasos
  7-8: lógica pura probada en `packages/shared` antes de tocar Phaser. El wiring visual llega en
  una sesión posterior y depende además de la decisión de assets de sprite del usuario (mismo
  bloqueo que el Paso 8).
- **2026-07-30**: `applyDefeat` sin reloj ni RNG inyectados. La progresión por XP es determinista
  pura, no tiene aleatoriedad ni dependencia temporal, así que no necesita `Clock`/`RandomSource`.
  Esto la distingue del combate (`advanceGuardianCombat`, `stepEnemy`) que sí los necesita.

## Milestones

1. **M1** — modelo de niveles del Bosque (`ForestLevelTuning`, `ForestProgressionCurve`,
   `currentLevelTuning`/`levelTuning`/`xpToAdvance`). Puro, determinista.
2. **M2** — estado de progreso (`ForestProgressState`) + `applyDefeat` idempotente con cascada y
   clamp.
3. **M3** — escalado en `game-data` (20 niveles monótonos) + bump versión + validación semántica.
4. **M4** — tests de comportamiento (7 en `endless-forest.test.ts` + 1 en `validation.test.ts`).
5. **M5** — generación pura de oleadas (composición seedeada, `waveSize`, claves estables y
   validación), sin crear GameObjects ni depender de reloj.

## Progreso

- [x] Completado (2026-07-30): visión documental. GOAL.md actualizado (§1 Primer objetivo jugable,
      §3 Alcance MVP, §10.1 Mapas → datos propios, Paso 9 reescrito, Registro de progreso con fila
      nueva). Hecho **antes** de programar, como precondición — igual que §0.1.
- [x] Completado (2026-07-30): M1 modelo de niveles. `packages/shared/src/endless-forest.ts` define
      `ForestLevelTuning`/`ForestProgressionCurve` + `currentLevelTuning`/`levelTuning`/
      `xpToAdvance`. Puro, determinista, sin Phaser/red/persistencia. Exportado desde
      `packages/shared/src/index.ts`.
- [x] Completado (2026-07-30): M2 estado de progreso + `applyDefeat`. `ForestProgressState`
      (inmutable, `Readonly`), `createForestProgressState`, `applyDefeat(state, reward)`.
      Idempotente por `enemyInstanceId` vía `countedDefeats` (mismo patrón que
      `EnemyRewardLedger`), level-up en cascada (un derrota puede subir varios niveles), clamp en
      `maximumLevel`. Bug `bestLevel` detectado por test y corregido (ver Riesgos).
- [x] Completado (2026-07-30): M3 escalado en `game-data`. `ForestLevelTuningSchema`/
      `EndlessForestSchema` (20 niveles, min 1, max 20) en `schemas.ts`; `buildEndlessForestLevels()`
      en `catalog.ts` genera escalado monótono estricto (vida ×1.25/nivel, daño ×1.10/nivel, oleada
      +1/nivel, XP redondeada); campo `endlessForest` en `GAME_DATA`;
      `GAME_DATA_VERSION`/`BALANCE_VERSION` → `2026.07.30.4`. Validación semántica en
      `validation.ts`: secuencia 1-20 + monotonicidad health/damage/waveSize. Test en
      `validation.test.ts` verifica rango 1-20, monotonicidad del catálogo real, y que un catálogo
      alterado no monótono y otro fuera de secuencia son rechazados.
- [x] Completado (2026-07-30): M4 tests. 7 tests en `endless-forest.test.ts` (curve access,
      idempotencia de `applyDefeat`, avance de nivel simple, cascada, clamp en máximo, `bestLevel`
      correcto tras subir, determinismo de `xpToAdvance`) + 1 nuevo en `validation.test.ts`
      (escalado monótono 1-20 del catálogo real + rechazo de catálogos inválidos). **166 tests
      totales verdes**, typecheck/lint/format:check verificados.
- [x] Completado (2026-08-04): M5 generación pura de oleadas. `createForestWave` toma curva, nivel,
      índice, seed y composición; usa shuffle-bag determinista, escala a `waveSize` y emite
      `spawnKey` estable por slot. 3 tests cubren tamaño/composición, replay exacto e inputs inválidos.
- [x] Completado (2026-08-04): wiring a Phaser. `runtime.ts` crea la oleada inicial desde
      `createForestWave`, deriva su composición/capacidad y, al confirmar `applyDefeat` con level-up,
      reconfigura el mismo `EnemySpawnDirector` con el plan siguiente. La reconfiguración conserva
      registros, cleanup/respawn y la secuencia monotónica `enemy:N`; el feedback visual muestra el
      nivel alcanzado y actualiza los atributos observables de oleada.
- [x] Completado (2026-08-04): persistencia V1 de `ForestProgressState`. El envelope compartido
      valida versión/curva y serializa `countedDefeats`; `CharacterForestProgress` se crea/backfillea
      por migración SQL y `ForestProgressRepository` hace round-trip con ownership, revisión
      optimista y transacción `Serializable`. La ruta GET sólo hidrata; el comando de derrota y las
      recompensas siguen reservados a autoridad del servidor.
- [x] Completado (2026-08-04): HUD de nivel y progreso. `GameHudSnapshot` publica los campos de
      Bosque desde el runtime y `GameHudOverlay` reemplaza el `0%` de maqueta; test React y smoke
      IAB verifican `nivel=1`, `0/100` inicial y la oleada inicial de 3 enemigos.

## Pruebas

- `pnpm test` debe seguir verde; este paso agrega 11 tests nuevos (7 endless-forest + 1 validación +
  3 de `forest-waves`).
- M2 idempotencia: `applyDefeat` con el mismo `enemyInstanceId` dos veces devuelve estado
  idéntico a la primera llamada (sin XP/oro/materiales extra).
- M2 cascada: un reward de XP gigante sube varios niveles de una vez y hace tope en
  `maximumLevel` sin pasarse.
- M2 clamp: en `maximumLevel`, acumular XP no sube más (no hay nivel 21).
- M2 `bestLevel`: tras subir de nivel, `bestLevel === level` (regresión del bug del primer diseño).
- M3 monotonicidad: el catálogo real pasa la validación; un catálogo con un nivel más fácil que el
  anterior es rechazado con error explícito.
- M3 secuencia: un catálogo con un `level` fuera de orden es rechazado.
- M5 replay: misma curva, nivel, índice, seed y composición producen un plan idéntico.
- M5 composición: los primeros slots recorren la composición barajada antes de repetir arquetipos.
- M5 validación: niveles/índices/seed/composición inválidos se rechazan antes de producir spawns.

## Criterios de aceptación

- [x] Cada nivel es más difícil que el anterior (escalado monótono verificado por test).
- [x] Derrotar un enemigo acumula progreso de nivel exactamente una vez (idempotencia probada).
- [x] No hay condición de victoria ni de derrota terminal en el núcleo (idle continuo por diseño).
- [x] El jugador puede avanzar del nivel 1 al 20 progresivamente — el test de runtime recorre todos
      los niveles con recompensas reales del catálogo; smoke Phaser confirma nivel 1→2 y oleada 3→4.
- [x] El nivel actual y el progreso se muestran en el HUD — `GameHudSnapshot` y `GameHudOverlay`
      publican nivel, XP, umbral, índice y tamaño de oleada.

## Resultados

- 2026-07-30 (M2): el primer diseño de `bestLevel` falló un test durante la verificación. Usaba
  `Math.max(next.bestLevel, next.level)` pero `next.level` aún no tenía el `+1` del level-up
  aplicado en el momento de la comparación, así que `bestLevel` se quedaba un nivel por detrás tras
  subir. Corregido introduciendo `advancedLevel = next.level + 1` antes del `Math.max`. El test
  que lo detectó quedó como regresión permanente. Bug del código, no del fixture.
- 2026-07-30 (M3): la validación semántica de monotonicidad es el principal valor de seguridad de
  este paso — convierte un bug de balance silencioso (alguien edita una constante y hace un nivel
  más fácil que el anterior) en un error de build. El test cubre tanto el caso positivo (catálogo
  real pasa) como los negativos (no monótono rechazado, fuera de secuencia rechazado).
- 2026-07-30 (general): ningún cambio arquitectónico — el núcleo sigue en `packages/shared`, los
  datos en `game-data`, separados de Phaser/UI/transporte. `ForestProgressState` es inmutable y
  devuelto por funciones puras, sin estado global mutable. 166 tests verdes en ese corte.
- 2026-08-04 (M5): `createForestWave` mantiene la separación de dominio: recibe una curva ya validada,
  usa una seed explícita y entrega un plan serializable; no crea sprites, escucha reloj ni muta un
  spawner. La composición de los cinco arquetipos del Paso 8 queda lista para el adaptador.
- 2026-08-04 (wiring HUD): `runtime.ts` inicializa la curva versionada, aplica derrotas con
  `applyDefeat` y publica nivel/XP; `GameHudOverlay` los renderiza sin fórmulas duplicadas. Smoke
  local: un canvas, `0/100` inicial y `10/100` tras AUTO; quedan avisos de pérdida de contexto WebGL
  del renderer del preview durante la recarga, sin errores JavaScript.
- 2026-08-04 (recorrido y Expedición): `endless-forest-runtime.test.ts` usa las recompensas reales
  del catálogo y recorre todos los niveles 1→20; el smoke IAB confirma AUTO en nivel 2, oleada 4 y
  `36/230` XP, y `/expedicion` entra/sale sin duplicar el canvas. La consola quedó sin errores ni
  warnings en ese recorrido.

## Resultado de wiring local de interaccion (2026-08-04)

`interaction-runtime.ts` define los targets visuales locales de cofre, NPC y reanimacion;
`runtime.ts` escucha `F`, resuelve el target valido mediante `applyInteraction`, actualiza el ledger
inmutable y publica prompt/resultado/razon en atributos `data-interaction-*`. Smoke limpio: el cofre
inicial pasa de ledger `0` a `1`, desaparece el prompt, queda un solo canvas y no aparecen errores ni
warnings. Este adaptador no entrega recompensas ni sustituye la autoridad de servidor; esos limites
quedan para los pasos de dominio y persistencia.

## Cierre parcial del Paso 9 (2026-08-04)

Actualización de esta sesión: el runtime ya instancia la oleada inicial y reconfigura el mismo
`EnemySpawnDirector` al subir de nivel; conserva los IDs `enemy:N`, las ventanas de cleanup/respawn
y publica nivel/XP/oleada en el HUD. La pantalla Expedición ya permite elegir Bosque Corrupto +
Normal y entrar/salir sin duplicar el runtime. El Paso 9 sigue abierto por la instancia/tick y los
efectos de dominio de las interacciones; el comportamiento visual no terminal del Guardián ya tiene
un cierre mínimo verificable (derribado, sin movimiento/auto/habilidades y con aviso en HUD).

M1–M5, el wiring de oleadas, el HUD y el selector de Expedición están implementados y probados. El
La persistencia V1 del progreso queda cubierta por el agregado PostgreSQL, el migrador y el repositorio
con revisión optimista. La transición 1→2 y el recorrido lógico 1→20 quedan cubiertos por smoke y
pruebas deterministas.

Durante esta sesión también se dejó preparada la base del sistema común de interacción en
`packages/shared/src/interaction.ts`. El contrato es puro, serializable e idempotente para NPCs,
cofres, reanimación, portales, puertas, objetos, comerciantes y objetivos de misión: valida
distancia/disponibilidad/estado, duración, interrupción, cooldown, autoridad y resultado; consume
objetivos `oneShot` y reproduce recibos por `operationId` sin duplicar efectos. El runtime local ya
conecta `F` con targets visuales de cofre/NPC/reanimación, actualiza el ledger V2 y publica señales de
smoke. El comando llega al adaptador server-side y WebSocket con posición de spawn; siguen fuera de
este hito el tick de una instancia real y los dominios concretos de loot/diálogo/reanimación.

## Estado visual del Guardián derribado (2026-08-04)

Al llegar a 0 vida, `LocalCombatController` publica `downed` y el dominio rechaza activaciones de
habilidad con esa razón. El runtime detiene movimiento y AUTO, cambia el estado de animación a
`downed`/death, aplica una lectura visual atenuada y conserva la interacción de reanimación. El HUD
marca `data-guardian-state="downed"`, muestra `DERRIBADO` y deshabilita las habilidades. Esto no
resuelve la reanimación: vida restaurada, actor autorizado y recompensas siguen siendo efectos de
dominio del tick de instancia server-side.

## Estado autoritativo de instancia (2026-08-04)

El primer bloque del Paso 14 ya tiene una implementación mínima reutilizable. `instance.ts` mantiene
un estado puro versionado con reloj/tick monotónico, jugadores, vida, actor state, posición y
revisión. `ActiveInstanceRegistry` lo conserva en memoria durante la sesión, impide reutilizar un
personaje con otro dueño/zona/dificultad y el WebSocket procesa `MOVE_INTENT` como vector normalizado
contra los límites del mundo. `INTERACT_INTENT` ahora consulta esa posición/estado del tick, no un
spawn fijo. Las finalizaciones pasan por `InteractionEffectService` y el ledger durable
`CharacterInteractionEffect`: reanimación y diálogo se aplican una vez; un cofre sólo deja una
autorización `PENDING_DOMAIN` hasta que exista el dominio de loot. No se persiste cada tick;
snapshots de varios jugadores, combate y reconexión siguen pendientes del Paso 14.

## Trabajo pendiente (historial)

El núcleo puro, el wiring de oleadas, el HUD, la pantalla de Expedición y el primer bloque de
autoridad de instancia están completos y documentados. Lo que falta, en orden de bloqueo:

1. **Sincronización de party y combate** — el servidor ya conserva el estado/tick de una instancia,
   valida movimiento, emite snapshots básicos y usa su posición real para interacción; falta ampliar
   el estado a 1–4 jugadores, sincronizar party/enemigos y resolver ataques/habilidades.
2. **Efectos y reconexión** — reanimación/diálogo ya tienen ledger durable idempotente; loot queda
   `PENDING_DOMAIN` hasta el dominio de objetos. Faltan la entrega real de loot, snapshots de
   reconexión y el fin de partida.
3. **Comportamiento no-terminal del Guardián a 0 vida** — cierre mínimo completado: el dominio y la
   presentación mantienen al jugador derribado, sin movimiento/auto/habilidades y con un estado
   visual/HUD explícito. La reanimación efectiva ya se registra en el ledger de efectos y espera el
   tick de finalización autoritativo.

**Punto de decisión explícito para el próximo loop**: ampliar snapshots/party y combate autoritativo.
No hace falta esperar assets; la Expedición usa la única zona funcional disponible y los sprites
faltantes sólo usan los fallbacks ya documentados hasta el Paso 18.
