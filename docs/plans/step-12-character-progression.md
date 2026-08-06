# Paso 12 — Progresion persistente del Guardian

## Objetivo del usuario

Separar la experiencia del personaje de la experiencia del Bosque, permitir niveles 1–10,
distribuir atributos, desbloquear habilidades y guardar una build que se vea en Personaje,
Habilidades y el HUD.

## Estado actual

El repositorio ya tenia `CharacterProgress` (nivel, XP y puntos de atributo) y `CharacterSkill`,
pero la XP solo se acumulaba, la curva no estaba centralizada, no habia endpoints de build y las
pantallas no consumian ese estado. El Paso 11 dejo inventario/equipamiento real y un ledger
`InventoryOperation` idempotente que tambien sirve para comandos de build versionados.

## Alcance

- Curva acumulativa de XP y reglas 1–10 en `GAME_DATA.progression`.
- Aplicacion server-side de XP otorgada por economia/recompensas, con nivel y puntos derivados.
- Stats base derivados de atributos, sin mezclar la XP del Bosque.
- Endpoints autenticados para leer progreso, asignar atributos, aprender habilidades, configurar
  cuatro ranuras y restablecer atributos con costo de oro.
- Ledger idempotente y hash canonico para todas las mutaciones.
- Pantallas React `Personaje` y `Habilidades`, y HUD que muestra solo las habilidades equipadas por
  la build confirmada.

## Fuera de alcance

- Arboles con ramas, puntos de talento separados o clases adicionales.
- Cambiar todavia el tuning de daño del motor de combate por personaje; la autoridad ya impide
  activar una habilidad no aprendida y el pipeline de stats queda listo para el siguiente balance.
- Modo ausente, comercio, cofre, ciudad completa y nuevas zonas (pasos posteriores).

## Arquitectura afectada

- `packages/shared/src/progression.ts`: funciones puras `levelForExperience`, `applyExperience`,
  `deriveCharacterStats` y contratos de configuracion.
- `packages/game-data/src/catalog.ts`/`schemas.ts`/`validation.ts`: curva, requisitos de nivel y
  validacion monotona.
- `apps/server/src/characters/progression-service.ts`: ownership, reglas, snapshots y ledger.
- `apps/server/src/app.ts`: rutas HTTP y validacion de habilidades en COMBAT_INTENT.
- `apps/web/src/api.ts`, pantallas y `GameIsland`/`GameHudOverlay`: consumo del snapshot real.

## Modelo de datos

No se agrega una tabla nueva: `CharacterProgress` ya versiona nivel/XP/puntos y las columnas de
atributos de `Character` son el estado autoritativo. `CharacterSkill` persiste el arbol minimo y
la barra. `InventoryOperation` se reutiliza como ledger de comandos con `kind` (`allocate_attributes`,
`learn_skill`, `set_skill_bar`, `reset_attributes`) y resultado snapshot JSON sin BigInt. Cada
operacion valida ownership, hash y `operationId` dentro de una transaccion serializable.

## Flujo de ejecucion

`REWARD_LOG/economia -> applyExperience(curva GAME_DATA) -> nivel/puntos -> persistencia`.

`HTTP autenticado -> Zod -> ProgressionService -> ownership + requisitos + mutacion atomica ->
snapshot/fingerprint -> UI`.

El cliente nunca envia nivel, XP ni estadisticas finales; solo expresa un delta de atributo o una
intencion de build.

## Consideraciones multiplayer

El servidor sigue siendo autoridad. Antes de resolver `COMBAT_INTENT`, la build persistida debe
contener la habilidad solicitada; un cliente no puede activar una habilidad bloqueada. La build se
lee por personaje y no se replica a otros usuarios.

## Consideraciones de persistencia

Se conserva el `schemaVersion` 1 del progreso y se versionan `GAME_DATA_VERSION`,
`BALANCE_VERSION` y `formulaVersion`. No hubo migracion porque los campos y ledger existentes ya
cubren el contrato; el resultado de cada mutacion es durable y reproducible.

## Rendimiento

La curva y stats son funciones puras O(1) para diez niveles. Los comandos ejecutan una transaccion
serializable y el HUD solo vuelve a consultar al montar/reconectar; no se recalculan por frame.

## Milestones

- [x] M1: curva, XP y stats puros con pruebas.
- [x] M2: servicio server-side, ledger, rutas y guard de habilidades.
- [x] M3: Personaje/Habilidades y HUD real.
- [x] M4: pruebas unitarias, integracion, typecheck/build/lint y smoke autenticado.

## Progreso

- [x] 2026-08-04 — Implementados M1–M4; `CharacterProgress` deja de acumular XP sin nivel y la
      build se puede leer/modificar desde servidor y navegador.

## Pruebas

- `pnpm test -- --run` — 56 archivos / 278 tests.
- `pnpm test:integration` — 4 archivos / 25 tests, incluyendo overspend, learn, barra, replay y
  persistencia de Paso 12.
- `pnpm typecheck`, `pnpm lint`, `pnpm build`.
- Smoke autenticado en `http://localhost:5173/personaje`, `/habilidades` y `/partida`: snapshot
  real, cuatro atributos, cinco habilidades con requisitos, barra con Tajo y canvas unico.

## Trabajo pendiente

- Integrar el snapshot de stats completo en el tuning de combate por personaje cuando se reabra el
  balance; no bloquear Paso 12 porque el estado y la autoridad ya estan separados.
- Arbol de talentos expandido queda fuera del alcance MVP y requiere una decision de datos.
