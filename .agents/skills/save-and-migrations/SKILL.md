---
name: save-and-migrations
description: Implementa guardado, carga, versionado, validación, recuperación y migraciones de partidas. Usar cuando cambie información persistente del jugador o del mundo. No usar para estado temporal de una escena.
---

# Purpose

Evolucionar datos persistentes sin pérdida, corrupción, sobrescritura silenciosa ni incompatibilidad inesperada.

# Trigger conditions

Usar cuando cambie cualquier dato persistente: jugador, personaje, estadísticas, inventario, equipo, habilidades, progreso, misiones, monedas, recompensas, idle o configuración.

# Do not use when

No usar para estado temporal de escena. No modificar esquema sin incrementar versión, crear migración, agregar pruebas y documentar.

# Required context

1. Inspeccionar `AGENTS.md`, `docs/game/saves.md`, modelos persistentes, serializadores, almacenamiento, backups, red y pruebas.
2. Localizar Save, Player, Character, Inventory, Equipment, Progress, Rewards, Idle y migraciones.
3. Leer [versionado de guardado](references/save-versioning.md).
4. Confirmar formato, versión actual, identidad, atomicidad, concurrencia y política de recuperación.

# Workflow

1. Inventariar campos, invariantes, datos sensibles y consumidores.
2. Definir versión origen/destino, defaults y compatibilidad hacia atrás.
3. Implementar migraciones secuenciales, pequeñas y deterministas.
4. Validar antes y después; conservar backup recuperable.
5. Escribir de forma atómica y proteger contra versiones/concurrencia.
6. Probar round trip, cada migración, cadenas completas, corrupción y recuperación.
7. Actualizar `docs/game/saves.md`, fixtures y registro de cambio.

# Architecture rules

- Separar modelo de dominio, DTO persistente, serializer, repositorio y migrador.
- Incluir versión de formato e identificadores estables de jugador y personaje.
- Persistir sólo estado durable; reconstruir caches y estado derivado.
- Usar guardado local sólo para desarrollo o modo acordado; usar autoridad server-side en multiplayer.
- Mantener migraciones secuenciales y conservar compatibilidad definida.

# Implementation rules

- Validar tipos, rangos, referencias, duplicados y valores por defecto.
- Usar escrituras atómicas: temporal + sync + reemplazo, transacción o equivalente del stack.
- Prevenir sobrescritura con versión, etag, bloqueo o control optimista.
- Auditar monedas, inventario, comercio y recompensas sensibles.
- Tratar conflictos y concurrencia explícitamente; no usar “última escritura gana” sin decisión.
- Crear backups y ruta de recuperación antes de migraciones irreversibles.
- Si no existe persistencia, definir primero esquema versionado y repositorio abstracto; no elegir backend definitivo.
- Delegar seguridad online a `multiplayer-authority`.

# Validation

- Probar round trip de cada agregado persistente.
- Probar migración N→N+1, cadena desde la versión mínima, defaults y referencias faltantes.
- Probar archivo truncado/corrupto, fallo de escritura, conflicto y restauración de backup.
- Mostrar fixtures, hashes o comparaciones, comandos, resultados y datos no recuperables si existieran.

# Required output

Entregar cambio de esquema, versión, migraciones, compatibilidad, estrategia de backup/atomicidad, pruebas y riesgos de rollback.

# Definition of done

Completar cuando versión y migración existan, round trip y cadenas pasen, fallos no corrompan el último estado válido, conflictos estén resueltos y la documentación esté actualizada.

# Related documentation

- [Versionado de guardado](references/save-versioning.md)
- [Guardado y migraciones](../../../docs/game/saves.md)
- [Multiplayer](../../../docs/game/multiplayer.md)
