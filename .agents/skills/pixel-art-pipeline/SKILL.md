---
name: pixel-art-pipeline
description: Define y valida el flujo de recursos gráficos 2D, pixel art, spritesheets, animaciones, nombres, escalas, pivotes, hitboxes y placeholders. Usar cuando se agreguen o modifiquen assets visuales 2D. No usar para reglas de combate.
---

# Purpose

Mantener assets 2D consistentes, reemplazables, eficientes y alineados con colisión y animación.

# Trigger conditions

Usar al agregar o modificar pixel art, spritesheets, atlas, animaciones, tiles, pivotes, importación, placeholders o convenciones visuales.

# Do not use when

No usar para reglas de combate, balance o autoridad. No derivar hitboxes definitivas del contorno visual sin contrato de gameplay.

# Required context

1. Inspeccionar `AGENTS.md`, `GAME_DESIGN.md`, `docs/game/art-pipeline.md`, assets, importadores, render, animación, física y build.
2. Localizar convenciones de nombres/carpetas, resolución, tile, escala, filtro, pivotes y atlas.
3. Leer [convenciones de assets](references/asset-conventions.md).
4. Confirmar motor, unidades, formatos, compresión y dispositivos objetivo.

# Workflow

1. Inventariar convenciones actuales y preservarlas si son mejores.
2. Definir resolución base, tile, pixels-per-unit si aplica y escalado entero.
3. Especificar spritesheet/atlas: frames, direcciones, acciones, pivote y origen.
4. Separar sprite, sombra, efectos, hitbox y hurtbox.
5. Importar con nearest-neighbor cuando corresponda y compresión compatible.
6. Validar nombres, secuencias, assets faltantes y presupuesto.
7. Documentar placeholders y ruta de sustitución futura.

# Architecture rules

- Separar presentación visual de lógica y colisión.
- Mantener pivotes/orígenes coherentes entre idle, walk, run, attack, cast, hit y death.
- Usar orden de renderizado explícito para suelo, sombra, personaje, equipo y efectos.
- Permitir variantes de clase/equipo sin duplicar lógica.
- Mantener metadatos de animación y colisión en formato versionable según el stack.

# Implementation rules

- Favorecer escalas enteras y filtro nearest-neighbor para pixel art nítido.
- Validar dimensiones, frame count, direcciones, nombres, alpha y bordes.
- Usar spritesheets/atlas/batching según soporte medido del motor.
- Mantener hitbox/hurtbox independientes y sincronizadas por estados, no por píxeles visibles.
- Marcar placeholders con nombre estable, licencia/origen y condición de reemplazo.
- No introducir assets finales si la dirección visual está `TBD`.
- Si no existe pipeline, definir convenciones provisionales agnósticas y una checklist; no elegir herramienta artística definitiva.
- Combinar `performance-2d` para atlas/memoria y `combat-system` sólo para contratos de hitbox.

# Validation

- Verificar importación, filtro, escala, pivote, orden, secuencia y ausencia de frames faltantes.
- Probar animaciones en todas las direcciones y transiciones relevantes.
- Medir atlas, draw calls o memoria cuando el stack lo permita.
- Mostrar inventario de assets, configuración, capturas/resultados y placeholders pendientes.

# Required output

Entregar convenciones, rutas, metadatos, validaciones, assets faltantes, impacto de rendimiento y plan de reemplazo de placeholders.

# Definition of done

Completar cuando nombres y frames sean válidos, escala/pivote sean coherentes, colisiones estén separadas, placeholders sean reemplazables y la importación pase.

# Related documentation

- [Convenciones de assets](references/asset-conventions.md)
- [Pipeline de arte](../../../docs/game/art-pipeline.md)
- [Rendimiento](../../../docs/game/performance.md)
