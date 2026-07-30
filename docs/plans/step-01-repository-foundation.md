# Paso 1 — Auditoría y base del repositorio

## Objetivo del usuario

Dejar un monorepo instalable y ejecutable con cliente, servidor, PostgreSQL local, toolchain
estricta y documentación de los límites centrales, sin avanzar a sistemas del Paso 2.

## Estado actual

El repositorio sólo contenía skills y documentación conceptual. No existía código ni
toolchain. La auditoría completa está en `docs/repository-audit.md`.

## Alcance

- pnpm workspace.
- Cliente React/Vite mínimo.
- Servidor Fastify mínimo con health check.
- TypeScript estricto, ESLint, Prettier y Vitest.
- `.env.example`, `.gitignore` y Docker Compose PostgreSQL.
- README y documentación de arquitectura, autoridad y modo ausente.
- Instalación, build, smoke y validaciones del Paso 1.

## Fuera de alcance

Phaser, tipos de dominio, game-data, Prisma, autenticación, multiplayer, gameplay y
persistencia real.

## Arquitectura afectada

Se crean los límites físicos `apps/web`, `apps/server` y `packages/config`. No existen
contratos de dominio todavía.

## Skills requeridas

`game-architect`, `idle-progression`, `multiplayer-authority`, `performance-2d` y
`automated-playtesting`.

## Archivos relevantes

- `package.json`, `pnpm-workspace.yaml`: orquestación.
- `apps/web`: cliente mínimo.
- `apps/server`: servidor y health check.
- `packages/config`: TypeScript compartido.
- `docker-compose.yml`: PostgreSQL local.
- `docs/*.md`: decisiones y evidencia.

## Modelo de datos

No aplica en este paso. El Paso 3 creará esquema y migraciones.

## Flujo de ejecución

`pnpm dev` inicia Vite y Fastify. Docker Compose inicia PostgreSQL de forma independiente.

## Consideraciones multiplayer

Sólo se documenta autoridad. No se selecciona ni implementa protocolo.

## Consideraciones de persistencia

Sólo se prepara PostgreSQL. No existe repositorio de dominio ni migración.

## Consideraciones de rendimiento

Se fija un presupuesto provisional, sin afirmar benchmarks inexistentes.

## Riesgos

- Compatibilidad entre versiones nuevas de TypeScript y ESLint.
- Puertos locales ocupados.
- Docker Desktop detenido.
- Documentación previa contradictoria con GOAL.

## Decisiones

- 2026-07-29: usar pnpm sin orquestador adicional.
- 2026-07-29: fijar TypeScript 6.0.3 por compatibilidad de peer dependencies.
- 2026-07-29: no instalar dependencias de pasos posteriores.

## Milestones

1. Auditar e integrar GOAL.
2. Crear toolchain y workspaces.
3. Documentar límites.
4. Instalar, ejecutar y verificar.
5. Actualizar GOAL.

## Progreso

- [x] Auditoría e integración de GOAL.
- [x] Toolchain y workspaces creados.
- [x] Límites documentados.
- [x] Instalación y validaciones finales.
- [x] GOAL actualizado con evidencia.

## Pruebas

Ejecutar instalación congelada, formatter, lint, typecheck, tests, build, smoke web/API y
validación de Docker Compose.

## Criterios de aceptación

Coinciden con el Paso 1 de `GOAL.md`.

## Resultados

Paso 1 completado el 2026-07-29. La instalación congelada, formatter, lint, typecheck,
test y build finalizaron con exit code 0. `pnpm dev` expuso el cliente y el servidor,
la revisión visual no detectó errores de consola ni desbordamiento horizontal y
PostgreSQL alcanzó estado `healthy` mediante Docker Compose.

## Trabajo pendiente

Ninguno dentro del Paso 1. El siguiente trabajo permitido es el primer ítem del Paso 2:
crear el paquete `shared`.
