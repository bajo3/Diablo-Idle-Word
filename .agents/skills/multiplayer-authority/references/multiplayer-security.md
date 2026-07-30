# Seguridad y autoridad multiplayer

## Regla de confianza

Confiar en el cliente sólo para intención y datos de presentación no sensibles. Verificar identidad, autorización, estado y precondiciones en servidor.

| Dato/acción | Cliente envía | Servidor decide |
| --- | --- | --- |
| Movimiento | dirección/input y secuencia | posición válida, velocidad y colisión |
| Ataque | habilidad, objetivo/dirección | costo, cooldown, hit, daño y estado |
| Loot | solicitud de recoger | existencia, alcance, propiedad y grant |
| Inventario | comando e IDs | versión, capacidad y mutación |
| Comercio | oferta/aceptación | propiedad, saldo y commit atómico |
| Idle | solicitud de reclamar | tiempo, tasas, límites y recompensa |
| UI/cosmético | preferencia permitida | validación de formato y visibilidad |

## Amenazas comunes

- Manipulación de velocidad, alcance, cooldown, daño o reloj.
- Replay de recompensa, compra, comercio o loot.
- Spam y agotamiento de CPU/memoria.
- IDs de objetos adivinados o de otro jugador.
- Mensajes fuera de orden y double-spend concurrente.
- Deserialización abusiva, tamaños no acotados o versiones desconocidas.
- Fuga de información mediante snapshots.
- Reconexión que revive operaciones incompletas.

## Controles

- Autenticar sesión y autorizar recurso/ownership.
- Limitar tamaño, frecuencia y complejidad por mensaje.
- Usar secuencia para comandos frecuentes e ID idempotente para transacciones.
- Mantener ventana de replay y expiración.
- Validar rango, velocidad y tiempo contra estado autoritativo.
- Usar transacciones/compare-and-swap para saldos e inventario.
- Versionar contratos y rechazar lo que no se pueda interpretar.
- Registrar correlación, identidad, acción, regla rechazada y resultado.

## Latencia

Permitir predicción sólo para feedback reversible, típicamente movimiento local. Interpolar entidades remotas. Al recibir snapshot:

1. Aplicar estado autoritativo confirmado.
2. Descartar inputs confirmados.
3. Reaplicar inputs pendientes.
4. Suavizar únicamente la presentación.

No predecir grants de moneda, loot, trade o daño como verdad persistente.

## Reconexión

- Asociar sesión nueva a identidad autorizada.
- Entregar snapshot con versión y cursor.
- Reanudar o consultar operaciones por ID.
- Invalidar ownership temporal anterior.
- No aceptar un snapshot aportado por el cliente.

## Revisión mínima

Trazar una acción válida, una inválida, replay, spam, out-of-order, pérdida de respuesta, desconexión entre debit/credit y reconexión con estado actualizado.

