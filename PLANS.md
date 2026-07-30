# ExecPlans

Un ExecPlan es un documento vivo y autocontenido para implementar trabajo grande. Debe permitir que otra persona continúe sólo con el repositorio y el plan. Crear uno para funcionalidades grandes, refactors significativos o cambios multisistema. Guardarlo en la ubicación de planes que adopte el proyecto; hasta definirla, usar `docs/plans/<nombre>.md`.

Actualizar `Progreso`, decisiones y resultados durante la implementación. Registrar timestamps cuando ayuden a reconstruir el trabajo. No describir tareas vagas: nombrar archivos, comandos, invariantes y evidencia.

## Plantilla obligatoria

### Título

Usar un título orientado al resultado.

### Objetivo del usuario

Explicar el resultado observable y por qué importa.

### Estado actual

Describir comportamiento, arquitectura, stack, evidencia y restricciones existentes.

### Alcance

Enumerar entregables incluidos.

### Fuera de alcance

Enumerar exclusiones explícitas.

### Arquitectura afectada

Indicar módulos, límites, contratos, dependencias y decisiones estructurales.

### Skills requeridas

Listar skills locales y explicar por qué se combinan.

### Archivos relevantes

Usar rutas relativas y describir la responsabilidad de cada archivo.

### Modelo de datos

Definir entidades, IDs, invariantes, versiones y cambios de esquema.

### Flujo de ejecución

Describir entrada → validación → reglas → persistencia/eventos → salida.

### Consideraciones multiplayer

Definir autoridad, mensajes, idempotencia, latencia, reconexión y compatibilidad. Escribir `No aplica` con razón si corresponde.

### Consideraciones de persistencia

Definir versión, migración, atomicidad, backup y recuperación. Escribir `No aplica` con razón si corresponde.

### Consideraciones de rendimiento

Definir presupuestos, escenarios y mediciones antes/después.

### Riesgos

Mantener una lista con impacto, probabilidad, mitigación y señal de detección.

### Decisiones

Registrar fecha, contexto, decisión, alternativas y consecuencias. No borrar decisiones superadas; marcarlas como reemplazadas.

### Milestones

Definir hitos verificables que dejen el proyecto en estado coherente.

### Progreso

- [ ] Pendiente: describir siguiente acción concreta.
- [x] Completado: describir resultado y evidencia.

Actualizar esta sección al completar cada paso, no sólo al final.

### Pruebas

Indicar comandos, fixtures, seeds, escenarios y resultados esperados.

### Criterios de aceptación

Definir resultados observables que un revisor pueda comprobar.

### Resultados

Completar durante y al final con comandos, métricas, diferencias frente al plan y evidencia.

### Trabajo pendiente

Listar deuda o extensiones no requeridas con siguiente acción; no ocultarlas dentro de “Resultados”.

## Reglas de ejecución

1. Inspeccionar antes de redactar.
2. Mantener una sola fuente de verdad para cada decisión.
3. Dividir trabajo en hitos seguros y reversibles.
4. Validar tras cada hito proporcionalmente al riesgo.
5. Actualizar el plan cuando la realidad contradiga una suposición.
6. Concluir con resultados reales, no con la intención inicial.

