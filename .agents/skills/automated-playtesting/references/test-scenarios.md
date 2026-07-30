# Escenarios de prueba jugable

## Convenciones

Definir cada escenario con ID, capa, precondiciones, seed/reloj, acciones, aserciones, logs prohibidos y limpieza. Marcar `Pendiente: sistema inexistente` en lugar de falsificar cobertura.

## Smoke

| ID | Recorrido | Aserciones mínimas |
| --- | --- | --- |
| SMK-01 | Iniciar juego | proceso/escena listos, sin error de consola |
| SMK-02 | Crear personaje y elegir clase | ID estable, stats válidos |
| SMK-03 | Entrar al mundo | spawn seguro y estado cargado |

## Combate y progresión

- `CBT-01`: mover, atacar y confirmar daño autoritativo.
- `CBT-02`: usar habilidad, consumir recurso y aplicar cooldown.
- `CBT-03`: recibir daño, morir y reaparecer en estado válido.
- `CBT-04`: aplicar/expirar un efecto sin depender de animación.
- `PRG-01`: ganar XP, subir nivel y asignar estadísticas.
- `PRG-02`: aprender habilidad y validar requisitos.

## Loot e inventario

- `LOOT-01`: derrotar enemigo, generar y recoger loot una vez.
- `INV-01`: equipar, comparar y desequipar.
- `INV-02`: inventario lleno, stacking y rechazo válido.
- `INV-03`: repetir operación y verificar ausencia de duplicación.

## Persistencia e idle

- `SAVE-01`: guardar, reiniciar y cargar con round trip.
- `SAVE-02`: cargar fixture antiguo y migrar.
- `IDLE-01`: reclamar duración bajo cap con reloj controlado.
- `IDLE-02`: reclamar dos veces y recibir el mismo resultado sin doble crédito.
- `IDLE-03`: alterar reloj local y verificar rechazo/irrelevancia.

## Dungeon y multiplayer

- `DNG-01`: entrar, recorrer seed fija y derrotar jefe.
- `DNG-02`: validar conectividad, spawn y limpieza.
- `NET-01`: dos jugadores se observan e interactúan.
- `NET-02`: desconectar/reconectar y recuperar snapshot.
- `NET-03`: repetir, retrasar y desordenar comandos.
- `NET-04`: desconectar durante pickup/comercio y verificar commit único.

## Observabilidad

Fallar ante excepciones no esperadas, errores de consola, mensajes de red inválidos, promesas/tareas no manejadas y entidades persistentes tras limpieza. Permitir listas de excepciones sólo con issue y vencimiento.

## Pirámide

Probar fórmulas y máquinas de estado con unidades rápidas. Probar repositorios, red y transacciones en integración. Reservar E2E para recorridos que conectan subsistemas. Mantener smoke mínimo y confiable en cada cambio.

