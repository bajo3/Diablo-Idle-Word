# Modo ausente (implementado en Paso 16)

## Definición

“Modo offline” es el nombre visible de un cálculo autoritativo durante la ausencia. No existe
un juego local sin conexión y no queda una simulación ejecutándose en la PC o el servidor.

## Contrato vigente

`@brecha/shared` define `CalibrationSnapshot`, `AwayMetrics` y `AwayResult` mediante schemas estrictos.
`away-calculation.ts` agrega el cálculo puro, cap, eficiencia, penalización de supervivencia y loot
determinista. `AwayService` implementa persistencia, rutas y reclamo; el cliente sólo expresa intención.

## Flujo

```text
AVAILABLE
  -> AWAY_CALIBRATING (300 segundos válidos)
  -> estimación y confirmación
  -> AWAY_FARMING (snapshot inmutable + reloj servidor)
  -> AWAY_REWARD_PENDING (resultado persistido)
  -> claim transaccional
  -> AVAILABLE
```

## Calibración

El servidor registra durante exactamente 300 segundos válidos:

- Zona, dificultad, build fingerprint y versiones.
- Atributos, equipo y habilidades.
- Muertes, daño, tiempo activo y enemigos por categoría.
- Experiencia, oro, materiales y oportunidades de loot válidas.
- Semilla y versión de fórmulas.

Cambiar build, zona o dificultad cancela la muestra. Una desconexión excesiva, actividad cero
o tasas imposibles la invalida con un motivo observable.

## Activación

Después de mostrar la estimación, una confirmación crea una única sesión:

- Hora de inicio del reloj del servidor.
- Snapshot inmutable de la build.
- Métricas normalizadas.
- Zona, dificultad, tabla de loot y semilla.
- Límite inicial configurable de 8 horas.
- Eficiencia inicial configurable de 80 %.

El personaje queda en `AWAY_FARMING` y no puede entrar a una partida activa.

## Cálculo al regreso

```text
elapsed = max(0, serverNow - startedAt)
computable = min(elapsed, configuredCap)
reward = normalizedRate * computable * awayEfficiency * survivalFactor
```

El cálculo:

- Usa enteros/unidades y redondeo documentados.
- Se ejecuta al regreso, no una vez por segundo.
- Aplica caps por zona y rareza.
- Genera oportunidades de loot nuevas con seed de servidor.
- Excluye recompensas únicas, misión principal y legendarios exclusivos de jefe.
- Persiste el resultado antes de mostrarlo.

## Reclamación

La reclamación usa una clave idempotente y una transacción. El resultado pasa de `pending` a
`claimed` junto con la entrega de XP, moneda, materiales e ítems. Dos pestañas reciben el
mismo resultado lógico; nunca dos entregas.

## Autoridad

El cliente puede pedir iniciar, cancelar, confirmar o reclamar. No aporta tiempo, duración,
métricas finales, recompensa ni IDs confiables. El servidor valida todo contra estado durable
y reloj propio.

## Persistencia y recuperación

Calibración, sesión y resultado tendrán versión de esquema y fórmula. Un reinicio del servidor
reconstruye el estado desde PostgreSQL. El detalle de tablas y transacciones se implementará
en el Paso 3 y el flujo completo en el Paso 16.

## Pruebas futuras obligatorias

- 300 segundos válidos con reloj simulado.
- Cambio de build, desconexión y cero actividad.
- Reloj cliente manipulado.
- Cap de 8 horas y penalización por muerte.
- Loot nuevo sin copiar el legendario de la muestra.
- IDs únicos y claim concurrente.

## Implementación vigente (Paso 16)

Las rutas son `GET /api/characters/:id/away`, `POST .../away/calibration`, `POST .../complete`,
`POST .../away/activate`, `POST .../away/return` y `POST .../away/claim`. `AwayService` deriva las
métricas de `RewardLog` dentro de la ventana server-side, compara el fingerprint al completar y
usa `RewardLog(operationId = away-claim:<resultId>)` para hacer el claim idempotente. La UI vive en
`/ausente`; el WebSocket y las mutaciones de inventario/progresión rechazan personajes no
`AVAILABLE`. Las tablas V1 ya existentes contienen todos los campos necesarios, por lo que no se
agregó una migración nueva.
