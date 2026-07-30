# Auditoría inicial del repositorio

Fecha: 2026-07-29.

## Estado encontrado

El repositorio Git no tenía commits ni código ejecutable. Contenía:

- `AGENTS.md`, `PLANS.md` y `GAME_DESIGN.md`.
- Doce skills locales en `.agents/skills/`.
- Documentación conceptual en `docs/game/`.
- Un validador de skills en `scripts/validate-skills.ps1`.

No existían `GOAL.md`, `README.md`, manifiestos, lockfile, código fuente, base de datos,
variables de entorno, pruebas, lint, formatter ni scripts de desarrollo. Todos los archivos
existentes aparecían como no rastreados en Git; no había lógica funcional para preservar.

## Herramientas detectadas

| Herramienta    | Versión auditada |
| -------------- | ---------------- |
| Node.js        | 24.15.0          |
| npm            | 11.12.1          |
| pnpm           | 11.9.0           |
| Corepack       | 0.34.6           |
| Docker         | 29.5.2           |
| Docker Compose | 5.1.4            |
| Git            | 2.54.0           |

## Conflictos detectados

1. `GOAL.md` faltaba. El documento proporcionado por el usuario declara que debe ser el único
   objetivo canónico; se incorporó en la raíz.
2. `AGENTS.md`, `GAME_DESIGN.md` y varios documentos indicaban que el stack estaba `TBD`. El
   repositorio vacío activa el stack aprobado por GOAL: pnpm, TypeScript, React, Vite y Node.
3. La documentación anterior usaba “idle” de forma genérica. GOAL define un modo ausente
   específico: calibración autoritativa de 300 segundos y cálculo agregado al regreso.
4. No existía separación física cliente/servidor. Se creó un monorepo mínimo sin introducir
   los sistemas de dominio previstos para el Paso 2.
5. No existía presupuesto de descarga inicial. Se definió uno provisional en
   `docs/performance-budget.md`.

## Decisiones del Paso 1

- Usar pnpm workspaces sin Turborepo: los scripts recursivos de pnpm cubren la escala actual.
- Usar React + Vite para el cliente y Fastify para el servidor HTTP.
- No instalar Phaser, Colyseus, Prisma ni Zod antes de sus pasos correspondientes.
- Fijar TypeScript 6.0.3 porque la versión 7 actual no cumple el peer range de
  `typescript-eslint` 8.65.0.
- Usar PostgreSQL 17 Alpine en desarrollo y conservar datos en un volumen nombrado.
- Exponer sólo un endpoint `/health` en el servidor del Paso 1.

## Riesgos abiertos

- El protocolo multiplayer (Colyseus o Socket.IO) se decide mediante prototipo posterior.
- Prisma y el modelo persistente corresponden al Paso 3.
- No hay baseline de rendimiento jugable hasta que exista la escena Phaser del Paso 6.
- PostgreSQL local usa credenciales de desarrollo; cada entorno real deberá usar secretos.

## Evidencia

Los comandos y resultados finales del Paso 1 se registran en
[docs/testing.md](testing.md) y en el Registro de progreso de `GOAL.md`.
