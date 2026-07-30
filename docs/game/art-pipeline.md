# Pipeline de arte 2D

## Placeholders del Paso 6

Los cuatro SVG `guardian_placeholder_{shadow,body,armor,weapon}` son recursos propios CC0-1.0 de
64×64 con origen de pies y capas estables. El manifiesto exige direcciones `up/down/left/right`,
frames y procedencia; el reemplazo posterior debe conservar ID y contrato de frame.

## Estado actual

Existen contratos de cuatro direcciones, estados, spritesheets, eventos de frame, manifest y propiedades de mapa. No hay motor ni assets físicos; resolución final, tile, paleta, cámara y herramientas siguen `TBD`.

## Contratos del Paso 2

El paquete compartido define cuatro direcciones, estados visuales, spritesheets de 64/128, eventos de frame, manifiesto de assets y propiedades Tiled estrictas. El manifiesto actual describe sólo un placeholder contractual; no afirma que exista un asset final.

## Responsabilidades

- Definir resolución base, tile, escala, filtro y pixels-per-unit si aplica.
- Estandarizar nombres, carpetas, spritesheets, atlas, frames y direcciones.
- Mantener pivotes/orígenes y orden de render.
- Separar sprite, sombra, VFX, hitbox y hurtbox.
- Administrar placeholders, importación, compresión y reemplazo.

## Flujo

```text
Fuente/licencia → export con nombre/metadatos
→ importación configurada → validación de frames/pivote
→ atlas/carga → prueba visual + presupuesto
```

## Límites

Arte no define daño ni ventanas autoritativas. Combate publica estados/eventos; animación los representa. Hitbox/hurtbox son datos de gameplay visibles en debug.

## Riesgos

Escala fraccionaria borrosa, pivotes que saltan, compresión con halos, frames faltantes, atlas mal segmentado, placeholders con contrato distinto y assets sin licencia.

## Pruebas requeridas

Importación, nearest-neighbor cuando aplique, acciones/direcciones, pivote, layering, hitbox debug, assets faltantes, memoria y sustitución de placeholder.

## Skills relacionadas

- [pixel-art-pipeline](../../.agents/skills/pixel-art-pipeline/SKILL.md)
- [performance-2d](../../.agents/skills/performance-2d/SKILL.md)
- [combat-system](../../.agents/skills/combat-system/SKILL.md)
