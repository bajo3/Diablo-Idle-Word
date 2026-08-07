# Placeholders y procedencia del arte

El manifiesto ejecutable de esta carpeta es `asset-manifest.json`. `pnpm validate:assets` comprueba
que cada archivo exista, respete dimensiones/frame count, tenga procedencia/licencia y no supere el
presupuesto inicial de 1,5 MB. El build de producción ejecuta esa validación antes de compilar.

`characters/guardian_placeholder_*.svg` fueron generados para este repositorio el 2026-07-29.
Son spritesheets placeholder CC0-1.0 de 256×256: 16 frames de 64×64, cuatro filas ordenadas
`up`, `down`, `left`, `right`; el frame 0 de cada fila es `idle` y los frames 1–2 son `moving`.
Comparten pivote de pies `(32,64)`, origen normalizado `(0.5,1)` y capas sincronizadas. Reemplazarlos
por spritesheets PNG con el mismo ID y contrato de frames, sin cambiar la lógica.

# Personajes generados y aprobados (contrato de hoja fusionada)

`characters/dark_knight/` y `characters/ranger/` se generaron entre el 2026-07-30 y 2026-07-31 vía
PixelLab MCP
(licencia según ToS de PixelLab, ver https://pixellab.ai/termsofservice; uso de assets generados
por IA para este proyecto). Son sprites fusionados (sin capas shadow/body/armor/weapon separadas),
92×92px, 3 direcciones generadas (south/north/east, west se espeja con flipX) en vez del contrato
actual de 4 capas × 64×64 × 4 direcciones literales. `dark_knight` se usa para el Guardián y
`ranger` para enemigos; el adaptador conserva el contrato separado de capas.

`characters/root_brute/` fue reemplazado el 2026-08-04 por el sprite proporcionado por el proyecto.
Conserva el contrato de tres direcciones y frame de 248×248, pero sus hojas de `idle`, `walk` y
`basic_attack` repiten únicamente esa referencia para impedir que reaparezca el personaje antiguo.
La licencia definitiva debe confirmarse antes de distribuir el juego.

Cada personaje trae:

- `full/<id>_<state>_<direction>.png` — spritesheets horizontales por animación (`idle`, `walk`,
  `basic_attack`, `hit`, `death`).
- `metadata/manifest.json` — frameWidth/frameHeight/frameCount por animación y dirección.
- `previews/<id>_preview.png` — pose estática de referencia.

**Estado (2026-08-04): el Caballero Oscuro está conectado al Guardián, Ranger al Arquero poseído y
el Bruto aprobado a `root_brute`.** La decisión se resolvió por una vía separada: `apps/web/src/game/
pixellab-characters.ts` describe el contrato fusionado (92×92, una hoja por animación y dirección,
`west` espejado de `east`) y mapea los estados de la FSM visual sobre las animaciones disponibles.
El manifiesto ejecutable valida estas hojas, mientras el contrato de capas de `assets.ts` sigue
intacto y honesto.

El script
`scripts/pixellab-process-character.mjs` reconstruye estos spritesheets a partir de un export ZIP
de PixelLab (`GET /mcp/characters/{id}/download`) si hace falta regenerarlos o agregar personajes.

# Fondos ambientales generados (2026-08-05)

`backgrounds/` contiene seis fondos raster de 832×468 optimizados a WebP para el kit visual:

- `village-square.webp` — plaza principal del pueblo.
- `blacksmith-forge.webp` — interior de la herrería.
- `portal-shrine.webp` — santuario del Guardián del Portal.
- `explorer-outpost.webp` — puesto de la Exploradora y modo ausente.
- `corrupted-forest.webp` — terreno de la expedición jugable actual.
- `sunken-ruins.webp` — teaser bloqueado de una futura expedición.

Se generaron como borradores de ambientación sin texto, personajes ni colisiones. La UI los consume
como capas `background-image` y el runtime usa `corrupted-forest.webp` únicamente como suelo visual;
la autoridad, navegación, spawn, obstáculos y hitboxes siguen en código/datos separados. La
procedencia queda registrada como `Codex image generation`; confirmar los términos de distribución
antes de publicar el juego.

# Cazadora por capas (2026-08-06)

`characters/hunter/layers/` contiene 45 hojas generadas por el rig de `scripts/aseprite-gen/`
(Aseprite compilado desde fuente + servidor `pixel-mcp`). Licencia CC0-1.0, arte propio del
proyecto: no proviene de PixelLab ni de ningún tercero.

A diferencia del resto de los personajes, **está separada en tres capas** —`body`, `armor` y
`weapon`— publicadas como tres IDs de personaje (`hunter_body`, `hunter_armor`, `hunter_weapon`)
que comparten frame de 92x92, origen `(0.5, 0.86)` y el mismo set de animaciones. Ese registro
pixel a pixel es lo que permite que el equipamiento se vea como arte real en vez de las figuras
vectoriales teñidas por rareza que usa `renderEquipmentVisuals` para los personajes fusionados.

Las proporciones y el rango de valores se midieron sobre el `ranger` ya publicado; el README de
`scripts/aseprite-gen/` documenta las mediciones. Desde 2026-08-06 el rig está conectado a `AMAZON`
en producción mediante `layeredCharacterForClass`; ya no depende de `?character=hunter`. La
aprobación visual definitiva y una pasada de retoque de la dirección `east` siguen pendientes
antes de declarar este arte como definitivo.

# Bárbara — preview provisional (2026-08-06)

`characters/barbarian/previews/barbarian_preview.png` sigue siendo una referencia de una sola pose
generada con Codex Image Generation y convertida a alpha desde chroma-key; está escalada a 184×184
con nearest-neighbor. La primera pasada de hojas completas se documenta en la sección siguiente.

# Clases generadas — primera pasada de sprites (2026-08-07)

Se generaron atlas de contacto para `barbarian`, `assassin`, `druid`, `necromancer`, `paladin` y
`sorceress` con el pipeline de imagen integrado: tres direcciones (`north`, `south`, `east`), cinco
estados (`idle`, `walk`, `basic_attack`, `hit`, `death`), alpha limpiado por chroma key y exportación
nearest-neighbor a frames de 92×92. Cada set tiene manifest propio, entrada en `asset-manifest.json`
y procedencia `Codex image generation contact atlas`.

Estado: generado y conectado al loader/runtime para estas clases; la primera pasada repite la pose de
cada contacto dentro del frame count contractual para mantener compatibilidad. La sustitución futura
por animaciones multi-frame authored debe conservar los mismos IDs, pivote `(0.5, 0.86)`, rutas y
direcciones. No se derivan hitboxes desde el alpha.
