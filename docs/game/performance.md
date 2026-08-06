# Rendimiento 2D

## Paso 6

La escena limita la física a un jugador y tres obstáculos estáticos, usa Arcade Physics y no crea
keys/listeners por frame. El runtime se destruye al desmontar; el presupuesto inicial es 60 FPS y
las pruebas verifican normalización/ciclo de vida sin usar benchmarks de tiempo no deterministas.

## Estado actual

Existe una build web mínima, todavía sin escena jugable ni baseline de FPS. Los objetivos provisionales y el presupuesto inicial de descarga están en [../performance-budget.md](../performance-budget.md).

## Paso 8 — stress de enemigos (2026-08-04)

El runtime local tiene un harness opt-in (`/bruto-preview?enemyStress=40`) que mide 600
intervalos de `requestAnimationFrame`, el p95 del callback de `update()` y `performance.memory`
cuando el navegador lo expone. La escena normal sigue en 3 enemigos y no activa la instrumentación.
Los efectos frecuentes usan pools preasignados: 24 proyectiles, 12 telegraphs y 64 bursts; cada
lease se resetea antes de volver al pool y el agotamiento omite sólo la presentación.

Medición reproducida en el mismo navegador/build: control de 3 enemigos, p95 RAF 5.700 ms, p95
de update 0.200 ms y heap 123504090 bytes; stress de 40 enemigos, p95 RAF 5.700 ms, p99 5.800
ms, p95 de update 0.500 ms y heap 158770075 bytes. Son objetivos provisionales del entorno de
desarrollo, no un benchmark de dispositivo bajo; repetir con hardware objetivo antes de cambiar
el presupuesto.

## Paso 18 — VFX y audio acotados

Los efectos repetitivos se reservan en pools preasignados y se liberan con un reset completo. Las
capacidades contractuales actuales son: 24 proyectiles, 12 telégrafos, 64 bursts, 24 efectos de
habilidad, 32 impactos y 24 textos flotantes. Si un pool se agota se omite sólo la presentación; el
evento de combate y su resultado no se alteran. El audio no crea una fuente por evento de red
repetido: `GameAudioMixer` deduplica IDs y destruye el timer de música al desmontar.

La validación de assets limita el paquete inicial de arte a 1,5 MB (la medición actual se imprime en
`pnpm validate:assets`). Falta repetir el perfil de navegador en hardware de menor rendimiento para
cerrar los criterios de compatibilidad del Paso 18.

## Paso 14 — tráfico WebSocket (2026-08-04)

`apps/server/src/gameplay/traffic-metrics.ts` mantiene contadores en memoria en el borde del
transporte. Se registran bytes UTF-8 y cantidad de mensajes entrantes/salientes; para
`INSTANCE_SNAPSHOT` se conserva una muestra acotada de 512 tamaños para calcular p95 sin guardar
payloads. `GET /api/metrics/network` (sesión autenticada) expone la ventana operativa de 60 s y
permite comparar el costo de snapshots con el presupuesto de red sin introducir una base de datos
ni datos personales.

La instrumentación cubre el saludo autenticado, rechazos, respuestas directas y broadcasts a la
party. Las tasas son contadores por proceso, no agregados distribuidos; al reiniciar el servidor se
reinician y deben correlacionarse con la duración real de la observación.

## Responsabilidades

Medir FPS/frame time, memoria/GC, entidades, render, partículas, física, colisiones, navegación, IA, updates, eventos y tráfico de red. Atribuir costo antes de optimizar.

## Flujo

```text
Escenario + hardware + build + seed → baseline/perfil
→ hipótesis → cambio mínimo → misma medición
→ regresión funcional → reporte antes/después
```

## Límites

Render puede aplicar culling/batching sin cambiar simulación. Pooling debe resetear estado. Interpolación no altera autoridad. Los presupuestos por sistema son objetivos revisables.

## Riesgos

Promedios que esconden picos, perfiles distintos antes/después, pooling con estado residual, listeners/timers filtrados, atlas enorme, pathfinding por frame y exceso de snapshots.

## Pruebas requeridas

Combate normal, dungeon densa, jefe con efectos, multiplayer con latencia, sesión prolongada y dispositivo bajo. Informar p50/p95/p99, memoria, GC, entidades y red.

## Skills relacionadas

- [performance-2d](../../.agents/skills/performance-2d/SKILL.md)
- [pixel-art-pipeline](../../.agents/skills/pixel-art-pipeline/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)

## Paso 19 — perfil de calidad y seguridad (2026-08-04)

El harness se ejecutó sobre la build de desarrollo en Chrome for Testing 151 y Firefox 153 con
`/bruto-preview` y `/bruto-preview?enemyStress=40`:

| Navegador | Escenario | Muestras | Frame p50/p95/p99 | `update` p95 | Heap | Entidades | Pools / audio |
| --- | --- | ---: | --- | ---: | ---: | --- | --- |
| Chrome | 3 enemigos | — | — | — | — | `idle:3` | `0/24`, `0/12`, `0/64`; audio `0/0`, dedupe 0 |
| Chrome | 40 enemigos | 600 | 5,5 / 5,7 / 5,8 ms | 0,3 ms | 93.115.695 B | `idle:37`, `attack:3` | proyectiles `0/24`, telegraphs `0/12`, bursts `1/64`; audio activo 0, pico 4, dedupe 25 |
| Firefox | 40 enemigos | 332 | 22,22 / 27,78 / 27,78 ms | 1,0 ms | no expuesto | `idle:37`, `attack:3` | proyectiles `1/24`, telegraphs `0/12`, bursts `0/64`; audio activo 0, pico 2, dedupe 14 |

Firefox mantiene la escena normal y las pantallas UI sin `pageerror` ni requests fallidos; su valor de
stress headless supera el objetivo provisional de 16,67 ms y queda como señal para perfilar hardware
real antes de subir densidad. La build de producción ignora `enemyStress=40`, conserva tres enemigos y
no publica `stressSamples`, validado en Chrome y Firefox con `pnpm --filter @brecha/web build` +
`vite preview`.

El servidor local respondió 200 a 200 solicitudes secuenciales de `/health`: p50 0,344 ms, p95
0,765 ms, p99 1,080 ms y máximo 28,481 ms. Son mediciones de una instancia local, no un SLO remoto.
