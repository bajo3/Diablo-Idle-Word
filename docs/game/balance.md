# Balance

## Estado actual

El Paso 7 introduce únicamente tuning de combate `PROVISIONAL` y versionado
`guardian-combat.1`; no representa balance definitivo. El snapshot de nivel 1 usa Vida 220, Armadura
25, daño base 20–24 y crítico 7,5 %. Las fórmulas y los límites exactos viven en
`GAME_DATA.guardianCombat` y están cubiertos con RNG controlado.

La progresión de personaje conserva la curva versionada de `GAME_DATA.progression` (niveles 1–10,
XP acumulativa y tres puntos de atributo por nivel). La recompensa de enemigo sigue siendo la única
fuente autoritativa de XP en el bosque y se aplica en la misma transacción que oro/materiales; el HUD
sólo presenta el snapshot server-side. Las siete clases seleccionables usan exactamente estos mismos
valores mientras no existan kits diferenciados, por lo que no se declara balance de clases todavía.

## Recompensas de derrota del Bosque (2026-08-04.4)

El primer tramo de recompensas autoritativas usa `forest-enemy-reward.1`. Los valores son
provisionales y viven en `GAME_DATA.enemyTuning`; el servidor los valida, aplica en una transaccion
`Serializable` y registra `GAME_DATA_VERSION`/`BALANCE_VERSION` en `RewardLog`.

| Enemigo | XP | Oro | Materiales |
| --- | ---: | ---: | ---: |
| `corrupted_minion` | 10 | 5 | 1 |
| `possessed_archer` | 14 | 7 | 1 |
| `dark_shaman` | 16 | 8 | 2 |
| `root_brute` | 24 | 12 | 3 |
| `unstable_beast` | 20 | 10 | 2 |

Antes, la autoridad resolvia la muerte pero no existia una fuente ejecutable de XP/oro/materiales
para la derrota multiplayer. Ahora cada jugador activo de la party recibe su propio delta y el
progreso de Bosque avanza una sola vez por `enemyId`; los reintentos reutilizan el receipt sin volver
a incrementar la economia. Los drops, rarezas y afijos se generan ahora dentro de la misma
transaccion y quedan ligados al inventario privado de cada personaje; el balance estadistico final
sigue pendiente.

## Dificultad multiplayer (2026-08-04.4)

`GAME_DATA.balance.difficulty` mantiene tuning provisional y versionado. Para una instancia con
`jugadores` activos, el servidor aplica:

```text
salud = salud_base x (multiplicador_dificultad_salud + 0.65 x (jugadores - 1))
daño   = daño_base   x (multiplicador_dificultad_daño   + 0.15 x (jugadores - 1))
```

Normal usa `1.0/1.0`; Veterano usa `1.25/1.15`. Los mismos multiplicadores se aplican al spawn
inicial, ataques y respawn, y nunca se aceptan desde el cliente. Antes de cambiar estos números hay
que medir TTK/DPS por tamaño de party y registrar una nueva versión de balance.

Riesgos a medir antes de declarar balance definitivo: TTK real con curacion de aliados, oro/materiales
por hora, inflacion en party y ritmo de nivel 1->20. Cualquier ajuste debe cambiar la version y
registrar comparativa antes/despues.

## Datos del Paso 2

`game-data` fija únicamente los números establecidos por GOAL: calibración 300 s, mínimo 600 s, cap 8 h, eficiencia 0.8, 1–4 jugadores, escalado 0.65/0.15 y frames 64/128. Todo tuning de combate no cuantificado se marca `TBD`.

## Economía del pueblo (Paso 17, `town.mvp.1`)

Hipótesis: los primeros objetos del comerciante deben ser un sumidero pequeño y legible para un
personaje de nivel 1, sin competir con el oro de las derrotas. Los precios son server-side y
provisionales:

| Stock | Precio oro | Fuente/sumidero | Resultado esperado |
| --- | ---: | --- | --- |
| Espada de hierro | 80 | sumidero de compra | 16 derrotas de Esbirro corrupto |
| Yelmo de hierro | 60 | sumidero de compra | 12 derrotas de Esbirro corrupto |
| Peto de cuero | 90 | sumidero de compra | 18 derrotas de Esbirro corrupto |
| Guanteletes de hierro | 50 | sumidero de compra | 10 derrotas de Esbirro corrupto |
| Botas del viajero | 55 | sumidero de compra | 11 derrotas de Esbirro corrupto |
| Amuleto del bosque mágico | 180 | sumidero de compra | 36 derrotas de Esbirro corrupto |

La venta devuelve `itemPower × multiplicador de rareza` (common 1, magic 2, rare 5, legendary
20), redondeado a entero y nunca menor que 1. Antes no había compras ni un ledger de venta; ahora
ambas direcciones quedan en `RewardLog` y las pruebas cubren replay/concurrencia. La métrica a
revisar en el Paso 19 es saldo neto por hora, p50/p90 de tiempo hasta compra y relación de oro
activo/idle; cambiar precios exige nueva versión de balance y simulación reproducible.

## Responsabilidades

Definir y medir XP/tiempo por nivel, DPS, vida efectiva, TTK, supervivencia, escalado, economía por hora, rarezas, costos, inflación y relación activo/idle.

## Flujo de datos

```text
Hipótesis + configuración versionada + escenario/seed
→ simulación reproducible → distribución/métricas
→ cambio mínimo → nueva simulación + prueba jugable
→ reporte antes/después
```

## Límites

Balance modifica datos y fórmulas acordadas, no redefine arquitectura. Cada sistema posee su comportamiento; balance aporta valores medibles. La telemetría futura debe respetar privacidad.

## Riesgos

Optimizar sólo la media, una clase o endgame; cambiar varias variables a la vez; inflación; idle dominante; caps invisibles; resultados sin seed o versión.

## Pruebas requeridas

Escenarios por clase/build/nivel, percentiles, extremos, activo/idle, fuentes/sumideros, seeds repetibles y reporte con valor anterior/nuevo, razón, riesgo y resultado.

## Skills relacionadas

- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [combat-system](../../.agents/skills/combat-system/SKILL.md)
- [loot-and-items](../../.agents/skills/loot-and-items/SKILL.md)
- [idle-progression](../../.agents/skills/idle-progression/SKILL.md)
