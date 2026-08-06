# Plan: HUD de combate overlay + pulido visual del canvas

## Objetivo del usuario

1. **HUD profesional flotante sobre el canvas** (no abajo como texto), siguiendo la imagen de referencia: barras en esquinas, skill bar con cooldown animado, minimapa placeholder, controles accesibles.
2. **Pulido visual del canvas**: mejor feedback de impacto, muerte de enemigos con efecto, aura de ironSkin.

## Referencia visual

Imagen analizada (`hud-ref.png`): HUD simétrico dark-fantasy. Inferior-izq = barras Vida/Furia; inferior-centro = skill bar 4 slots; sup-izq = objetivo/zona; sup-der = minimapa + party; controles inferiores.

---

## Parte A — HUD overlay flotante (`GameIsland.tsx`)

Reestructurar el contenedor: hoy canvas + HUD están en flujo normal (flex column). Pasar a **contenedor relativo** con el HUD **absolute-positioned** por encima del canvas.

### Layout del overlay (pointer-events:none salvo controles)

1. **Contenedor raíz** `.game-stage` (position:relative, 960×540). Dentro:
   - `div.game-island` (el host del canvas, ocupa todo).
   - `div.hud-overlay` (absolute inset:0, pointer-events:none, z-index sobre canvas).

2. **Esquina inferior izquierda — recursos** (`.hud-resources`, absolute bottom-left)
   - Barra de **Vida** grande (alto 22px, color `--danger-bright`, borde ornamentado, números `186/220` encima a la izquierda).
   - Barra de **Furia** más fina (alto 12px, `--corruption`).
   - Datos: `hud.health/maxHealth`, `hud.fury/maxFury` (ya existen).

3. **Esquina inferior centro — skill bar** (`.hud-skills`, absolute bottom-center)
   - 4 slots (64×64) en fila: Tajo (LMB), Golpe poderoso (RMB), Torbellino (Q), Piel de hierro (E).
   - Cada slot: borde, tecla abajo-derecha.
   - **Cooldown animado**: oscurecer (`data-on-cooldown`) + texto grande `Xs` en centro + un **sweep vertical** (un div oscuro cuya altura = `% del cooldown restante`, de arriba hacia abajo). El `%` = `cooldownRemainingMs[key] / cooldownMs`. El `cooldownMs` se lee de `guardianCombatTuning.abilities[key].cooldownMs` (500/4000/7000/12000) — el import ya existe en GameIsland.
   - **Piel de hierro activa**: borde `--accent` + glow interno cuando `hud.ironSkinActive` (ya hay data-attribute hoy).

4. **Esquina superior izquierda — zona/objetivo** (`.hud-zone`, absolute top-left)
   - "Bosque Corrupto" + nivel (placeholder estático por ahora; el snapshot no trae zona).
   - Estado conexión compacto: "● En línea" (verde `--accent`) o amarillo si degradado. Usa `hud.connection`.

5. **Esquina superior derecha — minimapa placeholder** (`.hud-minimap`, absolute top-right)
   - Caja ~150px con borde punteado, fondo verde-gris oscuro, texto "minimapa" centrado. Placeholder limpio hasta que exista el sistema de party/Bosque.
   - **Conteo de enemigos vivos** debajo: se puede calcular desde el runtime agregando `enemiesAlive` al snapshot (ver Parte C).

6. **Controles** (`.hud-controls`, absolute bottom-right, pointer-events:auto)
   - Botones compactos del kit `Button`: Pausar/Reanudar (toggle de texto), Combate automático (toggle visible), Guardar, Inventario, Pueblo, Salir.
   - Toggle de números de daño como un control chico.

### CSS

- Nuevo `game-hud.css` importado en `main.tsx` (o al final de `styles.css`), usando tokens de `theme.css`. Sin hex hardcodeado.
- Regla clave: `.hud-overlay { pointer-events: none }` y `.hud-controls, .hud-controls button { pointer-events: auto }` para que el canvas siga recibiendo clics de ataque.

---

## Parte B — Pulido visual del canvas (`runtime.ts`)

Aprovechar eventos que ya se emiten pero no tienen feedback visual. Cambios en `TestScene`:

1. **Muerte de enemigos con burst** — hoy solo `setTint(0x3b3b3b)`. Agregar en `handleEvents` rama `targetDefeated`:
   - Un **anillo expansivo** corto (estilo `flashHazard` existente): `this.add.circle(x,y, 16, 0x8a3ffc, 0.5)` con tween scale→2.5, alpha→0, 260ms, destroy on complete. Color corrupción para minions, dorado para élites (por ahora púrpura fijo, no hay élites aún).
   - Mantener el tint gris + alpha (queda como cadáver).

2. **Aura de ironSkin** — hoy el evento `{type:'ironSkin', active}` se emite pero `handleEvents` no lo maneja. Agregar rama:
   - `active: true`: crear/tween un `Arc` contorno translúcido `--accent` alrededor del player (`this.add.circle(player.x, player.y, 38).setStrokeStyle(2, 0xa9c09f, 0.6)`), guardarlo en `this.ironSkinAura`, tween de pulso suave (alpha 0.4↔0.8 loop).
   - `active: false`: destruir el aura.
   - Esto da feedback claro de que la habilidad defensiva está activa.

3. **Shake de cámara al activar Golpe poderoso** (opcional, sutil): ya hay shake en `selfDamaged`. Agregar un shake muy leve (40ms, 0.002) al activar powerStrike para dar "peso". En `activate()`, rama `abilityAccepted` para powerStrike.

No toco sprites de personajes (pixel art generado), ni agrego assets de imagen (sin dependencias). Todo es Phaser primitivas (Arc/Graphics/tweens) ya usadas en el runtime.

---

## Parte C — Extender el snapshot (mínimo)

Agregar a `GameHudSnapshot` (runtime.ts) y popular en `publishHud`:

- `enemiesAlive: number` — `controller.getTargets().filter(t => t.health > 0).length`. Ya existe `getTargets()` en el controller. Sirve para el contador bajo el minimapa.

No agrego más (party, forestLevel, poción, minimapa real) — son placeholders hasta que existan esos sistemas. El HUD queda preparado para recibirlos.

---

## Archivos a tocar

**Modificados:**

- `apps/web/src/game/GameIsland.tsx` — reestructura overlay + skill bar con sweep + props existentes.
- `apps/web/src/game/runtime.ts` — `GameHudSnapshot` +enemiesAlive, `publishHud` lo pobla, pulido visual (burst muerte, aura ironSkin, shake powerStrike).
- `apps/web/src/styles.css` (o nuevo `game-hud.css`) — CSS del overlay.
- `apps/web/src/game/GameIsland.test.tsx` — ajustar si cambian roles/textos.

**No se tocan:** `packages/shared`, `packages/game-data`, backend, DB, sprites, skills. El import de `guardianCombatTuning` ya existe.

## Validación (Definition of Done)

1. `corepack pnpm --filter @brecha/web typecheck` limpio.
2. `corepack pnpm --filter @brecha/web test` verde (GameIsland.test actualizado).
3. En navegador `/partida`: el HUD flota sobre el canvas sin tapar al personaje central, los slots muestran sweep de cooldown, los clics llegan al canvas, la muerte de enemigos tiene burst, ironSkin muestra aura. Controles accesibles.

## Riesgos

- **pointer-events**: si me equivoco, los clics de ataque no llegan al canvas. Mitigo con `.hud-overlay { pointer-events:none }` y solo `.hud-controls` con auto. Lo verifico en navegador.
- **Overlay tapando acción**: el layout de la imagen deja el centro libre. Verifico que el personaje (que empieza en 160,160 zoom 1.6) quede visible.
