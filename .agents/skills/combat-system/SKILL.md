---
name: combat-system
description: Implementa o revisa combate ARPG 2D, ataques, habilidades, daño, defensa, críticos, recursos, cooldowns, efectos de estado, proyectiles, hitboxes y validación del combate. Usar cuando una tarea afecte las reglas de combate. No usar para cambios puramente visuales.
---

# Purpose

Implementar reglas de combate deterministas, configurables, observables y seguras para juego activo y multiplayer.

# Trigger conditions

Usar al cambiar ataques, daño, defensa, recursos, cooldowns, lanzamiento, hit detection, proyectiles, estados, muerte, respawn, aggro o PvP. Combinar con `multiplayer-authority` para juego online, `game-balance` para números y `automated-playtesting` para recorridos.

# Do not use when

No usar para animación, VFX o audio sin cambio de reglas. No permitir que el cliente decida daño, cooldowns, recursos o resultados. No vincular estados sólo a animaciones ni mezclar cálculo con renderizado.

# Required context

1. Inspeccionar `AGENTS.md`, `GAME_DESIGN.md`, `docs/game/combat.md`, configuración de entidades, componentes de combate, física, red, pruebas y persistencia relacionada.
2. Localizar Player/Character, Combat, Ability, Projectile, Status, Health, Death, Respawn y Aggro.
3. Leer [fórmulas de combate](references/combat-formulas.md).
4. Identificar tick, unidades, reloj autoritativo, semilla aleatoria, redondeo y topes existentes.

# Workflow

1. Definir la intención jugable, entradas válidas, salida, invariantes y casos límite.
2. Trazar el flujo intención → validación → resolución → eventos → presentación.
3. Especificar fórmula, orden de operaciones, redondeo, caps y fuente de configuración.
4. Implementar lógica pura antes de integrar física, animación o red.
5. Emitir eventos relevantes con identificadores de actor, objetivo, habilidad y operación.
6. Añadir pruebas de fórmula, integración, regresión y recorrido.
7. Actualizar documentación y, si cambia balance, registrar antes/después.

# Architecture rules

- Separar definición de habilidad, estado de ejecución, resolución, presentación y persistencia.
- Modelar ataque básico, velocidad de ataque, daño físico y elemental, armadura, resistencias, crítico, precisión y evasión sólo si existen.
- Modelar mana, energía, furia u otros recursos con costos y regeneración explícitos.
- Tratar cooldown, tiempo de lanzamiento, interrupción e invulnerabilidad con un reloj controlable.
- Separar hitboxes y hurtboxes del sprite; resolver proyectiles, alcance y colisión de forma reproducible.
- Modelar DPS, stun, slow, burn, poison, bleed, freeze y knockback como efectos con duración, stacking y limpieza definidos.
- Modelar muerte, respawn, amenaza y aggro como estados y transiciones explícitas.
- Mantener extensiones PvP detrás de reglas configurables.

# Implementation rules

- Validar en servidor actor, objetivo, alcance, velocidad, recurso, cooldown, estado, impacto y daño.
- Usar enteros escalados o precisión documentada cuando el determinismo lo exija.
- No usar números mágicos; centralizar configuración y documentar valores.
- No hacer depender la aplicación o expiración de un estado de un callback visual.
- Registrar eventos de combate útiles sin incluir secretos ni saturar logs.
- Si el sistema no existe, definir primero tipos mínimos y funciones puras; no construir una UI ni un motor completo.
- Delegar cambios de clase a `classes-and-skills`, ítems a `loot-and-items`, persistencia a `save-and-migrations` y autoridad a `multiplayer-authority`.

# Validation

- Probar mínimos, máximos, cero, crítico, resistencias negativas si se admiten, caps, redondeo y orden de modificadores.
- Probar cooldowns, interrupciones, estados solapados, proyectiles, muerte/respawn y desconexiones.
- Comparar resultados cliente-servidor sin aceptar la predicción como verdad.
- Ejecutar pruebas del stack y mostrar comando, resultado, semilla/datos y eventos observados.

# Required output

Entregar fórmula y orden de resolución, cambios de configuración, pruebas con ejemplos numéricos, archivos afectados, autoridad de cada dato y riesgos de balance o sincronización.

# Definition of done

Completar cuando las reglas estén documentadas, no dependan del render, el servidor valide el multiplayer, los casos límite estén probados y no existan números mágicos no justificados.

# Related documentation

- [Fórmulas de combate](references/combat-formulas.md)
- [Combate](../../../docs/game/combat.md)
- [Multiplayer](../../../docs/game/multiplayer.md)
- [Balance](../../../docs/game/balance.md)

