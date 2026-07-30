# Generación de ítems

## Modelo

Separar:

```text
ItemDefinition: tipo, slot, base, tags, arte y reglas
ItemInstance: instance_id, definition_id, item_level, rarity, affixes, seed, version
Presentation: nombre localizado, icono, tooltip
DerivedStats: resultado calculado, no fuente persistente salvo decisión explícita
```

## Pipeline reproducible

1. Elegir tabla por fuente, nivel y contexto.
2. Elegir definición base por peso.
3. Determinar rareza.
4. Determinar cantidad y familias de afijos.
5. Filtrar por tags, nivel, exclusión y slot.
6. Elegir afijos sin conflictos mediante pesos.
7. Tirar valores dentro de rangos y aplicar redondeo.
8. Asignar ID único, seed y versión; validar instancia completa.

No reutilizar seed como identificador único.

## Ejemplo común

```yaml
definition_id: weapon.sword.iron
rarity: common
item_level: 5
base_damage: 8-12
affixes: []
```

Resultado conceptual con seed fija: daño base 10, sin afijos.

## Ejemplo raro

```yaml
definition_id: weapon.sword.iron
rarity: rare
item_level: 12
affixes:
  - id: prefix.power
    value: 14
  - id: suffix.haste
    value: 6
```

Validar que las familias no sean mutuamente excluyentes y que los tiers admitan nivel 12.

## Ejemplo legendario

```yaml
definition_id: weapon.sword.ember
rarity: legendary
item_level: 25
fixed_effects:
  - id: effect.ember-wave
    version: 1
rolled_affixes:
  - id: prefix.fire
    value: 22
```

Separar el efecto legendario versionado de sus valores aleatorios. No ejecutar scripts arbitrarios almacenados en el save.

## Tablas y economía

- Normalizar pesos sólo al evaluar; conservar pesos enteros legibles.
- Definir pity, garantías o exclusiones de forma explícita.
- Versionar cambios que alteren instancias o reproducibilidad.
- Simular percentiles y objetos por hora con seeds registradas.

## Transacciones seguras

Equipar, vender, destruir, mejorar y transferir deben verificar propiedad, versión, slot, bloqueo, saldo y operación previa dentro de una transacción. Una repetición con el mismo ID debe devolver el resultado previo, no duplicarlo.

