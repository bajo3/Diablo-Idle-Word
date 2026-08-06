# Expansión de clases y árboles de habilidades — referencia de diseño propia

## Objetivo del usuario

Ampliar La Brecha Oscura con una estructura de clases inspirada en la profundidad de los ARPG
clásicos, usando la referencia de Diablo II sólo como guía de organización. El resultado debe ser
propio: cuatro clases nuevas con roles distinguibles, tres ramas por clase, habilidades activas y
pasivas, sin copiar nombres, arte, texto, sonidos ni datos del juego de referencia.

Este plan no cambia el MVP vigente ni comienza hasta que el Paso 20 tenga resueltos sus bloqueos
externos. Guardián se conserva como clase compatible para no invalidar personajes o partidas.

## Estado actual

- `GOAL.md` define una sola clase MVP (`guardian`/Guardián), nivel 1–10, cuatro atributos y una
  barra de cuatro ranuras.
- `@brecha/game-data` valida un catálogo centrado en `guardian`, cinco habilidades y el tuning
  `guardian-combat.1`.
- Prisma usa `CharacterClass.GUARDIAN`; los servicios, contratos, HUD y runtime todavía tienen
  consumidores específicos de Guardián.
- Existe un asset visual `dark_knight` generado y validado, pero hoy se usa como apariencia del
  Guardián; no representa todavía una clase jugable ni un contrato de habilidades.
- `CharacterProgress` y `CharacterSkill` ya son persistentes y versionados, pero no existe un
  modelo de ramas, nodos, sinergias, respec de talentos ni selección de clase nueva.
- El siguiente paso incompleto del plan maestro sigue siendo el Paso 20 (infraestructura externa:
  proveedor, secretos, DNS/TLS, CI observado y remote Git). El Paso 21 no se inicia.

## Alcance

### Clases objetivo

Se agregan cuatro IDs de dominio estables, además de `guardian`:

| ID            | Nombre visible   | Rol principal        | Recurso propuesto | Fantasía propia                                     |
| ------------- | ---------------- | -------------------- | ----------------- | --------------------------------------------------- |
| `dark_knight` | Caballero Oscuro | melee híbrido/tanque | fervor            | intercambia vida, defensa y presión cuerpo a cuerpo |
| `arcanist`    | Arcanista        | caster de control    | mana              | combina elementos y ventanas de lanzamiento         |
| `hunter`      | Cazadora         | ranged/movilidad     | concentración     | distancia, trampas y marcas                         |
| `summoner`    | Invocador        | soporte/summons      | esencia           | criaturas temporales, maldiciones y protección      |

Cada clase nueva tendrá, como objetivo de contenido final:

- tres ramas con IDs (`branch.<class>.<branch>`), no posiciones visuales;
- hasta ocho nodos de habilidad por rama (24 nodos por clase), sujeto a presupuesto de producción;
- seis ranuras activas equipables, dos pasivas principales y una definitiva;
- requisitos de nivel, prerequisitos, coste, cooldown, targeting, tags y autoridad server-side;
- sinergias declaradas como referencias de IDs, sin ciclos;
- reglas de equipo expresadas por capacidades/tags, no por `if` globales de clase;
- localización separada del ID y datos versionados.

La primera implementación no debe crear 96 habilidades jugables de una vez. El vertical slice
inicial será una rama representativa por clase y una definitiva provisional; el resto queda como
datos bloqueados hasta medir balance, arte y capacidad de pruebas.

## Fuera de alcance

- No reemplazar ni renombrar `guardian` en esta expansión.
- No copiar las siete clases, nombres, habilidades, objetos, fórmulas o arte de Diablo II.
- No habilitar árboles extensos dentro del MVP actual ni adelantar el Paso 21.
- No agregar PvP, comercio entre jugadores, nuevas regiones ni un sistema de crafting por esta
  decisión.
- No escribir secretos, claves de proveedores, prompts con credenciales ni assets sin procedencia.

## Arquitectura afectada

- `packages/shared`: contratos de clase, rama, nodo, sinergia, capacidades y snapshots de build;
  funciones puras para requisitos, asignación, respec y derivación de stats.
- `packages/game-data`: catálogo de clases/ramas/abilities y tuning separado del motor; validación
  de IDs, referencias, ciclos, rangos y versiones.
- `apps/server`: selección de clase, creación de personaje, `ProgressionService`, combate y
  autoridad de habilidades consumen capacidades del catálogo en vez de enumerar clases.
- Prisma/persistencia: migración aditiva para clase y build sólo cuando se implemente el hito de
  persistencia; los personajes `GUARDIAN` existentes deben migrar sin cambio semántico.
- `apps/web`: selector de clase, árbol accesible, barra activa y HUD deben consumir snapshots
  server-side; Phaser sólo presenta animaciones/efectos derivados de eventos autorizados.
- Documentación: `docs/game/classes.md`, `docs/game/combat.md`, `docs/game/balance.md` y
  `docs/game/saves.md` se actualizan junto con cada hito.

## Skills requeridas

- `game-architect`: límites entre catálogo, dominio, servidor, transporte y presentación.
- `classes-and-skills`: identidad de clases, ramas, requisitos, sinergias, respec y compatibilidad.
- `combat-system`: resolución autoritativa de costes, cooldowns, impactos y efectos.
- `game-balance`: comparación reproducible de roles, builds, TTK/DPS, supervivencia y economía.
- `automated-playtesting`: regresión de creación, progresión, respec, combate, red y UI.
- `save-and-migrations`: obligatorio al cambiar el formato persistente de clase/build.
- `multiplayer-authority`: obligatorio al exponer selección o habilidades por WS/party.

## Archivos relevantes

- `packages/game-data/src/schemas.ts` y `packages/game-data/src/catalog.ts`: reemplazar el
  catálogo rígido por registros data-driven manteniendo validación de Guardián.
- `packages/game-data/src/validation.ts`: validar referencias, ramas acíclicas, sinergias y
  compatibilidad con animaciones/tuning.
- `packages/shared/src/domain.ts`, `progression.ts` y nuevos módulos de clases/talentos: lógica
  pura, IDs estables y snapshots inmutables.
- `apps/server/prisma/schema.prisma`, migraciones y `characters/`: selección, creación y guardado.
- `apps/server/src/characters/progression-service.ts` y `gameplay/combat-authority.ts`: autoridad
  server-side y rechazo de habilidades no aprendidas/no equipadas.
- `apps/web/src/api.ts`, `App.tsx`, `screens/Skills.tsx`, `GameHudOverlay.tsx` y `runtime.ts`:
  selector/árbol/barra/presentación sin reglas de negocio locales.

## Modelo de datos

Propuesta para el hito de persistencia, aún no implementada:

- `ClassDefinition`: `classId`, `schemaVersion`, `displayNameKey`, `roleTags`, `resource`,
  `baseStats`, `growth`, `equipmentCapabilities`, `treeId`.
- `SkillNodeDefinition`: `nodeId`, `classId`, `branchId`, `kind`, `tags`, `requirements`,
  `ranks`, `effects`, `targeting`, `authority`, `schemaVersion`.
- `CharacterTalent`: `characterId`, `nodeId`, `rank`, `spentPoints`, `revision` y ledger de
  operación; IDs únicos por personaje y nodo.
- `Character.class`: enum ampliado de forma aditiva o `classId` validado, con migración explícita;
  nunca aceptar un ID enviado por cliente sin consultar el catálogo server-side.

Versionado: `schemaVersion` de build/talentos debe avanzar con migraciones secuenciales. La carga
debe conservar el guardado anterior, rechazar nodos desconocidos de forma segura y recalcular stats
derivados en lugar de serializarlos como autoridad.

## Flujo de ejecución

`catálogo versionado → crear/seleccionar clase → snapshot de progresión → validar requisitos y
puntos → mutación atómica → derivar stats → validar COMBAT_INTENT → resolver efectos server-side →
replicar snapshot/eventos → presentar HUD/animación`.

El cliente sólo expresa `classId`, `nodeId`, `rank` y `operationId`. El servidor decide identidad,
costes, cooldowns, recursos, daño, sinergias, equipo permitido, recompensas y resultado.

## Consideraciones multiplayer

- Selección, build y activación son acciones autenticadas, con ownership, rate limit, versión,
  `operationId` e idempotencia.
- `COMBAT_INTENT` se valida contra la build persistida y el estado del tick; nunca usa daño,
  cooldown, recurso o clase finales enviados por el navegador.
- Los snapshots de party exponen sólo datos necesarios para presentación; la build privada de otro
  personaje no se replica salvo capacidades/rol permitidos por el diseño.
- Reintentos, reconexión, paquetes fuera de orden y versión incompatible deben devolver recibos o
  rechazos deterministas.

## Consideraciones de persistencia

No se cambia el esquema en esta sesión. Antes de implementar el primer hito persistente hay que
crear una migración aditiva, backup/restore verificable, serializer/migrador y pruebas de round trip,
conflicto de revisión, datos faltantes, nodo desconocido y rollback. Personajes existentes deben
seguir cargando como `guardian` con la build actual.

## Consideraciones de rendimiento

- La derivación de stats, requisitos y validación de grafos debe ser pura y no ejecutarse por frame.
- El catálogo se carga una vez; el HUD renderiza sólo el subgrafo visible y la barra equipada.
- Medir memoria/tiempo con cuatro jugadores y 24 nodos por árbol antes de aumentar contenido.
- Las simulaciones de balance deben registrar versión, seed, escenario, clase, build y percentiles.

## Riesgos

| Riesgo                                 | Impacto/probabilidad | Mitigación                                     | Señal                         |
| -------------------------------------- | -------------------- | ---------------------------------------------- | ----------------------------- |
| Migrar `GUARDIAN` rompe saves          | alto/media           | migración aditiva y round trip antes de UI     | fixture V1 no carga           |
| 120 nodos exceden presupuesto          | alto/alta            | vertical slice por clase y gates de producción | bundle/tiempo de carga        |
| una build domina todos los escenarios  | alto/media           | simulación por rol, equipo, nivel y seed       | TTK/DPS fuera de banda        |
| condicionales por clase se multiplican | medio/alta           | capacidades/tags y catálogo único              | `if classId` en consumidores  |
| cliente activa habilidad no autorizada | alto/media           | autoridad, hash, replay y pruebas adversarias  | resultado sin receipt         |
| sinergias cíclicas o IDs huérfanos     | medio/media          | validador de grafo en build                    | fallo de `validate:game-data` |

## Decisiones

| Fecha      | Decisión                                               | Alternativas                      | Consecuencia                                  |
| ---------- | ------------------------------------------------------ | --------------------------------- | --------------------------------------------- |
| 2026-08-05 | Conservar Guardián y sumar cuatro clases propias       | reemplazarlo o renombrarlo        | compatibilidad de saves y contenido existente |
| 2026-08-05 | Usar referencia de Diablo II sólo para estructura      | copiar clases/skills              | identidad, arte y datos originales            |
| 2026-08-05 | Implementar vertical slice antes de 24 nodos por clase | crear todo el catálogo de una vez | balance y pruebas manejables                  |
| 2026-08-05 | Mantener el trabajo fuera del MVP/Paso 21              | adelantarlo durante Paso 20       | respeta GOAL y evita scope creep              |

## Milestones

- [ ] M0: decisión de alcance registrada; no modificar código mientras el Paso 20 siga bloqueado.
- [ ] M1: registro data-driven de clases/ramas/nodos con Guardián compatible; validador de IDs,
      referencias y ciclos.
- [ ] M2: vertical slice de `dark_knight`, `arcanist`, `hunter` y `summoner` (una rama, una
      definitiva y capacidades mínimas por clase), con contratos puros y pruebas.
- [ ] M3: autoridad server-side, selección/creación, build, respec y migración de persistencia.
- [ ] M4: combate y HUD consumen capacidades sin condicionales globales; reconexión/replay probados.
- [ ] M5: expansión progresiva de ramas/nodos sólo después de balance y presupuesto de arte.
- [ ] M6: simulación reproducible, smoke de navegador y documentación de balance antes de activar
      más contenido.

## Progreso

- [x] 2026-08-05: leído el brief adjunto y contrastado con `GOAL.md`, `PLANS.md`, catálogo,
      Prisma, progresión, combate y HUD.
- [x] 2026-08-05: creado este ExecPlan con IDs, clases, límites, autoridad y gates de producción.
- [ ] Próximo: cerrar bloqueos externos del Paso 20 y recibir autorización explícita para iniciar
      M1; no iniciar M1 en esta sesión.

## Pruebas

Para M1–M6 se exigirán, como mínimo, pruebas unitarias de esquema/grafo/requisitos/respec, tests
de integración de creación/carga/migración y autoridad, replay/concurrencia, escenarios de combate
por clase/build y smoke de `/personaje`, `/habilidades` y `/partida`. Cada simulación debe usar seed
fija y emitir métricas p10/p50/p90 o p95 según el escenario.

## Criterios de aceptación

- Las cuatro clases nuevas tienen IDs estables, roles y capacidades distinguibles, sin romper
  Guardianes existentes.
- Ningún nodo puede aprenderse sin clase, nivel, prerequisito, puntos y operación válidos.
- Respec es atómico, idempotente y deja stats/equipo/combate coherentes.
- El servidor es la única autoridad de selección, build, coste, cooldown, daño y efectos.
- UI/HUD y Phaser presentan snapshots/eventos autorizados sin duplicar reglas.
- Migraciones, balance, pruebas y procedencia de assets están documentados antes de activar cada
  clase o rama.

## Resultados

La sesión actual sólo agrega documentación. No se modificaron catálogo, Prisma, contratos, UI,
combate ni assets; por lo tanto no se marca ningún hito de implementación.

## Trabajo pendiente

Resolver las dependencias del Paso 20 en `GOAL.md`. Al quedar disponible el proveedor/CI y con una
decisión explícita de continuar, ejecutar únicamente M1, actualizar este plan y volver a verificar
el MVP antes de pasar a M2.
