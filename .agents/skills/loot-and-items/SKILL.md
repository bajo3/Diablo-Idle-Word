---
name: loot-and-items
description: Implementa inventario, equipamiento, objetos, armas, armaduras, rarezas, afijos, generación procedural, tablas de drop, mejoras y persistencia de ítems. Usar cuando una tarea afecte objetos o economía asociada. No usar para recursos visuales sin lógica.
---

# Purpose

Implementar objetos e inventarios reproducibles, extensibles y resistentes a duplicación o manipulación.

# Trigger conditions

Usar al cambiar tipos, slots, rarezas, nivel, requisitos, estadísticas, afijos, tablas de drop, inventario, stacking, equipo, venta, destrucción, mejora, bloqueo, vinculación o persistencia. Para un tipo nuevo combinar `game-balance`, `save-and-migrations` y `automated-playtesting`.

# Do not use when

No usar para iconos o sprites sin lógica. No confiar en instancias, precios, drops ni transacciones enviados por el cliente.

# Required context

1. Inspeccionar `AGENTS.md`, `GAME_DESIGN.md`, `docs/game/items-and-loot.md`, entidades, combate, economía, inventario, red, guardado, configuración y pruebas.
2. Localizar ItemDefinition, ItemInstance, Inventory, Equipment, Affix, DropTable, Currency y transacciones equivalentes.
3. Leer [generación de ítems](references/item-generation.md).
4. Confirmar esquema, identificadores, RNG, slots, límites y autoridad actuales.

# Workflow

1. Definir invariantes y separar definición base, instancia concreta, presentación, estadísticas finales y persistencia.
2. Asignar identificadores estables de definición y únicos de instancia.
3. Modelar tipo, slot, rareza, nivel, requisitos, base, prefijos, sufijos, rangos y pesos.
4. Resolver tablas por fuente: enemigo, jefe, cofre o recompensa; fijar semilla cuando se necesite reproducción.
5. Implementar operaciones atómicas de inventario y equipo con identificador de operación.
6. Integrar serialización, migraciones y validación server-side.
7. Simular distribución, probar duplicación y documentar economía afectada.

# Architecture rules

- Mantener catálogos inmutables separados de instancias poseídas.
- Calcular estadísticas finales en un servicio de dominio común.
- Representar inventario y equipo como contenedores con reglas explícitas.
- Separar comandos de equipar, desequipar, comparar, vender, destruir, mejorar y bloquear.
- Mantener tablas, pesos y rangos como datos validables.
- Usar semillas sólo cuando la reproducibilidad lo requiera; registrar versión de generador.

# Implementation rules

- Validar stacking, capacidad, slot, requisitos, propiedad, vinculación y estado bloqueado.
- Hacer atómicas e idempotentes las operaciones sensibles.
- Impedir reutilización de ID, doble consumo y doble entrega.
- Autorizar en servidor loot, monedas, comercio, mejoras y cambios de inventario.
- Versionar y migrar instancias persistidas ante cambios de esquema.
- No derivar una instancia confiable sólo desde datos del cliente.
- Si el sistema no existe, definir esquema mínimo y operaciones puras antes de UI o contenido masivo.
- Delegar balance a `game-balance`, red a `multiplayer-authority` y esquema a `save-and-migrations`.

# Validation

- Probar generación común, rara y legendaria con semillas fijas y rangos límite.
- Probar inventario lleno, stacking parcial, equipar/desequipar, venta, destrucción, mejora, bloqueo y rollback.
- Probar concurrencia, reintentos, desconexión y ausencia de duplicación.
- Ejecutar round trip de persistencia y mostrar semillas, distribución, comandos y resultados.

# Required output

Entregar cambios de esquema, catálogos/tablas, transacciones afectadas, simulaciones, pruebas, autoridad de datos y riesgos económicos.

# Definition of done

Completar cuando las capas estén separadas, las operaciones sean atómicas e idempotentes, el servidor valide, las migraciones existan y las distribuciones/pruebas sean reproducibles.

# Related documentation

- [Generación de ítems](references/item-generation.md)
- [Objetos y loot](../../../docs/game/items-and-loot.md)
- [Balance](../../../docs/game/balance.md)
- [Guardado](../../../docs/game/saves.md)

