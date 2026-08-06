# Clases y habilidades

## Estado actual

Existe el contrato y catalogo inicial del Guardian, sus atributos, Furia y cinco habilidades. El
Paso 12 agrega una curva de XP acumulativa 1–10, puntos de atributo, stats derivados, requisitos
de nivel y una barra persistida de cuatro ranuras; el tuning de combate sigue siendo provisional.

Desde 2026-08-05 la creación ofrece las siete clases solicitadas con IDs persistentes
(`AMAZON`, `ASSASSIN`, `BARBARIAN`, `DRUID`, `NECROMANCER`, `PALADIN`, `SORCERESS`). Todas usan
temporalmente el perfil de combate del Guardián; `GUARDIAN` se conserva como valor legado y como
fallback para clientes antiguos. La elección se valida en servidor y aparece en Personaje,
Habilidades y el HUD junto con XP/nivel. Los kits diferenciados, recursos y árboles propios siguen
fuera de este MVP.

## Expansión posterior inspirada en ARPG clásicos

El MVP conserva un único perfil de combate jugable, Guardián; las siete opciones de creación sólo
aportan identidad persistida hasta que existan kits propios. El árbol extenso queda fuera de alcance.
Como trabajo posterior se registran cuatro clases propias —`dark_knight` (Caballero Oscuro), `arcanist`
(Arcanista), `hunter` (Cazadora) y `summoner` (Invocador)— sin copiar nombres, arte, habilidades ni
datos de Diablo II. Guardián no se renombra ni se elimina: cualquier expansión debe ser aditiva y
mantener la compatibilidad de sus partidas.

**Colisión de ID a resolver antes de M1:** el asset visual `dark_knight` (`pixellab-characters.ts`,
`ASSET_PROVENANCE.md`) ya existe hoy como la apariencia del Guardián — no como la clase jugable nueva
del mismo nombre. Antes de generar arte para la clase `dark_knight`, hay que decidir: (a) el Guardián
se queda con ese sprite y la clase nueva usa un ID de asset distinto (`dark_knight_class` o similar)
aunque comparta `displayName`, o (b) la clase `dark_knight` hereda ese sprite y el Guardián pasa a
usar otro. Sin esa decisión, cualquier art pipeline nuevo pisa el asset del Guardián en producción.

Cada clase nueva apunta a tres ramas data-driven, seis activas equipables, dos pasivas principales,
una definitiva y sinergias referenciadas por IDs. El primer hito será un vertical slice de una rama
y una definitiva por clase; no se crearán 24 nodos jugables por clase sin pasar antes por balance,
pruebas y presupuesto de arte. El contrato de ramas/nodos, autoridad, migración y milestones vive en
[`docs/plans/post-goal-class-expansion.md`](../plans/post-goal-class-expansion.md).

## División de trabajo: Codex vs Claude

Esta sección existe porque el proyecto usa dos agentes con capacidades distintas y complementarias.
Repartir mal el trabajo hace que uno de los dos reintente algo que el otro ya puede hacer mejor.

**Por qué la división es así:** `apps/web/public/assets/ASSET_PROVENANCE.md` registra que los seis
fondos de `backgrounds/*.webp` (plaza del pueblo, herrería, santuario, puesto de la Exploradora,
Bosque Corrupto, ruinas hundidas) tienen procedencia **"Codex image generation"** — es decir, Codex ya
generó arte raster real para este proyecto antes. Claude Code, en esta sesión, no tiene ninguna
herramienta de generación de imágenes conectada; sólo puede: (1) compilar y dirigir Aseprite vía
`pixel-plugin` para dibujo pixel a pixel programático (formas, paletas, dithering — más cerca de lo
que ya hice en `environment.ts` con Phaser Graphics que de un sprite dibujado a mano), y (2) escribir
todo el código, esquemas, autoridad de servidor, migraciones y pruebas del proyecto.

### Codex — generación de imágenes

- **Sprites de personaje de las 4 clases nuevas** (`arcanist`, `hunter`, `summoner`, y la que resulte
  de resolver la colisión de `dark_knight`): hojas `idle/walk/basic_attack/hit/death` × 3 direcciones
  generadas, seguendo el contrato de `pixellab-characters.ts` (92×92px, origen `(0.5, 0.86)`) o el
  contrato de capas de `assets.ts` si se prefiere volver a spritesheets por capas. **Punto de riesgo:**
  nadie verificó todavía si el generador de imágenes de Codex mantiene consistencia entre frames de una
  misma animación tan bien como PixelLab. Recomiendo probar con **una sola clase primero** (sugiero
  `hunter`, la más visualmente distinta del Guardián) antes de encargar las cuatro.
- **Fondos de mapas nuevos**, mismo formato que los seis `.webp` existentes (832×468, sin texto, sin
  colisiones, sólo ambientación) para las zonas que acompañen a las clases nuevas.
- Cada asset que entregue Codex necesita una entrada nueva en `ASSET_PROVENANCE.md` y en
  `asset-manifest.json` (dimensiones, frame count, licencia, `maxBytes`) — sin eso `pnpm
  validate:assets` lo rechaza en build.

### Claude — arquitectura, datos y autoridad

- **Desbloquear el catálogo para que admita más de una clase/mapa/enemigo.** Hoy
  `packages/game-data/src/schemas.ts` es literal a propósito: `guardian: GuardianDefinitionSchema`
  fuerza `id: z.literal('guardian')`, `enemies` exige `.length(5)` exacto y `maps` exige `.length(1)`
  exacto. Es una guarda intencional del MVP (evita que un catálogo mal armado pase validación en
  silencio), pero también es el bloqueo real número uno: nada de lo demás compila hasta que esto pase
  a ser data-driven (arrays con mínimos, no longitudes exactas) sin romper `guardian` existente. Esto
  es el hito **M1** del plan.
- Módulos puros de ramas/nodos/sinergias/respec en `packages/shared` (sin Phaser, sin timers,
  determinísticos, con tests).
- Autoridad de servidor: selección de clase, `ProgressionService`, `combat-authority.ts`, migración
  aditiva de Prisma — nunca aceptar clase, coste, cooldown o daño calculado en el cliente.
- Capas y decoración procedural del mapa nuevo (como `environment.ts` ya hace para el Bosque
  Corrupto) para complementar el fondo raster que entregue Codex, sin tocar colisiones/autoridad.
- Retoques de pixel art puntuales vía Aseprite/`pixel-plugin` una vez instalado: iconos, diferenciar
  más las siluetas de `corrupted_minion`/`dark_shaman`/`unstable_beast` mientras no tengan sprite
  propio.
- Todas las pruebas: esquema/grafo/requisitos/respec unitarias, integración de creación/carga/
  migración, replay/concurrencia y smoke de `/personaje`, `/habilidades`, `/partida`.

### Orden sugerido

1. Resolver la colisión de ID `dark_knight` (decisión de una línea, bloquea todo lo demás de arte).
2. Codex genera **una** clase de prueba (arte) mientras Claude arranca M1 (esquema data-driven) en
   paralelo — son independientes, no hay por qué esperar en serie.
3. Validar la clase de prueba (calidad de arte + `pnpm validate:assets` + integración en
   `pixellab-characters.ts`) antes de encargar las tres restantes.
4. Con M1 cerrado y el arte de las 4 clases validado, Claude sigue con M2 (vertical slice de una rama
   + una definitiva por clase) y el mapa nuevo se cablea sobre el fondo que entregue Codex.

## Datos del Paso 12

`GAME_DATA.progression` centraliza los umbrales `[0, 100, 250, 450, 700, 1000, 1350, 1750,
2200, 2700]`, tres puntos por nivel y el costo de respec. Cada habilidad declara `unlockLevel`.

## Responsabilidades

Mantener definiciones de clase/habilidad, progreso por nivel, puntos, requisitos, rangos, pasivas y
respec. Usar IDs estables y configuracion validable.

Separar:

- Definicion inmutable de clase/habilidad.
- Progreso persistente del personaje.
- Estado temporal de cast/cooldown.
- Resultado de estadisticas derivadas.
- Presentacion y localizacion.

## Flujo de datos

```text
Definicion + nivel + talentos + equipo + efectos
→ pipeline de stats → snapshot de combate/presentacion
```

Aprender o resetear: comando → validar requisitos/puntos → mutacion atomica → recalcular →
persistir → replicar.

El cliente solo manda intenciones. `ProgressionService` actualiza atributos/skills dentro de una
transaccion serializable y devuelve un snapshot con fingerprint; `InventoryOperation` evita doble
gasto o doble equipamiento. `COMBAT_INTENT` se rechaza si la habilidad no esta desbloqueada.

## Limites

Evitar condicionales globales por clase. Combate ejecuta efectos definidos; balance decide valores;
saves versiona progreso; servidor autoriza cambios online.

## Riesgos

IDs vinculados al nombre visible, referencias ciclicas, orden de stats duplicado, respec que deja
efectos, clases futuras que exigen editar todos los consumidores.

## Pruebas requeridas

Crear clase, nivelar, validar requisitos, aprender activa/pasiva, respec, compatibilidad de equipo,
round trip, replay idempotente y sincronizacion de la build del HUD.

## Skills relacionadas

- [classes-and-skills](../../.agents/skills/classes-and-skills/SKILL.md)
- [combat-system](../../.agents/skills/combat-system/SKILL.md)
- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [save-and-migrations](../../.agents/skills/save-and-migrations/SKILL.md)
