# Expansión completa de clases, mundo y contenido PvE

## Objetivo del usuario

Convertir las opciones de clase actuales en clases jugables diferenciadas y completar contenido
reutilizable para el RPG idle: mapas/zona nuevos, armas, armaduras, habilidades, efectos visuales,
audio y al menos cinco enemigos nuevos. La expansión debe conservar los personajes Guardian
existentes, la autoridad del servidor y los guardados actuales.

La autorización explícita del propietario del 2026-08-06 permite avanzar con esta expansión mientras
el Paso 20 de infraestructura sigue abierto. Esto es una excepción de alcance registrada; no abre el
Paso 21 ni reemplaza los requisitos de despliegue.

## Estado actual

- Stack: monorepo pnpm, TypeScript estricto, React/Vite, Phaser y Node/Fastify con PostgreSQL/Prisma.
- El MVP persiste `GUARDIAN` legado y siete IDs seleccionables (`AMAZON`, `ASSASSIN`, `BARBARIAN`,
  `DRUID`, `NECROMANCER`, `PALADIN`, `SORCERESS`), pero todos resuelven al perfil de combate del
  Guardián.
- `class-tree.ts`, `ClassRegistrySchema` y `validateClassRegistry` existen; el catálogo sólo contiene
  `guardian` sin ramas ni nodos.
- Amazona usa el rig por capas `hunter`; las demás clases todavía no tienen arte de clase integrado.
- El catálogo ya tiene inventario, equipamiento, loot, cinco enemigos y el Bosque Corrupto infinito.
- La presentación ya tiene VFX descriptivos, audio procedural y fondos ambientales; falta contenido
  definitivo y conexión completa con las nuevas definiciones.

## Alcance

1. Siete clases de dominio diferenciadas, además de `GUARDIAN` como compatibilidad legado:
   Amazona, Asesina, Bárbara, Druida, Nigromante, Paladín y Hechicera.
2. Para cada clase: identidad mecánica, recurso, stats base/crecimiento, tres ramas, activas,
   pasivas, una definitiva, sinergias y reglas de equipo data-driven.
3. Al menos cinco enemigos nuevos con IA configurable, ataques, telegraphs, recompensas y respawn
   seguro. Los IDs iniciales propuestos son `spore_stalker`, `ash_crawler`, `veil_wraith`,
   `stonebound_sentinel` y `rift_howler`; se pueden cambiar antes de publicar datos.
4. Tres zonas nuevas mínimas: Pantano de Esporas, Minas de Ceniza y Ruinas del Umbral, con fondo,
   datos de zona, encuentros, seed, spawn, recompensas y navegación separadas del arte.
5. Expansión del catálogo de armas, armaduras y accesorios con iconos, requisitos, rarezas, afijos,
   tablas de drop y compatibilidad por capacidades.
6. Habilidades con efectos de combate reales: proyectiles, área, buffs/debuffs, daño periódico,
   control, escudos y telegraphs, siempre resueltos por servidor.
7. Efectos visuales y audio con eventos versionados, pooling, reducción de movimiento y buses de
   volumen existentes.
8. Persistencia/migraciones, multiplayer, balance y pruebas de cada recorrido.

## Fuera de alcance

- PvP, comercio entre jugadores, clanes, temporadas y monetización.
- Copiar nombres, arte, texto, sonidos, fórmulas o datos de Diablo II.
- Crear los 24 nodos completos por clase antes de validar el vertical slice y el balance.
- Cambiar de motor o introducir dependencias nuevas sin una decisión registrada.
- Marcar una clase, mapa o asset como terminado si no tiene procedencia, pruebas y smoke verificable.

## Arquitectura afectada

- `packages/shared`: contratos de clases, árboles, efectos, enemigos, zonas, encuentros, loot y
  snapshots; lógica pura de requisitos, stats, respec, IA y generación determinista.
- `packages/game-data`: catálogo versionado y validadores de referencias, rangos, ciclos, animaciones,
  tablas, mapas y presupuesto de entidades.
- `apps/server`: autoridad de selección, progresión, habilidades, IA, spawns, combate, recompensas,
  loot, inventario, audio/VFX event IDs y persistencia.
- Prisma: migraciones aditivas sólo cuando el modelo actual no pueda representar la expansión; los
  saves Guardian se cargan sin cambio semántico.
- `apps/web`: selector/árbol, HUD, runtime Phaser, adaptadores de sprites, VFX, audio y mapas sin
  reglas de negocio locales.
- `public/assets`: spritesheets, capas, iconos, fondos, efectos y audio con manifest/procedencia.

## Skills requeridas

- `game-architect`: límites entre catálogo, dominio, servidor, transporte y presentación.
- `classes-and-skills`: clases, stats, recursos, ramas, nodos, sinergias y respec.
- `combat-system`: daño, efectos, proyectiles, cooldowns, hitboxes y autoridad.
- `loot-and-items`: objetos, equipo, afijos, drops, transacciones y migraciones.
- `enemy-and-dungeon-generator`: enemigos, IA, encuentros, biomas, seeds y spawn.
- `game-balance`: curvas, TTK/DPS, XP, loot, economía y activo frente a idle.
- `pixel-art-pipeline`: sprites, capas, pivotes, animaciones, iconos, fondos y validación.
- `multiplayer-authority`: comandos, snapshots, replay, reconexión y ownership.
- `save-and-migrations`: versiones, migraciones, backups, round trip y recuperación.
- `automated-playtesting`: unidad, integración, smoke, E2E y regresiones jugables.

## Archivos relevantes

- `packages/shared/src/class-tree.ts`, `character-class.ts`, `progression.ts`, `combat.ts`,
  `enemy-*.ts`, `items.ts`: contratos y dominio puro.
- `packages/game-data/src/catalog.ts`, `schemas.ts`, `validation.ts`: datos y validación.
- `apps/server/src/characters/progression-service.ts`, `gameplay/combat-authority.ts`,
  `gameplay/enemy-authority.ts`, `persistence/enemy-reward-service.ts`, `persistence/inventory-service.ts`:
  autoridad y transacciones.
- `apps/server/prisma/schema.prisma` y `migrations/`: sólo cambios persistentes versionados.
- `apps/web/src/screens/CharacterSelect.tsx`, `Character.tsx`, `Skills.tsx`, `game/runtime.ts`,
  `game/presentation.ts`, `game/vfx.ts`, `game/audio.ts`: presentación/adaptadores.
- `apps/web/public/assets/asset-manifest.json`, `ASSET_PROVENANCE.md`, `characters/`, `backgrounds/`:
  recursos verificables.
- `docs/game/classes.md`, `combat.md`, `items-and-loot.md`, `enemies-and-dungeons.md`,
  `balance.md`, `art-pipeline.md`, `saves.md`, `multiplayer.md` y `testing.md`.

## Modelo de datos

- `ClassDefinition`: ID estable, versión, rol, recurso, stats, capacidades, ramas y ultimate.
- `SkillBranchDefinition`/`SkillNodeDefinition`: IDs, requisitos, rangos, tags, efectos y autoridad;
  sin ciclos ni nodos huérfanos.
- `EnemyDefinition`/`EnemyTuning`: arquetipo, estados, ataques, telegraphs, leash, presupuesto y loot.
- `ZoneDefinition`/`EncounterDefinition`: biome, mapa, seed/version, requisitos, encuentros,
  spawn seguro y perfil de recompensa.
- `ItemDefinition`/`ItemInstance`: slot, requisitos, rareza, afijos, seed, versión y capacidades.
- `CombatEffectDefinition`: ID, duración, stacking, tick, inmunidades y evento de presentación.
- `AudioCueDefinition`/`VfxDescriptor`: evento, bus, prioridad, pooling, reducción de movimiento y
  recurso físico; nunca contienen autoridad de daño.
- Todo dato nuevo se versiona; los IDs no dependen del nombre visible.

## Flujo de ejecución

```text
selección/intención
  -> validación server-side contra catálogo y snapshot
  -> resolución pura (stats, requisitos, IA, combate, loot)
  -> transacción/ledger si cambia estado durable
  -> evento versionado (resultado, VFX, audio, recompensa)
  -> snapshot/replicación
  -> UI, Phaser, animación y audio
```

## Consideraciones multiplayer

El cliente sólo envía clase/skill/objetivo/dirección/operación. El servidor decide clase válida,
recurso, cooldown, impacto, daño, IA, spawn, recompensa, drop, propiedad y equipo. Los comandos
usan `operationId`/secuencia, son idempotentes y se rechazan si la versión es incompatible. La
reconexión reconstruye snapshot de party/instancia; los drops siguen siendo privados por personaje.

## Consideraciones de persistencia

Primero se intentará representar la expansión con el catálogo actual. Si se agregan talentos,
recursos o estados durables nuevos, se crea migración Prisma aditiva, `schemaVersion`, fixture
N→N+1, backup/restore y pruebas de round trip. Nunca se serializan stats derivados como autoridad ni
se reemplaza un save corrupto por defaults.

## Consideraciones de rendimiento

- Presupuesto inicial: cuatro jugadores, 40 enemigos, 60 proyectiles y 100 efectos activos por
  instancia; degradar VFX antes que simular menos autoridad.
- Cargar catálogo una vez, usar pooling y evitar asignaciones por frame.
- Medir Chrome/Firefox con p50/p95/p99 de frame/update, heap, entidades, audio y tamaño de snapshot.
- Validar tamaño total de assets contra el límite de `validate:assets` y separar atlas por ciclo de carga.

## Riesgos

| Riesgo                            | Impacto | Mitigación                                               | Señal                    |
| --------------------------------- | ------- | -------------------------------------------------------- | ------------------------ |
| Una clase domina todas las builds | alto    | simulación por rol, nivel, equipo y seed                 | DPS/TTK fuera de banda   |
| Árboles rompen saves              | alto    | migración aditiva, backup y round trip                   | fixture antiguo no carga |
| Enemigos nuevos kitean o bloquean | alto    | estados/leash/spawn tests y navegación separada          | path imposible/softlock  |
| Assets inconsistentes o pesados   | medio   | contrato 92×92, manifest, nearest-neighbor y presupuesto | validate:assets falla    |
| VFX/audio saturan el cliente      | medio   | pooling, prioridades, reduced motion y stress            | p95 de frame/heap        |
| Cliente falsifica skills/loot     | alto    | autoridad, operación idempotente y pruebas adversarias   | receipt ausente/replay   |

## Decisiones

| Fecha      | Decisión                                                                 | Alternativas                        | Consecuencia                                                              |
| ---------- | ------------------------------------------------------------------------ | ----------------------------------- | ------------------------------------------------------------------------- |
| 2026-08-06 | El propietario autoriza la expansión durante Paso 20                     | esperar Paso 20 para todo           | se implementa contenido, pero no se abre Paso 21                          |
| 2026-08-06 | `GUARDIAN` se conserva como legado                                       | renombrar/reemplazar                | saves existentes siguen cargando                                          |
| 2026-08-06 | Se parte de siete clases de dominio, no de los cuatro IDs experimentales | mantener cuatro como producto final | los cuatro IDs se mapearán sólo si aportan contenido y no duplican clases |
| 2026-08-06 | El arte no define combate ni hitboxes                                    | derivarlo del alpha                 | recursos reemplazables y autoridad intacta                                |

## Milestones

- [ ] M1: contrato/catálogo data-driven de las siete clases, cinco enemigos y tres zonas; validadores
      de referencias, ciclos, animaciones, seeds y presupuestos.
- [ ] M2: vertical slice de Bárbara: stats, recurso, una rama, definitiva, arte, arma/armadura,
      VFX/audio y recorrido servidor/UI.
- [ ] M3: vertical slices de Amazona, Asesina, Druida, Nigromante, Paladín y Hechicera con una rama,
      definitiva, arte y pruebas por clase.
- [ ] M4: cinco enemigos nuevos, IA, spawns, encuentros, loot y recompensas.
- [ ] M5: Pantano de Esporas, Minas de Ceniza y Ruinas del Umbral con fondos, datos, navegación,
      encuentros y progresión activa/idle.
- [ ] M6: armas, armaduras, accesorios, iconos, afijos y compatibilidad visual/equipo.
- [ ] M7: efectos de habilidades, impactos, estados, telegraphs, audio y pooling.
- [ ] M8: persistencia/migraciones, multiplayer, reconexión, replay y auditoría de autoridad.
- [ ] M9: balance reproducible, smoke/E2E, validación de assets, documentación y navegador.

## Progreso

- [x] 2026-08-06: autorización explícita recibida; plan creado sin modificar gameplay.
- [x] 2026-08-06: M1 subpaso de clases completado: las siete clases jugables y `GUARDIAN` legado
      están registradas en `classRegistry`; Bárbara ya tiene recurso `rage` y la rama de su
      vertical slice, mientras las otras seis conservan ramas vacías; 20 tests y `pnpm typecheck`
      pasan.
- [x] 2026-08-06: M1 subpaso de contenido completado: cinco enemigos y tres zonas/mapas quedaron
      registrados en `contentExpansion` con referencias cruzadas validadas; 21 tests y
      `pnpm typecheck` pasan. El registro es data-only y no activa spawns ni assets incompletos.
- [x] 2026-08-06: M1 subpaso de skills/efectos completado: los nodos admiten `effectIds`, el
      registro define efectos versionados con targeting/tags/tuning y el validador rechaza efectos
      huérfanos; 22 tests focalizados y `pnpm typecheck` pasan.
- [x] 2026-08-06: M2 subpaso de diseño de Bárbara completado: `branch.barbarian.bloodsong` define
      un activo, una pasiva y la definitiva `ability.barbarian.berserker_oath`; los efectos tienen
      targeting/tags versionados y el helper puro comprueba nivel, prerrequisito y puntos.
- [x] 2026-08-06: M2 subpaso de integración server-side completado: Bárbara inicia con su habilidad
      propia, el snapshot de progresión enumera sus nodos y `CombatAuthority` selecciona su tuning
      por clase sin alterar el recorrido de `GUARDIAN`; 19 tests focalizados y `pnpm typecheck`
      pasan.
- [x] 2026-08-06: M2 subpaso de creación/carga completado: una prueba de integración crea una
      Bárbara, carga su snapshot autenticado y verifica `cleave` desbloqueada y la definitiva en
      nivel 6; la suite de integración queda en 32 tests verdes.
- [x] 2026-08-06: M2 subpaso de presentación completado: el snapshot expone rama/nodo/tipo/efectos,
      la pantalla de Habilidades muestra `Canto de sangre` y las pasivas no ocupan la barra; 2 tests
      de UI y `pnpm typecheck` pasan.
- [x] 2026-08-06: M2 subpaso de runtime local completado: la simulación selecciona el tuning de
      Bárbara por clase y el HUD resuelve sus IDs a `Hendidura`, `Juramento berserker` y `Piel de
      batalla`, con `RABIA` como recurso. Regresiones de combate/HUD y typecheck pasan.
- [x] 2026-08-06: M2 subpaso de concept art completado: se generó y se limpió un preview de pose
      de Bárbara en `apps/web/public/assets/characters/barbarian/previews/`; queda documentado como
      provisional y fuera del manifiesto ejecutable.
- [ ] Siguiente acción: producir hojas consistentes de Bárbara (`idle/walk/basic_attack/hit/death`)
      en tres direcciones y agregar VFX/audio con procedencia validada; el runtime local y la barra
      de acción por clase ya están conectados.

## Pruebas

- Unitarias: schemas, IDs, referencias, ciclos, requisitos, stats, efectos, IA y seeds.
- Integración: creación/carga de clase, skill server-side, loot, inventario, recompensa, migración,
  party y reconexión.
- Playtest: `SMK-01..03`, `CBT-01..04`, `PRG-01..02`, `LOOT-01`, `INV-01..03`, `SAVE-01..02`,
  `DNG-01..02`, `NET-01..04` cuando cada sistema exista.
- Balance: escenarios por clase/rol, equipo bajo/medio/alto, activo/idle, seeds fijas y p10/p50/p90.
- Arte: `pnpm validate:assets`, previews, dimensiones, pivotes, frames, alpha y presupuesto.

## Criterios de aceptación

- Se pueden crear y cargar las siete clases sin romper `GUARDIAN`.
- Cada clase activada tiene al menos una identidad mecánica comprobable, una rama, una definitiva,
  arte y una prueba de autoridad.
- Hay cinco enemigos nuevos reproducibles por seed, con estados sin salida, spawn seguro y loot.
- Hay tres zonas nuevas navegables, con encuentros y recompensas separadas del fondo visual.
- Armas, armaduras, skills, VFX y audio aparecen sólo desde snapshots/eventos autorizados.
- No hay duplicación de XP, objetos, monedas o efectos al reintentar/reconectar.
- Build, typecheck, lint, pruebas, validación de assets y smoke de navegador pasan.

## Resultados

La presentación local ya selecciona el tuning de Bárbara y su barra de acción muestra `Hendidura`,
`Juramento berserker` y `Piel de batalla` a partir del snapshot server-side; `RABIA` reemplaza la
etiqueta de recurso `FURIA`. Se agregaron pruebas del selector de tuning y del HUD. Esto cierra el
subpaso runtime de M2, pero no activa todavía hojas animadas, VFX/audio definitivos ni el manifest.

El contrato y el catálogo base de M1 están implementados y validados: ocho IDs de clase contando
`GUARDIAN`, cinco enemigos y tres zonas/mapas. Las entradas de contenido siguen siendo data-only;
no se han activado spawns ni mapas navegables. M2 ya tiene el diseño data-driven de una rama de
Bárbara y su helper de desbloqueo, pero todavía no cambia el combate activo del runtime.

## Trabajo pendiente

### Estado vigente de milestones (2026-08-06)

- [x] M1: contratos y catálogos data-driven de clases, efectos, enemigos y zonas.
- [ ] M2: vertical slice de Bárbara; servidor, progresión, HUD y preview provisional están listos;
      quedan hojas animadas, runtime visual definitivo, VFX/audio y manifest.

M1 está cerrado. El siguiente trabajo es continuar M2 con hojas animadas de Bárbara, runtime visual,
VFX/audio y validación de assets antes de pasar a las seis clases restantes.
