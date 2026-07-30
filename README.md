# La Brecha Oscura

Base técnica del ARPG web cooperativo definido en [GOAL.md](GOAL.md). El repositorio se
cuenta con la base de los Pasos 1 a 3: cliente/servidor mínimos, contratos compartidos, datos
iniciales y PostgreSQL autoritativo con Prisma. Phaser, autenticación y sistemas de juego
pertenecen a pasos posteriores.

## Requisitos

- Node.js 24 o superior.
- pnpm 11.
- Docker Desktop con Docker Compose, para PostgreSQL local.

Las versiones de dependencias quedan fijadas en `pnpm-lock.yaml`. No usar claves reales en
archivos versionados.

## Instalación limpia

```powershell
corepack enable
pnpm install --frozen-lockfile
Copy-Item .env.example .env
pnpm db:up
pnpm db:migrate:deploy
pnpm db:generate
pnpm db:seed
pnpm dev
```

En macOS o Linux, reemplazar `Copy-Item` por `cp`.

Servicios de desarrollo:

- Cliente: <http://localhost:5173>
- Servidor: <http://localhost:3001/health>
- PostgreSQL: `localhost:5432`

El servidor del Paso 1 no consume todavía PostgreSQL. La base queda disponible para Prisma y
las migraciones del Paso 3.

El servidor usa PostgreSQL para identidad y Guardianes. `SERVER_STATUS=maintenance` conserva
`/health` y `/api/status`, pero rechaza las mutaciones protegidas hasta volver a `available`.

## Comandos

| Comando                  | Función                                               |
| ------------------------ | ----------------------------------------------------- |
| `pnpm dev`               | Inicia cliente y servidor en paralelo                 |
| `pnpm build`             | Compila los workspaces                                |
| `pnpm lint`              | Ejecuta ESLint                                        |
| `pnpm typecheck`         | Verifica TypeScript estricto                          |
| `pnpm test`              | Ejecuta Vitest                                        |
| `pnpm format`            | Aplica Prettier                                       |
| `pnpm format:check`      | Comprueba formato                                     |
| `pnpm db:up`             | Inicia PostgreSQL                                     |
| `pnpm db:status`         | Muestra el estado de PostgreSQL                       |
| `pnpm db:stop`           | Detiene PostgreSQL sin eliminar sus datos             |
| `pnpm db:generate`       | Genera el cliente Prisma ESM ignorado por Git         |
| `pnpm db:migrate:deploy` | Aplica migraciones SQL versionadas                    |
| `pnpm db:seed`           | Crea el agregado local de prueba de forma idempotente |
| `pnpm test:integration`  | Ejecuta persistencia contra PostgreSQL real efímero   |
| `pnpm db:backup`         | Crea dump con SHA-256 de la DB local de desarrollo    |
| `pnpm db:restore:smoke`  | Restaura un backup en DB efímera y verifica Prisma    |

## Estructura

```text
apps/
├─ web/       Cliente React + Vite
└─ server/    Servidor HTTP Fastify
packages/
└─ config/    Configuración TypeScript compartida
docs/         Auditoría y contratos de arquitectura
```

La separación completa y sus reglas están en [docs/architecture.md](docs/architecture.md). El
modelo de datos, las restricciones y la idempotencia están en [docs/data-model.md](docs/data-model.md).

## Variables de entorno

Copiar `.env.example` a `.env` y cambiar valores sólo en el archivo local. `.env` está
ignorado por Git. Los defaults de Docker Compose son exclusivamente para desarrollo.

La interfaz restaura una sesión mediante la cookie al recargar. Cerrar el navegador no envía
logout: la sesión queda sujeta a su vencimiento o revocación explícita y el personaje no se altera.

## Estado

Consultar el checklist y el registro de progreso en [GOAL.md](GOAL.md). No avanzar a un paso
posterior sin completar y verificar el actual.
