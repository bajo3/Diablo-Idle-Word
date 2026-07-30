# Presupuesto inicial de rendimiento

Estos valores son objetivos provisionales, no verdades universales. Sustituirlos por presupuestos basados en plataforma, resolución, motor y perfil real.

## Objetivos sugeridos

| Métrica | Objetivo inicial | Observación |
| --- | --- | --- |
| FPS | 60 estable; 30 como perfil bajo acordado | priorizar frame time |
| Frame time a 60 FPS | p95 ≤ 16,7 ms | registrar p99 y spikes |
| Frame time a 30 FPS | p95 ≤ 33,3 ms | no mezclar perfiles |
| Pausa GC | sin picos perceptibles | medir duración y frecuencia |
| Memoria | estable en sesión prolongada | fijar cap por dispositivo |
| Entidades activas | según perfil y costo | medir por arquetipo |
| Red | presupuesto por cliente y segundo | medir picos y percentiles |

## Reparto conceptual a 60 FPS

```text
render:       6 ms
gameplay/AI:  4 ms
física:       3 ms
red/otros:    2 ms
margen:       1,7 ms
```

No usar el reparto como garantía; medir solapamiento, multithreading y herramientas del motor.

## Escenarios de perfil

- Escena vacía y arranque.
- Combate normal.
- Dungeon densa con enemigos melee/ranged/summoner.
- Jefe con partículas y proyectiles.
- Dos o más clientes con latencia simulada.
- Sesión prolongada con carga/descarga repetida.
- Dispositivo de menor rendimiento acordado.

## Métricas por sistema

- Render: draw calls, sprites visibles, overdraw, atlas y upload.
- Física: cuerpos, pares, queries y contactos.
- IA: agentes activos, path requests y tiempo por tick.
- Gameplay: entidades, proyectiles, efectos y eventos.
- Memoria: heap, texturas, pools y recursos liberados.
- Red: mensajes/s, bytes/s, tamaño p95, snapshots descartados.

## Reglas

Comparar la misma build, escena, seed, duración y hardware. Calentar caches, repetir capturas y reportar variabilidad. Un pool debe mostrar reducción medida y tener reset completo; un culling no debe alterar simulación autoritativa.

