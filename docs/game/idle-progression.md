# Progresión idle

## Estado actual (Paso 16)

El modo ausente está implementado en `AwayService`: la calibración dura exactamente 300 segundos
según el reloj del servidor, toma las recompensas `enemy_defeat` persistidas como métrica y bloquea
la build con un fingerprint. La activación guarda snapshot y semilla; el regreso calcula una única
ventana agregada y la deja `PENDING`. `POST .../away/claim` acredita recursos y objetos dentro de
una transacción serializable y `RewardLog` funciona como ledger de replay. La pantalla `/ausente`
muestra contador, estimación, informe y reclamo.

## Responsabilidades

- Determinar ventana offline válida con tiempo del servidor.
- Aplicar cap, tasas y reducción versionadas.
- Calcular XP, oro, materiales y loot de forma agregada.
- Crear recompensa pendiente auditable antes de mostrarla.
- Reclamarla de forma atómica e idempotente.

## Flujo de datos

```text
calibracion valida + ahora servidor + snapshot/versiones
  -> ventana limitada -> calculo agregado -> AwayResult(PENDING)
  -> claim idempotente -> saldos/loot + CLAIMED + personaje AVAILABLE
```

## Fórmula vigente

Para `elapsed` en segundos: `computed = min(max(0, elapsed), 28_800)` y
`reward = floor(calibrationReward * computed / 300 * 0.8 * survivalFactor)`. La penalización es
`survivalFactor = max(0.5, 1 - min(5, deathsOrDowns) * 0.1)`; el tiempo descartado queda auditado.
El loot usa semilla de sesión, 35 % de oportunidades, máximo 40 objetos y sólo rarezas common,
magic y rare (nunca el legendario exclusivo del jefe).

## Límites

El cliente solicita y presenta; no aporta tiempo ni recompensa confiables. Balance posee las tasas.
Saves conserva estado/recompensas. Multiplayer protege sesiones y replay. No se simula cada ataque
o frame durante horas offline.

## Riesgos

Reloj local alterado, doble claim, ventanas solapadas, cambio de tasas a mitad del intervalo, tiradas
masivas, recompensa acreditada sin marcar y build modificada durante la muestra.

## Pruebas ejecutadas/requeridas

`packages/shared/src/away-calculation.test.ts` cubre cero/cap, penalización, determinismo y ausencia
de legendarios. `apps/server/src/persistence/away.integration.test.ts` cubre calibración, reloj de
servidor, activación, regreso y dos claims concurrentes con un solo `RewardLog`. Quedan para la etapa
de balance los escenarios de largo plazo y comparación idle/activo.

## Skills relacionadas

- [idle-progression](../../.agents/skills/idle-progression/SKILL.md)
- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [save-and-migrations](../../.agents/skills/save-and-migrations/SKILL.md)
