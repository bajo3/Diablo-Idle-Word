# Progresión visible y selección de clases equivalentes

## Objetivo del usuario

Quitar las paredes invisibles que traban al personaje y completar el recorrido de personaje estilo
ARPG clásico: experiencia, niveles, puntos de atributo, habilidades y una pantalla de creación con
las siete clases de Diablo II. Durante este prototipo todas las clases deben compartir la misma
configuración de Guardián para no inventar siete kits de combate distintos.

## Estado actual

El dominio ya tiene una progresión server-side de nivel 1–10, XP acumulativa, atributos derivados,
respec y habilidades desbloqueables. La UI expone `/personaje` y `/habilidades`, pero la creación sólo
envía un nombre y la base sólo acepta `GUARDIAN`. El runtime local usa Arcade Physics y conserva una
lista de obstáculos para el knockback; el movimiento ordinario no debe quedar bloqueado por paredes
decorativas del mapa.

## Alcance

- Mantener la autoridad existente de XP, nivel, atributos y habilidades.
- Hacer explícita la curva/estadísticas de prueba y mostrar progreso de nivel y puntos en la UI.
- Añadir siete IDs de clase seleccionables (Amazon, Asesina, Bárbara, Druida, Nigromante, Paladín y
  Hechicera) más `GUARDIAN` legado; todos resuelven temporalmente al perfil de combate Guardián.
- Persistir la elección de clase con una migración Prisma compatible con personajes existentes.
- Quitar las colisiones de obstáculos decorativos del movimiento del jugador, conservando sólo límites
  de mapa y validaciones de knockback relevantes.
- Agregar pruebas de contrato, creación, progreso, UI y regresión de movimiento.

## Fuera de alcance

- No crear siete árboles, recursos, sprites ni fórmulas distintas todavía.
- No copiar nombres, arte o habilidades propietarias; sólo se usan los nombres de clase solicitados y
  un perfil provisional común.
- No cambiar la autoridad server-side ni permitir que el cliente asigne XP o stats.
- No retirar la XP del Bosque ni mezclarla con la XP del personaje.

## Arquitectura afectada

- `@brecha/shared`: contrato estable de IDs/opciones de clase.
- `apps/server/src/auth` y `characters`: validación y creación autorizada.
- Prisma: enum `CharacterClass` ampliado aditivamente; `GUARDIAN` permanece para compatibilidad.
- `apps/web/src/App.tsx`/`api.ts`: selección de clase y envío de intención.
- `apps/web/src/game/runtime.ts`: movimiento sin obstáculos decorativos.
- `apps/web/src/screens/Character.tsx` y `Skills.tsx`: presentación del progreso ya autorizado.

## Skills requeridas

- `game-architect`: límites dominio/UI/persistencia y migración incremental.
- `classes-and-skills`: IDs, perfil común, atributos, niveles y habilidades.
- `combat-system`: stats derivados consumidos por combate sin duplicar fórmulas.
- `game-balance`: curva provisional reproducible y métricas XP/TTK documentadas.
- `automated-playtesting`: regresiones de creación, nivel, habilidad y movimiento.

## Archivos relevantes

- `packages/shared/src/character-class.ts`: IDs y opciones data-driven.
- `packages/shared/src/progression.ts`: fórmulas puras de nivel y stats.
- `packages/game-data/src/catalog.ts`: curva y tuning versionados.
- `apps/server/src/auth/contracts.ts`, `characters/character-service.ts`: comando de creación.
- `apps/server/src/persistence/contracts.ts`, `character-repository.ts`: round trip persistente.
- `apps/server/prisma/schema.prisma` y `migrations/*character_class_choices*/`: enum compatible.
- `apps/web/src/api.ts`, `App.tsx`, `Character.tsx`, `Skills.tsx`: flujo visible.
- `apps/web/src/game/runtime.ts`: límites de movimiento.

## Modelo de datos

`CharacterClassId` es un enum versionado con `GUARDIAN` legado y las siete opciones solicitadas.
Los personajes existentes no cambian. Las nuevas creaciones guardan la opción elegida; el perfil de
combate provisional se resuelve por capacidades comunes, no por condicionales repartidos.

## Flujo de ejecución

Creación: UI selecciona clase → API envía `{name, class}` → Zod valida → servicio comprueba ownership
y disponibilidad → Prisma guarda enum y crea el progreso inicial → lista devuelve clase y nivel.

Progresión: recompensa server-side → `applyExperience` calcula XP/niveles/puntos → snapshot deriva
stats y habilidades → React renderiza; las mutaciones de atributos/habilidades siguen usando ledgers
idempotentes existentes.

Movimiento: input → Arcade con límites del mundo → sin cuerpos de obstáculos decorativos → posición
visible y knockback sólo sujeto a límites.

## Consideraciones multiplayer

La elección de clase, XP, nivel, stats y habilidades sigue siendo server-side. El cliente sólo envía
intenciones; el snapshot replica IDs, build y fingerprint. La clase común evita divergencia mientras
las siete variantes no tengan kits propios.

## Consideraciones de persistencia

Se agrega una migración enum aditiva; no se reescriben filas existentes. El formato de progreso y
ledgers no cambia. Revertir código mantiene `GUARDIAN` como fallback para clientes antiguos.

## Consideraciones de rendimiento

La selección es una lectura/escritura única de personaje. El movimiento elimina checks de obstáculos
por frame; el runtime conserva límites O(1). Las fórmulas de XP/stats son puras y no asignan estado en
el tick.

## Riesgos

- **Enum/código antiguo**: impacto medio; mitigación: default `GUARDIAN`, migración aditiva y tests de
  round trip.
- **Clases sólo cosméticas**: impacto bajo y explícito; mitigación: mostrar “perfil común provisional”
  y dejar expansión de kits como trabajo posterior.
- **Eliminar colisión útil**: impacto medio; mitigación: mantener bounds y test de posición, no quitar
  la restricción de knockback de dominio sin evidencia.

## Decisiones

- 2026-08-05: guardar IDs de clase reales, pero resolver todas al perfil Guardián hasta que existan
  datos, arte y balance para kits distintos. Alternativa descartada: mostrar botones falsos sin guardar
  la elección.
- 2026-08-05: quitar sólo obstáculos decorativos del movimiento; los límites del mapa permanecen.

## Milestones

- [x] Inspeccionar contratos actuales y definir migración compatible.
- [x] Implementar IDs/opciones y creación persistente.
- [x] Quitar obstáculos de movimiento y añadir regresión.
- [x] Verificar UI de progreso, stats, habilidades y selección.
- [x] Ejecutar suite completa y actualizar GOAL.

## Pruebas

Unitarias para IDs/validación/progresión; integración HTTP/Prisma para crear una clase no-Guardian y
cargarla; UI para seleccionar clase y ver XP/puntos/habilidades; regresión runtime para movimiento
sin obstáculos; suite completa, typecheck, lint, build y `git diff --check`.

## Criterios de aceptación

- El personaje puede cruzar el área mostrada sin quedar atrapado por esas paredes.
- Crear personaje ofrece las siete clases solicitadas y persiste la elegida.
- Todas las opciones nuevas usan exactamente el perfil Guardian provisional.
- XP, nivel, stats derivados, puntos y habilidades siguen siendo autoritativos y visibles.
- Personajes existentes y clientes que omiten `class` continúan funcionando.

## Resultados

- Se agregaron siete IDs seleccionables con migración Prisma aditiva y default `GUARDIAN`; la
  integración HTTP/Prisma crea y devuelve una `BARBARIAN` persistida.
- Se quitaron los cuerpos de obstáculos decorativos del runtime y se conserva únicamente el límite
  del mundo para movimiento y knockback.
- Personaje, Habilidades y HUD muestran la clase del snapshot server-side y la barra de XP/nivel;
  atributos, puntos, desbloqueos y respec siguen en `ProgressionService`. Cada `REWARD_GRANTED`
  solicita un snapshot nuevo para que la barra refleje el nivelado sin recargar la partida.
- Verificación completada: `pnpm test` (70 archivos, 318 tests), `pnpm test:integration` (7 archivos,
  30 tests), `pnpm typecheck`, `pnpm lint`, `pnpm build` y `git diff --check`.

## Trabajo pendiente

Kits, árboles, recursos, arte y balance diferenciados por clase quedan para una expansión posterior
con su propio plan y migraciones si cambia el progreso persistente.
