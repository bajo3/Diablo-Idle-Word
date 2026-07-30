# Arquitectura del juego

## Paso 6 — isla Phaser

React conserva sesión, rutas y API. `GameIsland` es el único puente hacia un runtime Phaser con
`pause`, `resume`, `destroy` y `setConnection`; las escenas consumen sólo manifiesto, input local y
callbacks de HUD. Phaser no importa React, HTTP ni Prisma. El checkpoint es una intención versionada
que se envía desde React; coordenadas y configuración proceden exclusivamente del servidor.

## Estado actual

Los Pasos 1 y 2 fijaron el monorepo pnpm, React/Vite, Node/Fastify, TypeScript estricto y los paquetes `@brecha/shared`/`@brecha/game-data`. La arquitectura vigente y sus decisiones se documentan en [../architecture.md](../architecture.md); `GOAL.md` sigue siendo la fuente principal.

## Contratos del Paso 2

`@brecha/shared` ofrece tipos derivados de Zod y `@brecha/game-data` el catálogo inmutable. Cliente y servidor consumen los mismos símbolos; ninguna capa visual o de infraestructura entra en esos paquetes.

## Responsabilidades

```text
Input/UI → Casos de uso → Dominio → Eventos/resultados
   ↑                         ↓
Render ← adaptadores      Repositorios/red
```

- Dominio: combate, stats, inventario, loot y progresión sin dependencias visuales.
- Aplicación: coordinar comandos, transacciones y eventos.
- Infraestructura: motor, transporte, reloj, RNG, almacenamiento y telemetría.
- Presentación: escenas, HUD, animación, audio e input.
- Servidor: verdad compartida, validación y persistencia.
- Cliente: intención, predicción reversible y presentación.

El Paso 3 agrega `apps/server/src/persistence`: contratos de aplicación, repositorios y servicios
dependen de un adaptador Prisma/PostgreSQL. `@brecha/shared` permanece sin Prisma; migraciones y
cliente generado son detalles de infraestructura del servidor.

El Paso 4 añade `auth/`, `characters/` y adaptadores HTTP/WS en `app.ts`. `auth/` entrega un
principal ya autenticado; los servicios de personajes reciben sólo ese `userId`, nunca uno enviado
por la UI. La selección durable usa el ownership de base y React consume DTOs HTTP, sin importar
Prisma ni contener reglas de autorización.

## Límites

Mantener módulos para combat, classes, inventory/items, loot, idle, PvE/dungeons, multiplayer y saves. Compartir IDs y contratos versionados, no referencias internas. El UI no muta entidades directamente; el guardado no serializa nodos/objetos del motor sin DTO.

## Flujo de datos

1. Un adaptador convierte input o mensaje en comando.
2. Aplicación autentica/autoriza y carga estado.
3. Dominio valida invariantes y produce resultado/eventos.
4. Repositorio confirma cambios atómicos.
5. Red replica snapshot/delta y presentación reacciona.

## Decisiones

- Stack y estructura física: pnpm monorepo con React/Vite, Node/Fastify, `@brecha/shared`, `@brecha/game-data` y configuración TypeScript estricta.
- Usar separación conceptual dominio/aplicación/infraestructura/presentación.
- Mantener servidor autoritativo para estado compartido.
- Exigir ExecPlan para cambios grandes.

## Riesgos

Elegir prematuramente un motor, compartir modelos persistentes con UI, crear un Player monolítico, depender de estado global o duplicar fórmulas entre cliente y servidor.

## Pruebas requeridas

Pruebas de funciones puras, contratos entre módulos, round trip de DTO, autoridad de comandos y smoke de arranque cuando exista runtime. Agregar detección de ciclos si el stack la soporta.

## Skills relacionadas

- [game-architect](../../.agents/skills/game-architect/SKILL.md)
- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)
