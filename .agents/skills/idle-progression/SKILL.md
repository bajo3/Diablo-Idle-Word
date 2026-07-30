---
name: idle-progression
description: Implementa progreso automático, recompensas offline, combate simulado, producción por tiempo, límites y reclamación segura de recompensas. Usar cuando una tarea involucre progreso sin juego activo. No usar para combate activo normal.
---

# Purpose

Calcular y reclamar progreso offline de forma agregada, determinista, auditable e idempotente.

# Trigger conditions

Usar para tiempo offline, experiencia, oro, materiales, loot, misiones, producción, límites, simulación resumida o recompensas pendientes. Combinar con `game-balance`, `multiplayer-authority`, `save-and-migrations` y `automated-playtesting`.

# Do not use when

No usar para combate activo. No simular cada frame ni cada ataque durante horas. No confiar en el reloj local cuando exista servidor.

# Required context

1. Inspeccionar `AGENTS.md`, `GAME_DESIGN.md`, `docs/game/idle-progression.md`, economía, combate, reloj, sesiones, red, guardado y pruebas.
2. Localizar timestamps, Rewards, Progress, Missions, Save, Session y Currency.
3. Leer [cálculos idle](references/idle-calculations.md).
4. Confirmar fuente de tiempo, zona/unidad, cap, tasas, versión de balance e idempotencia existentes.

# Workflow

1. Definir último instante válido, instante autoritativo actual y duración acumulable máxima.
2. Separar producción por segundo, loot probabilístico y progreso de misión.
3. Elegir fórmula agregada; usar tramos sólo cuando las tasas cambien en el intervalo.
4. Crear una recompensa pendiente con ID único, ventana, versión y desglose.
5. Persistir cálculo y reclamación como operaciones idempotentes.
6. Resolver desconexiones y sesiones concurrentes antes de entregar.
7. Auditar, probar reintentos y comparar métricas activas frente a idle.

# Architecture rules

- Separar cálculo, persistencia, reclamación y presentación.
- Mantener diferencia explícita entre modo activo e idle.
- Usar tiempo de servidor o fuente monotónica confiable para estado compartido.
- Representar límites diarios, cap y reducción progresiva como configuración versionada.
- Modelar recompensas pendientes antes de acreditar saldos.
- Usar cálculos agregados deterministas y verificables.

# Implementation rules

- Calcular experiencia, oro y materiales con precisión y redondeo documentados.
- Calcular loot mediante distribución agregada o tiradas acotadas; registrar semilla si debe reproducirse.
- No aceptar duración, timestamp ni recompensa final del cliente.
- Prevenir doble reclamación con ID de operación, estado y transacción atómica.
- Manejar múltiples sesiones con bloqueo optimista, versión o serialización equivalente.
- Registrar ventana, tasas, cap, versión, resultado y reclamación sin datos sensibles.
- Si el sistema no existe, definir primero contrato, reloj inyectable y función pura; no crear contenido definitivo.

# Validation

- Probar duración negativa, cero, bajo cap, sobre cap, cambios de tasa y reloj alterado.
- Probar probabilidades agregadas, límites diarios, reducción y redondeo.
- Probar doble clic, replay, desconexión, dos sesiones y recuperación tras fallo.
- Ejecutar round trip de estado idle y mostrar inputs, fórmula, resultado y auditoría.

# Required output

Entregar fórmula, fuente de tiempo, límites, modelo de idempotencia, casos numéricos, pruebas, impacto de balance y riesgos pendientes.

# Definition of done

Completar cuando no se confíe en el reloj local, el cálculo sea agregado, la reclamación sea atómica e idempotente, la auditoría exista y las pruebas de concurrencia pasen.

# Related documentation

- [Cálculos idle](references/idle-calculations.md)
- [Progresión idle](../../../docs/game/idle-progression.md)
- [Multiplayer](../../../docs/game/multiplayer.md)
- [Guardado](../../../docs/game/saves.md)

