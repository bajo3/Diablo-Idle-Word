# Paso 4 — Identidad, perfil y personajes protegidos

## Objetivo del usuario

Permitir que una persona cree una cuenta, conserve una sesión segura, gestione su perfil y cree,
seleccione o elimine de forma segura un Guardián que sólo ella puede consultar.

## Estado actual

El Paso 3 ya aporta PostgreSQL, Prisma y agregados de personaje. Aún no había credenciales,
sesiones, HTTP protegido ni transporte autenticado. Este plan no incorpora gameplay, recuperación
de red de cliente ni salas: pertenecen a los Pasos 5 y 13.

## Alcance

- Argon2id con parámetros explícitos y rehash al iniciar sesión.
- Sesión opaca aleatoria de 256 bits, persistida sólo como SHA-256, revocable y de vencimiento absoluto.
- Cookie `brecha_session`, API HTTP protegida y handshake WebSocket autenticado.
- Perfil, nombres normalizados, selección durable y borrado lógico del Guardián.
- Migración Prisma aditiva, pruebas unitarias, integración PostgreSQL/HTTP/WS y prueba UI mínima.

## Fuera de alcance

Recuperación de contraseña, OAuth, refresh tokens, gameplay, reconexión de partidas, salas,
rate limiting distribuido y navegación completa del Paso 5.

## Arquitectura afectada

`auth/` contiene reglas de identidad y sesiones; `characters/` los casos de uso de Guardianes;
`api/` traduce HTTP/WS a esos casos de uso. Ninguno expone Prisma al cliente. La UI consume DTOs
de API y no decide ownership. El servidor deriva `userId` de la sesión; nunca desde el cuerpo.

## Modelo de datos

- `User`: email normalizado único, display name y hash de contraseña opcional para preservar el seed no autenticable.
- `Session`: token hash único, expiración absoluta, revocación y último uso.
- `CharacterSelection`: una selección por usuario y FK compuesta a `(Character.id, Character.userId)`.
- `Character.deletedAt`: borrado lógico; el índice parcial SQL permite reutilizar un nombre eliminado.

## Flujo de ejecución

Registro/login → validar y normalizar → Argon2id → crear/rotar sesión opaca → cookie. Petición
protegida → cookie → hash → sesión activa → principal → servicio autorizado → transacción → DTO.
El WS pasa por el mismo origen y principal antes del upgrade; no acepta identidad enviada por cliente.

## Consideraciones multiplayer

El WS sólo prueba el perímetro de autenticación de esta fase. Cierra/rechaza origen o cookie/sesión
inválidos y expone una confirmación mínima con principal del servidor. No implementa gameplay ni
reconexión, que se incorporarán en el Paso 13.

## Persistencia y seguridad

La migración es aditiva y el hash de sesión evita persistir el bearer token. `expiresAt` nunca se
extiende durante una rotación. Logout revoca de forma idempotente. Mutaciones HTTP requieren JSON
y `Origin` permitido; CORS declara orígenes concretos y credenciales. El limitador local protege
registro/login por IP+email; se reemplazará por uno compartido al existir despliegue horizontal.

## Decisiones

- 2026-07-29: autenticación propia con Argon2id en vez de OAuth para cumplir el paso sin introducir
  proveedor externo; recuperación de contraseña queda explícitamente fuera de alcance.
- 2026-07-29: token de sesión de 256 bits + SHA-256 en DB, en vez de JWT, para permitir revocación
  inmediata y no colocar identidad durable en el navegador.
- 2026-07-29: selección en tabla propia con FK compuesta, en vez de un campo sin constraint en User,
  para mantener ownership durable a nivel de base.
- 2026-07-30: logins sin cuenta verifican un hash Argon2id dummy con la misma política antes de
  devolver el error genérico; reduce la señal temporal dominante sin prometer ocultar latencia de DB.
- 2026-07-30: nombres activos de Guardianes son únicos por `lower(name)` y usuario; el índice parcial
  conserva la reutilización luego de un soft-delete.

## Progreso

- [x] Inspección de contratos, persistencia, pruebas y límites existentes.
- [x] Migración, servicios y adaptadores HTTP/WS.
- [x] UI mínima, pruebas y documentación final.

## Pruebas

- Unidad: normalización/validación de email y nombres; limitador local.
- Integración: migración vacía, registro/login no enumerable, cookie/sesión/revocación, ownership,
  selección/borrado y WebSocket válido/inválido sobre PostgreSQL real.
- UI: formulario de sesión, perfil y selector consumen respuestas simuladas verificables.

## Criterios de aceptación

Un usuario autenticado sólo observa sus Guardianes; la sesión persiste en cookie y puede revocarse;
un websocket sin sesión válida no entra; la UI permite crear, seleccionar y confirmar eliminación,
mostrando disponibilidad y selección autoritativas.

## Resultados

2026-07-30, exit code 0: `pnpm install --frozen-lockfile`, `pnpm db:generate`, `prisma format`,
`prisma validate`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (7 archivos,
19 pruebas), `pnpm test:integration` (2 archivos, 11 pruebas sobre PostgreSQL real), `pnpm build`,
`pnpm db:migrate:deploy` y `pnpm db:seed` dos veces. La integración aplica las cinco migraciones
desde DB vacía y limpia sus bases `brecha_test_*`.

El recorrido probado registra cuentas, verifica que login inexistente y contraseña incorrecta pasan
por Argon2id y devuelven el mismo error, inspecciona que la DB sólo contiene el SHA-256 de la sesión,
rota sin extender vencimiento absoluto, revoca la cookie anterior tras login y hace logout repetido
con 204. También rechaza mutaciones sin Origin/JSON, ownership cruzado, nombres inválidos o iguales
sin distinción de mayúsculas, preserva selección y soft-delete, y acepta/rechaza WS por origen,
cookie manipulada, expiración y revocación. Prisma se desconecta sólo durante `onClose`.

## Trabajo pendiente

Paso 5 agregará recuperación de sesión y estados de red de aplicación; no se adelanta aquí.
