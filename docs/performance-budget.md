# Presupuesto inicial de rendimiento

Estos valores son objetivos provisionales del MVP. Se revisarán con mediciones de una build
jugable en el Paso 6 y no justifican optimizaciones prematuras.

## Cliente

- Objetivo: 60 FPS; mínimo aceptable acordado: 30 FPS.
- Frame time objetivo a 60 FPS: p95 menor o igual a 16,7 ms.
- Hasta 60 enemigos, 120 proyectiles y 250 efectos visibles por instancia.
- Hasta 80 objetos en suelo por jugador antes de compactar o limpiar.
- Hasta 24 sonidos simultáneos relevantes.

## Descarga inicial

- Objetivo comprimido para shell, UI y assets esenciales iniciales: 15 MiB.
- Límite provisional duro: 25 MiB.
- Cargar por escena todo asset no requerido para inicio/pueblo.
- Registrar tamaño transferido y descomprimido en cada revisión del pipeline.

El límite no incluye contenido opcional descargado bajo demanda. Un cambio del límite requiere
medición, motivo y actualización de GOAL/documentación.

## Servidor y red

- Hasta cuatro jugadores por instancia.
- Tick y frecuencia de snapshots: `TBD` tras prototipo.
- Medir mensajes/s, bytes/s, tamaño p95 y snapshots descartados.
- No persistir cada tick.

## Escenarios futuros

- Escena vacía y arranque.
- Combate normal y dungeon densa.
- Jefe con 20 invocaciones.
- Dos a cuatro clientes con latencia.
- Repetición de expediciones y sesión prolongada.

No existe todavía una escena jugable; por eso no se declaran mediciones de FPS como realizadas.
