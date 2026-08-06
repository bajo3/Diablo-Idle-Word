# Multiplayer

## Checkpoint local y autoridad

El checkpoint no replica una partida ni acepta estado espacial desde el navegador. Es una operación
idempotente por `operationId`, con hash de intención y configuración/posición derivada en servidor;
la red futura deberá recuperar ese recibo, no un snapshot local.

## Estado actual

Existen cliente y servidor mínimos. El WebSocket ya transporta intenciones de movimiento, interacción
y combate del Paso 9/14, y el servidor conserva un `ActiveInstanceRegistry` con estado versionado,
reloj/tick monotónico, posición, vida, estado del actor y enemigos iniciales. Emite snapshots del
actor o de la party después de cada comando; la party de hasta cuatro jugadores, el snapshot inicial
de enemigos y las habilidades del Guardián (incluidos impactos diferidos) ya están cubiertos. GOAL.md fija cooperación para 1 a 4
jugadores y autoridad de servidor; consultar
[../networking.md](../networking.md).

El Paso 4 incorpora el perímetro de autenticación WebSocket en `/ws`: el upgrade exige `Origin`
permitido y la misma cookie de sesión opaca activa que HTTP; la identidad se deriva de PostgreSQL.
Confirma autenticación y acepta `MOVE_INTENT`, `INTERACT_INTENT` y `COMBAT_INTENT`: deriva el Guardián seleccionado,
crea/reanuda su instancia activa desde spawn server-side, avanza el tick y responde `COMMAND_ACCEPTED`
para movimiento o `INTERACTION_RESULT` para interacción. El vector de movimiento se normaliza y se
recorta a los límites del mundo; una posición absoluta, vida o estado enviados por el cliente no se
aceptan. Un `COMBAT_INTENT` nunca incluye daño o vida confiable: `CombatAuthority` toma el enemigo
del estado de instancia, aplica la fórmula y publica `COMBAT_RESULT` más el snapshot compartido. Los
impactos con `impactMs`/`tickOffsetsMs` se mantienen en una cola server-side y un timer de 50 ms emite
un `COMBAT_RESULT` posterior con `pending: false`; el cliente nunca decide cuándo aplicar daño.
La FSM/steering de enemigos y sus ataques server-side ya avanzan una vez por instancia compartida;
cleanup/respawn usa timestamps server-side y puntos seguros. `INSTANCE_SNAPSHOT` también replica la
lista server-owned de objetivos del Bosque (`objective.forest.level`, nivel 1→20), con unicidad y
rango validados antes de salir del servidor. La misión finita de altares/jefe está retirada por la
decisión de Bosque infinito; XP/oro/materiales actualizan el nivel y se entregan por
`REWARD_GRANTED`; los objetos se generan de forma individual dentro de la misma transacción y no
se replican a otros miembros. La reconexión de la sesión
ya está cubierta: una nueva conexión autenticada
recupera la party/instancia activa. La interacción de reanimación selecciona al
compañero derribado en servidor, conserva `effectCharacterId` en el recibo, se interrumpe si el actor
recibe daño durante la duración y publica `INTERACTION_EFFECT` o `INTERACTION_INTERRUPTED` a la party.

## Interacción autoritativa preparada (Paso 9/14)

`InteractionCommandSchema` define una intención versionada con `operationId`, `zoneId` y `targetId`;
no acepta identidad, posición, reloj ni recompensa del cliente. Cada target reusable declara estado
permitido, duración, interrupción por daño, autoridad, `resultId`, cooldown y texto de UI.
`InteractionAuthorityService` enlaza la identidad autenticada y la posición/estado del tick
server-side, usa el catálogo de targets de `@brecha/game-data`, ejecuta `applyInteraction` y persiste
`CharacterInteractionState` V2 más un `CharacterInteractionReceipt` durable. Los reintentos devuelven
el recibo exacto y los conflictos de `operationId` se rechazan.

El WebSocket usa la posición/estado del `ActiveInstanceRegistry`, no un `Map` de spawn por request;
no acepta reloj, zona ni snapshot del cliente. La instancia es process-local durante la sesión y no
persiste cada tick en PostgreSQL. Las finalizaciones pasan por `InteractionEffectService` y el ledger
durable `CharacterInteractionEffect`: reanimación y diálogo se aplican una vez; loot queda como
`PENDING_DOMAIN` hasta integrar el dominio de objetos, sin otorgar recompensas desde el transporte.

## Party y snapshots compartidos (primer bloque Paso 13/14)

`PartyRegistry` mantiene un lobby server-side de hasta cuatro personajes. `PARTY_CREATE_INTENT`,
`PARTY_JOIN_INTENT`, `PARTY_READY_INTENT`, `PARTY_START_INTENT` y `PARTY_LEAVE_INTENT` son intenciones
versionadas; el servidor deriva el personaje seleccionado, valida ownership, código, capacidad,
líder, readiness, zona y dificultad. `PARTY_SNAPSHOT` nunca acepta una lista aportada por el cliente.

Al iniciar, los miembros listos se enlazan a una sola instancia autoritativa. El estado contiene todos
los jugadores, el snapshot inicial de la oleada de enemigos (arquetipo, posición, vida y estado) y
los objetivos server-side del bucle infinito; el movimiento de uno incrementa la revisión compartida
y `INSTANCE_SNAPSHOT` se envía a los sockets conectados de la party. `CombatAuthority` aplica las
habilidades del Guardián de forma idempotente y
replica `COMBAT_RESULT.hits[]` junto con la vida/estado/knockback del enemigo; los impactos diferidos
se publican como actualizaciones del mismo `operationId`. `EnemyAuthority` se deduplica por
`instanceId` para que una party no multiplique ataques; el lobby es process-local por ahora: no se pierde
por cerrar el socket. La finalización de interacciones también se procesa en el timer de instancia,
por lo que una party no necesita enviar otro comando para completar una reanimación. `PartyRegistry`
limpia lobbies sin actividad después de un TTL configurable
(15 minutos por defecto), sólo cuando todos sus miembros están desconectados; la persistencia social
durable queda fuera de este hito. La recompensa de recursos y los drops individuales llegan por
`REWARD_GRANTED`; la instancia de objeto queda ligada al inventario del personaje que la obtuvo.

## Reconexión y observabilidad de red (Paso 14)

El WebSocket envía primero `authenticated` y, si el usuario tiene un personaje en una party,
reproduce `PARTY_SNAPSHOT` y luego `INSTANCE_SNAPSHOT` con `requestId: session`. El snapshot se
construye desde `PartyRegistry`/`ActiveInstanceRegistry`, nunca desde un estado enviado por el
cliente. Cerrar el socket sólo quita el transporte; no elimina una party activa ni pausa el timer
server-side. El lobby se conserva durante `DEFAULT_PARTY_LOBBY_TTL_MS` (15 minutos) cuando todos
están desconectados y se elimina al expirar; una party `ACTIVE` no admite nuevos miembros.

`GET /api/metrics/network` requiere sesión y devuelve contadores del proceso para una ventana de
60 segundos: mensajes/bytes entrantes y salientes, tasas por segundo, cantidad de snapshots de
instancia, p95 de su tamaño UTF-8 y muestras descartadas. No almacena payloads, cookies ni IDs;
es una sonda operativa, no una fuente de estado de juego.

## Recompensas autoritativas por derrota (Paso 14)

Cuando `CombatAuthority` confirma un impacto con `hit.defeated`, el servidor deriva el enemigo y
la lista de personajes activos de la party. `EnemyRewardService` aplica XP, oro, materiales y
progreso del Bosque en una transaccion `Serializable`, y crea un `RewardLog` con hash, formula y
versiones. La misma operacion se puede reintentar tras perder la conexion: el receipt se reproduce
sin duplicar saldos.

Cada destinatario recibe un `REWARD_GRANTED` privado (`visibility: private`) con deltas numericos serializados como string,
progreso de nivel y `replayed`. El `operationId` es un digest acotado derivado de instancia,
enemigo y personaje; `sourceId` conserva un digest acotado y los IDs completos quedan en el payload
durable. El cliente nunca envia ni decide cantidades. `GET /api/characters/:characterId/rewards/recent`
comprueba ownership antes de devolver el informe privado.

El escalado de dificultad tambien es server-side: salud = base × (1 + 0.65 × jugadores adicionales)
y dano = base × (1 + 0.15 × jugadores adicionales), con multiplicadores de Veterano 1.25/1.15
versionados en `GAME_DATA.balance.difficulty`. La misma configuracion se usa al crear oleadas,
respawnear y resolver ataques.

Cada mob derrotado tiene su propia operación `reward:<digest(instance, enemy, character)>`; el ledger
`RewardLog` y `CharacterProgress` se actualizan en la misma transacción. Volver al Pueblo ejecuta
además un checkpoint idempotente con el snapshot observado, pero nunca acepta XP ni coordenadas del
cliente.

## Responsabilidades

- Autenticar sesión y autorizar acciones.
- Simular estado compartido en servidor.
- Versionar mensajes, snapshots y operaciones.
- Sincronizar con interpolación/predicción/reconciliación apropiadas.
- Recuperar estado tras reconexión.
- Aplicar límites, idempotencia, replay protection y auditoría.

## Flujo de datos

```text
Input cliente + secuencia → comando autenticado → validación servidor
→ mutación autoritativa → snapshot/delta → interpolación/presentación
```

Las transacciones usan ID de operación y persistencia atómica. La reconexión solicita snapshot/cursor; nunca sube una verdad local.

## Límites

Cliente: intención y feedback reversible. Servidor: movimiento válido, combate, loot, inventario, monedas, comercio, recompensas y guardado. Transporte no contiene reglas de dominio.

## Riesgos

Trust del cliente, replay, spam, versiones incompatibles, snapshots con datos privados, double-spend, comandos fuera de orden y operaciones ambiguas tras desconexión.

## Pruebas requeridas

Dos clientes, latencia/pérdida, out-of-order, replay, rate limiting, reconexión, versión inválida, movimiento imposible, daño falsificado y desconexión durante transacción.

## Skills relacionadas

- [multiplayer-authority](../../.agents/skills/multiplayer-authority/SKILL.md)
- [game-architect](../../.agents/skills/game-architect/SKILL.md)
- [performance-2d](../../.agents/skills/performance-2d/SKILL.md)
- [automated-playtesting](../../.agents/skills/automated-playtesting/SKILL.md)

## Calidad y límites de abuso (Paso 19)

Las mutaciones HTTP exigen `Origin` permitido, JSON y sesión; `/ws` exige el mismo perímetro y valida
envelope, protocolo, secuencia, ownership y disponibilidad del personaje antes de ejecutar una
intención. Las credenciales tienen una ventana fija de 5 intentos por IP+email y el gameplay WebSocket
una ventana de 120 comandos por usuario/minuto. Ambos mapas son acotados (10.000 claves por proceso)
para que entradas únicas no puedan crecer la memoria sin límite; al llenar la capacidad se rechazan
nuevas claves sin evictar identidades activas. Las réplicas horizontales requerirán
un almacén compartido en el Paso 20.

Los errores inesperados registran `requestId`, método/URL y, en gameplay, `requestId`/usuario sin
payload; los rechazos de validación/conflicto se reducen a códigos seguros para el cliente. `RewardLog`
y los ledgers de interacción, progresión, inventario, pueblo y modo ausente conservan `operationId` +
hash y transacciones serializables, por lo que un replay devuelve el recibo original sin duplicar
moneda, experiencia u objetos.
