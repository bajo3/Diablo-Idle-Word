# Plantillas de contenido PvE

## Enemigo normal

```yaml
id: enemy.stable-id
archetype: melee|ranged|summoner
stats_profile: TBD
states: [idle, detect, chase, attack, return, dead]
detection: { range: TBD }
leash: { distance: TBD }
attacks: []
reward_table: TBD
entity_budget_cost: 1
```

Definir transiciones, timeout y comportamiento sin ruta. La animación refleja el estado; no lo gobierna.

## Élite

```yaml
id: enemy.elite.stable-id
base_enemy_id: enemy.stable-id
modifier_pool: []
modifier_count: TBD
telegraph_profile: TBD
reward_multiplier: TBD
entity_budget_cost: TBD
```

Excluir combinaciones imposibles o ilegibles. Validar que modificadores no anulen todas las respuestas del jugador.

## Jefe

```yaml
id: boss.stable-id
arena_requirements: {}
phases:
  - id: phase.1
    enter_condition: start
    attacks: []
    adds_budget: TBD
  - id: phase.2
    enter_condition: health_threshold
telegraphs: []
enrage: TBD
reward_table: TBD
```

Cada fase debe tener entrada, salida, fallback, limpieza y señal legible. Probar muerte/transición simultánea y reconexión.

## Dungeon

```yaml
id: dungeon.stable-id
generator_version: 1
seed: runtime
biome: TBD
room_graph:
  start: 1
  boss: 1
  optional: TBD
constraints:
  connected: true
  max_rooms: TBD
  safe_spawn_radius: TBD
encounter_budget: TBD
reward_profile: TBD
```

## Generación

1. Crear grafo abstracto conectado.
2. Reservar inicio, salida y jefe.
3. Asignar plantillas compatibles con puertas.
4. Validar colisiones, navegación y áreas de spawn.
5. Distribuir encuentros según presupuesto y distancia.
6. Validar camino crítico y condiciones de finalización.
7. Persistir seed + versión, no el RNG mutable sin necesidad.

## Presupuestos

Asignar costo por enemigo, proyectil, invocación y efecto. Rechazar o degradar un spawn si supera el presupuesto; nunca dejar entidades huérfanas. Hacer autoridad de generación y recompensa en servidor online.

## Seeds de prueba

Conservar al menos una seed mínima, una densa, una con bifurcaciones y cada seed que reproduzca un bug. La misma seed sólo promete el mismo resultado bajo la misma versión del generador y configuración.

