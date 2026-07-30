# Progresión idle

## Estado actual

Existe un servidor mínimo, pero todavía no hay persistencia ni implementación del modo ausente. GOAL.md fija calibración autoritativa de 300 segundos, cap inicial de 8 horas y eficiencia provisional de 80 %. Consultar [../away-mode.md](../away-mode.md).

## Responsabilidades

- Determinar ventana offline válida.
- Aplicar cap, tasas y reducción versionadas.
- Calcular XP, oro, materiales, loot y misiones de forma agregada.
- Crear recompensa pendiente auditable.
- Reclamarla de forma atómica e idempotente.

## Flujo de datos

```text
Último tiempo válido + ahora servidor + estado/versiones
→ ventana limitada → cálculo agregado → pending reward
→ claim(operation_id) → saldos + estado claimed
```

## Límites

El cliente solicita y presenta; no aporta tiempo ni recompensa confiables. Balance posee tasas. Saves conserva estado/recompensas. Multiplayer protege sesiones y replay. No simular cada ataque o frame.

## Riesgos

Reloj local alterado, doble claim, ventanas solapadas, dos sesiones, cambio de tasas a mitad del intervalo, tiradas masivas, recompensa acreditada sin marcar.

## Pruebas requeridas

Duraciones negativa/cero/cap, tramos de tasa, probabilidad agregada, límite diario, replay, doble sesión, desconexión, recuperación y comparación idle/activo.

## Skills relacionadas

- [idle-progression](../../.agents/skills/idle-progression/SKILL.md)
- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [save-and-migrations](../../.agents/skills/save-and-migrations/SKILL.md)
