# Principios de arquitectura

## Propósito

Usar estos criterios para evaluar límites y migraciones sin imponer un motor o framework. Adaptar nombres y capas a las convenciones reales del repositorio.

## Dependencias

Dirigir dependencias desde presentación e infraestructura hacia contratos de aplicación y dominio. Evitar que reglas de combate, inventario o progresión importen escenas, widgets, sockets o almacenamiento.

```text
Presentación ─┐
              ├─> Aplicación ─> Dominio
Infraestructura ┘        ^          ^
                         └─ contratos┘
```

- Dominio: entidades, value objects, reglas, invariantes y eventos.
- Aplicación: casos de uso y coordinación de transacciones.
- Infraestructura: red, archivos, base de datos, motor y telemetría.
- Presentación: escenas, HUD, input, animación y audio.

Cuando el motor use componentes o nodos, conservar el mismo principio: los adaptadores traducen callbacks del motor a comandos de aplicación.

## Límites de módulos

| Módulo | Posee | Consume mediante |
| --- | --- | --- |
| Combat | resolución, salud temporal, efectos | stats y reloj por interfaz |
| Inventory | contenedores y propiedad | catálogo y transacciones |
| Loot | selección y generación | RNG y tablas versionadas |
| Progression | nivel, XP y desbloqueos | eventos de recompensa |
| Network | transporte y replicación | comandos/snapshots versionados |
| Save | DTO, migraciones y repositorios | snapshots durables |

No permitir que `Combat` escriba directamente el archivo de guardado ni que la UI modifique `Inventory`.

## Cuándo dividir un sistema

Dividir cuando se cumplan al menos dos criterios:

- Cambia por razones distintas o con frecuencias distintas.
- Requiere pruebas, autoridad o ciclo de vida propios.
- Tiene más de un consumidor estable.
- Oculta una dependencia de infraestructura.
- Mezcla comandos, datos, render y persistencia.
- Obliga a modificar archivos no relacionados para agregar una variante.

No dividir sólo por cantidad de líneas. Evitar interfaces de una única función sin aislamiento real.

## Eventos y estado

- Nombrar eventos en pasado: `DamageApplied`, `ItemGranted`.
- Incluir ID, versión, correlación y datos mínimos.
- Definir si el evento es durable, replicado o local.
- No usar eventos para evitar una llamada directa clara.
- Mantener estado global sólo para configuración inmutable o servicios de plataforma bien delimitados.

## Errores frecuentes

- God object de jugador con combate, red, UI y guardado.
- Bus global sin esquema ni ownership.
- Dependencias circulares resueltas con acceso global.
- Predicción del cliente reutilizada como resultado autoritativo.
- DTO persistente usado como entidad de dominio.
- Configuración duplicada en cliente y servidor sin versión.
- Refactor total sin compatibilidad ni hitos.

## Registro de decisiones

Registrar contexto, decisión, alternativas, consecuencias, migración y condición de revisión en el ExecPlan o en `docs/game/architecture.md`. Preferir compatibilidad temporal y adaptadores a reemplazos “big bang”.

