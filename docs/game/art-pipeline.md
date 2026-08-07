# Pipeline de arte 2D

## Placeholders del Paso 6

Los cuatro SVG `guardian_placeholder_{shadow,body,armor,weapon}` son recursos propios CC0-1.0 de
64×64 con origen de pies y capas estables. El manifiesto exige direcciones `up/down/left/right`,
frames y procedencia; el reemplazo posterior debe conservar ID y contrato de frame.

## Estado actual

### Manifiesto ejecutable (Paso 18)

`apps/web/public/assets/asset-manifest.json` registra cada recurso físico con ID estable, tipo,
procedencia, autor, licencia, estado y límite de bytes. Los manifiestos de personajes repiten la
procedencia en `metadata/manifest.json` para que una hoja no pueda quedar huérfana del registro.
`pnpm validate:assets` comprueba rutas dentro de `public/assets`, dimensiones PNG/SVG, divisibilidad
de frames, animaciones mínimas (`idle`, `walk`, `basic_attack`), direcciones, licencias y el límite
inicial de 1,5 MB. `pnpm build` ejecuta la misma validación antes de compilar.

El reemplazo de una hoja debe conservar el ID y el contrato de frame, actualizar su entrada de
procedencia y volver a ejecutar el validador. Los recursos `placeholder` se pueden usar para pruebas,
pero no se etiquetan como arte final.

Existen contratos de cuatro direcciones, estados, spritesheets, eventos de frame, manifest y propiedades de mapa. No hay motor ni assets físicos; resolución final, tile, paleta, cámara y herramientas siguen `TBD`.

### Presentación provisional de equipamiento (2026-08-04)

El personaje generado de 92x92 no trae capas authored de arma/armadura. Para que el equipo
confirmado por servidor produzca una diferencia visible sin fingir que el spritesheet ya es modular,
`apps/web/src/game/equipment-visual.ts` deriva un loadout mínimo y `runtime.ts` dibuja overlays
placeholder en Phaser. Los overlays comparten el origen de pies del personaje, siguen dirección,
flip, profundidad y alpha, y usan una paleta estable por rareza. Se recrean únicamente cuando cambia
el snapshot, nunca dentro de `update()` ni de la lógica de combate.

Estos overlays son reemplazables y no definen hitboxes, daño ni estadísticas. Las capas authored por
frame y sus offsets por animación siguen siendo una mejora visual posterior; el contrato de
compatibilidad ya se valida antes de arrancar Phaser y no bloquea el vertical slice.

### Bruto aprobado (2026-08-04)

El Bruto (`root_brute`) usa el sprite proporcionado por el proyecto como única referencia visual.
Se conservaron las rutas y el contrato de `248×248` por frame (`idle`, `walk`, `basic_attack`, tres
direcciones con espejo de `east` para la izquierda), pero todas las celdas de esas hojas se generaron
a partir de la misma imagen para impedir que aparezcan las hojas antiguas de otro personaje. La
procedencia queda registrada como `User-provided sprite upload`; antes de distribuir el juego hay que
confirmar la licencia definitiva del archivo.

### Fondos ambientales generados (2026-08-05)

El kit visual incorpora seis fondos de `832×468` en WebP bajo `public/assets/backgrounds/`. Pueblo,
herrería, santuario del portal y puesto de la Exploradora se consumen como capas de ambientación en
las pantallas React; `corrupted-forest.webp` también se carga detrás del suelo procedural de la
expedición jugable; `sunken-ruins.webp` se muestra como zona bloqueada de preparación. Son arte
generado de borrador, sin personajes ni colisiones, y todos sus metadatos están en
`asset-manifest.json` y `ASSET_PROVENANCE.md`.

El presupuesto del set es menor a 320 KB con nearest-neighbor/pixel art preservado por la escala
entera de exportación. Las imágenes no definen navegación, obstáculos, hitboxes, spawn ni autoridad;
se pueden sustituir manteniendo sus rutas estables y actualizando procedencia/licencia.

## Contratos del Paso 2

El paquete compartido define cuatro direcciones, estados visuales, spritesheets de 64/128, eventos de
frame, manifiesto de assets y propiedades Tiled estrictas. El manifiesto físico del Paso 18 diferencia
placeholders contractuales de hojas generadas y conserva la procedencia de cada una.

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

## Primera pasada de clases generadas (2026-08-07)

`barbarian`, `assassin`, `druid`, `necromancer`, `paladin` y `sorceress` ahora tienen hojas merged
de 92×92, tres direcciones y cinco estados bajo `characters/<id>/full/`, con metadata y procedencia
registradas. El loader las carga y `characterForClass` las asigna a la clase elegida; Amazona conserva
su rig por capas y Guardián conserva `dark_knight`.

La primera pasada partía de una pose de contacto repetida dentro del conteo de frames contractual.
Ahora `scripts/aseprite-gen/synthesize-class-animation-variants.py` genera una pasada puente
determinista: bob/lean de 1–5 px para que caminar, atacar, recibir daño y morir tengan lectura
visual en juego. Mantiene rutas, IDs, frame size, pivote, alpha y nearest-neighbor; no pretende ser
la animación multi-frame authored definitiva. Cuando llegue arte final, se reemplazan las celdas sin
cambiar esos contratos y se vuelve a ejecutar `pnpm validate:assets`.

La misma pasada dejó de teñir tres enemigos sobre la silueta del Guardián: `corrupted_minion`,
`dark_shaman` y `unstable_beast` usan temporalmente las siluetas generadas de Asesina, Nigromante y
Druida respectivamente. Es variedad de lectura para la demo, no arte enemigo final; sus IDs,
estadísticas, IA y hitboxes siguen siendo los del catálogo.

## Skills relacionadas

- [pixel-art-pipeline](../../.agents/skills/pixel-art-pipeline/SKILL.md)
- [performance-2d](../../.agents/skills/performance-2d/SKILL.md)
- [combat-system](../../.agents/skills/combat-system/SKILL.md)
