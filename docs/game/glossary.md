# Glosario

| Término | Definición |
| --- | --- |
| ARPG | Juego de rol de acción centrado en combate en tiempo real, builds y progresión. |
| Tick | Paso discreto de actualización de una simulación o sistema. |
| Server authority | Regla por la que el servidor decide y valida el estado compartido. |
| Client prediction | Ejecución local anticipada de una intención reversible para ocultar latencia. |
| Reconciliation | Corrección del cliente contra estado autoritativo, reaplicando inputs pendientes. |
| Interpolation | Suavizado visual entre estados conocidos, normalmente de entidades remotas. |
| Idempotency | Propiedad por la que repetir una operación produce un único efecto lógico. |
| Snapshot | Representación versionada del estado en un instante o revisión. |
| Entity | Objeto con identidad y ciclo de vida dentro del juego. |
| Component | Unidad componible de datos o comportamiento asociada a una entidad, según arquitectura. |
| Hitbox | Región usada para detectar el alcance ofensivo de un ataque. |
| Hurtbox | Región que puede recibir impactos. |
| Cooldown | Tiempo mínimo antes de volver a usar una acción. |
| Affix | Modificador generado o asignado a un objeto; puede ser prefijo o sufijo. |
| Drop table | Configuración ponderada de recompensas posibles para una fuente. |
| Seed | Valor inicial que permite reproducir una secuencia pseudoaleatoria bajo la misma versión. |
| DPS | Daño por segundo durante una ventana y escenario definidos. |
| TTK | Time to kill; tiempo necesario para derrotar un objetivo bajo supuestos definidos. |
| Offline progression | Progreso agregado calculado durante ausencia del jugador y sujeto a límites. |
| Migration | Transformación versionada de datos persistentes desde un esquema anterior. |
| State machine | Modelo de estados y transiciones explícitas para comportamiento o flujo. |
| Aggro | Decisión o medida por la que un enemigo selecciona y mantiene un objetivo. |
| Leash | Límite que hace que un enemigo abandone persecución y regrese. |
| Telegraph | Señal anticipada y legible de una acción enemiga. |
| RNG | Generador de números pseudoaleatorios; debe ser controlable en pruebas. |
| Round trip | Serializar y deserializar conservando el estado semántico esperado. |
| Cap | Límite mínimo o máximo aplicado a un valor. |

## Skills relacionadas

- [game-architect](../../.agents/skills/game-architect/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [combat-system](../../.agents/skills/combat-system/SKILL.md)

