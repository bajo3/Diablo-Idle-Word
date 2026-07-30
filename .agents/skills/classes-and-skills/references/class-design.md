# Diseño de clases y habilidades

## Plantilla conceptual de clase

```yaml
id: class.stable-id
display_name: TBD
archetype: melee|ranged|caster|hybrid
strengths: []
weaknesses: []
primary_resource:
  type: TBD
  base: TBD
base_stats:
  health: TBD
  power: TBD
growth_per_level:
  health: TBD
starting_abilities: []
skill_tree_id: tree.stable-id
equipment_rules: []
schema_version: 1
```

Validar ID único, recurso conocido, stats dentro de rango, habilidades existentes y compatibilidad con equipo. Mantener nombre visible localizable y separado del ID.

## Plantilla conceptual de habilidad

```yaml
id: ability.stable-id
kind: active|passive
tags: []
requirements:
  class_ids: []
  level: TBD
  prerequisites: []
ranks:
  - rank: 1
    cost: TBD
    cooldown: TBD
    range: TBD
effects:
  - type: TBD
    parameters: {}
targeting: self|ally|enemy|area|direction
interrupt_policy: TBD
multiplayer_authority: server
schema_version: 1
```

## Pipeline de estadísticas

1. Cargar base de clase y crecimiento por nivel.
2. Aplicar puntos asignados y talentos.
3. Aplicar equipo y afijos.
4. Aplicar pasivas persistentes.
5. Aplicar buffs/debuffs temporales.
6. Aplicar caps y derivar estadísticas finales.

Definir el orden una sola vez y reutilizarlo en UI, combate y simulación.

## Árboles y respec

- Representar nodos por ID y referencias, no por posición visual.
- Validar ciclos, prerequisitos inexistentes, costos y nodos inaccesibles.
- Calcular respec completo antes de mutar; devolver puntos y retirar efectos en una transacción.
- Revalidar habilidades/equipo dependientes y migrar guardados.

## Extensibilidad

Usar registro/configuración o composición. Un consumidor debe preguntar por capacidades/tags, no enumerar cada clase. Conservar campos desconocidos sólo si la estrategia de compatibilidad lo requiere y está probada.

## Checklist de clase nueva

- Identidad mecánica distinta y límites claros.
- IDs y versión estables.
- Fórmulas y balance documentados.
- Habilidades con costo, cooldown, targeting y autoridad.
- Equipo, serialización, migración y red probados.
- Recorrido crear → progresar → respec → guardar/cargar cubierto.

