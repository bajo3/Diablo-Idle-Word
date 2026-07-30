---
name: multiplayer-authority
description: Diseña y revisa multiplayer autoritativo, sincronización, salas, reconexión, validación de acciones y seguridad del estado compartido. Usar cuando una tarea afecte red, jugadores, combate, inventario, comercio, monedas o persistencia multiplayer.
---

# Purpose

Diseñar multiplayer autoritativo que tolere latencia, reintentos, desconexiones y clientes hostiles.

# Trigger conditions

Usar ante red, salas, matchmaking, party, guild, movimiento compartido, combate, inventario, loot, monedas, comercio, guardado o recompensas online. Combinar con la skill del dominio, `automated-playtesting` y `performance-2d` cuando aumente tráfico.

# Do not use when

No usar para estado puramente local sin impacto compartido. No tratar al cliente como fuente de verdad ni ocultación del protocolo como seguridad.

# Required context

1. Inspeccionar `AGENTS.md`, `docs/game/multiplayer.md`, arquitectura, protocolos, autenticación, sesiones, pruebas y observabilidad.
2. Revisar archivos relacionados con Player, Character, Combat, Inventory, Loot, Currency, Trading, Matchmaking, Party, Guild, Save y Rewards.
3. Leer [seguridad multiplayer](references/multiplayer-security.md).
4. Identificar transporte, tick, ownership, secuencias, versiones, persistencia y límites actuales.

# Workflow

1. Clasificar cada dato y acción por propietario y autoridad.
2. Modelar mensaje como intención con identidad, versión, secuencia o ID de operación.
3. Validar autenticación, estado, alcance, velocidad, cooldown, recurso, daño, loot, inventario, moneda y comercio.
4. Aplicar rate limiting, protección de replay e idempotencia.
5. Definir snapshots/deltas, latencia, interpolación y predicción sólo donde aporte respuesta.
6. Implementar reconciliación y recuperación tras reconexión.
7. Probar clientes adversarios, fallos parciales y compatibilidad de versiones.

# Architecture rules

- Mantener servidor autoritativo y cliente como fuente de intención.
- Separar simulación autoritativa, transporte, replicación y presentación.
- Versionar mensajes y negociar o rechazar versiones incompatibles explícitamente.
- Usar identificadores de operación y secuencia; hacer idempotentes los comandos sensibles.
- Recuperar estado desde snapshot autoritativo, no desde caché del cliente.
- Usar heartbeats cuando resuelvan detección de sesión, no como sustituto de timeouts.
- Aplicar predicción sólo a acciones reversibles; reconciliar contra servidor.

# Implementation rules

- Validar movimiento, alcance, velocidad, recursos, cooldowns y daño en servidor.
- Validar propiedad, capacidad y saldo antes de loot, inventario, moneda o comercio.
- Prevenir replay y spam con ventana de secuencia, nonce/ID y límites por identidad/acción.
- Manejar desconexión durante operaciones sensibles mediante commit/rollback durable.
- Registrar rechazos, anomalías y operaciones sensibles con correlación y sin secretos.
- Limitar frecuencia y tamaño de paquetes; no replicar datos privados.
- Si no existe backend, documentar el contrato autoritativo y abstraer el transporte; no simular seguridad con lógica cliente.

# Validation

- Probar paquetes inválidos, repetidos, fuera de orden, tardíos y de versión incorrecta.
- Probar latencia, pérdida, reconexión, dos sesiones, spam y desconexión en transacción.
- Verificar que ningún resultado sensible dependa de valores finales enviados por cliente.
- Mostrar matriz de autoridad, trazas correlacionadas, comandos, resultados y amenazas residuales.

# Required output

Entregar contratos/versiones, matriz cliente-servidor, validaciones, estrategia de sincronización/reconexión, pruebas adversarias, métricas de red y riesgos.

# Definition of done

Completar cuando la autoridad sea explícita, replay/spam/reintentos estén cubiertos, reconexión recupere estado, mensajes estén versionados y las pruebas adversarias pasen.

# Related documentation

- [Seguridad multiplayer](references/multiplayer-security.md)
- [Multiplayer](../../../docs/game/multiplayer.md)
- [Arquitectura](../../../docs/game/architecture.md)
- [Rendimiento](../../../docs/game/performance.md)
