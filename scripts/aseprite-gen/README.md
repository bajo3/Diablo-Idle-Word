# Generación de sprites por rig (Aseprite MCP)

Estado al 2026-08-06. Este documento existe para que el trabajo se pueda retomar sin el historial
de la conversación donde se construyó.

## Por qué un rig y no frames sueltos

Dos razones, y la segunda es la importante:

1. **Escala.** Cada personaje son 96 frames (idle 4 + walk 8 + basic_attack 7 + hit 6 + death 7 = 32,
   por 3 direcciones generadas). Cuatro clases nuevas son 384 frames. Dibujarlos uno por uno no es
   viable.
2. **Equipamiento.** `apps/web/src/game/runtime.ts` (`renderEquipmentVisuals`) hoy dibuja la armadura
   y el arma como **figuras vectoriales translúcidas teñidas por rareza** — un casco es un círculo
   semitransparente, un arma es una línea de color. Equipar el "Filo del Guardián Corrupto" en vez de
   una espada de hierro sólo cambia el largo y el color de esa línea. Lo hace porque el arte generado
   es **fusionado**: no tiene capas. El contrato original de `apps/web/src/game/assets.ts` sí las
   preveía (`shadow`/`body`/`armor`/`weapon`) y se perdió cuando llegó el arte de PixelLab.

El rig resuelve las dos: las partes se dibujan una vez y se posan por frame, y cada parte declara a
qué capa pertenece, así que el mismo rig emite hojas `body`, `armor` y `weapon` que calzan pixel a
pixel.

**Nota:** PixelLab tampoco resuelve el equipamiento — también genera personajes fusionados. El rig
hace falta igual, venga de donde venga el cuerpo.

## Archivos

| Archivo                                                         | Qué es                                                                                                                                                                          |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mcp-client.mjs`                                                | Cliente JSON-RPC por stdio contra `pixel-mcp`. Existe porque el CLI del MCP Inspector pasa cada argumento como un flag suelto y no puede cargar un payload de miles de píxeles. |
| `rig/rig.mjs`                                                   | El motor, agnóstico del personaje: partes desde ASCII, composición por capa, contorno por capa, export con frames + duraciones + tags reales.                                   |
| `rig/hunter.mjs`                                                | La Cazadora: 18 partes, posiciones de reposo y las 5 animaciones (32 poses).                                                                                                    |
| `rig/preview.mjs`                                               | Renderiza un frame en tres variantes (cuerpo / +armadura / +arma) para juzgar el apilado sin generar 45 hojas.                                                                  |
| `dump-shape.lua`                                                | Vuelca el bounding box y el ancho por fila de un sprite.                                                                                                                        |
| `dump-colors.lua`                                               | Vuelca el histograma real de colores (ignora alpha < 128).                                                                                                                      |
| `ascii-map.lua`                                                 | Vuelca un sprite como mapa ASCII de brillo — así se descubrió la anatomía del ranger.                                                                                           |
| `compare.lua` / `compare3.lua` / `compare4.lua` / `upscale.lua` | Hojas de comparación ampliadas con fondo a cuadros.                                                                                                                             |

## Datos medidos del `ranger` (no inventados)

Sacados con los scripts de arriba sobre `apps/web/public/assets/characters/ranger/`:

- Canvas 92x92, silueta 28 ancho x 62 alto, centrada en x=46.
- Cabeza arranca en y=16 con 3px y llega a ~15px. Hombros máximo 24px.
- **Fila y=68 completamente vacía**, y recién ahí empiezan dos piernas separadas. Sin esa fila el
  cuerpo bajo se lee como un bloque sólido — fue el error más grande del primer intento.
- Brazos separados del torso por píxeles transparentes a ambos lados.
- Pies terminan en y=77 (el pivote del runtime es `origin.y = 0.86` → y≈79).
- Paleta: ~30% de los píxeles opacos son línea casi negra (`#040303`); la tela vive entre 0.12 y
  0.25 de luminancia, con un realce raro cerca de 0.38 y un acento dorado mínimo (0.7%).

Un intento previo pintó la ropa entre 0.32 y 0.40 y por eso se veía brillante y de juguete al lado
del arte existente.

## Cómo correrlo

```bash
node rig/preview.mjs idle 0 south
```

Requiere Aseprite compilado en `C:/Users/felip/Documents/aseprite-src/build/bin/aseprite.exe` y la
config del servidor en `~/.config/pixel-mcp/config.json` (ojo: el binario lee esa ruta, **no**
`%APPDATA%` como dice su documentación).

## Hecho

1. ~~Verificar el ciclo de caminata.~~ Falló al principio: 8 frames casi idénticos. Dos causas —
   amplitud de 1-2px (invisible a 92px) y que mover un brazo obligaba a listar su brazalete y su
   mano en cada frame. Se resolvió agregando **jerarquía de partes** (`parent`) más un nodo `core`
   sin píxeles del que cuelga el torso, y subiendo amplitudes: piernas 4px, cuerpo 2px, brazos 3px.
2. ~~Generar y medir.~~ **45 hojas en 118s** (3 direcciones x 5 animaciones x 3 capas). Proyecta a
   ~8 min para las 4 clases. Dimensiones verificadas contra el contrato: `736x92` walk, `368x92`
   idle — idéntico al `ranger_idle_south` real.
3. ~~`north` y `east`.~~ Ambas tienen partes propias y **tablas de reposo propias** (girar mueve la
   aljaba a la espalda y el arco a la otra mano, que es un cambio de posición, no sólo de dibujo).

4. ~~Cablear el runtime.~~ Cada capa se publica como un `PixelLabCharacter` propio
   (`hunter_body` / `hunter_armor` / `hunter_weapon`), así el cargador, el registro de animaciones y
   el contrato de frames funcionan **sin cambios**. El runtime crea dos sprites extra sobre el mismo
   origen y los anima desde el mismo estado de la FSM y el mismo facing que el cuerpo — cualquier
   otra cosa deja el casco un frame atrás de la cabeza. Cuando hay capas reales, los overlays
   vectoriales se saltean por completo.

   Activación: `?character=hunter`, **sólo en desarrollo** (misma compuerta que el harness de
   stress). Un bundle de producción sigue mostrando al Guardián.

   ```bash
   pnpm dev   # y abrir /mundo?character=hunter
   ```

## Pendiente

5. Replicar para `arcanist`, `summoner` y la clase que resuelva la colisión de ID `dark_knight`
   (ver `docs/game/classes.md`).

## Calidad conocida

`east` (perfil) es la dirección más floja: la cabeza de perfil se lee algo forzada y el peto queda
descentrado. `south` y `north` están bien. Vale una pasada de retoque antes de dar el personaje por
cerrado.

## Decisiones tomadas

- Se usa `pixel-mcp` (plugin `pixel-plugin`, 50 herramientas) y **no** se migra a
  `diivi/aseprite-mcp`: el servidor no está roto y ya tiene lo necesario (`import_image`,
  `resize_canvas`, `create_tag`, `set_frame_duration`, `export_spritesheet`).
- Aseprite Lua con primitivas geométricas queda como **fallback**, no como método principal.
- No hay acceso a la API de PixelLab en este entorno (sin API key, sin conector MCP). Si aparece,
  el pipeline preferido es: PixelLab genera el cuerpo → Aseprite normaliza a 92x92, centra pivotes,
  crea tags y exporta. El rig sigue siendo necesario para las capas de equipamiento.
