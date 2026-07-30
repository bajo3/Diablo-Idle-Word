# Game design

Este documento es una síntesis derivada. [GOAL.md](GOAL.md) reemplaza las versiones anteriores y es la fuente principal de verdad. Cuando una decisión de este archivo figure como `TBD` pero GOAL.md la defina, prevalece GOAL.md.

## Visión del juego

Crear un ARPG 2D que combine control activo satisfactorio con progreso idle seguro y comprensible, y que pueda evolucionar hacia experiencias multiplayer autoritativas. Público, plataformas, cámara y fantasía temática: `TBD`.

## Pilares

1. Combate activo legible, responsivo y basado en decisiones.
2. Progresión clara con elecciones de clase, habilidades y equipo.
3. Progreso idle complementario, limitado y sin desplazar el juego activo.
4. Loot con variedad útil y generación auditable.
5. Arquitectura extensible, testeable y preparada para autoridad de servidor.

## Bucle activo

Explorar → enfrentar enemigos → usar ataques/habilidades → obtener recompensas → evaluar/equipar loot → mejorar build → acceder a desafíos mayores. Duración de sesión y ritmo: `TBD`.

## Bucle idle

Cerrar sesión → acumular progreso dentro de límites → calcular recompensa autoritativa agregada → reclamar una vez → reinvertir en progresión activa. Tasas, cap y actividades elegibles: `TBD`.

## Objetivo general

Progresar un personaje y sus builds a través de contenido PvE y, si se confirma, cooperación o competencia multiplayer. Endgame y condición de victoria: `TBD`.

## Progresión

Nivel, experiencia, desbloqueos, dificultad y ritmo: `TBD`. Mantener activo e idle en tablas versionadas y medir tiempo por nivel.

## Clases

Arquetipos, cantidad inicial, recursos y fantasía de cada clase: `TBD`. Usar IDs estables y definiciones extensibles.

## Estadísticas

Vida y estadísticas ofensivas/defensivas exactas: `TBD`. Documentar unidades, caps, crecimiento y orden de modificadores antes de implementar.

## Combate

Vista, controles, ritmo, precisión/evasión, tipos de daño y reglas PvP: `TBD`. El servidor decidirá resultados compartidos.

## Habilidades

Cantidad, slots, árboles, respec y progresión: `TBD`. Separar definición, rango, estado temporal y presentación.

## Equipamiento

Slots, requisitos, durabilidad, crafting y mejora: `TBD`. Separar definición base e instancia única.

## Loot

Rarezas, afijos, tablas, pity y legendarios: `TBD`. Usar seeds/versiones para simulación reproducible cuando corresponda.

## Enemigos

Arquetipos, familias, IA y escalado: `TBD`. Diseñar estados explícitos, telegraphs y presupuesto de entidades.

## Dungeons

Estructura, generación procedural, biomas, longitud y matchmaking: `TBD`. Validar conectividad, spawn seguro y seed.

## Jefes

Cantidad, fases, recompensas y dificultad: `TBD`. Cada ataque debe tener señal y ventana real comprobable.

## Multiplayer

Modalidades, tamaño de grupo, regiones, PvP, trade, party y guild: `TBD`. Mantener servidor autoritativo, mensajes versionados y reconexión.

## Economía

Monedas, fuentes, sumideros, comercio y crafting: `TBD`. Medir saldos por hora e inflación por etapa.

## Persistencia

Backend, cuenta, guardado local de desarrollo y política de backup: `TBD`. Todo formato tendrá versión y migraciones secuenciales.

## Dirección visual

Estilo exacto, resolución base, tile, paleta, cámara y UI: `TBD`. El pipeline provisional prioriza pixel art escalable y assets reemplazables.

## Audio

Música, ambientación, feedback, accesibilidad y herramientas: `TBD`.

## Interfaz

HUD, inventario, árbol, comparación, feedback de red y accesibilidad: `TBD`. La UI no contendrá reglas de dominio.

## Monetización

`TBD — no definida.` No implementar ni inferir modelo de monetización sin decisión explícita.

## Preguntas abiertas

- ¿Qué motor, lenguaje y plataformas se usarán?
- ¿Cuál es la perspectiva/cámara y el esquema de control?
- ¿Qué parte del juego será multiplayer y con cuántos jugadores?
- ¿Cuál es el cap idle y su relación objetivo con el progreso activo?
- ¿Qué clases y estadísticas formarán el primer vertical slice?
- ¿Qué dirección visual, resolución y tile size se adoptarán?
- ¿Habrá comercio, PvP, crafting o temporadas?

## Decisiones tomadas

- El juego será un ARPG 2D con combate activo y progresión idle.
- La arquitectura deberá admitir clases, habilidades, equipo, loot, PvE, multiplayer y persistencia.
- El estado compartido y las recompensas sensibles serán autoritativos en servidor.
- Las decisiones no confirmadas permanecerán `TBD`.

## Registro de cambios

| Fecha | Cambio | Motivo |
| --- | --- | --- |
| 2026-07-29 | Creación de la base de diseño | Preparar desarrollo sin inventar contenido definitivo |
