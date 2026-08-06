Estoy desarrollando **La Brecha Oscura**, un RPG 2D idle/ARPG para web, inspirado en la estructura de progresión, clases, habilidades, objetos y enemigos de Diablo II.

Necesito que diseñes el sistema completo de:

* Clases jugables.
* Estadísticas.
* Árboles de habilidades.
* Enemigos normales.
* Enemigos campeones y élites.
* Jefes.
* Resistencias y tipos de daño.
* Progresión por zonas y dificultad.
* Comportamiento en modo activo e idle.

Antes de realizar cambios:

1. Revisa `GOAL.md`, `AGENTS.md`, `PLANS.md` y la estructura actual del proyecto.
2. Identifica qué sistemas ya existen.
3. No elimines funcionalidades existentes.
4. Mantén compatibilidad con el modo activo, el modo idle y la simulación offline.
5. Separa datos, lógica y presentación.
6. No copies nombres, historias, habilidades, enemigos, mapas ni recursos protegidos de Diablo II. Utiliza solamente sus conceptos generales como inspiración y crea contenido original para La Brecha Oscura.

# 1. Filosofía de las clases

Cada clase debe cumplir una fantasía clara y tener:

* Una identidad visual reconocible.
* Una mecánica principal única.
* Fortalezas y debilidades reales.
* Tres ramas de habilidades.
* Habilidades activas y pasivas.
* Opciones para diferentes builds.
* Utilidad tanto en modo activo como idle.
* Escalado con armas, estadísticas y equipamiento.
* Una habilidad básica gratuita.
* Una habilidad definitiva.
* Un recurso propio o una interacción especial.
* Al menos tres builds viables por clase.

No quiero que todas las clases se diferencien únicamente por daño. Algunas deben destacar por:

* Supervivencia.
* Daño en área.
* Daño contra jefes.
* Invocaciones.
* Control de masas.
* Daño prolongado.
* Golpes críticos.
* Velocidad.
* Contraataques.
* Auras.
* Maldiciones.
* Generación de recursos.
* Automatización eficiente en modo idle.

# 2. Clases iniciales

Diseña inicialmente estas siete clases.

## 2.1 Bárbaro — nombre provisional: Quebrantahuesos

Guerrero de primera línea especializado en fuerza física, furia, armas pesadas y resistencia.

Características:

* Mucha vida y armadura.
* Combate cuerpo a cuerpo.
* Puede usar armas de una o dos manos.
* Puede utilizar dos armas simultáneamente si la build lo permite.
* Genera Furia atacando y recibiendo daño.
* Pierde parte de la Furia después de permanecer fuera de combate.
* Excelente limpiando grupos cercanos.
* Dependiente de buen equipamiento físico.

Ramas sugeridas:

1. **Furia de Guerra**

   * Ataques rápidos.
   * Golpes consecutivos.
   * Torbellinos.
   * Bonificaciones por Furia alta.

2. **Armas Colosales**

   * Golpes lentos y fuertes.
   * Sangrado.
   * Ruptura de armadura.
   * Daño contra jefes.

3. **Gritos Ancestrales**

   * Aumentos temporales.
   * Provocación.
   * Reducción de daño.
   * Recuperación de vida.
   * Bonificaciones para aliados o invocaciones.

Builds esperadas:

* Torbellino y velocidad.
* Arma de dos manos y golpes críticos.
* Tanque basado en gritos y contraataques.

## 2.2 Amazona — nombre provisional: Guardiana de la Frontera

Combatiente ágil especializada en arcos, jabalinas, proyectiles elementales y evasión.

Características:

* Combate principalmente a distancia.
* Alta precisión, velocidad de ataque y probabilidad de crítico.
* Menor vida y defensa física.
* Puede atacar a varios enemigos mediante perforación y rebotes.
* Usa Concentración como recurso.
* La Concentración aumenta al mantener distancia y acertar ataques.
* Pierde eficiencia cuando queda rodeada.

Ramas sugeridas:

1. **Arquería**

   * Flechas múltiples.
   * Flechas perforantes.
   * Rebotes.
   * Disparos críticos.
   * Ataques contra objetivos lejanos.

2. **Jabalinas Rúnicas**

   * Proyectiles eléctricos.
   * Explosiones en cadena.
   * Lanzamientos contra grupos.
   * Daño híbrido físico y elemental.

3. **Supervivencia**

   * Evasión.
   * Trampas simples.
   * Retroceso.
   * Señuelos.
   * Bonificaciones al mantener distancia.

Builds esperadas:

* Multidisparo físico.
* Jabalinas eléctricas.
* Crítico, evasión y daño contra jefes.

## 2.3 Nigromante — nombre provisional: Heraldo de Ceniza

Invocador y manipulador de cadáveres, maldiciones y energía oscura.

Características:

* Puede invocar esqueletos, espectros o criaturas de hueso.
* Utiliza Esencia como recurso.
* Algunos poderes requieren cadáveres.
* Débil en combate directo.
* Muy eficiente en modo idle cuando posee un ejército estable.
* Puede sacrificar invocaciones para obtener beneficios.

Ramas sugeridas:

1. **Legión de Hueso**

   * Esqueletos.
   * Guardianes.
   * Magos espectrales.
   * Mejoras para invocaciones.

2. **Ritos de Cadáver**

   * Explosión de cadáver.
   * Extracción de esencia.
   * Resurrección temporal.
   * Sacrificios.

3. **Maldiciones**

   * Reducción de defensa.
   * Daño recibido aumentado.
   * Lentitud.
   * Debilitamiento de resistencias.
   * Robo de vida indirecto.

Builds esperadas:

* Ejército de invocaciones.
* Explosión de cadáveres.
* Maldiciones y daño prolongado.

## 2.4 Hechicera — nombre provisional: Tejedora Arcana

Especialista en daño elemental, teletransporte, control de masas y grandes explosiones.

Características:

* Utiliza Maná.
* Mucho daño elemental.
* Poca vida y armadura.
* Puede especializarse en fuego, hielo o tormenta.
* Excelente controlando grupos.
* Depende de recuperación de Maná y reducción de enfriamientos.

Ramas sugeridas:

1. **Fuego Primordial**

   * Quemaduras.
   * Explosiones.
   * Meteoros.
   * Daño creciente sobre enemigos afectados.

2. **Escarcha**

   * Congelación.
   * Ralentización.
   * Escudos.
   * Fragmentación de enemigos congelados.

3. **Tormenta Arcana**

   * Rayos en cadena.
   * Teletransporte.
   * Sobrecarga.
   * Daño variable pero rápido.

Builds esperadas:

* Incendio y daño prolongado.
* Congelación y control.
* Rayos en cadena y velocidad.

## 2.5 Paladín — nombre provisional: Custodio del Umbral

Guerrero sagrado especializado en escudo, auras, contraataques y daño contra criaturas corruptas.

Características:

* Buena combinación de daño y defensa.
* Puede utilizar escudo de forma ofensiva.
* Mantiene una sola aura principal activa.
* Utiliza Convicción como recurso.
* Genera Convicción bloqueando, atacando y protegiendo aliados.
* Muy estable en modo idle.

Ramas sugeridas:

1. **Martillo y Escudo**

   * Golpes de escudo.
   * Bloqueos.
   * Aturdimientos.
   * Contraataques.

2. **Auras**

   * Daño.
   * Regeneración.
   * Armadura.
   * Resistencias.
   * Velocidad.

3. **Juicio**

   * Daño sagrado.
   * Ejecuciones.
   * Marcas.
   * Daño adicional contra demonios y no-muertos.

Builds esperadas:

* Tanque de bloqueo.
* Aura ofensiva.
* Daño sagrado contra jefes.

## 2.6 Druida — nombre provisional: Caminante Salvaje

Guerrero de la naturaleza que alterna entre forma humana, bestial e invocaciones naturales.

Características:

* Puede transformarse.
* Utiliza Instinto.
* Puede invocar lobos, raíces o espíritus.
* Buen equilibrio entre supervivencia y daño.
* Las transformaciones deben modificar estadísticas y habilidades disponibles.

Ramas sugeridas:

1. **Forma Bestial**

   * Transformación.
   * Mordidas.
   * Garras.
   * Regeneración.
   * Furia animal.

2. **Naturaleza Salvaje**

   * Enredaderas.
   * Tormentas.
   * Rocas.
   * Veneno natural.
   * Control del terreno.

3. **Manada Espiritual**

   * Lobos.
   * Cuervos.
   * Tótems.
   * Espíritus protectores.

Builds esperadas:

* Bestia cuerpo a cuerpo.
* Tormentas y control.
* Invocador de manada.

## 2.7 Asesina — nombre provisional: Hoja del Velo

Combatiente rápida especializada en combos, venenos, trampas y golpes críticos.

Características:

* Utiliza Impulso.
* Determinadas habilidades generan puntos de combo.
* Otras habilidades consumen esos puntos.
* Alta movilidad y evasión.
* Menor resistencia al recibir golpes directos.
* Puede colocar trampas automáticas.

Ramas sugeridas:

1. **Artes de la Hoja**

   * Combos.
   * Golpes críticos.
   * Ejecuciones.
   * Ataques desde sombras.

2. **Trampas**

   * Trampas de fuego.
   * Rayos.
   * Cuchillas.
   * Control de zonas.

3. **Venenos**

   * Acumulaciones.
   * Propagación.
   * Reducción de curación.
   * Daño prolongado.

Builds esperadas:

* Combos y críticos.
* Trampas automáticas.
* Venenos acumulables.

# 3. Estadísticas principales

Diseña un sistema claro con estas estadísticas principales:

* Fuerza.
* Destreza.
* Vitalidad.
* Inteligencia.
* Voluntad.

Define exactamente qué aporta cada punto.

Ejemplo conceptual:

* Fuerza: daño físico, requisitos de armadura y armas pesadas.
* Destreza: precisión, evasión, crítico y velocidad con armas ágiles.
* Vitalidad: vida máxima, regeneración y resistencia física.
* Inteligencia: daño mágico, Maná y potencia elemental.
* Voluntad: resistencias, regeneración de recursos y duración de efectos.

También deben existir estadísticas secundarias:

* Vida máxima.
* Regeneración de vida.
* Recurso máximo.
* Regeneración de recurso.
* Armadura.
* Probabilidad de bloqueo.
* Evasión.
* Precisión.
* Daño físico.
* Daño de fuego.
* Daño de hielo.
* Daño eléctrico.
* Daño de veneno.
* Daño oscuro.
* Daño sagrado.
* Probabilidad de crítico.
* Daño crítico.
* Velocidad de ataque.
* Velocidad de lanzamiento.
* Reducción de enfriamiento.
* Robo de vida.
* Robo de recurso.
* Perforación de armadura.
* Penetración elemental.
* Resistencia a cada elemento.
* Duración reducida de controles.
* Probabilidad de encontrar objetos.
* Bonificación de experiencia.

Evita estadísticas redundantes o difíciles de comprender.

# 4. Diseño de habilidades

Cada clase debe tener:

* 3 ramas.
* Entre 8 y 10 habilidades por rama.
* Entre 24 y 30 habilidades totales.
* 1 ataque básico.
* 1 habilidad defensiva.
* 1 habilidad de movilidad cuando corresponda.
* 1 definitiva por rama o una definitiva general.
* Pasivas que cambien el funcionamiento de habilidades.
* Sinergias entre habilidades.
* Mejoras por niveles.
* Costos y enfriamientos coherentes.

Para cada habilidad especifica:

```ts
interface SkillDefinition {
  id: string;
  classId: string;
  branchId: string;
  name: string;
  description: string;
  type: "active" | "passive" | "ultimate";
  tags: string[];
  damageType?: DamageType;
  targetType: TargetType;
  resourceCost?: number;
  cooldownSeconds?: number;
  durationSeconds?: number;
  maxLevel: number;
  unlockLevel: number;
  scaling: SkillScaling;
  effects: SkillEffect[];
  idlePriority?: number;
  idleConditions?: IdleCondition[];
}
```

Cada descripción debe explicar claramente:

* Qué hace.
* Cuánto daño produce.
* De qué estadística escala.
* Cuánto recurso consume.
* Cuánto dura.
* Su enfriamiento.
* Qué estados aplica.
* Qué habilidades la mejoran.
* Cómo se comporta en modo idle.

No uses descripciones ambiguas como “hace mucho daño”. Utiliza fórmulas concretas.

Ejemplo:

```txt
Inflige 140% del daño del arma más 0,8 puntos por cada punto de Fuerza.
Aplica Sangrado durante 5 segundos, causando 20% del daño inicial por segundo.
Coste: 25 de Furia.
Enfriamiento: 6 segundos.
```

# 5. Sistema de daño

Define estos tipos de daño:

* Físico.
* Fuego.
* Hielo.
* Eléctrico.
* Veneno.
* Oscuro.
* Sagrado.

Define además:

* Golpe crítico.
* Daño prolongado.
* Daño reflejado.
* Daño de invocaciones.
* Daño de trampas.
* Daño de entorno.
* Daño verdadero, solamente para casos excepcionales.

Crea fórmulas transparentes para:

* Daño antes de mitigación.
* Reducción por armadura.
* Reducción por resistencias.
* Penetración.
* Crítico.
* Bloqueo.
* Evasión.
* Escalado por nivel.
* Diferencia de nivel entre atacante y objetivo.

Evita fórmulas que permitan alcanzar inmunidad total fácilmente.

# 6. Estados alterados

Diseña estados como:

* Sangrado.
* Quemadura.
* Congelación.
* Escarcha.
* Electrocución.
* Veneno.
* Aturdimiento.
* Derribo.
* Silencio.
* Miedo.
* Lentitud.
* Inmovilización.
* Vulnerabilidad.
* Ruptura de armadura.
* Maldición.
* Marcado.

Para cada estado define:

* Duración.
* Acumulaciones máximas.
* Forma de renovación.
* Resistencia posible.
* Interacción con jefes.
* Interacción con modo idle.
* Inmunidades temporales para evitar control permanente.

# 7. Enemigos

Los enemigos deben estar organizados por:

* Familia.
* Arquetipo.
* Zona.
* Nivel.
* Rareza.
* Tipo de daño.
* Resistencias.
* Comportamiento.
* Tabla de botín.

Familias iniciales sugeridas:

## No-muertos

* Esqueletos guerreros.
* Arqueros óseos.
* Caballeros caídos.
* Sacerdotes espectrales.
* Cadáveres reanimados.
* Apariciones.
* Constructos de hueso.

Características:

* Resistencia al daño oscuro.
* Debilidad variable al daño sagrado y fuego.
* Algunos pueden revivir si no se destruye al invocador.

## Demonios

* Diablillos.
* Brutos infernales.
* Sabuesos de ceniza.
* Tentadores.
* Invocadores.
* Guardianes acorazados.
* Demonios alados.

Características:

* Daño de fuego u oscuro.
* Mayor agresividad.
* Algunos se fortalecen cuando mueren aliados cercanos.

## Bestias corruptas

* Lobos deformes.
* Arañas.
* Osos corrompidos.
* Murciélagos.
* Jabalíes.
* Insectos gigantes.
* Depredadores subterráneos.

Características:

* Velocidad.
* Veneno.
* Sangrado.
* Ataques en manada.

## Cultistas

* Fanáticos.
* Arqueros.
* Sacerdotes.
* Hechiceros.
* Sacrificadores.
* Asesinos.
* Caballeros del culto.

Características:

* Combate coordinado.
* Curaciones.
* Mejoras para aliados.
* Invocaciones.
* Maldiciones.

## Autómatas y guardianes

* Estatuas.
* Gólems.
* Armaduras animadas.
* Centinelas.
* Constructos rúnicos.

Características:

* Mucha armadura.
* Resistencia a sangrado y veneno.
* Debilidad a determinados elementos o ruptura de armadura.

## Entidades del vacío

* Sombras.
* Devoradores.
* Fragmentos vivientes.
* Parásitos dimensionales.
* Horrores sin forma.

Características:

* Daño oscuro.
* Teletransporte.
* Copias.
* Alteración de recursos.
* Mecánicas especiales.

# 8. Arquetipos de combate

Crea enemigos con roles claramente identificables:

* Cuerpo a cuerpo básico.
* Cuerpo a cuerpo pesado.
* Arquero.
* Mago.
* Curador.
* Invocador.
* Tanque.
* Asesino.
* Controlador.
* Explosivo.
* Enjambre.
* Soporte.
* Comandante.

Una formación de enemigos debe poder combinar varios roles.

Ejemplo:

* Un guardián pesado protege.
* Un sacerdote cura.
* Dos arqueros atacan desde atrás.
* Un invocador genera unidades adicionales.

# 9. Rarezas de enemigos

Implementa:

## Normal

* Sin modificadores.
* Habilidades básicas.

## Campeón

* Estadísticas aumentadas.
* Un modificador.
* Recompensa mejorada.

## Élite

* Nombre generado.
* Entre dos y cuatro modificadores.
* Habilidades especiales.
* Mayor posibilidad de objetos raros.

## Minijefe

* Mecánica propia.
* Varias fases simples.
* Recompensa específica.

## Jefe de zona

* Diseño manual.
* Varias fases.
* Ataques claramente anticipados.
* Resistencias adaptadas.
* Tabla de botín única.
* No debe depender únicamente de tener más vida.

Modificadores posibles:

* Ardiente.
* Congelante.
* Tormentoso.
* Venenoso.
* Vampírico.
* Blindado.
* Acelerado.
* Invocador.
* Teletransportador.
* Reflejo parcial.
* Explosivo al morir.
* Aura debilitante.
* Regenerador.
* Enfurecido.
* Duplicador.
* Supresor de recursos.

Incluye reglas para evitar combinaciones injustas.

# 10. Jefes iniciales

Diseña al menos cinco jefes originales, uno por gran zona.

Para cada jefe incluye:

* Nombre.
* Historia breve.
* Apariencia.
* Arena.
* Tipo de daño.
* Resistencias.
* Debilidades.
* Fases.
* Habilidades.
* Señales visuales antes de ataques peligrosos.
* Mecánicas que castiguen builds completamente pasivas.
* Adaptación al modo idle.
* Botín único.
* Material exclusivo.
* Posibilidad de aparición en dificultad superior.

Los jefes no deben ser copias de Andariel, Duriel, Mefisto, Diablo ni Baal.

Ejemplos conceptuales de zonas:

1. Bosque Marchito.
2. Catacumbas del Umbral.
3. Fortaleza de Ceniza.
4. Ciudad Sumergida.
5. La Brecha Oscura.

# 11. Progresión

Diseña una progresión inicial de nivel 1 a 60.

Divide el contenido aproximadamente así:

* Zona 1: niveles 1–10.
* Zona 2: niveles 8–20.
* Zona 3: niveles 18–32.
* Zona 4: niveles 30–45.
* Zona 5: niveles 43–60.
* Endgame: nivel 60.

Debe existir superposición entre zonas para que el jugador pueda elegir dónde avanzar.

Define:

* Vida base de enemigos.
* Daño base.
* Armadura.
* Resistencias.
* Experiencia.
* Oro.
* Rareza del botín.
* Densidad.
* Cantidad de élites.
* Escalado por zona.
* Escalado por dificultad.

# 12. Dificultades

Crea tres dificultades iniciales:

1. **Despertar**

   * Campaña normal.
   * Introducción a las mecánicas.

2. **Pesadilla**

   * Nuevos modificadores.
   * Resistencias más importantes.
   * Mejores objetos.
   * Enemigos más agresivos.

3. **Abismo**

   * Endgame.
   * Combinaciones complejas.
   * Penalizaciones moderadas.
   * Objetos y materiales exclusivos.

No aumentes únicamente la vida y el daño. Cada dificultad debe introducir:

* Nuevos comportamientos.
* Habilidades adicionales.
* Combinaciones distintas.
* Mayor densidad.
* Nuevas variantes.
* Mejor botín.

# 13. Integración con modo idle

El sistema idle debe utilizar las mismas estadísticas y habilidades que el combate activo.

No quiero dos sistemas de combate completamente separados.

Cada habilidad debe poder declarar:

* Prioridad.
* Condición de uso.
* Porcentaje mínimo de recurso.
* Cantidad mínima de enemigos.
* Vida mínima o máxima.
* Uso contra élites.
* Uso contra jefes.
* Conservación de habilidades definitivas.
* Posición ideal.
* Riesgo aceptable.

Ejemplo:

```ts
interface IdleSkillRule {
  skillId: string;
  enabled: boolean;
  priority: number;
  minResourcePercent?: number;
  minEnemyCount?: number;
  useAgainstElite?: boolean;
  useAgainstBoss?: boolean;
  playerHealthBelowPercent?: number;
  targetHealthAbovePercent?: number;
}
```

El resultado del modo idle debe depender de:

* Poder real del personaje.
* Build.
* Resistencias.
* Sustento.
* Control.
* Densidad de enemigos.
* Velocidad de limpieza.
* Riesgo de muerte.
* Eficiencia de recursos.

La simulación offline puede simplificar eventos, pero debe mantener resultados coherentes con el combate real.

# 14. Equipamiento por clase

Define afinidades, no restricciones absolutas.

Ejemplos:

* Quebrantahuesos: hachas, mazas, espadas pesadas.
* Guardiana de la Frontera: arcos, lanzas y jabalinas.
* Heraldo de Ceniza: varas, guadañas y focos.
* Tejedora Arcana: bastones, orbes y grimorios.
* Custodio del Umbral: espada, martillo y escudo.
* Caminante Salvaje: bastones, hachas y tótems.
* Hoja del Velo: dagas, garras y espadas cortas.

El equipo visual del personaje debe continuar dividido en:

* Casco.
* Armadura.
* Guantes.
* Botas.
* Arma.
* Escudo u objeto secundario.

El sistema debe permitir añadir nuevas clases y armas sin modificar grandes bloques de código.

# 15. Arquitectura técnica

Implementa el contenido mediante datos, evitando grandes condicionales como:

```ts
if (classId === "barbarian") {
  // cientos de líneas
}
```

Prefiere:

```ts
const classDefinitions: Record<string, ClassDefinition> = {};
const skillDefinitions: Record<string, SkillDefinition> = {};
const enemyDefinitions: Record<string, EnemyDefinition> = {};
```

Propón interfaces TypeScript para:

* `ClassDefinition`.
* `ClassResourceDefinition`.
* `SkillBranchDefinition`.
* `SkillDefinition`.
* `SkillEffect`.
* `StatusEffectDefinition`.
* `EnemyDefinition`.
* `EnemyAbilityDefinition`.
* `EnemyModifierDefinition`.
* `BossDefinition`.
* `LootTableDefinition`.
* `ZoneDefinition`.
* `DifficultyDefinition`.
* `CombatProfile`.
* `IdleCombatProfile`.

Los identificadores internos deben:

* Estar en inglés.
* Utilizar `camelCase` o `kebab-case` de manera consistente.
* No depender del nombre visible.
* Permitir traducciones futuras.

Los nombres y descripciones visibles deben estar en español y preparados para internacionalización.

# 16. Entregables

Primero genera documentación, sin implementar todo de una vez.

Crea:

```txt
/docs/game-design/classes.md
/docs/game-design/stats.md
/docs/game-design/damage-system.md
/docs/game-design/status-effects.md
/docs/game-design/enemies.md
/docs/game-design/bosses.md
/docs/game-design/progression.md
/docs/game-design/idle-combat.md
```

Además crea:

```txt
/src/game/data/classes/
  bonebreaker.ts
  frontierWarden.ts
  ashHerald.ts
  arcaneWeaver.ts
  thresholdCustodian.ts
  wildwalker.ts
  veilBlade.ts

/src/game/data/enemies/
/src/game/data/bosses/
/src/game/data/zones/
/src/game/data/skills/
/src/game/types/
```

Trabaja por etapas:

## Etapa 1

* Auditar el proyecto.
* Documentar el estado actual.
* Diseñar interfaces.
* Diseñar estadísticas y fórmulas.

## Etapa 2

* Diseñar las siete clases.
* Diseñar sus ramas.
* Crear una tabla resumida de todas las habilidades.
* No implementar todavía animaciones ni efectos visuales.

## Etapa 3

* Diseñar familias de enemigos.
* Diseñar modificadores.
* Diseñar cinco jefes.
* Diseñar progresión por zonas.

## Etapa 4

* Implementar una sola clase completa como vertical slice.
* Implementar enemigos de la primera zona.
* Implementar un élite.
* Implementar el primer jefe.
* Verificar combate activo, idle y offline.

## Etapa 5

* Crear tests.
* Balancear.
* Extender el sistema al resto de las clases.

# 17. Formato de respuesta inicial

Antes de escribir código, responde con:

1. Resumen de lo que ya existe en el proyecto.
2. Problemas arquitectónicos encontrados.
3. Sistemas que pueden reutilizarse.
4. Archivos que propones crear o modificar.
5. Diseño resumido de las siete clases.
6. Tabla de recursos de clase.
7. Fórmulas principales de combate.
8. Plan de implementación por etapas.
9. Riesgos técnicos.
10. Decisiones que deben quedar registradas.

Después crea o actualiza un archivo de planificación siguiendo el formato que ya utilice el repositorio.

No implementes las siete clases simultáneamente. Empieza por diseñar toda la arquitectura y luego crea como vertical slice al **Quebrantahuesos**, los enemigos del **Bosque Marchito** y su primer jefe.

El resultado debe ser escalable, equilibrable mediante datos y compatible con futuras clases, enemigos, objetos, temporadas y contenido endgame.
