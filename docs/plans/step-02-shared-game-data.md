# Paso 2 — Contratos compartidos y datos iniciales validados

## Objetivo del usuario

Entregar contratos de dominio y un catálogo inicial único para que cliente y servidor compartan identificadores, validación y datos sin duplicar reglas ni adelantar gameplay, transporte o persistencia.

## Estado actual

El Paso 1 dejó `apps/web`, `apps/server` y configuración estricta. El Paso 2 incorpora `@brecha/shared` y `@brecha/game-data` con Zod 4.4.3.

## Alcance

- Schemas Zod estrictos, tipos derivados, IDs, estados, snapshots y eventos versionados.
- Datos para Guardián, atributos, habilidades, objetos, enemigos, Bosque Corrupto y misión.
- Contratos de spritesheet, animación, manifest, mapas, seeds y versiones.
- Validación de duplicados, referencias y frames, con pruebas positivas y negativas.

## Fuera de alcance

Handlers, Phaser, combate, IA, persistencia/Prisma, transporte multiplayer, archivos de assets, autenticación y cálculo/claim real del modo ausente.

## Arquitectura afectada

`apps/web` y `apps/server` consumen ambos paquetes. `shared` sólo conoce contratos; `game-data` depende de `shared` y contiene definiciones inmutables. Ningún paquete importa infraestructura.

## Skills requeridas

`game-architect`, `classes-and-skills`, `combat-system`, `loot-and-items`, `idle-progression`, `multiplayer-authority`, `enemy-and-dungeon-generator`, `game-balance`, `pixel-art-pipeline` y `automated-playtesting`.

## Archivos relevantes

- `packages/shared/src`: esquemas y tipos de dominio, modo ausente, red y visuales.
- `packages/game-data/src`: catálogo, schemas y validador de referencias.
- `apps/*`: importaciones consumidoras verificables.
- `vitest.config.ts`: descubre pruebas en paquetes.

## Modelo de datos

Los IDs son strings estables validados; los payloads llevan `protocolVersion: 1`; snapshots y resultados usan `schemaVersion: 1`. Semilla, versión de datos, versión de balance y fingerprint de build quedan disponibles para reproducibilidad. No se persiste aún.

## Flujo de ejecución

Entrada desconocida → schema Zod estricto → validación semántica de IDs/referencias/frames → tipo derivado seguro para consumidor. Los clientes futuros sólo expresarán `ClientEvent`; el servidor producirá `ServerEvent` autoritativo.

## Consideraciones multiplayer

Los mensajes están discriminados, versionados y con secuencia/request ID. Se definen intenciones, no resultados de combate ni recompensas de confianza. Transporte y autorización siguen pendientes.

## Consideraciones de persistencia

No aplica todavía: los schemas preparan versiones y snapshots para el Paso 3 sin importar Prisma.

## Consideraciones de rendimiento

La validación ocurre en límites de entrada/carga, no por frame. No se carga ni verifica un asset real hasta el pipeline del Paso 18.

## Riesgos

- Tuning de combate pendiente: se etiqueta `TBD` para evitar números inventados.
- La política exacta de samples/rareza queda pendiente: los schemas no la fijan como regla.
- Los placeholders del manifest no son assets entregados y no se validan en build aún.

## Decisiones

- 2026-07-29: Zod 4.4.3 como dependencia runtime; se descartan tipos TS sin validación.
- 2026-07-29: valores sólo establecidos por GOAL; el resto usa `TBD`, no balance implícito.
- 2026-07-29: el catálogo es inmutable y valida referencias antes de ser consumido.

## Milestones

1. [x] Crear workspaces y resolverlos desde web/servidor.
2. [x] Definir schemas estrictos y payloads discriminados.
3. [x] Modelar catálogo MVP y validación cruzada.
4. [x] Ejecutar pruebas, toolchain y documentación derivada.

## Progreso

- [x] `shared`: IDs, contratos, away-mode, red y arte.
- [x] `game-data`: contenido MVP, balance fijado y referencias.
- [x] Tests de aceptación/rechazo y consumidor servidor.
- [x] Documentación de límites actualizada.

## Pruebas

`pnpm install`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`. Las pruebas cubren payload extra, tipo de evento inválido, métricas inválidas, duplicados, referencias huérfanas, evento fuera del rango de frames y el health endpoint que importa ambos paquetes.

## Criterios de aceptación

Cliente y servidor resuelven los mismos símbolos; los paquetes son puros; schemas estrictos derivan los tipos públicos; cualquier payload de red puede validarse antes de usarlo.

## Resultados

Completado el 2026-07-29. La auditoría posterior corrigió estados de disponibilidad al vocabulario exacto de GOAL, invariantes temporales de modo ausente, materiales no equipables, atributos y mecánicas estructuradas, estados de IA y grafo asset/spritesheet/animación. `pnpm install --frozen-lockfile`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (3 archivos, 12 pruebas) y `pnpm build` finalizaron correctamente. El smoke de desarrollo confirmó web HTTP 200 y `/health` con protocolo 1 y datos `2026.07.29.1`.

## Trabajo pendiente

Implementar persistencia recién en el Paso 3. Las fórmulas, handlers y gameplay permanecen fuera del alcance del Paso 2.
