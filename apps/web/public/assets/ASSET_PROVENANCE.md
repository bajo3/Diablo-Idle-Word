# Placeholders del Paso 6

`characters/guardian_placeholder_*.svg` fueron generados para este repositorio el 2026-07-29.
Son spritesheets placeholder CC0-1.0 de 256×256: 16 frames de 64×64, cuatro filas ordenadas
`up`, `down`, `left`, `right`; el frame 0 de cada fila es `idle` y los frames 1–2 son `moving`.
Comparten pivote de pies `(32,64)`, origen normalizado `(0.5,1)` y capas sincronizadas. Reemplazarlos
por spritesheets PNG con el mismo ID y contrato de frames, sin cambiar la lógica.

# Personajes PixelLab (no integrados)

`characters/dark_knight/` y `characters/ranger/` se generaron el 2026-07-30 vía PixelLab MCP
(licencia según ToS de PixelLab, ver https://pixellab.ai/termsofservice; uso de assets generados
por IA para este proyecto). **No están enchufados al pipeline de combate ni pasan
`validateAssetManifest`** — son sprites fusionados (sin capas shadow/body/armor/weapon separadas),
92×92px, 3 direcciones generadas (south/north/east, west se espeja con flipX) en vez del contrato
actual de 4 capas × 64×64 × 4 direcciones literales.

Cada personaje trae:

- `full/<id>_<state>_<direction>.png` — spritesheets horizontales por animación (`idle`, `walk`,
  `basic_attack`, `hit`, `death`).
- `metadata/manifest.json` — frameWidth/frameHeight/frameCount por animación y dirección.
- `previews/<id>_preview.png` — pose estática de referencia.

Sirven como set de arte de referencia/candidato para cuando el proyecto pase de la etapa técnica
(Paso 6/7, placeholders) a la etapa visual. Para usarlos habría que decidir entre (a) adaptar
`assets.ts`/`validateAssetManifest` para aceptar sprites fusionados de tamaño variable, o
(b) regenerar el arte respetando el contrato de 4 capas de 64×64. El script
`scripts/pixellab-process-character.mjs` reconstruye estos spritesheets a partir de un export ZIP
de PixelLab (`GET /mcp/characters/{id}/download`) si hace falta regenerarlos o agregar personajes.
