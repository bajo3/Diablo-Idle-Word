# Paso 7 — combate completo del Guardián

## Objetivo del usuario

Permitir probar en la partida local el kit completo del Guardián —vida, Furia, Tajo, Golpe
poderoso, Torbellino, Piel de hierro y Sed de batalla— con impactos, cooldowns, costos, críticos,
armadura, retroceso y feedback audiovisual verificables.

## Estado actual

El Paso 6 deja una isla Phaser desacoplada de React con movimiento, cámara, colisiones, FSM visual
`idle/moving`, cuatro capas sincronizadas, pausa segura, HUD mínimo y checkpoint autoritativo. El
catálogo compartido ya contiene IDs y semántica de las cinco habilidades, pero todo el tuning de
combate sigue marcado `TBD`. Todavía no existen enemigos ni IA; corresponden al Paso 8.

## Alcance

- Núcleo puro y determinista de combate local con reloj y RNG inyectables.
- Configuración versionada de estadísticas, fórmulas, habilidades y ventanas de impacto.
- Maniquíes estáticos de prueba, únicamente como objetivos del kit.
- Integración de input, geometría, animaciones multicapa y HUD de vida/Furia/cooldowns.
- VFX, SFX provisionales, pooling y números de daño opcionales.
- Pruebas de fórmulas, ejecución, presentación, ciclo de vida y smoke real.

## Fuera de alcance

IA, enemigos reales, drops, botín, experiencia, niveles, inventario, mapas, misión, persistencia del
estado transitorio de combate, combate multiplayer y autoridad remota. No se inicia el Paso 8.

## Arquitectura afectada

- `packages/game-data`: única fuente versionada de tuning y metadata temporal de habilidades.
- `packages/shared`: tipos y funciones puras de reglas; no importa React, Phaser, red ni Prisma.
- `apps/web/src/game/combat-controller.ts`: aplicación local que consume comandos, posiciones y
  reloj, aplica ventanas una sola vez y publica snapshots/eventos.
- `apps/web/src/game/runtime.ts`: adaptador Phaser de input, colisiones, presentación y audio.
- `GameIsland.tsx`: consumidor React de snapshots, sin decidir daño ni disponibilidad.

La presentación puede atrasarse, omitirse o repetir callbacks sin alterar el resultado lógico. Cada
impacto se deduplica por `executionId + targetId + tick`. El reloj de combate se congela al pausar.

## Skills requeridas

- `game-architect`: conservar límites dominio/aplicación/presentación.
- `classes-and-skills`: modelar kit, recursos, estados y HUD.
- `combat-system`: resolver activaciones, ventanas, daño, estados y deduplicación.
- `game-balance`: centralizar números, límites y reporte de fórmulas.
- `automated-playtesting`: cubrir reglas puras, integración y recorrido jugable.

## Archivos relevantes

- `packages/game-data/src/schemas.ts`, `catalog.ts`, `validation.test.ts`: tuning provisional.
- `packages/shared/src/combat.ts`, `combat.test.ts`, `index.ts`: núcleo puro.
- `apps/web/src/game/domain.ts`, `assets.ts`, `presentation.ts`: estados y metadata visual.
- `apps/web/src/game/combat-controller.ts`: sesión local de combate.
- `apps/web/src/game/runtime.ts`, `GameIsland.tsx`: integración Phaser/React.
- `apps/web/public/assets/characters`, `effects`, `audio`: placeholders propios y procedencia.

## Modelo de datos

`GAME_DATA_VERSION` y `BALANCE_VERSION` avanzan a `2026.07.29.2`. El bloque
`guardianCombat` usa `combatFormulaVersion: guardian-combat.1` y estado `PROVISIONAL`.

Snapshot fijo de prueba de nivel 1:

- Fuerza 10, Destreza 5, Inteligencia 3, Vitalidad 12.
- Arma provisional `[10, 14]`, vida `100 + vitalidad × 10 = 220`.
- Furia máxima 100 e inicial 0.
- Armadura `20 + floor(fuerza × 0.5) = 25`.
- Daño base `rollEntero(10,14) + fuerza = 20..24`.
- Crítico `clamp(0.05 + destreza × 0.005, 0, 0.50) = 7,5 %`, multiplicador `1,50`.
- Mitigación `clamp(armadura / (armadura + 100 + 50 × nivel), 0, 0.75)`.
- Daño final
  `max(0, round(base × habilidad × (1-mitigación) × crítico × modificadorFinal))`, con un único
  redondeo al final.

Tuning de habilidades:

- Tajo: clic izquierdo, costo 0, cooldown 500 ms, ×1, alcance 78 px, arco 100°, máximo 3,
  impacto 200 ms, recuperación 500 ms; +10 Furia si impacta al menos un objetivo.
- Golpe poderoso: clic derecho, costo 30, cooldown 4000 ms, ×2,25, alcance 90 px, arco 80°,
  máximo 3, impacto 400 ms, recuperación 800 ms, retroceso 128 px contra colisiones.
- Torbellino: `Q`, costo 40, cooldown 7000 ms, duración 1200 ms, radio 96 px, ticks
  0/300/600/900 ms a ×0,45 y movimiento ×0,65.
- Piel de hierro: `E`, costo 25, cooldown 12000 ms, cast 250 ms, duración 4000 ms y daño recibido
  ×0,55 después de armadura.
- Sed de batalla: cura 5 % de vida máxima por derrota, limitada a 15 % en una ventana móvil de
  10 segundos; eventos repetidos no curan dos veces.
- Recibir daño efectivo genera 5 Furia. Fuera de combate, tras 3 segundos, decae 5/s.

Costos y cooldowns comienzan cuando la activación es aceptada.

## Flujo de ejecución

Input → comando con `executionId` → validación de estado/costo/cooldown → reserva de recurso y
cooldown → avance del reloj → apertura de ventana configurada → consulta geométrica de objetivos →
resolución pura de RNG/crítico/armadura/estados → eventos deduplicados → snapshot de HUD y comandos
de presentación.

## Consideraciones multiplayer

No se implementa transporte en este paso. Los comandos, IDs, reloj/RNG y resultados separados de la
presentación preparan la futura validación autoritativa del Paso 14; el cliente local no constituye
autoridad multiplayer.

## Consideraciones de persistencia

No aplica al estado transitorio de combate. El checkpoint existente no acepta vida, Furia, cooldowns
ni posiciones del cliente. No hay migración de base de datos.

## Consideraciones de rendimiento

Pool fijo mínimo de 32 impactos y 24 textos flotantes, con reset total al liberar. El HUD se publica
por cambios y como máximo 10 veces por segundo; React no recibe `setState` por frame. El smoke debe
mantener objetivo de 60 FPS y verificar destrucción sin listeners, audio, timers ni objetos
residuales.

## Riesgos

- Adelantar Paso 8: mitigar con maniquíes sin IA, aggro, drops ni comportamiento.
- Divergencia animación/regla: validar tiempos de `hitFrame/eventFrames` contra tuning; la lógica no
  depende del callback visual.
- Doble impacto/curación: dedupe explícito y pruebas de replay.
- Números mágicos: rechazar tuning fuera del catálogo versionado.
- Crecimiento de `runtime.ts`: extraer controlador y adaptadores antes de mezclar reglas.

## Decisiones

- 2026-07-29: usar maniquíes locales estáticos para probar el kit sin iniciar enemigos del Paso 8.
- 2026-07-29: mantener el núcleo en `packages/shared` para reutilización y futura autoridad.
- 2026-07-29: usar configuración provisional exacta y versionada; no presentar estos números como
  balance definitivo.
- 2026-07-29: el evento lógico configurado abre el impacto; los eventos de animación sólo validan y
  disparan feedback.

## Milestones

1. Versionar y validar tuning.
2. Implementar y probar el núcleo puro completo.
3. Integrar controlador local y maniquíes sin Phaser.
4. Extender sprites/metadata de cuatro direcciones y capas.
5. Conectar input, HUD y animaciones.
6. Añadir VFX, SFX, pooling y números opcionales.
7. Ejecutar matriz completa y smoke real; actualizar GOAL sólo si todo pasa.

## Progreso

- [x] Planificado: alcance, arquitectura, fórmulas y límites definidos con Sol.
- [x] Completado: tuning `guardian-combat.1` provisional y `GAME_DATA_VERSION`/`BALANCE_VERSION` `2026.07.29.2`; el validador exige las cinco habilidades del Guardián.
- [x] Completado: núcleo puro en `@brecha/shared` con RNG/reloj inyectables, fórmulas, costos, cooldowns, Furia, Piel de hierro, Sed de batalla, geometría y deduplicación.
- [x] Completado: controlador local de maniquíes y adaptador Phaser con inputs, capas sincronizadas, ventanas temporales, HUD limitado a 10 Hz, VFX/SFX propios y pools 32/24.
- [-] En curso: ejecutar matriz final, smoke de navegador y auditoría independiente antes de cerrar GOAL.

## Pruebas

- Fórmulas: vida/Furia, RNG mínimo/máximo, crítico 0/cap, armadura 0/grande/cap, redondeo y daño no
  negativo.
- Reglas: costo insuficiente, cooldown antes/en el límite, multigolpe, dedupe, ticks de Torbellino,
  expiración de Piel de hierro, cap de Sed de batalla, decaimiento y retroceso.
- Integración web: input, arcos/radio, pausa, HUD, toggle de daño, audio deduplicado y pools limpios.
- Matriz: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`,
  `pnpm test:integration`, `pnpm build` y smoke real.

## Criterios de aceptación

Todos los checkboxes del Paso 7 quedan respaldados por pruebas y evidencia observable; ninguna
habilidad ignora costos/cooldowns; vida y Furia llegan al HUD; las fórmulas están probadas; la
presentación nunca calcula ni decide daño.

## Resultados

- 2026-07-29: `packages/shared/src/combat.ts` concentra las reglas sin imports de React, Phaser,
  HTTP, Prisma o almacenamiento. La aplicación web aporta reloj, RNG, targets y una restricción de
  retroceso; la presentación solamente consume eventos.
- 2026-07-29: `LocalCombatController` deduplica cada impacto por
  `executionId + targetId + tick`, inicia costos/cooldowns al aceptar y publica snapshots aptos para
  HUD. Los maniquíes son estáticos y no tienen IA, aggro, loot ni experiencia.
- 2026-07-29: la escena local vincula clic izquierdo/derecho, Q y E; el reloj de combate se congela
  durante la pausa. Los textos de daño se pueden ocultar; los pools se destruyen al apagar la escena.
- 2026-07-29: corrección de auditoría: el decaimiento conserva milisegundos pendientes para dar el
  mismo resultado con ticks de 10 Hz o saltos; Piel de hierro comienza a los 250 ms y vence a 4250
  ms; Torbellino mantiene movimiento ×0,65 hasta 1200 ms. La metadata de presentación se valida
  contra el tuning antes de cargar Phaser.
- 2026-07-29: corrección de feedback: reusar un efecto cancela tweens previos, aun con textos ocultos;
  audio se desbloquea por gesto y deduplica activación/impacto/crítico por ejecución. El montaje aplica
  la preferencia de números almacenada aunque el import dinámico se resuelva tarde.
- 2026-07-29: segunda corrección de auditoría: impactos vencidos se ordenan por `at,tick`; Torbellino
  consulta la pose inyectada del actor en cada tick; recovery/canal bloquean nuevos comandos hasta su
  límite. Los ledgers se liberan al terminar una ejecución y el retroceso usa un sweep puro contra el
  segmento completo antes de que Phaser actualice la presentación.
- Evidencia de matriz: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (65 pruebas,
  16 archivos), `pnpm test:integration` (13 pruebas, 2 archivos) y `pnpm build` pasaron. El build
  conserva la advertencia preexistente del chunk Phaser de 1,310.90 kB (351.15 kB gzip). Falta el
  smoke real de navegador y la auditoría independiente antes de cerrar GOAL.

## Trabajo pendiente

El Paso 8 añadirá enemigos y consumirá este núcleo. Balance definitivo, persistencia de runs y
autoridad multiplayer permanecen en sus pasos de GOAL.
