---
name: classes-and-skills
description: Diseña e implementa clases de personaje, estadísticas, progresión por nivel, habilidades activas, pasivas, árboles de talentos y sinergias. Usar cuando una tarea agregue o modifique clases o habilidades. No usar para balance numérico aislado.
---

# Purpose

Crear clases y habilidades extensibles, basadas en datos y compatibles con combate, equipo, guardado y multiplayer.

# Trigger conditions

Usar al agregar o modificar una clase, estadísticas base, crecimiento, recurso principal, habilidad activa o pasiva, árbol, requisito, rango, costo, sinergia, modificador o reseteo. Para una clase nueva combinar `game-architect`, `combat-system`, `game-balance` y `automated-playtesting`; sumar `multiplayer-authority` si funciona online.

# Do not use when

No usar para un ajuste numérico aislado sin cambio de comportamiento. No definir historia, estética final o monetización. No crear cadenas de condicionales por clase.

# Required context

1. Inspeccionar `AGENTS.md`, `GAME_DESIGN.md`, `docs/game/classes.md`, combate, entidades, configuración, UI, inventario, red, guardado y pruebas.
2. Localizar Class, Character, Stats, Ability, Talent, Modifier, Equipment y serializer equivalentes.
3. Leer [diseño de clases](references/class-design.md).
4. Confirmar identificadores, esquema de datos, unidades, progresión y contratos actuales.

# Workflow

1. Definir arquetipo, identidad mecánica, fortalezas, debilidades y compatibilidad futura.
2. Asignar un identificador estable independiente del nombre visible.
3. Modelar estadísticas base, crecimiento por nivel y recurso principal mediante datos.
4. Definir habilidades activas/pasivas: requisitos, rango, costos, cooldowns, modificadores y sinergias.
5. Validar referencias y detectar ciclos o nodos inaccesibles del árbol.
6. Integrar equipamiento, serialización y sincronización sin duplicar reglas.
7. Probar progresión, respec, guardado y comportamiento online; actualizar documentación.

# Architecture rules

- Separar definición inmutable, progreso del personaje, estado temporal y presentación.
- Favorecer interfaces, componentes, recursos o configuraciones extensibles según el stack.
- Resolver estadísticas mediante un pipeline común; evitar `if class == warrior ...`.
- Mantener identificadores estables para clase, habilidad, nodo y modificador.
- Expresar requisitos y efectos mediante contratos validables, no referencias visuales.
- Permitir agregar clases futuras sin modificar cada sistema consumidor.

# Implementation rules

- Validar duplicados, referencias faltantes, rangos, costos, requisitos y exclusiones.
- Definir orden de modificadores y vínculo con equipamiento y efectos de combate.
- Hacer idempotente la asignación o devolución de puntos cuando corresponda.
- Autorizar en servidor selección, aprendizaje, respec y uso online.
- Versionar datos persistentes si cambia el progreso guardado.
- No inventar valores de balance definitivos; usar `TBD` o valores de prueba declarados.
- Si el sistema no existe, crear primero el esquema mínimo y un ejemplo neutral, no una lista completa de clases.
- Delegar fórmulas a `combat-system`, números a `game-balance`, red a `multiplayer-authority` y cambios de esquema a `save-and-migrations`.

# Validation

- Probar creación, carga, subida de nivel, límites, requisitos, respec y referencias inválidas.
- Probar habilidad activa, pasiva, cooldown, costo, sinergia y compatibilidad de equipo.
- Probar serialización round trip y sincronización con dos jugadores si aplica.
- Ejecutar validaciones del stack y mostrar comandos, fixtures, resultados y riesgos.

# Required output

Entregar definiciones modificadas, identificadores, flujo de cálculo, compatibilidad, pruebas, documentación actualizada y decisiones `TBD`.

# Definition of done

Completar cuando la extensión no requiera condicionales globales, las referencias sean válidas, progreso y respec sean seguros, guardado/red estén cubiertos y las pruebas relevantes pasen.

# Related documentation

- [Diseño de clases](references/class-design.md)
- [Clases y habilidades](../../../docs/game/classes.md)
- [Combate](../../../docs/game/combat.md)
- [Guardado](../../../docs/game/saves.md)
