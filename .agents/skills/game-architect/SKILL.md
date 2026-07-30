---
name: game-architect
description: Diseña, revisa o modifica la arquitectura general de un juego 2D. Usar para sistemas grandes, nuevos módulos, separación cliente-servidor, organización de escenas, comunicación por eventos y decisiones estructurales. No usar para cambios visuales pequeños o correcciones aisladas.
---

# Purpose

Diseñar cambios estructurales incrementales, comprobables y compatibles con el stack y las funcionalidades existentes.

# Trigger conditions

Usar ante nuevos módulos, cambios entre varios sistemas, límites cliente-servidor, escenas o estados, eventos compartidos, refactors estructurales y deuda técnica. Combinar con la skill de cada dominio afectado y con `automated-playtesting`.

# Do not use when

No usar para ajustes visuales, contenido aislado ni bugs locales sin impacto arquitectónico. No elegir motor, framework, protocolo o almacenamiento sin evidencia y sin registrar la decisión.

# Required context

1. Inspeccionar `AGENTS.md`, `PLANS.md`, `GAME_DESIGN.md`, manifiestos, configuración, scripts, pruebas y `docs/game/architecture.md`.
2. Localizar puntos de entrada, escenas, módulos de dominio, UI, red, persistencia y configuración.
3. Leer [principios de arquitectura](references/architecture-principles.md).
4. Identificar stack, restricciones, funcionalidades existentes y cambios sin confirmar.
5. Crear o actualizar un ExecPlan cuando el cambio sea grande o cruce sistemas.

# Workflow

1. Describir estado actual, problema, alcance, invariantes y dependencias.
2. Presentar análisis de impacto antes de modificar varios módulos: datos, APIs, eventos, red, guardado, pruebas, rendimiento y migración.
3. Definir límites, interfaces, propietarios de datos y dirección de dependencias.
4. Elegir la mínima migración incremental que preserve compatibilidad.
5. Implementar en pasos pequeños; mantener el proyecto ejecutable entre hitos.
6. Actualizar el ExecPlan durante el trabajo y registrar decisiones y deuda.
7. Validar cada límite con pruebas y evidencia observable.

# Architecture rules

- Separar dominio, aplicación, infraestructura y presentación cuando el stack lo permita; conservar una separación equivalente si el motor impone otra organización.
- Mantener lógica de negocio fuera de UI, escenas, animaciones y transporte.
- Separar cliente y servidor; tratar al servidor como autoridad del estado compartido.
- Diseñar módulos independientes para combate, inventario, loot, progresión, red y persistencia.
- Dirigir dependencias hacia contratos estables; evitar ciclos, estado global y singletons mutables.
- Usar eventos de dominio con contratos explícitos cuando desacoplen productores y consumidores; evitar buses de eventos opacos.
- Modelar escenas y estados del juego con transiciones explícitas.
- Favorecer configuración basada en datos, identificadores estables e interfaces pequeñas.
- Dividir archivos gigantes por responsabilidad, no por tamaño arbitrario.
- Diseñar lógica determinista e inyectable para pruebas.

# Implementation rules

- Preservar APIs y datos existentes o documentar una ruta de migración.
- No inventar APIs del stack; verificar documentación o código instalado.
- No agregar dependencias sin justificar necesidad, costo y alternativa.
- Encapsular infraestructura detrás de puertos o adaptadores cuando aporte aislamiento real.
- Registrar decisiones en `docs/game/architecture.md` o en el ExecPlan.
- Marcar deuda técnica con impacto, causa y siguiente acción concreta.
- Si el sistema no existe, documentar primero el contrato mínimo y crear sólo el esqueleto requerido por la tarea.
- Delegar reglas de combate, clases, loot, idle, red, guardado, contenido, balance, pruebas, rendimiento o arte a sus skills específicas.

# Validation

- Ejecutar compilación o arranque, pruebas unitarias y de integración disponibles, lint y formatter configurados.
- Comprobar dependencias circulares, importaciones prohibidas y límites cliente-servidor.
- Añadir pruebas de contrato o arquitectura cuando el stack las soporte.
- Mostrar comandos, resultados, módulos afectados, compatibilidad preservada y riesgos pendientes.

# Required output

Entregar el análisis de impacto, decisiones con alternativas descartadas, diagrama o flujo sólo si aclara varios límites, archivos modificados, pruebas ejecutadas, evidencia y plan incremental.

# Definition of done

Completar cuando los límites sean explícitos, no haya ciclos nuevos, la lógica de dominio sea comprobable, la compatibilidad esté preservada o migrada, la documentación esté actualizada y las validaciones relevantes pasen.

# Related documentation

- [Principios de arquitectura](references/architecture-principles.md)
- [Arquitectura del juego](../../../docs/game/architecture.md)
- [Planes de ejecución](../../../PLANS.md)

