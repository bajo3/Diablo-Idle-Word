# Arquitectura

## Alcance

Este documento fija los límites del MVP sin implementar sistemas de pasos posteriores. La
fuente de producto y planificación es [GOAL.md](../GOAL.md).

## Estructura

```text
apps/web       UI, input, render y futura integración Phaser
apps/server    API, autoridad, futura simulación y coordinación
packages/config configuración técnica compartida
packages/shared contratos puros, schemas Zod y tipos derivados (Paso 2)
packages/game-data catálogo, balance y validación de referencias (Paso 2)
prisma         esquema y migraciones (Paso 3, todavía inexistente)
```

Sólo `prisma` permanece ausente deliberadamente hasta el Paso 3; `shared` y `game-data` ya
son workspaces consumidos por cliente y servidor.

## Dirección de dependencias

```text
web presentation ──┐
                   ├──> shared contracts ──> domain rules
server adapters ───┘              ^
                                  │
                         game-data/config

server persistence adapter ──> PostgreSQL
```

- El cliente no importa infraestructura del servidor.
- El servidor no importa React, Phaser ni assets.
- Los tipos compartidos no dependen de UI, motor, transporte ni ORM.
- La lógica de dominio no lee variables de entorno ni accede directamente a PostgreSQL.
- Prisma implementará contratos de persistencia, no definirá el dominio.

## Cliente

React contiene navegación, HUD y pantallas. Phaser será un adaptador de render e input dentro
del cliente a partir del Paso 6. React y Phaser intercambiarán snapshots y comandos mediante
un límite explícito; ninguna escena decidirá daño, loot o persistencia.

## Servidor

Fastify aloja API y health checks. El transporte multiplayer se incorporará tras el prototipo
del Paso 13. El servidor será dueño de:

- Identidad y estado de personajes.
- Validación de movimiento y combate.
- Reloj, calibraciones y sesiones ausentes.
- Inventario, economía, loot y recompensas.
- Objetivos, resultados e idempotencia.

## Persistencia

PostgreSQL será el almacenamiento durable. No se escribirá cada tick. Las partidas activas
mantendrán simulación en memoria y persistirán resultados/eventos relevantes. El Paso 3
definirá Prisma, migraciones, repositorios y transacciones.

## Modo ausente

El modo ausente no ejecuta una partida cuando el usuario cierra el navegador. El servidor
guarda calibración y snapshot, luego calcula el resultado por tiempo transcurrido al regreso.
Consultar [away-mode.md](away-mode.md).

## Configuración y datos

- `packages/config` contiene sólo configuración de herramientas.
- `packages/shared` contiene contratos versionados y validables sin infraestructura.
- `packages/game-data` contiene balance y definiciones versionadas, con referencias validadas.
- `.env` contiene configuración de entorno, nunca reglas de balance ni secretos versionados.

## Impacto de cambios futuros

Todo cambio multisistema debe declarar contratos, autoridad, persistencia, red, rendimiento y
pruebas en un ExecPlan. Evitar ciclos, buses globales opacos y DTO de base de datos usados
directamente en UI.

## Paquetes compartidos (Paso 2)

`@brecha/shared` valida IDs, snapshots, estados, mensajes y contratos visuales sin depender de UI, motor, transporte ni ORM. `@brecha/game-data` depende sólo de `shared`, contiene definiciones inmutables y valida duplicados, referencias y rangos de frames. Ambos son consumidos por web y servidor.

## Decisiones pendientes

- Colyseus o Socket.IO.
- Phaser Arcade Physics o sistema acotado propio.
- Proveedor de autenticación.
- Hosting y topología de producción.
