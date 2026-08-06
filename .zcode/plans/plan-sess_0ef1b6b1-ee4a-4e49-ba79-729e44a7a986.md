# Plan: Wirear el Bruto a Phaser

## Objetivo

Que el dummy `root_brute` (línea 283 de `runtime.ts`) deje de reusar los frames del `darkKnight` tintados y muestre su **arte real generado** (idle/walk/basic_attack, 3 dirs, 248×248). Es el primer enemigo con arte propio, y desbloquea el patrón para los otros 4.

## Contexto confirmado

- Ya existe el contrato `PixelLabCharacter` (`pixellab-characters.ts`) con `darkKnight` cargado en runtime. **No toco el validador placeholder `assets.ts` ni `runtime.ts`'s layout 4×4** — los enemigos van por este camino separado.
- El arte del Bruto ya está en `apps/web/public/assets/characters/root_brute/` (9 spritesheets + manifiesto, formato idéntico a `dark_knight`).
- `addDummy` (runtime.ts:387-399) crea sprites con `this.character` (= darkKnight) + tint. Los dummies **no tienen body de física** (son visuales; la colisión va por posición en el controlador) → no hay que recalibrar `setBodySize`/`setOffset`.
- `mapState`/`mapDirection` son genéricos (no asumen un character específico) → reusables tal cual para el Bruto.
- Hay un solo `root_brute` en la escena hoy (dummy:three, línea 284).

## Cambios

### 1. `apps/web/src/game/pixellab-characters.ts` — declarar `rootBrute`

Añadir un `rootBrute: PixelLabCharacter` análogo a `darkKnight`, reflejando el manifiesto ya generado:

```ts
export const rootBrute: PixelLabCharacter = Object.freeze({
  id: 'root_brute',
  displayName: 'Bruto de raíces',
  frameWidth: 248,
  frameHeight: 248,
  origin: { x: 0.5, y: 0.86 }, // mismo origin relativo que dark_knight (pies)
  animations: Object.freeze({
    idle: { frameRate: 6, repeat: -1, sheets: sheets('root_brute', 'idle', 1) },
    walk: { frameRate: 10, repeat: -1, sheets: sheets('root_brute', 'walk', 6) },
    basic_attack: { frameRate: 12, repeat: 0, sheets: sheets('root_brute', 'basic_attack', 6) },
  }),
});
```

Nota: el Bruto no tiene animaciones de `hit`/`death` (no se generaron). El contrato `PixelLabCharacter` exige las 5 keys (`Record<PixelLabAnimationName, ...>`), así que **hay una decisión de diseño**: (a) hacer opcional `hit`/`death` (cambiar el tipo `Record` → `Partial` + fallback a `idle` en `mapState`), o (b) mapear `hit`/`death` a las animaciones que sí existen. Elijo **(a)** porque es lo correcto a nivel de datos (no todos los personajes tendrán las 5) y `mapState` ya tiene un fallback a `idle` implícito — sólo hay que volverlo explícito y defensivo. Esto también beneficia a futuros enemigos. Cambio mínimo y reversible.

### 2. `apps/web/src/game/enemy-visuals.ts` — extender `EnemyVisual`

Añadir un campo opcional `character?: PixelLabCharacter` al visual. Cuando esté presente, el dummy usa ese character (arte propio); cuando no, sigue el camino actual (darkKnight tintado, sin gastar). Así los 4 enemigos sin arte siguen funcionando sin tocarlos:

```ts
export type EnemyVisual = Readonly<{
  displayName: string;
  tint: number;
  character?: PixelLabCharacter;
}>;
// root_brute ahora lleva character: rootBrute (sin tint, o tint neutro)
```

El tint se ignora cuando hay `character` (el arte real no se tinta).

### 3. `apps/web/src/game/runtime.ts` — preload + create + addDummy

- **BootScene.preload** (línea 87): además de `pixelLabSheetsToLoad(darkKnight)`, cargar las sheets de todos los `ENEMY_VISUALS` que tengan `character` (hoy: root_brute). Recorro el catálogo en vez de hardcodear rootBrute, para que añadir más enemigos con arte sólo requiera tocar `enemy-visuals.ts`.
- **TestScene.create** (línea 266): además de `createPixelLabAnimations(this, darkKnight)`, llamar `createPixelLabAnimations` para cada character de enemigo (uno por visual con `character`). Idempotente (`if (scene.anims.exists(key)) continue` ya lo protege).
- **addDummy** (líneas 387-399): resolver el character a usar (`visual.character ?? this.character`), crear el sprite con `pixelLabKey(<char>, 'idle', 'south')`, `setOrigin(<char>.origin)`, y **sólo tintar si no hay character propio**. Reproducir la animación idle del character resuelto. Guardar en `dummyVisuals` como hoy.

### 4. Tests

- `pixellab-characters.test.ts`: añadir aserciones sobre `rootBrute` (keys de animación, frame counts, paths de sheets válidos contra los archivos en `public/`).
- `enemy-visuals.test.ts`: verificar que `root_brute` ahora lleva `character` y los demás siguen con tint y sin character.
- **No añado test de `runtime.ts`** (es Phaser, requires browser/jsdom pesado) — la verificación del wiring será visual/funcional, consistente con cómo se validó darkKnight (que tampoco tiene test de runtime de sprites).

## Fuera de alcance

- **NO** generar arte para los otros 4 enemigos (créditos: 13/40, no alcanza para completos).
- **NO** wirear el Bruto al adaptador de enemigos `apps/web/src/game/sim/` (no existe todavía — es trabajo posterior que requiere instanciar `stepEnemy` real). Hoy el Bruto sigue siendo un dummy estático del TestScene, ahora con arte propio.
- **NO** tocar el combat controller, IA, ni balance — sólo presentación visual.
- **NO** cambiar el comportamiento del Guardián/darkKnight.

## Verificación

1. `pnpm typecheck` limpio.
2. `pnpm lint` + `pnpm format:check` limpios.
3. `pnpm test` verde (tests nuevos de pixellab-characters + enemy-visuals; los existentes sin tocar).
4. `pnpm build` limpio.
5. Smoke visual: levantar el dev server y confirmar que el dummy root_brute muestra el coloso de raíces en vez del Guardián tintado. (Esto te lo dejo para que lo veas vos en el navegador, como ya pasaba con darkKnight — yo no tengo browser in-app fiable esta sesión.)

## Archivos

- **Modificados**: `apps/web/src/game/pixellab-characters.ts` (rootBrute + Partial), `apps/web/src/game/enemy-visuals.ts` (character opcional), `apps/web/src/game/runtime.ts` (preload/create/addDummy), `apps/web/src/game/pixellab-characters.test.ts`, `apps/web/src/game/enemy-visuals.test.ts`, `docs/plans/step-08-enemies-ai.md` (Progreso + Trabajo pendiente).
- **Sin tocar**: el arte ya está en `public/assets/characters/root_brute/`.
