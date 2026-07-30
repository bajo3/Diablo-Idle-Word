# Autoridad y networking

## Principio

El cliente expresa intención; el servidor decide estado compartido. La interfaz puede predecir
feedback reversible, pero no persistir ni conceder resultados.

| Operación        | Cliente                      | Servidor                                |
| ---------------- | ---------------------------- | --------------------------------------- |
| Movimiento       | Input, dirección y secuencia | Posición, velocidad y colisión válidas  |
| Ataque/habilidad | Intención y objetivo         | Recurso, cooldown, hit, daño y estado   |
| Interacción      | ID y solicitud               | Distancia, estado, duración y resultado |
| Loot             | Solicitud de recoger         | Propiedad, instancia y entrega          |
| Inventario       | Comando e IDs                | Ownership, capacidad y mutación         |
| Modo ausente     | Iniciar/confirmar/reclamar   | Reloj, muestra, snapshot y recompensa   |
| UI               | Preferencias permitidas      | No aplica a estado sensible             |

## Capas

- HTTP: autenticación, personajes, configuración y operaciones durables.
- Transporte multiplayer: salas, inputs, snapshots y eventos de partida.
- Simulación: estado autoritativo independiente del transporte.
- Persistencia: resultados y eventos relevantes, nunca cada tick.

## Mensajes

Los contratos del Paso 2 incluirán versión, identidad, secuencia o `operationId` según el tipo.
Los comandos frecuentes usarán secuencias; las transacciones sensibles serán idempotentes.

## Latencia y reconexión

La predicción local se limita al movimiento reversible. El cliente interpola entidades
remotas y reconcilia contra snapshots. Tras reconectar obtiene estado autoritativo y cursor;
nunca sube un snapshot local como verdad.

## Sesión y disponibilidad web (Paso 5)

`GET /api/auth/session` es una introspección de la cookie actual: no rota, crea ni revoca una
sesión, por lo que solicitudes simultáneas siguen siendo válidas. `GET /api/status` es público y
devuelve `status`, `message`, versión de protocolo y datos. `navigator.onLine` sólo es una señal;
el cliente confirma disponibilidad con el servidor.

El transporte distingue `offline`, `timeout`, `unreachable`, `aborted` y errores HTTP. Puede repetir
una lectura de forma limitada ante fallos transitorios, pero nunca reintenta una mutación por sí
solo. Las acciones sensibles esperan confirmación autoritativa y el reintento manual conserva la
misma intención; una acción nueva genera otro identificador.

En mantenimiento se conservan health, status e identidad, pero se rechazan acciones protegidas que
modifican estado con HTTP 503 y `error: maintenance`.

## Contrato vigente

El indicador de conexión escucha `online`/`offline` como señales locales. Una señal `online` deja
el estado degradado hasta que una respuesta de API confirma conectividad; una respuesta exitosa lo
marca online y un fallo de acción conserva offline o degradado, sin polling. Las intenciones nuevas
usan `crypto.randomUUID()`; un retry manual conserva exactamente el mismo identificador y payload.

`ClientEvent` y `ServerEvent` son uniones discriminadas Zod estrictas. Cada mensaje usa `protocolVersion: 1`; las intenciones frecuentes incluyen `requestId` y secuencia. Campos extra, tipos desconocidos y versiones incompatibles se rechazan antes de procesarlos.

## Seguridad

- Validar payload, ownership, rango, velocidad, cooldown y recursos.
- Limitar tamaño y frecuencia por mensaje.
- Rechazar replay, versión incompatible y secuencia obsoleta.
- No replicar datos privados o secretos.
- Correlacionar logs de anomalías sin registrar credenciales.

La implementación del protocolo y sus pruebas de dos clientes pertenecen a los Pasos 13 y 14.
