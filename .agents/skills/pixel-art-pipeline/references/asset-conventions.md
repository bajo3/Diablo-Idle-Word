# Convenciones de assets 2D

## Estado actual

No existe pipeline ni motor detectado. Adoptar estas convenciones como provisionales y reemplazarlas si el proyecto establece otras mejores.

## Nombres

Usar minúsculas ASCII, guiones bajos, IDs estables y numeración con padding:

```text
character_<class>_<action>_<direction>_<frame>
enemy_<type>_<action>_<direction>_<frame>
item_<category>_<id>
effect_<type>_<frame>
tile_<biome>_<variant>
```

Ejemplos: `character_warrior_attack_s_03`, `enemy_slime_hit_e_01`, `item_weapon_iron_sword`, `effect_fire_04`, `tile_forest_ground_02`.

## Metadata por set

Documentar:

- Resolución base y tamaño de tile.
- Pixels per unit si el motor lo usa.
- Ancho/alto de frame, margen y spacing.
- Orden de frames y FPS.
- Direcciones admitidas y fallback.
- Pivote/origen común.
- Hitboxes/hurtboxes por estado como datos separados.
- Licencia/origen y estado placeholder/final.

## Animaciones

Reservar nombres `idle`, `walk`, `run`, `attack`, `cast`, `hit` y `death`. No exigir todas si el diseño no las usa. Mantener el punto de apoyo de pies estable entre frames y documentar frames de evento sólo como señal visual; la lógica conserva autoridad.

## Importación

- Usar nearest-neighbor y desactivar mipmaps sólo cuando corresponda al estilo/escala.
- Preferir escala entera en cámara y UI pixel-perfect.
- Evitar compresión con pérdida que introduzca halos.
- Agrupar atlas por ciclo de carga y presupuesto, no únicamente por tipo.
- Verificar alpha premultiplicado según motor.

## Render y colisión

Separar sprite, sombra, equipo y VFX. Definir capas de suelo, decorado, entidades, overhead y UI. Mantener hitbox/hurtbox independientes del alpha del sprite y visibles en modo debug.

## Placeholders

Usar exactamente las dimensiones, pivote y nombres esperados. Marcar visualmente que son temporales sin cambiar contratos. Mantener un inventario de reemplazo con owner/estado `TBD`; sustituir sin alterar IDs consumidos por código.

