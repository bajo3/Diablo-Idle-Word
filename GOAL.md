# GOAL.md — LA BRECHA OSCURA (WEB + MODO AUSENTE + PIPELINE 2D)

> Documento maestro de producto, arquitectura y ejecución para Codex.
>
> Estado inicial: planificación aprobada.
>
> Versión del documento: 1.0 consolidada.
>
> Plataforma objetivo del MVP: navegador de escritorio.
>
> Regla principal: trabajar por pasos, no saltar etapas y marcar con `[x]` únicamente aquello que esté implementado, probado y funcionando.

---

## 0. Instrucciones obligatorias para Codex

Este archivo es la fuente principal de verdad del proyecto.

Antes de modificar código:

1. Leer este archivo completo.
2. Inspeccionar el repositorio y detectar qué existe.
3. Comparar el estado real del código con el checklist.
4. No asumir que una tarea está completa porque exista un archivo.
5. Ejecutar el proyecto, pruebas, lint y verificación de TypeScript.
6. Trabajar únicamente sobre el siguiente paso incompleto, salvo que una corrección previa sea necesaria.
7. Mantener el alcance del MVP y evitar agregar funciones no solicitadas.
8. Actualizar este archivo al terminar cada tarea.

### Cómo actualizar el progreso

- Cambiar `[ ]` por `[x]` solamente cuando la tarea cumpla sus criterios de aceptación.
- Usar `[-]` para una tarea iniciada pero todavía incompleta.
- Usar `[!]` para una tarea bloqueada y explicar el motivo en el registro.
- No borrar tareas.
- No reescribir el alcance sin una decisión explícita.
- Agregar una entrada al **Registro de progreso** después de cada sesión relevante.

### Condición para marcar un paso como terminado

Un paso se considera terminado únicamente cuando:

- La funcionalidad está implementada.
- No hay errores de TypeScript.
- No hay errores relevantes en la consola.
- Las pruebas correspondientes pasan.
- El flujo puede verificarse manualmente.
- La documentación quedó actualizada.
- No se dejaron mocks engañosos presentados como funcionalidad real.

### Prioridades técnicas

1. Corrección.
2. Jugabilidad.
3. Código mantenible.
4. Seguridad y autoridad del servidor.
5. Rendimiento.
6. Apariencia visual.
7. Contenido adicional.

No sacrificar la arquitectura central para crear efectos visuales prematuramente.

---

## 0.1 Pivote de visión (2026-07-30)

La visión original (ARPG cooperativo en tiempo real, sala privada por sesión, 1-4 jugadores) se
reemplaza por: **juego online persistente con sistema de party** (roles que importan
mecánicamente) y **combate semi-automático** (idle por defecto, intervención manual del jugador
para telegrafiar/reaccionar en jefes de raid y misiones difíciles). La resolución de acciones en
grupo es asíncrona por tick de servidor, no sincronizada en tiempo real.

**Por qué**: el motivo explícito del usuario fue evitar el costo más caro de un ARPG online — el
netcode de autoridad de servidor a 20-60 Hz con predicción y reconciliación de cliente — sin perder
la sensación de que la party importa. Con resolución por comandos asíncronos y tick de servidor
(precedente real: el combate por ticks de Old School RuneScape), ese costo desaparece casi por
completo, y el contenido regular puede resolverse como un idle/incremental clásico.

**Qué sobrevive intacto**: todo el núcleo puro de combate/IA construido en los Pasos 7 y 8
(`packages/shared/src/combat.ts`, `enemy-ai.ts`, `enemy-simulation.ts`, `steering.ts`,
`projectiles.ts`, `elites.ts`) — reloj inyectado, RNG seedeado, comandos con id, telégrafos
aviso→resolución. Fue construido con exactamente esta forma en mente ("preparado para que un paso
posterior lo eleve a autoridad de servidor sin reescritura"), y es la pieza que un jefe de raid con
resolución por tick necesita: percepción → decisión → intención → resolución determinista → evento.
Nada de esto se descarta.

**Qué cambia**: el Paso 14 (antes "Multiplayer de combate" en tiempo real dentro de una sala de
sesión) pasa a ser un loop de tick de servidor que resuelve comandos en cola, no un sistema de
snapshots/interpolación/predicción de movimiento en vivo. El Paso 13 (lobby) se generaliza de "sala
por código" a sistema de party sobre un mundo persistente. La sección "14. Multiplayer" más abajo ya
quedó actualizada con esto.

**Qué no cambió**: el modo ausente (Sección 7), el sistema de objetos (Sección 10), el jefe inicial
(Sección 13) y el resto de la arquitectura de datos siguen siendo válidos tal cual — este pivote es
sobre el modelo de sincronización multiplayer y el modo de combate, no sobre el contenido del juego.

---

# 1. Visión del producto

## Nombre provisional

**La Brecha Oscura**

El nombre es provisional y debe poder cambiarse desde una configuración central.

## Definición

**(2026-07-30 — pivote de visión, reemplaza la definición anterior de ARPG cooperativo en tiempo real.
Ver "0. Pivote de visión" para el porqué y la fila de Decisiones registrando el cambio.)**

Juego web 2D de rol con progresión persistente, botín, y un sistema de **party** online (grupo con
roles que importan mecánicamente — tanque, arquero, etc. — para zonas difíciles y jefes de raid).
El personaje vive siempre en el servidor: no hay una versión "offline" separada, hay un espectro
entre jugar activamente y dejar que el personaje progrese solo.

El juego combina dos formas de jugar sobre el mismo personaje online:

### Modo activo (semi-automático)

El personaje combate de forma automática por defecto — se mueve, ataca y usa habilidades básicas
sin que el jugador tenga que apretar nada, como un idle/incremental. El jugador puede intervenir en
cualquier momento activando habilidades manualmente, y **eso es lo que hace falta** en contenido
exigente: un jefe de raid o una misión difícil telegrafía ataques peligrosos, y sin intervención
manual del jugador (y de su party) el grupo no sobrevive. Fuera de ese contenido, mirar sin tocar
nada es una forma válida de jugar.

### Party (grupo)

De 1 a 4 jugadores pueden agruparse. El rol de cada personaje (clase, atributos, habilidades)
importa mecánicamente para la composición — un tanque aguanta y genera amenaza, un arquero pega de
lejos — no es un bonus cosmético. La resolución de acciones en grupo es **asíncrona por tick**: cada
jugador manda su intención (activar una habilidad, moverse) cuando puede, y el servidor la resuelve
en su propio tick de simulación. Ningún jugador necesita estar mirando la pantalla en el mismo
milisegundo que el resto de su party — el modelo de referencia es el combate por ticks de Old School
RuneScape, no un shooter de acción en tiempo real. Esto es una decisión técnica deliberada: evita el
problema más caro de un ARPG online (autoridad de servidor a 20-60 Hz con predicción/reconciliación)
sin sacrificar que la party se sienta real.

### Modo offline o modo ausente

En la interfaz puede llamarse **Modo offline**, pero técnicamente es un sistema de progreso durante la ausencia.

Cuando el jugador quiere cerrar el navegador o apagar la computadora:

1. Presiona **Preparar modo offline**.
2. El juego inicia una calibración de 5 minutos en la zona elegida.
3. Durante esos 5 minutos registra el rendimiento real y válido de la build.
4. Al completar la calibración, el servidor guarda un snapshot del personaje y activa el modo ausente.
5. El jugador puede cerrar el juego o apagar la computadora.
6. Al regresar, el servidor calcula recompensas equivalentes al tiempo transcurrido usando la muestra de 5 minutos.

No se crea un perfil separado y no se juega sin conexión. El personaje, inventario, experiencia y botín son los mismos del modo online. El servidor conserva el estado y calcula el resultado aunque la computadora esté apagada.

## Fantasía principal

El jugador crea una build, consigue armas y armaduras, distribuye atributos, configura habilidades, mejora su personaje y supera regiones cada vez más peligrosas.

## Objetivo general

Cerrar las brechas que están corrompiendo el mundo.

Cada región contiene una brecha principal protegida por un jefe. Para llegar al jefe, el jugador debe completar objetivos dentro de la expedición.

## Primer objetivo jugable

**(2026-07-30 — reescrito: el Bosque pasa de misión finita con jefe a idle RPG infinito por niveles. El
modo semi-automático de la §0.1 es el loop natural de esto: el personaje avanza solo y el jugador
interviene cuando quiere, sin un fin de partida que perseguir. Sin victoria ni derrota por ahora.)**

En el **Bosque Corrupto infinito**, el jugador avanza por niveles (1 a 20 en el alcance inicial),
cada uno más difícil que el anterior:

1. Entrar solo o con un grupo.
2. El personaje combate de forma semi-automática (idle) contra oleadas de enemigos.
3. Derrotar enemigos otorga experiencia, oro y materiales, y acumula progreso de nivel del Bosque.
4. Al sumar suficiente progreso, avanza al siguiente nivel del Bosque, con enemigos más fuertes y
   mayor densidad de spawn.
5. El jugador puede intervenir manualmente (habilidades, posicionamiento) en cualquier momento.
6. No hay condición de victoria ni de derrota terminal por ahora: es un bucle de progresión continua.
7. El jefe (Guardián Corrupto), los altares y la puerta del jefe quedan postergados fuera del MVP de
   este bucle infinito; se reconsideran como contenido de "fin de nivel" o de raid en una fase
   posterior.

---

# 2. Pilares de diseño

## 2.1 Construcción del personaje

El jugador debe poder modificar:

- Clase.
- Atributos.
- Armas.
- Armadura.
- Accesorios.
- Habilidades activas.
- Habilidades pasivas.
- Estrategia para el modo ausente.

## 2.2 Progreso constante

Una sesión corta debe producir algún progreso útil:

- Experiencia.
- Oro.
- Materiales.
- Equipamiento.
- Avance de misión.
- Desbloqueos.
- Mejora de habilidades.

## 2.3 El modo activo debe ser superior

El modo ausente sirve para complementar el progreso, no para reemplazar el juego.

El contenido principal, los jefes, la historia, las habilidades importantes y el mejor botín requieren jugar activamente.

## 2.4 Party sencilla, roles que importan

El sistema de party debe permitir jugar con amigos sin sistemas sociales complejos, pero el rol de
cada clase dentro del grupo tiene que ser una decisión mecánica real, no cosmética.

Para el MVP:

- Invitar/unirse a una party (código o invitación directa).
- Hasta 4 jugadores.
- El rol de clase (tanque, arquero, etc.) afecta atributos y habilidades disponibles, no solo el
  aspecto visual.
- Botín individual.
- Reanimación de compañeros.
- Dificultad escalada.
- Contenido difícil (jefes de raid, misiones exigentes) requiere intervención manual coordinada de
  la party; el resto del contenido puede resolverse en modo semi-automático.

## 2.5 Progreso ausente basado en rendimiento real

El modo offline debe reflejar la build que el jugador realmente logró construir y usar.

Principios:

- La calibración dura exactamente 5 minutos válidos.
- El servidor registra enemigos derrotados, experiencia, oro, materiales, velocidad de limpieza, daño recibido, muertes y eventos de botín.
- La calibración queda vinculada a la zona, dificultad, equipamiento, atributos y habilidades utilizados.
- El tiempo ausente se mide con reloj del servidor.
- El personaje queda ocupado hasta que el jugador regresa y reclama el resultado.
- Cambiar la build o la zona obliga a realizar una nueva calibración.
- El modo activo debe seguir siendo más rentable y ofrecer contenido exclusivo.
- No se duplican literalmente los objetos obtenidos en la muestra.
- El loot ausente se vuelve a generar con las tablas correspondientes, usando el rendimiento medido como base.

El objetivo es que una build que farmea bien durante cinco minutos también farmee bien durante la ausencia, sin permitir duplicaciones ni aprovechar un golpe de suerte aislado.

## 2.6 Alcance controlado

No intentar construir un Diablo completo.

Primero debe existir una experiencia pequeña, completa, repetible y divertida.

---

# 3. Alcance del MVP

## Incluido en el MVP

- Juego web para escritorio.
- Cuenta y personajes persistidos en servidor.
- Detección de desconexión y recuperación de sesión.
- Gráficos 2D con vista superior y profundidad visual simulada.
- Un pueblo pequeño.
- Una región: Bosque Corrupto **infinito por niveles** (alcance inicial: niveles 1 a 20).
- Una sesión activa de progresión continua (idle/semi-automática), sin victoria ni derrota terminal
  por ahora (ver §1 y §0.1).
- Modo offline o ausente basado en una calibración real de 5 minutos.
- Un límite inicial configurable de 8 horas de progreso ausente.
- Un perfil de combate jugable: Guardián. La creación también ofrece siete IDs de clase
  persistentes (Amazona, Asesina, Bárbara, Druida, Nigromante, Paladín y Hechicera) que por ahora
  resuelven al mismo perfil provisional del Guardián.
- Nivel máximo inicial: 10.
- Cuatro atributos principales.
- Ataque básico.
- Tres habilidades activas.
- Una habilidad pasiva.
- Cinco tipos de enemigos.
- Un enemigo élite con modificadores.
- Un jefe con dos fases. _(Postergado fuera del MVP del bucle infinito: sin victoria/derrota por
  ahora; se reconsidera como contenido de fin de nivel o raid en una fase posterior.)_
- Inventario.
- Equipamiento.
- Armas, armaduras y accesorios.
- Objetos comunes, mágicos, raros y legendarios.
- Oro, experiencia y materiales.
- Guardado persistente.
- Multiplayer activo para 1 a 4 jugadores.
- Creación y unión a salas mediante código.
- Reanimación.
- Botín individual.
- Informe de progreso ausente.
- Interfaz responsive para resoluciones de escritorio habituales.
- Spritesheets 2D de cuatro direcciones.
- Máquina de estados de animación.
- Capas sincronizadas para cuerpo, armadura, casco, arma, escudo y efectos.
- Pipeline de assets con manifiesto, licencia y validación.
- Mapas definidos por **datos propios versionados** (no Tiled) — el Bosque infinito se construye de
  forma determinista por código (ver §10.1) y sus capas/objetos se describen en datos tipados.
- Efectos visuales reutilizables.
- Sonidos y música básicos o placeholders con licencia válida.
- Tutorial inicial corto.
- Herramientas internas de desarrollo desactivadas en producción.
- Guardados versionados y migrables.
- Compatibilidad objetivo con Chrome, Edge y Firefox actuales.
- Pruebas unitarias de sistemas críticos.
- Prueba end-to-end del flujo principal.

## Fuera del MVP

- Juego activo sin conexión a internet.
- Sincronización de un guardado local con el servidor.
- MMO.
- Mundo abierto.
- PvP.
- Clanes.
- Comercio entre jugadores.
- Casa de subastas.
- Chat global.
- Chat de voz.
- Aplicación móvil nativa.
- Controles táctiles completos.
- Cinco o más regiones.
- Árboles de habilidades extensos.
- Temporadas.
- Pase de batalla.
- Microtransacciones.
- Blockchain.
- NFTs.
- Generación procedural compleja.
- Mods.
- Editor de mapas.
- Cross-save entre plataformas externas.
- Multiplayer sin conexión.
- Modo ausente cooperativo.
- Personajes mercenarios de otros usuarios.

# 4. Dirección visual

## Perspectiva

Usar una vista **2D top-down con ángulo visual de tres cuartos**, no una cuadrícula isométrica estricta.

Motivos:

- Reduce complejidad de colisiones.
- Facilita el apuntado con mouse.
- Simplifica mapas y navegación.
- Permite reemplazar el arte sin modificar la lógica.
- Hace viable el MVP.

## Estilo

- Fantasía oscura.
- Legibilidad antes que detalle.
- Siluetas claras.
- Efectos visibles pero no excesivos.
- Pixel art moderno o sprites 2D dibujados.
- No copiar assets, interfaces, nombres ni sonidos de Diablo.

## Etapas de arte

### Etapa técnica

- Formas simples.
- Sprites provisionales propios.
- Colores y animaciones básicas.
- Sin dependencia del arte final.

### Etapa visual

- Sprites originales.
- Capas visuales de equipamiento.
- Animaciones de ataque.
- Efectos de habilidades.
- Entornos definitivos.

## Capas visuales del personaje

Preparar la arquitectura para combinar:

- Cuerpo base.
- Casco.
- Pechera.
- Arma.
- Escudo.
- Capa.
- Efecto de aura.

En el MVP, como mínimo, el arma y la armadura equipada deben generar una diferencia visual reconocible.

---


## Pipeline obligatorio de sprites y animaciones

El código debe poder funcionar primero con placeholders y luego reemplazar los gráficos sin reescribir la lógica.

### Contrato de spritesheets del MVP

- Vista de cuatro direcciones: arriba, abajo, izquierda y derecha.
- Se permite espejar derecha para izquierda únicamente en placeholders o assets simétricos.
- El arte final debe admitir metadata para decidir si una animación puede espejarse.
- Tamaño base recomendado para personajes y enemigos comunes: `64x64` píxeles por frame.
- Jefes y criaturas grandes pueden usar `128x128` o múltiplos definidos en datos.
- Todas las capas de un mismo personaje deben compartir:
  - Tamaño de frame.
  - Cantidad de frames.
  - Orden de frames.
  - Punto de origen.
  - Offset.
  - Dirección.
  - Duración de animación.
- El punto de apoyo visual debe estar alineado con los pies.
- La colisión no debe derivarse automáticamente del tamaño completo del sprite.

### Animaciones mínimas del Guardián

- `idle`
- `walk`
- `attack_basic`
- `skill_power_strike`
- `skill_whirlwind`
- `skill_iron_skin`
- `hit`
- `downed`
- `revive`
- `death`
- `interact`

### Animaciones mínimas de enemigos

- `idle`
- `walk`
- `attack`
- `special`
- `hit`
- `stunned`
- `death`

No todos los enemigos necesitan una animación especial diferente, pero deben usar el mismo contrato de estados.

### Convención de nombres

Ejemplos:

```text
guardian_body_idle_down
guardian_body_walk_right
guardian_iron_armor_attack_basic_up
guardian_iron_sword_attack_basic_right
corrupted_minion_walk_down
corrupted_minion_death_left
```

Las rutas físicas no deben usarse como identificadores de dominio.

### Definición de animación dirigida por datos

Cada animación debe describirse mediante datos tipados:

```ts
type AnimationDefinition = {
  id: string;
  atlasId: string;
  state: CharacterAnimationState;
  direction: Direction4;
  startFrame: number;
  endFrame: number;
  frameRate: number;
  repeat: number;
  lockMovement: boolean;
  interruptible: boolean;
  hitFrame?: number;
  eventFrames?: Array<{
    frame: number;
    event: string;
  }>;
};
```

Los eventos de impacto no deben depender de temporizadores visuales dispersos. Deben vincularse a frames o ventanas de combate definidas.

### Máquina de estados visual

Estados mínimos:

```text
idle
moving
attacking
casting
channeling
interacting
stunned
knocked_back
downed
reviving
dead
```

Reglas:

- `dead` tiene prioridad máxima y no puede interrumpirse.
- `downed` bloquea ataques.
- `stunned` bloquea movimiento y habilidades.
- Una habilidad puede definir si permite movimiento.
- No reproducir varias animaciones incompatibles simultáneamente.
- La animación visual refleja el estado validado del juego; no decide por sí misma si un ataque hizo daño.
- La red sincroniza estado, dirección y momentos relevantes, no cada frame individual.

### Capas visuales de equipamiento

Orden recomendado:

1. Sombra.
2. Capa posterior.
3. Cuerpo.
4. Pechera.
5. Botas o guantes visibles.
6. Casco.
7. Arma o escudo posterior.
8. Arma o escudo frontal.
9. Efectos.
10. Nombre, barra y UI contextual.

Cada capa debe seguir la misma animación y dirección.

### Validación automática de sprites

Crear un script de desarrollo que compruebe:

- Archivo existente.
- Dimensiones divisibles por el tamaño de frame.
- Cantidad esperada de frames.
- Animaciones obligatorias.
- Direcciones obligatorias.
- IDs duplicados.
- Capas faltantes.
- Origen y offsets válidos.
- Referencias huérfanas.
- Licencia o procedencia registrada.

El build de producción debe fallar si faltan assets obligatorios del MVP.

## Pipeline general de assets

Estructura sugerida:

```text
apps/web/public/assets/
├─ characters/
├─ enemies/
├─ equipment/
├─ environments/
├─ maps/
├─ effects/
├─ ui/
├─ audio/
│  ├─ music/
│  ├─ ambience/
│  └─ sfx/
└─ fonts/
```

Cada asset debe registrarse en un manifiesto con:

- ID estable.
- Tipo.
- Ruta.
- Versión.
- Dimensiones.
- Frames.
- Animaciones.
- Tamaño aproximado.
- Precarga requerida o carga diferida.
- Fuente.
- Autor.
- Licencia.
- Fecha de incorporación.

No incluir en producción assets sin procedencia o licencia conocida.

## Efectos visuales

Sistemas mínimos:

- Impacto físico.
- Crítico.
- Curación.
- Fuego.
- Hielo.
- Electricidad.
- Buff.
- Debuff.
- Explosión.
- Aura.
- Indicador de zona peligrosa.
- Sombra bajo entidades.
- Sacudida de cámara configurable.

Usar pooling para partículas, proyectiles y efectos repetitivos cuando sea útil.

Los efectos nunca deben ocultar la telegrafía de ataques ni reemplazar la lógica del combate.

## Audio

Separar buses de volumen:

- General.
- Música.
- Ambiente.
- Efectos.
- Interfaz.

Requisitos:

- Precarga solo de sonidos esenciales.
- Carga diferida de música o zonas posteriores.
- Liberar recursos que ya no se utilizan.
- Evitar reproducción duplicada por eventos de red repetidos.
- Permitir silenciar.
- No reproducir audio hasta que exista interacción del usuario si el navegador lo exige.
- Usar audio propio o con licencia válida.


# 5. Bucle principal

## Bucle activo

1. Entrar al pueblo.
2. Revisar personaje e inventario.
3. Equipar objetos.
4. Distribuir puntos.
5. Seleccionar misión.
6. Crear o unirse a una sala.
7. Entrar a la expedición.
8. Combatir.
9. Cumplir objetivos.
10. Derrotar al jefe.
11. Recibir resultados.
12. Volver al pueblo.
13. Vender, equipar o mejorar objetos.
14. Repetir con mayor dificultad.

## Bucle del modo offline o ausente

1. El jugador entra a una zona de farmeo habilitada.
2. Equipa la build que desea utilizar.
3. Presiona **Preparar modo offline**.
4. El servidor inicia una calibración de 5 minutos.
5. El jugador continúa farmeando durante la calibración.
6. El sistema mide rendimiento y valida la muestra.
7. Al terminar, muestra un resumen estimado por hora.
8. El jugador confirma **Activar modo offline**.
9. El servidor guarda snapshot, métricas, semilla y hora de inicio.
10. El jugador cierra el navegador o apaga la computadora.
11. El servidor no simula cada segundo: calcula por tiempo transcurrido al regresar.
12. El usuario vuelve y el modo ausente se detiene.
13. El servidor genera el informe y las recompensas.
14. El jugador reclama una sola vez.
15. El personaje vuelve a estar disponible para jugar.

# 6. Reglas del modo activo

## Controles de escritorio

- `WASD`: movimiento.
- Mouse: dirección de apuntado.
- Clic izquierdo: ataque básico.
- Clic derecho: habilidad principal.
- `Q`: habilidad secundaria.
- `E`: habilidad defensiva o de movilidad.
- `1`: poción de vida.
- `I`: inventario.
- `C`: personaje.
- `Esc`: pausa o menú.
- `F`: interactuar o reanimar.

Los controles deben ser remapeables en una etapa posterior. Para el MVP pueden ser fijos, pero deben estar centralizados.

## Cámara

- Cámara centrada en el jugador local.
- Zoom configurable dentro de límites razonables.
- Suavizado ligero.
- Sacudida breve en impactos fuertes.
- No usar sacudidas constantes.

## Movimiento

- Movimiento en ocho direcciones.
- Normalización diagonal.
- Colisión con obstáculos.
- Velocidad modificable por efectos.
- El servidor valida velocidad, posición y estados imposibles.

## Combate

- Ataque básico con cooldown corto.
- Habilidades con costo y cooldown.
- Daño físico inicial.
- Críticos.
- Armadura.
- Retroceso moderado.
- Estado de aturdimiento en habilidades específicas.
- Números de daño opcionales.
- Indicadores visuales de ataques peligrosos.

## Muerte y reanimación

Cuando un jugador llega a cero de vida:

1. Entra en estado derribado.
2. No puede atacar.
3. Puede desplazarse lentamente o permanecer inmóvil según el balance.
4. Otro jugador puede reanimarlo manteniendo `F`.
5. La reanimación se interrumpe al recibir daño.
6. Si todos los jugadores están derribados o muertos, la expedición fracasa.
7. En solitario, puede existir una resurrección limitada por expedición.

---

# 7. Reglas del modo offline o ausente

## Definición técnica

El botón puede llamarse **Modo offline**, pero no significa que el juego siga ejecutándose en la computadora ni que exista una partida local sin internet.

El servidor almacena una muestra de rendimiento y la hora de inicio. Cuando el usuario regresa, calcula cuánto tiempo transcurrió y genera las recompensas correspondientes.

## Flujo de calibración de 5 minutos

1. El jugador elige zona y dificultad.
2. El personaje debe encontrarse fuera de una misión principal y en una zona habilitada para farm.
3. El jugador presiona **Preparar modo offline**.
4. Se bloquea temporalmente la build utilizada para la muestra.
5. Comienza un contador visible de 5:00.
6. Durante la muestra, el servidor registra únicamente actividad válida.
7. Si el jugador cambia equipamiento, habilidades, zona o dificultad, la calibración se cancela.
8. Si la conexión se corta demasiado tiempo, la muestra se invalida.
9. Al terminar, el servidor valida que haya suficiente actividad.
10. Se muestra una estimación de recompensas por hora.
11. El jugador confirma y puede cerrar el juego.

## Métricas de la muestra

Guardar, como mínimo:

- Duración válida.
- Zona.
- Dificultad.
- ID y versión de la build.
- Snapshot de atributos.
- Snapshot de equipamiento.
- Snapshot de habilidades.
- Enemigos normales derrotados.
- Élites derrotados.
- Experiencia obtenida.
- Oro obtenido.
- Materiales obtenidos.
- Daño infligido.
- Daño recibido.
- Muertes o derribos.
- Tiempo efectivo en combate.
- Objetos soltados por rareza.
- Estadística de búsqueda mágica o equivalente.
- Semilla de cálculo.

## Validación de una muestra

Una calibración solo es válida si:

- Dura 300 segundos válidos.
- El personaje permanece en la misma zona y dificultad.
- La build no cambia.
- Existe una cantidad mínima configurable de enemigos derrotados.
- No contiene recompensas de misión, tutorial, correo, comercio o regalo.
- No incluye recompensas únicas de jefe o de primera victoria.
- No presenta velocidades, daño o eventos imposibles.
- No se detectan largos períodos inactivos dentro de la muestra.

Si la muestra falla, mostrar el motivo y permitir repetirla.

## Inicio del modo ausente

Al confirmar:

- Guardar la hora de inicio usando el reloj del servidor.
- Guardar el snapshot completo de la build.
- Guardar las métricas normalizadas de la muestra.
- Guardar zona, dificultad y tabla de botín aplicable.
- Marcar el personaje como `AWAY_FARMING`.
- Impedir que ese personaje participe en partidas activas hasta detener y reclamar el modo ausente.
- Permitir usar otro personaje de la cuenta si se decide soportarlo.

## Tiempo computable

```text
tiempo_transcurrido = ahora_servidor - inicio_modo_ausente

tiempo_computable = min(tiempo_transcurrido, limite_modo_ausente)
```

Valores iniciales recomendados:

- Tiempo mínimo para obtener recompensa: 10 minutos.
- Límite inicial: 8 horas.
- El límite debe ser configurable desde datos de balance.
- El modo se detiene cuando el jugador vuelve a abrir ese personaje.

## Eficiencia

Para mantener el modo activo como opción superior:

```text
recompensa_ausente = tasa_muestra * minutos_computables * eficiencia_ausente
```

Valor inicial recomendado:

```text
eficiencia_ausente = 0.80
```

Esto significa que el modo ausente produce inicialmente el 80 % del rendimiento válido medido. Debe estar centralizado y ser fácil de ajustar durante el balance.

## Experiencia, oro y materiales

Estas recompensas pueden calcularse desde tasas normalizadas:

```text
experiencia_por_minuto = experiencia_valida_muestra / 5
oro_por_minuto = oro_valido_muestra / 5
materiales_por_minuto = materiales_validos_muestra / 5
```

Aplicar:

- Eficiencia ausente.
- Límite de tiempo.
- Penalización por muertes.
- Límite de rendimiento razonable para la zona.
- Redondeo determinista.

## Generación de loot

No repetir los objetos exactos obtenidos en los cinco minutos.

Ejemplo de abuso que debe evitarse:

> El jugador obtiene un legendario durante la muestra y el sistema lo duplica cada cinco minutos durante ocho horas.

El sistema correcto debe:

1. Usar las muertes por minuto y la composición de enemigos de la muestra.
2. Calcular una cantidad equivalente de oportunidades de drop.
3. Volver a ejecutar las tablas de botín de la zona con una semilla del servidor.
4. Respetar el nivel, dificultad, búsqueda mágica y poder del snapshot.
5. Aplicar límites por rareza.
6. Excluir recompensas únicas, quest items y legendarios exclusivos de jefe.
7. Generar instancias nuevas con IDs únicos.

La muestra puede influir en la cantidad de oportunidades y en la calidad esperada, pero un evento de suerte aislado no debe multiplicarse linealmente.

## Normalización contra suerte extrema

Para impedir muestras manipuladas o excepcionalmente afortunadas:

- Limitar la tasa de oro y experiencia al máximo razonable de la zona.
- Comparar la tasa observada con valores esperados del contenido.
- Aplicar un techo a drops raros por hora.
- No usar literalmente `objetos_obtenidos / 5` para legendarios.
- Exigir varias muestras futuras antes de permitir bonificaciones avanzadas, si fuera necesario.
- Registrar muestras sospechosas para revisión.

## Muerte durante la muestra

Las muertes reducen la eficiencia.

Ejemplo configurable:

```text
factor_supervivencia = max(0.50, 1 - muertes_muestra * 0.10)
```

No permitir que una build incapaz de sobrevivir genere el mismo rendimiento que una build estable.

## Regreso del jugador

Al abrir el personaje:

1. El servidor detiene el modo ausente.
2. Calcula el tiempo computable.
3. Genera un resultado determinista o reproducible.
4. Guarda el resultado sin entregarlo todavía.
5. Muestra el informe.
6. El jugador reclama.
7. Una transacción entrega experiencia, monedas, materiales y objetos.
8. La operación queda marcada como reclamada.
9. El personaje vuelve a estado disponible.

## Informe

Mostrar:

- Tiempo total ausente.
- Tiempo computado.
- Tiempo descartado por superar el límite.
- Zona y dificultad.
- Build utilizada.
- Rendimiento medido en los cinco minutos.
- Eficiencia aplicada.
- Enemigos estimados derrotados.
- Experiencia.
- Oro.
- Materiales.
- Objetos por rareza.
- Penalizaciones.
- Motivo de cualquier reducción.

## Cancelación y retorno temprano

- El jugador puede volver antes del límite.
- Se calcula únicamente el tiempo real transcurrido.
- Si vuelve antes del mínimo, no recibe recompensas o recibe una cantidad mínima según balance.
- No requiere una penalización extra además de la eficiencia general.

## Cambio de build

La muestra queda invalidada para futuras activaciones si cambia cualquiera de estos elementos:

- Arma.
- Armadura relevante.
- Atributos.
- Habilidades equipadas.
- Nivel de habilidad.
- Zona.
- Dificultad.
- Modificadores de farmeo.

Puede guardarse una calibración por combinación de build, zona y dificultad, pero para el MVP es suficiente exigir una calibración nueva.

## Restricciones de contenido

El modo ausente puede entregar:

- Experiencia.
- Oro.
- Materiales.
- Objetos comunes.
- Objetos mágicos.
- Objetos raros dentro de límites.

No debe entregar inicialmente:

- Primer desbloqueo de región.
- Progreso principal de historia.
- Habilidades principales.
- Recompensas únicas.
- Objetos legendarios exclusivos de jefe.
- Victoria sobre el jefe principal.
- Recompensas de primera finalización.

## Autoridad y persistencia

- Usar reloj del servidor.
- Guardar snapshot inmutable.
- Calcular recompensas en servidor.
- No depender de que el navegador permanezca abierto.
- No ejecutar una simulación por segundo durante la ausencia.
- Hacer el reclamo idempotente.
- Proteger contra dos pestañas reclamando simultáneamente.
- Conservar la sesión aunque se reinicie el servidor.
- Registrar la versión de las fórmulas para poder reproducir resultados.

# 8. Clase inicial: Guardián

## Rol

Guerrero cuerpo a cuerpo resistente y simple de aprender.

## Recursos

Para el MVP puede utilizar **Furia**:

- Se genera al atacar y recibir daño.
- Se consume al usar habilidades.
- Disminuye lentamente fuera de combate.

## Atributos principales

### Fuerza

- Aumenta daño físico.
- Permite utilizar equipo pesado.
- Aporta una pequeña cantidad de armadura.

### Destreza

- Aumenta probabilidad crítica.
- Aumenta precisión si se implementa.
- Puede aportar velocidad de ataque en menor escala.

### Inteligencia

- Aumenta resistencia elemental o eficacia de efectos.
- Para el Guardián tiene menor prioridad.
- Debe existir para futuras clases.

### Vitalidad

- Aumenta vida máxima.
- Aumenta recuperación.
- Aporta resistencia a estados.

## Habilidades MVP

### Ataque básico: Tajo

- Ataque frontal corto.
- Genera Furia.
- Puede golpear a más de un enemigo si se encuentran muy cerca.

### Habilidad 1: Golpe poderoso

- Ataque lento.
- Daño alto.
- Empuja.
- Consume Furia.
- Cooldown moderado.

### Habilidad 2: Torbellino

- Daño alrededor del personaje durante un tiempo breve.
- Consume Furia por activación.
- Reduce ligeramente la velocidad mientras está activo.

### Habilidad 3: Piel de hierro

- Reduce daño recibido durante algunos segundos.
- Cooldown alto.
- No debe volver invulnerable al personaje.

### Pasiva: Sed de batalla

- Recupera una pequeña cantidad de vida después de derrotar enemigos.
- Debe tener límites para evitar curación infinita en grupos débiles.

## Builds previstas

- Arma y escudo: defensiva.
- Arma de dos manos: daño alto.
- Dos armas: rápida, posterior al MVP.

---

# 9. Estadísticas y fórmulas iniciales

Todas las fórmulas deben estar centralizadas y ser configurables.

No dispersar números de balance en componentes o escenas.

## Estadísticas derivadas

- Vida máxima.
- Furia máxima.
- Daño mínimo.
- Daño máximo.
- Armadura.
- Probabilidad crítica.
- Daño crítico.
- Velocidad de ataque.
- Velocidad de movimiento.
- Reducción de cooldown.
- Resistencia al fuego.
- Resistencia al hielo.
- Resistencia eléctrica.
- Poder de objeto.
- Poder total estimado.

## Reglas iniciales

- La probabilidad crítica debe tener un límite.
- La reducción de cooldown debe tener un límite.
- Las resistencias deben tener un límite.
- La armadura debe usar una fórmula con retornos decrecientes.
- El daño final nunca puede ser negativo.
- Los cálculos críticos deben ejecutarse o validarse en el servidor.

## Fórmulas provisionales

Estas fórmulas son puntos de partida, no reglas definitivas.

```text
vida_maxima = vida_base + vitalidad * vida_por_punto + vida_equipo

daño_fisico = daño_arma + fuerza * escala_fuerza + bonificaciones

probabilidad_critica =
  limitar(critico_base + destreza * escala_destreza + critico_equipo, 0, limite_critico)

daño_critico =
  daño_normal * multiplicador_critico

mitigacion_armadura =
  armadura / (armadura + constante_por_nivel)

daño_recibido =
  daño_entrante * (1 - mitigacion_armadura)
```

Crear pruebas unitarias para límites, redondeos y casos extremos.

---

# 10. Sistema de objetos

## Espacios de equipamiento

- Casco.
- Pechera.
- Guantes.
- Botas.
- Arma principal.
- Mano secundaria o escudo.
- Amuleto.
- Anillo 1.
- Anillo 2.

Para el primer vertical slice pueden implementarse primero:

- Arma.
- Pechera.
- Casco.
- Escudo.

## Rarezas

### Común

- Estadísticas base.
- Sin afijos o con una modificación mínima.

### Mágico

- Uno o dos afijos.

### Raro

- Más afijos.
- Valores superiores.

### Legendario

- Afijo especial que altera una habilidad o comportamiento.
- Muy limitado durante el MVP.

## Propiedades de un objeto

- ID de instancia.
- ID de definición.
- Nombre.
- Tipo.
- Rareza.
- Nivel requerido.
- Poder de objeto.
- Daño o armadura base.
- Afijos.
- Valor de venta.
- Estado de equipado.
- Vinculación al personaje si corresponde.
- Apariencia visual.
- Fecha de creación.
- Fuente de obtención.

## Generación

La generación debe ser dirigida por datos:

- Tablas de botín.
- Rangos de nivel.
- Pesos de rareza.
- Pools de afijos.
- Restricciones por tipo de objeto.
- Semilla opcional para reproducibilidad.

No generar objetos enteramente desde componentes del cliente.

## Inventario

- Cuadrícula o lista simple.
- Capacidad limitada.
- Equipar.
- Desequipar.
- Comparar.
- Vender.
- Marcar como favorito.
- Evitar vender favoritos.
- Filtros básicos.
- Información clara de cambios de estadísticas.

---


# 10.1. Mapas y niveles

**(2026-07-30 — decisión: el Bosque infinito se define por datos propios, no por Tiled.)** El Bosque
Corrupto infinito se construye de forma determinista por código (ya hoy `environment.ts` pinta
suelo, árboles, obstáculos y esporas seed-based), y sus capas, objetos y escalado por nivel se
describen en **datos propios tipados y versionados** (ver `GAME_DATA.endlessForest`). Tiled queda
como una alternativa posible para una fase posterior, pero **no es una dependencia del MVP**.

Usar **Tiled Map Editor** o un formato de mapa equivalente basado en datos. _(Original; la decisión
de arriba reemplaza Tiled por datos propios para el Bosque infinito.)_

### Capas mínimas de un mapa

- Suelo.
- Decoración inferior.
- Colisiones.
- Objetos interactivos.
- Obstáculos.
- Decoración superior.
- Zonas de aparición.
- Zonas de cámara.
- Altares.
- Puertas.
- Portal.
- Arena del jefe.
- Puntos de control.
- Sonido ambiental.
- Minimap o datos necesarios para generarlo.

### Propiedades de objetos de Tiled

No depender de nombres libres. Definir propiedades y esquemas validados:

```text
entityType
definitionId
spawnGroup
interactionId
objectiveId
collisionType
zIndex
serverRelevant
```

El servidor no debe confiar ciegamente en un archivo de mapa enviado por el cliente. Las definiciones relevantes para combate y objetivos deben existir o validarse también en el servidor.

### Sistema común de interacción

Usar una interfaz reutilizable para:

- Cofres.
- Altares.
- Portales.
- NPC.
- Objetos en el suelo.
- Reanimaciones.
- Puertas.
- Comerciantes.
- Elementos de misión.

Cada interacción debe definir:

- Distancia máxima.
- Duración.
- Estado permitido.
- Si se interrumpe al recibir daño.
- Autoridad local o del servidor.
- Resultado.
- Texto de interfaz.
- Cooldown si corresponde.


# 11. Enemigos del Bosque Corrupto

## 11.1 Esbirro corrupto

- Cuerpo a cuerpo.
- Fácil.
- Persigue al jugador.
- Ataque frontal.

## 11.2 Arquero poseído

- A distancia.
- Mantiene separación.
- Dispara proyectiles visibles.
- Reposiciona si el jugador se acerca.

## 11.3 Chamán oscuro

- Prioridad táctica.
- Cura o potencia aliados.
- Lanza un proyectil lento.
- Debe tener señales visuales claras.

## 11.4 Bruto de raíces

- Mucha vida.
- Ataques lentos.
- Golpe de área.
- Puede aturdir.

## 11.5 Bestia inestable

- Rápida.
- Persigue.
- Explota al morir o al acercarse.
- La explosión debe anunciarse visualmente.

## Estados mínimos de IA

- Inactivo.
- Patrulla.
- Detecta.
- Persigue.
- Ataca.
- Usa habilidad.
- Retrocede.
- Aturdido.
- Muere.

La IA debe ser una máquina de estados clara y testeable.

---

# 12. Élites

Un enemigo élite es una versión reforzada con modificadores.

## Modificadores iniciales

- Veloz.
- Congelante.
- Vampírico.
- Explosivo.
- Resistente.

Para el MVP, implementar al menos dos.

## Reglas

- No combinar modificadores incompatibles.
- Mostrar el nombre del élite.
- Mostrar sus modificadores.
- Mejorar recompensas.
- Evitar combinaciones imposibles o injustas.

---

# 13. Jefe inicial: Guardián Corrupto

## Contexto

Antiguo protector del bosque consumido por la brecha.

## Arena

- Espacio cerrado.
- Obstáculos simples.
- Límites claros.
- Zona central para ataques de área.
- Sin elementos visuales que oculten peligros.

## Fase 1

- Ataque cuerpo a cuerpo.
- Embestida anunciada.
- Golpe contra el suelo.
- Pausas claras entre ataques.

## Fase 2

Se activa al llegar a un porcentaje configurable de vida.

- Invoca esbirros.
- Crea zonas corruptas.
- Aumenta frecuencia de ataque.
- Mantiene ventanas de daño razonables.

## Reglas de diseño

- Todo ataque fuerte debe anunciarse.
- No usar daño inevitable.
- La dificultad debe escalar con jugadores.
- El jefe no debe convertirse únicamente en una esponja de vida.
- La muerte debe enseñar algo al jugador.

---

# 14. Multiplayer

**(2026-07-30 — sección reescrita por el pivote de visión de la 0.1: de "sala de sesión en tiempo
real" a "party sobre resolución por tick asíncrono". El escalado por jugadores y el botín individual
de más abajo no cambiaron.)**

## Alcance

- 1 a 4 jugadores por party.
- El rol de clase importa mecánicamente en la composición (tanque/arquero/etc.), no solo
  cosméticamente.
- Sin matchmaking público en el MVP.
- Sin chat global.

## Flujo

1. El jugador forma o se une a una party (código o invitación directa).
2. La party entra junta a una zona o misión.
3. Cada jugador manda sus intenciones (moverse, activar habilidad) cuando puede — no hace falta que
   todos estén conectados en el mismo instante para que el servidor siga resolviendo la simulación.
4. El servidor resuelve cada intención en su propio tick, contra el estado autoritativo de esa
   instancia.
5. Al terminar, todos ven resultados individuales y grupales.

## Servidor autoritativo

El servidor controla o valida:

- Estado de la party y de la instancia.
- Vida, daño, cooldowns, recursos (vía el núcleo determinista de `packages/shared`).
- Botín, eliminaciones, reanimaciones, objetivos, resultado, recompensas.

El cliente envía intenciones con id (`executionId`), igual que el modo activo local: activación de
habilidad, movimiento, interacción, reanimación. El servidor las valida contra su propio tick, no
contra el reloj del cliente.

## Sincronización — resolución por tick, no tiempo real

- Tick del servidor configurable (el punto de partida es varias veces por segundo, no 20-60 Hz;
  se ajusta en balance, no es una decisión de esta sección).
- Cada comando de un jugador se aplica en el tick en que el servidor lo recibe, contra el estado de
  ese tick — no hace falta que dos jugadores actúen en el mismo instante para que ambos comandos se
  resuelvan correctamente uno tras otro.
- Sin predicción de movimiento en tiempo real ni interpolación cliente-a-cliente: cada cliente
  muestra el último estado que el servidor confirmó. Esto es aceptable porque el modelo de
  referencia es un combate por ticks (tipo Old School RuneScape), no un juego de acción con
  reflejos de milisegundo.
- No enviar el estado completo si no cambió.
- Separar estado persistente del estado de la instancia activa.

## Desconexiones

- Tolerar desconexión breve — al ser resolución por tick asíncrona, un jugador desconectado no
  bloquea el tick de los demás.
- Mantener un período de reconexión configurable.
- Si no reconecta, eliminar o convertir el personaje en estado seguro.
- Transferir anfitrión en el lobby de party.
- Durante la instancia, la party no depende del anfitrión.
- Limpiar instancias vacías.

## Escalado por cantidad de jugadores

Punto de partida:

```text
vida_enemigo = vida_base * (1 + 0.65 * (jugadores - 1))
daño_enemigo = daño_base * (1 + 0.15 * (jugadores - 1))
```

Las fórmulas deben ser configurables y revisadas durante balance.

## Botín

- Botín individual.
- Un jugador no puede tomar el objeto de otro.
- El servidor genera y asigna recompensas.
- Los drops visuales pueden ser privados para cada usuario.

---

# 15. Pueblo

## Funciones

- Ver personaje.
- Gestionar inventario.
- Equipar objetos.
- Distribuir atributos.
- Seleccionar habilidades.
- Iniciar expedición activa.
- Crear o unirse a sala.
- Iniciar sesión de modo ausente.
- Reclamar sesión de modo ausente.
- Comprar y vender.
- Acceder al cofre personal.

## NPC iniciales

### Herrero

- Compra y vende equipo.
- Más adelante mejora objetos.

### Exploradora

- Selección de expediciones.
- Explica regiones y objetivos.

### Guardián del portal

- Inicia misiones activas.
- Gestiona sala de grupo.

## Implementación MVP

El pueblo puede comenzar como una interfaz navegable simple o una escena pequeña.

No dedicar demasiado tiempo a decorarlo antes de terminar el combate.

---

# 16. Progresión

## Niveles

- Nivel inicial: 1.
- Nivel máximo MVP: 10.
- Curva de experiencia configurable.
- Subir de nivel restaura parcialmente recursos.
- Cada nivel entrega puntos.

## Recompensas por nivel

Punto de partida:

- 3 puntos de atributo.
- 1 punto de habilidad cada ciertos niveles o por hitos.
- Desbloqueos de equipamiento por nivel.

## Dificultades

### Normal

Disponible desde el inicio.

### Veterano

Se desbloquea al derrotar al jefe.

### Pesadilla

Posterior al MVP o contenido de extensión.

## Progreso de cuenta y personaje

Separar:

### Cuenta

- Preferencias.
- Ajustes.
- Personajes.
- Desbloqueos globales futuros.

### Personaje

- Clase.
- Nivel.
- Experiencia.
- Atributos.
- Inventario.
- Equipamiento.
- Habilidades.
- Oro.
- Materiales.
- Misiones.
- Estado idle.

---

# 17. Economía

## Monedas iniciales

### Oro

- Comprar.
- Vender.
- Reparaciones si se implementan.
- Mejoras posteriores.

### Materiales

- Recompensa de enemigos y modo ausente.
- Usados más adelante para fabricación.

## Reglas

- No introducir inflación descontrolada.
- Registrar fuentes y sumideros.
- No confiar en cantidades enviadas por el cliente.
- Toda modificación de moneda ocurre en el servidor.
- Las transacciones críticas deben ser atómicas.
- Las recompensas del modo ausente deben tener límites por zona, dificultad y tiempo.
- El cálculo debe registrar la versión de balance utilizada.
- Las recompensas se entregan una sola vez mediante una operación idempotente.

# 18. Arquitectura técnica

## Stack recomendado

### Monorepo

- `pnpm` workspaces.
- TypeScript estricto.
- Configuración compartida.
- Scripts raíz para desarrollo, pruebas, lint y build.

### Cliente web

- React.
- Vite.
- TypeScript.
- Phaser 3.
- Gestión de estado ligera.
- Cliente de red compatible con el servidor multiplayer.
- CSS Modules, Tailwind o una solución simple y consistente.
- Recuperación clara ante pérdida de conexión.

No mezclar múltiples sistemas de estilo sin necesidad.

### Servidor

- Node.js.
- TypeScript.
- Fastify o Express.
- Colyseus para salas y sincronización de juego, salvo que el repositorio ya tenga una base sólida con Socket.IO.
- Validación de datos con Zod.
- Logs estructurados.
- Servicio de progreso ausente.
- Reloj y cálculo autoritativos.

### Persistencia

- PostgreSQL.
- Prisma ORM.
- Migraciones versionadas.
- Transacciones para recompensas y economía.
- Persistencia de calibraciones, snapshots, sesiones ausentes y resultados.

### Modo ausente

- No mantener una instancia de combate funcionando mientras el usuario está fuera.
- Guardar métricas agregadas de 5 minutos.
- Guardar snapshot de build.
- Calcular al regreso mediante tiempo del servidor.
- Usar tablas de botín y semilla del servidor.
- Versionar las fórmulas de cálculo.
- Hacer inicio, finalización y reclamación idempotentes.

### Pruebas

- Vitest para unidades.
- Pruebas de integración del servidor.
- Playwright para flujos principales.
- Pruebas de calibración de 5 minutos con reloj simulado.
- Pruebas de cálculo de progreso ausente.
- Pruebas de loot estadístico.
- Pruebas de reclamo concurrente.
- Pruebas de fórmulas de combate y botín.

### Desarrollo local

- Docker Compose para PostgreSQL.
- Variables de entorno documentadas.
- Semillas de datos.
- Un comando raíz para levantar todo.

## Regla de versiones

Usar versiones estables y compatibles.

Fijar versiones mediante lockfile.

No actualizar dependencias mayores sin revisar migraciones y pruebas.


## Guardado versionado y migraciones

Todo dato persistido debe incluir una versión de esquema.

Requisitos:

- Migraciones de base de datos versionadas.
- Versión de personaje.
- Versión de inventario.
- Versión de snapshot de modo ausente.
- Migración de datos antiguos cuando cambien las definiciones.
- Backups antes de migraciones destructivas.
- Recuperación segura ante datos parciales.
- No borrar silenciosamente objetos que ya no existen; convertirlos o enviarlos a revisión.
- Guardado automático en eventos relevantes, no en cada frame.
- Bloqueo o control optimista para escrituras simultáneas.

## Semillas y reproducibilidad

Usar semillas para:

- Generación de loot.
- Variantes de enemigos.
- Simulación del modo ausente.
- Pruebas.
- Reproducción de bugs.

Un resultado importante debe poder investigarse con:

- ID de sesión.
- Semilla.
- Versión de balance.
- Versión de datos.
- Build fingerprint.
- Zona y dificultad.

## Registro de eventos

Registrar sin almacenar cada movimiento:

- Inicio y final de expedición activa.
- Inicio, validación y activación de calibración.
- Inicio y fin de modo ausente.
- Reclamación.
- Muerte.
- Reanimación.
- Jefe derrotado.
- Objeto raro o legendario obtenido.
- Venta o destrucción de objeto.
- Cambio de equipamiento.
- Cambio de atributos.
- Error de economía.
- Intento inválido relevante.

Evitar guardar datos sensibles o logs excesivos.

## Herramientas internas de desarrollo

Crear un panel disponible únicamente en desarrollo y entornos autorizados.

Funciones recomendadas:

- Invulnerabilidad.
- Añadir oro y materiales.
- Subir o bajar nivel.
- Generar objetos por ID y rareza.
- Teletransportar.
- Mostrar hitboxes.
- Mostrar grid o navegación.
- Invocar enemigos.
- Invocar élite.
- Iniciar jefe.
- Completar altares.
- Vaciar inventario.
- Simular latencia.
- Forzar desconexión.
- Simular 30 minutos, 2 horas, 4 horas y 8 horas ausente.
- Mostrar FPS, ping, tick y entidades.
- Pausar IA.
- Cambiar velocidad de simulación.

Reglas:

- Desactivadas en producción.
- Protegidas también en el servidor.
- Nunca habilitadas únicamente por una variable manipulable desde el navegador.
- Las acciones deben quedar registradas en desarrollo.

## Balance centralizado

Todos los números ajustables deben residir en `game-data` o configuración versionada:

- Vida.
- Daño.
- Cooldowns.
- Costos.
- Velocidades.
- Experiencia.
- Escalado.
- Tablas de botín.
- Pesos de rareza.
- Afijos.
- Poder recomendado.
- Eficiencia del modo ausente.
- Límites de horas.
- Límites de objetos.
- Multiplicadores multiplayer.

Cada resultado debe registrar la versión de balance utilizada.


# 19. Estructura propuesta del repositorio

```text
/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ game/
│  │  │  │  ├─ scenes/
│  │  │  │  ├─ entities/
│  │  │  │  ├─ systems/
│  │  │  │  ├─ animation/
│  │  │  │  ├─ rendering/
│  │  │  │  ├─ effects/
│  │  │  │  ├─ audio/
│  │  │  │  ├─ maps/
│  │  │  │  ├─ input/
│  │  │  │  └─ networking/
│  │  │  ├─ features/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ characters/
│  │  │  │  ├─ inventory/
│  │  │  │  ├─ equipment/
│  │  │  │  ├─ lobby/
│  │  │  │  ├─ away-mode/
│  │  │  │  └─ results/
│  │  │  ├─ components/
│  │  │  └─ styles/
│  │  └─ tests/
│  │
│  └─ server/
│     ├─ src/
│     │  ├─ api/
│     │  ├─ auth/
│     │  ├─ characters/
│     │  ├─ game/
│     │  │  ├─ rooms/
│     │  │  ├─ simulation/
│     │  │  ├─ combat/
│     │  │  ├─ enemies/
│     │  │  ├─ loot/
│     │  │  └─ objectives/
│     │  ├─ away-mode/
│     │  │  ├─ calibration/
│     │  │  ├─ normalization/
│     │  │  ├─ rewards/
│     │  │  └─ claims/
│     │  ├─ economy/
│     │  ├─ persistence/
│     │  ├─ validation/
│     │  └─ observability/
│     └─ tests/
│
├─ packages/
│  ├─ shared/
│  │  ├─ src/types/
│  │  ├─ src/events/
│  │  ├─ src/schemas/
│  │  └─ src/constants/
│  │
│  ├─ game-data/
│  │  ├─ src/classes/
│  │  ├─ src/skills/
│  │  ├─ src/items/
│  │  ├─ src/enemies/
│  │  ├─ src/zones/
│  │  ├─ src/loot/
│  │  └─ src/balance/
│  │
│  ├─ config/
│  └─ test-utils/
│
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
│  └─ seed.ts
│
├─ docs/
│  ├─ architecture.md
│  ├─ networking.md
│  ├─ game-design.md
│  ├─ away-mode.md
│  └─ testing.md
│
├─ docker-compose.yml
├─ .env.example
├─ package.json
├─ pnpm-workspace.yaml
├─ README.md
└─ GOAL.md
```

La estructura puede adaptarse, pero debe conservar separación entre:

- UI.
- Renderizado.
- Simulación.
- Red.
- Datos de juego.
- Persistencia.
- Calibración y cálculo del modo ausente.
- Sistemas compartidos.

# 20. Modelos principales

## Usuario

- ID.
- Email o identificador.
- Nombre visible.
- Hash de contraseña si existe autenticación propia.
- Fechas.
- Preferencias.

## Personaje

- ID.
- Usuario.
- Nombre.
- Clase.
- Nivel.
- Experiencia.
- Atributos base.
- Oro.
- Materiales.
- Estado.
- Última conexión.

Estados relevantes:

- `AVAILABLE`.
- `IN_ACTIVE_RUN`.
- `AWAY_CALIBRATING`.
- `AWAY_FARMING`.
- `AWAY_REWARD_PENDING`.

## Objeto de inventario

- ID de instancia.
- Personaje.
- Definición.
- Rareza.
- Poder.
- Afijos.
- Equipado.
- Favorito.
- Datos de generación.

## Habilidad del personaje

- Habilidad.
- Nivel.
- Desbloqueada.
- Equipada.
- Posición en barra.

## Misión

- Definición.
- Estado.
- Progreso.
- Dificultad.
- Recompensas reclamadas.

## Calibración de modo ausente

- ID.
- Personaje.
- Zona.
- Dificultad.
- Inicio.
- Final.
- Duración válida.
- Snapshot de build.
- Versión de build.
- Métricas agregadas.
- Tasas normalizadas.
- Motivo de invalidez si corresponde.
- Versión de fórmulas.
- Fecha de creación.

## Sesión de modo ausente

- ID.
- Personaje.
- Calibración utilizada.
- Hora de inicio del servidor.
- Hora de finalización.
- Límite máximo.
- Snapshot inmutable.
- Zona.
- Dificultad.
- Semilla.
- Estado.
- Resultado.
- Fecha de reclamación.
- Clave de idempotencia.

## Resultado ausente

- Tiempo real.
- Tiempo computable.
- Eficiencia.
- Penalizaciones.
- Experiencia.
- Oro.
- Materiales.
- Objetos generados.
- Métricas estimadas.
- Versión de balance.
- Estado de reclamación.

## Sesión activa

No persistir cada tick en PostgreSQL.

Persistir:

- Identificador.
- Jugadores.
- Misión.
- Resultado final.
- Recompensas.
- Eventos relevantes para auditoría.

# 21. Seguridad y anti-trampas

## Reglas generales

- Nunca aceptar daño calculado por el cliente.
- Nunca aceptar recompensas calculadas por el cliente.
- Nunca aceptar cambios de inventario sin validación.
- Nunca confiar en el reloj del cliente.
- Validar payloads.
- Limitar frecuencia de eventos.
- Autenticar conexiones multiplayer.
- Invalidar sesiones expiradas.
- Evitar duplicación de recompensas.
- Usar transacciones.
- Registrar acciones económicas importantes.

## Calibración del modo ausente

- Medir eventos en servidor.
- Validar que la muestra dure 300 segundos válidos.
- Excluir recompensas externas al combate.
- Invalidar cambios de build, zona o dificultad.
- Detectar tasas imposibles.
- Aplicar máximos razonables por zona.
- Registrar versión del cliente y del balance.
- No aceptar un resumen de métricas enviado por el cliente como fuente de verdad.

## Cálculo durante la ausencia

- Usar reloj del servidor.
- Guardar snapshot inmutable.
- No depender de procesos activos en la PC del usuario.
- No duplicar objetos exactos de la muestra.
- Generar loot con semillas del servidor.
- Excluir recompensas únicas.
- Aplicar límite horario.
- Mantener una sola sesión ausente activa por personaje.

## Reclamación

- Una sola reclamación.
- Operación idempotente.
- Bloqueo transaccional.
- Prueba de múltiples reclamos simultáneos.
- No permitir que dos pestañas reclamen dos veces.
- Persistir el resultado antes de mostrarlo.

## Multiplayer

- Validar velocidad.
- Validar cooldowns.
- Validar distancia de interacción.
- Validar estado del personaje.
- Descartar mensajes fuera de orden cuando corresponda.
- Rate limit por tipo de evento.

# 22. Rendimiento

## Objetivos iniciales

- 60 FPS en cliente en una computadora media.
- Simulación estable del servidor.
- Sin fugas de memoria evidentes al repetir expediciones.
- Pooling de proyectiles y efectos cuando sea necesario.
- No crear objetos por frame sin control.
- Carga de assets por escena.
- Limitar partículas.
- Culling de entidades fuera de cámara si aporta valor.

## Presupuestos iniciales de rendimiento

Los valores son objetivos configurables para el MVP, no límites eternos:

- 60 FPS objetivo.
- 30 FPS mínimo aceptable en hardware objetivo.
- Hasta 60 enemigos comunes activos por instancia.
- Hasta 120 proyectiles activos.
- Hasta 250 efectos o partículas activas visibles.
- Hasta 80 objetos en el suelo por jugador antes de compactar o limpiar.
- Hasta 24 sonidos simultáneos relevantes.
- Hasta 4 jugadores.
- Hasta 1 jefe y 20 invocaciones durante el encuentro.
- Assets iniciales esenciales por debajo de un presupuesto definido durante el Paso 1.
- Carga diferida de assets no requeridos por la escena actual.

Crear métricas visibles en herramientas de desarrollo.

## Networking

- No enviar más datos de los necesarios.
- Diferenciar estado frecuente y eventos discretos.
- Comprimir o simplificar snapshots si se vuelve necesario.
- Medir antes de optimizar.

---

# 23. Accesibilidad y experiencia

- Escala de interfaz.
- Volumen separado para música y efectos.
- Desactivar sacudida de cámara.
- Alternativa a destellos fuertes.
- Texto legible.
- Contraste suficiente.
- No depender únicamente del color.
- Indicadores de cooldown.
- Telegrafía de ataques.
- Confirmación antes de vender objetos raros o favoritos.

---


## Compatibilidad web

Objetivo de soporte:

- Versiones actuales de Chrome.
- Versiones actuales de Edge.
- Versiones actuales de Firefox.

Safari puede probarse, pero no bloquea el primer MVP salvo decisión posterior.

Requisitos:

- Canvas adaptable a diferentes resoluciones.
- Escalado de UI independiente del zoom del juego.
- Pantalla completa opcional.
- Precarga progresiva.
- Pantalla de carga con progreso real.
- Compresión de imágenes y audio.
- Gestión de pérdida de foco.
- En solitario, pausar o reducir simulación al ocultar la pestaña.
- En multiplayer, el servidor continúa y el cliente muestra estado al regresar.
- Reconexión tras suspensión o cambio de red.
- Evitar que el menú contextual interfiera dentro del área del juego.
- No bloquear atajos fuera del canvas.
- Detectar WebGL o capacidades insuficientes y mostrar un error comprensible.
- No depender de APIs experimentales sin fallback.


# 24. Pantallas y flujos

## Inicio

- Logo.
- Jugar.
- Ajustes.
- Créditos.
- Estado del servidor.

## Autenticación

- Registro.
- Inicio de sesión.
- Recuperación básica o estrategia documentada.
- Sesión segura.

## Selección de personaje

- Lista.
- Crear.
- Eliminar con confirmación.
- Ver clase, nivel y poder.
- Mostrar si está disponible, calibrando o en modo ausente.

## Pueblo

- Personaje.
- Inventario.
- Habilidades.
- Expedición activa.
- Preparar modo offline.
- Reclamar progreso offline.
- Comerciante.
- Ajustes.

## Lobby

- Código.
- Jugadores.
- Estado listo.
- Misión.
- Dificultad.
- Botón iniciar.

## HUD activo

- Vida.
- Furia.
- Habilidades.
- Cooldowns.
- Poción.
- Objetivo.
- Minijefe o jefe.
- Compañeros.
- Ping o estado de conexión.

## Calibración de 5 minutos

- Zona y dificultad.
- Build bloqueada.
- Contador de 5:00.
- Enemigos derrotados.
- Experiencia y oro válidos.
- Indicador de actividad válida.
- Motivo de invalidación.
- Botón cancelar.

## Confirmación del modo offline

- Resumen de la muestra.
- Estimación por hora.
- Eficiencia aplicada.
- Límite máximo.
- Recompensas excluidas.
- Botón **Activar modo offline**.

## Personaje ausente

- Hora de inicio.
- Tiempo transcurrido.
- Tiempo máximo computable.
- Zona.
- Build utilizada.
- Botón **Volver y calcular**.

## Resultados activos

- Victoria o derrota.
- Tiempo.
- Enemigos.
- Objetivos.
- Experiencia.
- Oro.
- Objetos.
- Botón volver.

## Informe del modo offline

- Tiempo ausente.
- Tiempo computado.
- Eficiencia.
- Penalizaciones.
- Enemigos estimados.
- Experiencia.
- Oro.
- Materiales.
- Objetos por rareza.
- Botón reclamar.


## Tutorial inicial

El tutorial debe ser corto, saltable después de la primera finalización y repetible desde ajustes.

Secuencia:

1. Moverse.
2. Apuntar.
3. Ejecutar ataque básico.
4. Usar una habilidad.
5. Recibir o evitar un ataque anunciado.
6. Recoger un objeto.
7. Abrir inventario.
8. Equipar el objeto.
9. Gastar un punto de atributo de prueba.
10. Interactuar con un altar.
11. Regresar al pueblo.
12. Explicar cómo preparar el modo ausente.

Reglas:

- No usar paredes de texto.
- Detectar acciones reales.
- Guardar progreso.
- No entregar recompensas explotables al repetir.
- Permitir omitirlo.
- No exigir multiplayer.


# 25. Datos y contenido

Todo el contenido debe definirse mediante datos siempre que sea razonable.

También deben definirse mediante datos:

- Manifiestos de assets.
- Animaciones.
- Direcciones.
- Capas visuales.
- Eventos de frames.
- Sonidos asociados.
- Efectos visuales asociados.
- Mapas y propiedades validadas.
- Tutoriales.
- Presupuestos de rendimiento.
- Versiones de balance.

Ejemplos:

- Clases.
- Habilidades.
- Enemigos.
- Objetos.
- Afijos.
- Tablas de botín.
- Zonas.
- Misiones.
- Dificultades.
- Fórmulas.
- Textos.
- Nombres.

Evitar condicionales gigantes como:

```ts
if (itemName === "Espada X") {
  // comportamiento especial
}
```

Preferir identificadores, definiciones tipadas y sistemas extensibles.

---

# 26. Estrategia de pruebas

## Unitarias

- Máquina de estados de animación.
- Prioridades e interrupciones de animación.
- Validación de manifiestos de assets.
- Validación de frames y capas.
- Fórmulas de daño.
- Mitigación.
- Críticos.
- Cooldowns.
- Generación de botín.
- Restricciones de afijos.
- Experiencia.
- Escalado multiplayer.
- Normalización de métricas de 5 minutos.
- Eficiencia del modo ausente.
- Límites por zona.
- Penalización por muerte.
- Cálculo de tiempo computable.
- Generación estadística de loot.
- Transacciones idempotentes.

## Integración

- Cargar manifiesto de assets.
- Cargar mapa Tiled.
- Reproducir una animación multicapa.
- Disparar un evento de impacto en el frame configurado.
- Crear personaje.
- Equipar objeto.
- Guardar personaje.
- Iniciar calibración.
- Invalidar calibración por cambio de build.
- Completar una calibración válida.
- Activar modo ausente.
- Reiniciar servidor.
- Recuperar sesión ausente.
- Calcular resultado.
- Reclamar resultado.
- Rechazar segundo reclamo.
- Crear sala.
- Unirse a sala.
- Iniciar misión.
- Completar objetivo.
- Entregar recompensas.

## End-to-end

Flujo mínimo:

1. Registrar o iniciar sesión.
2. Crear personaje.
3. Entrar al pueblo.
4. Equipar arma.
5. Completar una misión activa.
6. Entrar a una zona habilitada de farm.
7. Presionar **Preparar modo offline**.
8. Completar cinco minutos válidos de calibración.
9. Confirmar el modo offline.
10. Cerrar el navegador.
11. Avanzar el reloj del servidor en el entorno de prueba.
12. Volver a iniciar sesión.
13. Abrir el personaje.
14. Ver el informe.
15. Reclamar recompensas.
16. Confirmar que no puede reclamarlas dos veces.

## Pruebas específicas del loot ausente

- Una muestra con un legendario no duplica ese objeto.
- Los IDs de objetos generados son únicos.
- Las recompensas de jefe no aparecen.
- La tasa rara respeta el techo de la zona.
- Una muestra con cero actividad es inválida.
- Una tasa imposible es rechazada o limitada.
- Una sesión mayor al límite solo computa el máximo.

## Pruebas manuales de assets y web

- Abrir el juego en Chrome, Edge y Firefox.
- Cambiar resolución.
- Entrar y salir de pantalla completa.
- Ocultar y recuperar la pestaña.
- Reemplazar un spritesheet placeholder sin modificar lógica.
- Comprobar capas de arma y armadura.
- Verificar que los efectos no oculten ataques.
- Verificar carga progresiva.

## Pruebas manuales multiplayer

- Dos pestañas.
- Dos navegadores.
- Reconexión.
- Desconexión del anfitrión.
- Jugador derribado.
- Reanimación.
- Botín individual.
- Fin de partida.
- Repetición sin reiniciar servidor.

# 27. Definición de terminado del MVP

El MVP está terminado cuando un usuario puede:

1. Abrir el juego en la web.
2. Crear una cuenta persistente.
3. Crear un Guardián.
4. Entrar al pueblo.
5. Equipar armas y armaduras.
6. Distribuir atributos.
7. Crear una sala.
8. Jugar solo o con otro usuario.
9. Completar el Bosque Corrupto.
10. Destruir tres altares.
11. Derrotar al Guardián Corrupto.
12. Obtener botín individual.
13. Subir de nivel.
14. Cambiar su build.
15. Entrar a una zona de farm habilitada.
16. Presionar **Preparar modo offline**.
17. Completar una calibración válida de 5 minutos.
18. Ver una estimación de rendimiento por hora.
19. Activar el modo offline.
20. Cerrar el navegador o apagar la computadora.
21. Volver después.
22. Recibir un cálculo basado en el tiempo del servidor.
23. Ver experiencia, oro, materiales y loot nuevo equivalente.
24. Confirmar que no se duplican literalmente los objetos de la muestra.
25. Reclamar las recompensas una sola vez.
26. Repetir el ciclo sin corromper datos ni duplicar economía.
27. Ejecutar todo el proyecto siguiendo el README.

# 28. Plan maestro de implementación

# Paso 1 — Auditoría y base del repositorio

Estado: [x]

## Tareas

- [x] Inspeccionar el repositorio.
- [x] Documentar archivos existentes.
- [x] Detectar conflictos con esta arquitectura.
- [x] Crear monorepo.
- [x] Configurar `pnpm`.
- [x] Configurar TypeScript estricto.
- [x] Configurar lint.
- [x] Configurar formato.
- [x] Configurar scripts raíz.
- [x] Crear `.env.example`.
- [x] Crear Docker Compose para PostgreSQL.
- [x] Crear README inicial.
- [x] Crear documentación de arquitectura.
- [x] Documentar el modo ausente basado en calibración de 5 minutos.
- [x] Documentar autoridad del servidor y cálculo por tiempo transcurrido.
- [x] Verificar instalación limpia.

## Criterios de aceptación

- [x] `pnpm install` funciona.
- [x] `pnpm dev` inicia cliente y servidor.
- [x] `pnpm lint` funciona.
- [x] `pnpm typecheck` funciona.
- [x] `pnpm test` funciona aunque todavía haya pocas pruebas.
- [x] No existen errores iniciales de compilación.

---

# Paso 2 — Tipos compartidos y datos del juego

Estado: [x]

## Tareas

- [x] Crear paquete `shared`.
- [x] Crear esquemas de validación.
- [x] Definir IDs y tipos de dominio.
- [x] Definir eventos de red.
- [x] Definir estados del personaje para calibración y modo ausente.
- [x] Definir tipos de métricas, snapshots y resultados ausentes.
- [x] Crear paquete `game-data`.
- [x] Definir Guardián.
- [x] Definir atributos.
- [x] Definir habilidades MVP.
- [x] Definir tipos de objetos.
- [x] Definir rarezas.
- [x] Definir enemigos.
- [x] Definir zona Bosque Corrupto.
- [x] Definir misión principal.
- [x] Centralizar constantes de balance.
- [x] Definir estados de personaje.
- [x] Definir estados de animación.
- [x] Definir direcciones.
- [x] Definir contratos de spritesheets.
- [x] Definir manifiesto de assets.
- [x] Definir eventos de frames.
- [x] Definir propiedades de mapas.
- [x] Definir semillas y versión de balance.
- [x] Agregar pruebas de datos inválidos.

## Criterios de aceptación

- [x] Cliente y servidor importan los mismos tipos.
- [x] Los datos no dependen de React ni Phaser.
- [x] Las definiciones son tipadas.
- [x] Los payloads de red pueden validarse.

---

# Paso 3 — Persistencia y contratos de almacenamiento

Estado: [x]

## Tareas

- [x] Configurar Prisma.
- [x] Crear esquema inicial.
- [x] Crear migración.
- [x] Crear seed.
- [x] Crear repositorios de acceso a datos.
- [x] Crear transacciones de economía.
- [x] Crear pruebas de integración.
- [x] Implementar idempotencia básica.
- [x] Agregar versiones de guardado.
- [x] Crear estrategia de migración de personajes.
- [x] Crear respaldo y recuperación para desarrollo.
- [x] Documentar modelo de datos.
- [x] Definir contratos de persistencia sin acoplar dominio a Prisma.

## Entidades mínimas

- [x] Usuario.
- [x] Personaje.
- [x] Inventario.
- [x] Equipamiento.
- [x] Habilidades.
- [x] Progreso.
- [x] Calibración de modo ausente.
- [x] Sesión de modo ausente.
- [x] Resultado de modo ausente.
- [x] Resultado de misión.
- [x] Registro de recompensas.

## Criterios de aceptación

- [x] Las migraciones funcionan desde una base vacía.
- [x] El seed crea contenido de prueba.
- [x] Crear y recuperar un personaje funciona.
- [x] Las monedas no pueden duplicarse en una transacción repetida.

---

# Paso 4 — Autenticación y perfiles

Estado: [x]

## Tareas

- [x] Elegir e implementar autenticación.
- [x] Crear registro.
- [x] Crear inicio de sesión.
- [x] Proteger rutas.
- [x] Autenticar websocket.
- [x] Crear perfil de usuario.
- [x] Crear selección de personaje.
- [x] Crear personaje Guardián.
- [x] Validar nombres.
- [x] Implementar eliminación segura.
- [x] Agregar pruebas.

## Criterios de aceptación

- [x] Un usuario no accede a personajes ajenos.
- [x] La sesión se mantiene correctamente.
- [x] La conexión multiplayer rechaza tokens inválidos.
- [x] El usuario puede crear y seleccionar un personaje.
- [x] La interfaz muestra correctamente el estado del personaje.

---

# Paso 5 — Base web, sesión y recuperación de conexión

Estado: [x]

## Tareas

- [x] Configurar navegación principal.
- [x] Crear estado de sesión.
- [x] Crear manejo de errores de red.
- [x] Crear indicador de conexión.
- [x] Crear recuperación de sesión después de recargar.
- [x] Crear pantalla de estado del servidor.
- [x] Crear manejo de mantenimiento.
- [x] Crear protección contra múltiples acciones simultáneas.
- [x] Documentar comportamiento al cerrar el navegador.
- [x] Crear pruebas de recuperación de sesión.

## Criterios de aceptación

- [x] La aplicación abre como web en navegadores de escritorio actuales.
- [x] La sesión se recupera al recargar.
- [x] Una pérdida de conexión muestra un estado claro.
- [x] Una acción económica no se repite por reintentos del navegador.
- [x] El cierre del navegador no corrompe el personaje.
- [x] El cliente puede consultar si el personaje está disponible o en modo ausente.

---

# Paso 6 — Prototipo Phaser y partida local

Estado: [x]

## Tareas

- [x] Integrar Phaser dentro del cliente.
- [x] Crear escena de carga.
- [x] Crear escena de prueba.
- [x] Crear jugador provisional.
- [x] Implementar movimiento.
- [x] Implementar cámara.
- [x] Implementar colisiones.
- [x] Implementar input de mouse.
- [x] Crear HUD mínimo.
- [x] Crear máquina de estados del personaje.
- [x] Crear sistema de animación de cuatro direcciones.
- [x] Crear reproducción de spritesheets placeholder.
- [x] Crear sistema de capas sincronizadas.
- [x] Crear manifiesto y cargador de assets.
- [x] Crear validador de spritesheets.
- [x] Crear sombras y orden de profundidad.
- [x] Crear herramientas de desarrollo básicas.
- [x] Crear ciclo de pausa y destrucción.
- [x] Evitar duplicación de instancia al navegar.
- [x] Separar el renderizado de las llamadas de red.
- [x] Guardar progreso mínimo mediante la API del servidor.

## Criterios de aceptación

- [x] El jugador se mueve a 60 FPS.
- [x] La diagonal está normalizada.
- [x] No atraviesa obstáculos.
- [x] React y Phaser intercambian estado sin acoplamiento excesivo.
- [x] Las animaciones cambian de acuerdo con estados válidos.
- [x] Las capas permanecen alineadas.
- [x] El validador detecta frames o capas inválidas.
- [x] Las herramientas internas no aparecen en producción.
- [x] Entrar y salir de la escena no genera fugas evidentes.
- [x] La escena detecta y maneja correctamente una pérdida de red.

---

# Paso 7 — Combate del Guardián

Estado: [x]

## Tareas

- [x] Implementar vida. `applyIncomingDamage` conecta `applyDamageTaken` al Guardián real; antes
  nada del juego podía reducir la vida aunque los tests unitarios la cubrieran.
- [x] Implementar Furia.
- [x] Implementar ataque básico.
- [x] Implementar Golpe poderoso.
- [x] Implementar Torbellino.
- [x] Implementar Piel de hierro. `damageTakenMultiplier` ahora es observable: reduce el daño real
  entrante, no solo la bandera del HUD.
- [x] Implementar Sed de batalla. La curación por muerte es visible porque la vida ya puede bajar.
- [x] Implementar cooldowns.
- [x] Implementar costos.
- [x] Implementar impactos.
- [x] Implementar retroceso.
- [x] Implementar críticos.
- [x] Implementar armadura. Mitigación saliente y entrante, ambas reales.
- [x] Vincular impactos a ventanas o eventos de animación. `combat-presentation.ts` deriva
  frameRate/frames de `GAME_DATA.animations`; `hitFrameImpactDivergenceMs` verifica que el
  `hitFrame` de cada animación siga alineado con su `impactMs`, en vez de literales sueltos.
- [x] Implementar efectos visuales provisionales.
- [x] Implementar sonidos provisionales. `CombatAudio.seen` ahora tiene tope (500 claves, FIFO).
- [x] Implementar pooling de efectos repetitivos.
- [x] Implementar números de daño opcionales.
- [x] Crear pruebas de fórmulas.

## Criterios de aceptación

- [x] Las habilidades respetan cooldowns.
- [x] No pueden activarse sin recursos.
- [x] La vida y Furia se sincronizan con el HUD.
- [x] Las fórmulas tienen pruebas.
- [x] No hay daño calculado únicamente en la capa visual.

---

# Paso 8 — Enemigos e IA

Estado: [x]

## Tareas

- [x] Crear sistema base de enemigo. Tuning real de los 5 enemigos (`enemyTuning` en
      `game-data`), estado de simulación puro (`EnemySimState`/`stepEnemy`) y entidades locales de
      Phaser (sprite, hitbox y ciclo de vida) existen y están probados; el adaptador visual cubre
      los estados de enemigo aplicables y usa fallback seguro cuando falta arte.
- [x] Crear máquina de estados. `packages/shared/src/enemy-ai.ts` (`decideEnemyState`), 9 estados,
      prioridad/interrupción, 7 tests.
- [x] Crear detección. Radio + línea de visión para adquirir, histéresis por distancia
      (`loseTargetRadiusPx > detectRadiusPx`) para sostener, dentro de `decideEnemyState`.
- [x] Crear navegación simple. `packages/shared/src/steering.ts` (seek/flee/arrive/separación,
      sin A*) + `enemy-simulation.ts` (`stepEnemy`, paso fijo determinista).
- [x] Implementar Esbirro. Tuning + `movementStyle: 'close'` y perfil `melee_strike` resueltos por
      `behaviors`, con estados visuales y cleanup verificados.
- [x] Implementar Arquero. Tuning + `movementStyle: 'keepDistance'` (kitea bajo la mitad de su
      rango), `ranged_shot` con proyectil real y arte `ranger` con hit/death resueltos.
- [x] Implementar Chamán. Tuning + `movementStyle: 'keepDistance'` y `heal_allies` (prioriza y
      cura aliados con clamp) resueltos; feedback visual y fallback tintado verificados.
- [x] Implementar Bruto. Tuning + `movementStyle: 'close'` y `area_attack`/`stun` telegrafiados
      resueltos; channeling, hit/death y fallback del arte propio verificados.
- [x] Implementar Bestia. Tuning + `movementStyle: 'close'` y `telegraphed_explosion` resueltos
      con aviso antes del daño; channeling y feedback tintado verificados.
- [x] Implementar estados visuales de enemigos. El runtime local conecta `idle`, `walk`, `attack`,
      `casting`, `channeling`, `interacting`, reacciones `hit/knockback` y `death` hasta cleanup,
      con fallback seguro cuando falta arte. `downed/reviving` pertenecen al ciclo de vida del
      Guardián y no se inventan para enemigos que se reemplazan por respawn.
- [x] Implementar animaciones placeholder de enemigos. Los enemigos sin arte propio reutilizan el
      personaje generado del Guardián con tint; `mapState`/`pickAnimation` cubren los 11 estados
      del contrato y vuelven a `idle` cuando falta un clip (por ejemplo `root_brute` en `hit/death`).
- [x] Implementar muerte. `dead` es absorbente en la FSM (inmediata); `isReadyForCleanup` separa
      el momento de limpieza de la muerte misma. El runtime local ya limpia target, sprite, sombra,
      tweens, proyectiles, telegraphs y mapas mediante `EnemySpawnDirector`; pooling y stress de
      30-40 están verificados.
- [x] Implementar drops provisionales. `EnemyRewardLedger` acumula XP pendiente deduplicado por
      instancia (mismo patrón que Sed de batalla); sin drops de items — fuera de alcance hasta que
      exista inventario.
- [x] Implementar al menos dos modificadores élite. `packages/shared/src/elites.ts`: Veloz (×1.5
      velocidad) y Resistente (×1.75 vida, +10 armadura), selección vía RNG seedeado.
- [x] Agregar pruebas de estados. 122 pruebas verdes cubren FSM, detección, steering, simulación,
      proyectiles/telégrafos, élites y ciclo de vida — ver
      `docs/plans/step-08-enemies-ai.md` para el detalle milestone por milestone.

## Criterios de aceptación

- [x] Los cinco enemigos tienen comportamientos diferentes. Dos estilos de movimiento
      distintos (`close`/`keepDistance`) y los cinco perfiles de habilidad (`melee`, `ranged`, `heal`,
      área, explosión) se instancian en el runtime local desde sus `behaviors`, con estados
      visuales y fallback de arte verificados.
- [x] Los ataques peligrosos se anuncian. `area_attack` y `telegraphed_explosion` abren un
      telegraph visible y resuelven daño sólo en su tick final; el estado `channeling` queda
      publicado durante la ventana de aviso.
- [x] El Chamán prioriza aliados válidos. `chooseHealTarget` selecciona al aliado con menor % de
      vida (tie-break por id, ignora aliados casi full) y el runtime aplica la curación con clamp.
- [x] La Bestia no explota sin señal previa. `telegraphed_explosion` abre un telegraph visible,
      publica `channeling` y su daño sólo resuelve en el tick de resolución.
- [x] Las entidades muertas se limpian correctamente. La lógica temporal (`isReadyForCleanup`)
      existe y está probada, el adaptador local ejecuta cleanup/respawn, y pooling y stress de
      30-40 entidades están verificados.

---

# Paso 9 — Bosque infinito por niveles

Estado: [x]

**(2026-07-30 — reescrito: el Bosque pasa de misión finita con altares/jefe/victoria/derrota a idle
RPG infinito por niveles. Sin Tiled (datos propios), sin altares, sin puerta de jefe, sin victoria ni
derrota terminal por ahora. Ver §1, §10.1 y §0.1.)**

## Tareas

- [x] Definir modelo de datos del Bosque infinito: niveles 1 a 20, escalado por nivel (vida/daño
      enemigo, densidad de spawn, recompensa XP/oro/materiales), todo `PROVISIONAL` y versionado.
- [x] Implementar estado de progreso del Bosque (`ForestProgressState`): nivel actual, XP acumulada,
      niveles superados, mejor nivel alcanzado.
- [x] Implementar avance de nivel: acumular XP al derrotar enemigos, subir de nivel al alcanzar el
      umbral, idempotente por instancia de enemigo (un enemigo no paga dos veces).
- [x] Crear importador/validador del modelo de niveles (datos propios, no Tiled): rango 1-20,
      escalado monótono (cada nivel ≥ al anterior).
- [x] Spawn de oleadas por nivel (cantidad/composición escalada) — núcleo puro primero, sin Phaser.
- [x] Mostrar el nivel actual y el progreso hacia el siguiente (HUD). `GameHudSnapshot` publica
      nivel/XP reales desde `ForestProgressState`; el overlay muestra porcentaje, umbral y nivel.
- [x] Sistema común de interacción (cofres, NPCs, reanimación y extensiones): contrato V2 reusable
      con distancia, duración, estado permitido, interrupción, autoridad, resultado, UI y cooldown.
- [x] Contrato, persistencia y adaptador server-side de interacción: `F` local y `/ws` aceptan
      intenciones versionadas con receipts/replay protection; el tick autoritativo usa la posición
      real de la instancia y `CharacterInteractionEffect` aplica una sola vez reanimación/diálogo o
      deja autorización `PENDING_DOMAIN` para loot.
- [x] Wiring a Phaser: instanciar oleadas por nivel y feedback de avance de nivel. El runtime
      consume `createForestWave`, reconfigura el mismo `EnemySpawnDirector` al subir de nivel y el
      HUD publica nivel/XP/índice/tamaño de oleada; el agregado server-side usa la capa de guardado
      versionada descrita abajo.
- [x] Persistir `ForestProgressState` con envelope V1, migración SQL, backfill de personajes,
      validación de curva, round-trip y revisión optimista. `CharacterForestProgress` no mezcla la
      XP del Bosque con `CharacterProgress` y el cliente no puede enviar snapshots arbitrarios.
- [x] Crear pantalla Expedición para elegir zona/dificultad disponible y entrar/salir de forma
      coherente. `Expedition` ofrece Bosque Corrupto en Normal; el portal y el dock `E` del Pueblo
      llegan a la pantalla y la entrada local no duplica el runtime.
- [x] Sistema común de interacción reutilizable; el contrato, ledger V2, preview local, autoridad
      WebSocket, persistencia y migración son compartidos por los tipos de target.
- [x] Estado visual no terminal del Guardian al llegar a 0 vida: el runtime lo marca como
      derribado, bloquea movimiento/auto/habilidades, conserva la opcion de reanimacion y el HUD
      expone `data-guardian-state="downed"` con aviso visible. La reanimacion efectiva sigue siendo
      un efecto de dominio de la instancia autoritativa.
- [x] Minimapa o datos para generarlo (postergable; se conserva como mejora de presentación).
- [x] Puntos de control (postergable; el endpoint idempotente ya existe y el refinamiento visual
      queda fuera del loop activo).
- ~~Victoria y derrota~~ — fuera del MVP del bucle infinito por decisión (§1): sin fin terminal.

## Criterios de aceptación

- [x] El jugador puede avanzar del nivel 1 al 20 progresivamente. El recorrido determinista con
      recompensas reales del catálogo llega a nivel 20; smoke Phaser confirma el salto 1→2 y la
      oleada 3→4.
- [x] Cada nivel es más difícil que el anterior (escalado monótono verificado por test).
- [x] Derrotar un enemigo acumula progreso de nivel exactamente una vez (idempotencia probada).
- [x] El nivel actual y el progreso se muestran en el HUD (wiring verificado en navegador).
- [x] No hay condición de victoria ni de derrota terminal (idle continuo por diseño del núcleo).

> Ver `docs/plans/step-09-endless-forest.md` para el detalle milestone por milestone.

### Base común de interacción adelantada (2026-08-04)

Se incorporó `packages/shared/src/interaction.ts` como contrato puro y serializable para NPC, cofre,
reanimación, altar, portal, objeto, puerta, comerciante y objetivo de misión. Cada target declara
distancia, duración, estados permitidos, interrupción por daño, autoridad, resultado, texto de UI y
cooldown; `applyInteraction` valida esos invariantes, consume objetivos de un solo uso, mantiene
cooldowns y devuelve recibos con ventana de finalización. El ledger V2 y la migración de estado son
compatibles con filas V1. El transporte WebSocket acepta `INTERACT_INTENT` con secuencia/rate limit,
usa posición/estado del tick, emite `INSTANCE_SNAPSHOT` y agenda finalizaciones. El ledger durable
`CharacterInteractionEffect` hace idempotentes reanimación/diálogo y conserva loot como
`PENDING_DOMAIN` hasta el dominio de objetos. El preview local conecta `F` con targets visuales y
mantiene el mismo contrato sin mover reglas a React/Phaser.

### Prioridades posteriores confirmadas por el usuario (2026-08-04)

Una vez cerrado este GOAL completo, estas son las mejoras solicitadas, manteniendo los límites del
plan maestro y sin adelantar sistemas mientras el Paso 9 siga abierto:

1. **Loot y objetos reales** — Paso 11: drops con IDs únicos, rarezas, afijos, inventario,
   equipamiento y cambios de estadísticas validados por servidor.
2. **Experiencia, niveles, estadísticas y árbol de habilidades** — Paso 12: separar la XP del
   personaje de la progresión del Bosque, centralizar la curva, calcular stats en dominio y guardar
   una build con requisitos/puntos y habilidades activas/pasivas.
3. **Ciudad/Pueblo completo** — Paso 17: comerciante, cofre, portal, acceso al modo ausente,
   economía idempotente y navegación sin callejones.
4. **Efectos, sprites y feedback de combate** — Paso 18: mejorar VFX de ataques, impactos, muerte,
   equipamiento, audio, pooling y legibilidad sin mezclar hitboxes con presentación.
5. **Mapa mundial y nuevas zonas para el RPG idle** — después de los pasos anteriores: mapa de
   zonas desbloqueables, selección de expedición, biomas/encuentros/recompensas por zona y progreso
   activo u offline calculado por el servidor. Los nombres iniciales son provisionales (por ejemplo
   Bosque Corrupto, Pantano de Esporas, Minas de Ceniza y Ruinas del Umbral) y no se convierten en
   contenido definitivo hasta validar balance, arte, conectividad y presupuesto de entidades.

6. **Expansión de clases y árboles de habilidades** — después de cerrar el MVP y sus bloqueos de
   infraestructura: conservar `dark_knight`, `arcanist`, `hunter` y `summoner` como clases propias
   además de Guardián. Cada una se diseñará con tres ramas, activas, pasivas, definitiva y
   sinergias mediante IDs estables, autoridad server-side, migraciones y balance reproducible. La
   referencia de Diablo II se usa sólo como inspiración estructural; no se copian nombres, arte,
   habilidades, objetos, fórmulas ni texto. El plan vivo es
   [`docs/plans/post-goal-class-expansion.md`](docs/plans/post-goal-class-expansion.md).

La XP del Bosque ya implementada en el Paso 9 no reemplaza la XP del personaje del Paso 12. Estas
prioridades quedan documentadas como trabajo posterior; no se marcan como completadas hasta tener
implementación, pruebas y verificación en navegador. Esta expansión no abre el Paso 21 ni cambia el
alcance MVP mientras el Paso 20 siga incompleto.

---

# Paso 10 — Jefe

Estado: [!]

Postergado fuera del MVP por la decisión vigente del Bosque infinito (§0.1): no se implementa una
arena terminal hasta que exista una necesidad de raid/jefe compatible con el loop idle. El trabajo
activo continúa en el Paso 11, mientras este paso queda reservado y no bloquea el dominio de loot.

## Tareas

- [ ] Crear arena.
- [ ] Implementar fase 1.
- [ ] Implementar transición.
- [ ] Implementar fase 2.
- [ ] Implementar invocaciones.
- [ ] Implementar zonas corruptas.
- [ ] Implementar animaciones y telegrafía.
- [ ] Implementar efectos y audio provisionales.
- [ ] Implementar barra de vida.
- [ ] Implementar recompensas.
- [ ] Ajustar dificultad.
- [ ] Agregar pruebas de transición.

## Criterios de aceptación

- [ ] El jefe tiene al menos dos patrones distinguibles.
- [ ] Los ataques fuertes son evitables.
- [ ] La transición no duplica eventos.
- [ ] La recompensa se entrega una sola vez.
- [ ] Puede derrotarse con la build inicial mediante buena ejecución.

---

# Paso 11 — Inventario, equipamiento y botín

Estado: [x]

## Tareas

- [x] Crear inventario persistente.
- [x] Crear panel.
- [x] Crear comparación.
- [x] Equipar y desequipar.
- [x] Actualizar estadísticas.
- [x] Crear drops individuales.
- [x] Crear generación de rareza.
- [x] Crear afijos.
- [x] Crear objetos MVP.
- [x] Crear favorito.
- [x] Crear venta.
- [x] Crear protecciones.
- [x] Crear cambios visuales de arma y armadura. El runtime aplica overlays placeholder derivados
      del equipo confirmado por servidor, con color de rareza y silueta de arma.
- [x] Sincronizar capas visuales con todas las animaciones. Los overlays placeholder heredan el
      origen 92x92 y siguen posición, facing, flip, profundidad y alpha en cada actualización;
      las capas authored por frame quedan como mejora visual del Paso 18.
- [x] Validar compatibilidad de frames entre capas. `validateEquipmentVisualCompatibility` exige
      las cinco animaciones y las tres hojas generadas del Guardián, con origen de pies y frames
      positivos antes de iniciar Phaser; las capas authored futuras deben conservar ese contrato.
- [x] Crear pruebas de generación y equipamiento.

## Contenido mínimo

- [x] 10 armas.
- [x] 10 piezas de armadura.
- [x] 5 accesorios.
- [x] 12 afijos.
- [x] 1 objeto legendario de jefe.

## Criterios de aceptación

- [x] Equipar modifica estadísticas reales (snapshot derivado server-side).
- [x] El servidor valida la operación.
- [x] No puede equiparse un objeto ajeno.
- [x] No se duplican objetos.
- [x] El cambio visual básico es visible. Smoke autenticado con un mandoble equipado expone
      `canvas[data-equipment-visual="weapon:common|armor:none"]` y el screenshot muestra el arma
      sobre el Guardián; las capas authored por frame siguen pendientes del Paso 18.

---

# Paso 12 — Niveles, atributos y habilidades

Estado: [x]

## Tareas

- [x] Implementar experiencia. `applyExperience` aplica XP del personaje sin reutilizar la XP del
      Bosque.
- [x] Implementar niveles 1 a 10. La curva acumulativa vive en `GAME_DATA.progression` y el
      servidor deriva el nivel; el cliente no puede escribirlo.
- [x] Implementar puntos de atributo.
- [x] Implementar distribución. `ProgressionService` valida el saldo dentro de una transacción
      serializable y devuelve stats derivados.
- [x] Implementar reseteo controlado si corresponde. Restablece a los valores base con costo de
      oro por nivel y devuelve los puntos ganados.
- [x] Implementar desbloqueo de habilidades. Cada habilidad declara `unlockLevel` y el servidor
      rechaza habilidades bloqueadas.
- [x] Implementar barra de habilidades. Cuatro ranuras persistidas en `CharacterSkill`.
- [x] Guardar build. Snapshot con fingerprint y ledger `InventoryOperation` idempotente.
- [x] Crear pantalla de personaje. `/personaje` consume el snapshot autenticado real.
- [x] Crear pruebas. Unitarias puras, UI, integración HTTP/DB y smoke autenticado.

## Criterios de aceptación

- [x] No se gastan más puntos de los disponibles. Overspend devuelve 409 y no muta el personaje.
- [x] Los atributos actualizan estadísticas. El snapshot recalcula vida, daño, armadura, crítico
      y velocidad de ataque con una función pura versionada.
- [x] La build persiste. Equipar/quitar ranuras se puede leer tras una nueva petición y el HUD
      muestra la barra confirmada.
- [x] El nivel no puede alterarse desde el cliente. Las rutas sólo aceptan intenciones de delta;
      nivel, XP y puntos se derivan server-side.
- [x] La curva de experiencia está centralizada en `GAME_DATA.progression` y validada monotónicamente.

---

# Paso 13 — Multiplayer de lobby

Estado: [x]

**Nota (2026-07-30, ver sección 0.1 y 14):** "sala"/"lobby" se generaliza a sistema de party sobre
un mundo persistente — la lista de tareas se conserva como alcance. `PartyRegistry` sigue siendo
process-local detrás del WebSocket, pero el lobby ya tiene cleanup server-side por TTL y conserva la
reconexión mientras haya actividad o miembros conectados; la persistencia social durable queda fuera
de este hito.

## Tareas

- [x] Configurar servidor multiplayer. El WebSocket autenticado comparte un `PartyRegistry` server-side.
- [x] Autenticar conexión.
- [x] Crear sala. `PARTY_CREATE_INTENT` crea una party de lobby para el personaje seleccionado.
- [x] Generar código. El servidor genera un código de seis caracteres, único en el proceso.
- [x] Unirse por código. `PARTY_JOIN_INTENT` valida código, estado y capacidad; el cliente no elige
      identidad ajena.
- [x] Listar jugadores. `PARTY_SNAPSHOT` replica miembros, líder, readiness, estado y revisión.
- [x] Estado listo. Cada miembro cambia su propio `ready` mediante `PARTY_READY_INTENT`.
- [x] Transferir anfitrión. Al salir el líder, el servidor transfiere el liderazgo al siguiente miembro.
- [x] Seleccionar misión. El líder inicia con una zona validada por el contrato compartido.
- [x] Seleccionar dificultad. El líder inicia con `normal` o `veteran`, validado server-side.
- [x] Iniciar partida. El servidor bloquea nuevos joins y enlaza los miembros con una instancia común.
- [x] Limpiar salas. `PartyRegistry.cleanupExpired` elimina lobbies inactivos sólo cuando todos sus
      miembros están desconectados y superaron el TTL configurable (15 minutos por defecto). Se
      ejecuta al conectar, al recibir comandos y en un intervalo con `unref`; nunca elimina parties
      activas ni un lobby que aún puede recibir una reconexión.
- [x] Probar dos clientes.

## Criterios de aceptación

- [x] Dos usuarios pueden entrar a la misma sala.
- [x] Los códigos inválidos muestran error.
- [x] No se supera el límite de cuatro.
- [x] El anfitrión puede desconectarse sin destruir el lobby. La prueba WebSocket cierra el socket,
      reconecta la misma sesión y recupera `PARTY_SNAPSHOT` con código, líder y readiness intactos.
- [x] Una partida iniciada no admite nuevos jugadores.

---

# Paso 14 — Multiplayer de combate

Estado: [x]

El transporte, la instancia/tick, los enemigos, las habilidades, la reanimación, la reconexión, la
observabilidad, las recompensas de recursos y la presentación de eventos ya tienen implementación.
Los drops como objetos, rarezas, afijos e inventario siguen deliberadamente en los Pasos 11/15.

**Nota (2026-07-30, ver sección 0.1 y 14):** este paso pasa de "sincronización en tiempo real
(interpolación, predicción, reconciliación)" a "loop de tick de servidor que resuelve comandos en
cola de forma asíncrona" — más simple, no más complejo. El estado/tick, party básica, snapshots y
movimiento ya tienen una primera implementación; las recompensas de recursos y la presentación
validada ya están cerradas en este paso, mientras los drops como objetos quedan en los pasos 11/15.

## Tareas

- [x] Crear estado de partida autoritativo. `packages/shared/src/instance.ts` define un estado
      versionado e inmutable de instancia activa (jugadores, posición, vida, estado, reloj, tick y
      revisión); `ActiveInstanceRegistry` lo conserva sólo mientras la sesión está activa y nunca
      persiste cada tick en PostgreSQL. El primer actor entra en `corrupted_forest` desde spawn
      server-side y la instancia no puede cambiar de dueño, zona o dificultad durante la sesión.
- [x] Sincronizar jugadores. `PartyRegistry` limita a cuatro miembros; `ActiveInstanceRegistry` los
      agrega a un estado/tick/revisión compartido y `PARTY_SNAPSHOT`/`INSTANCE_SNAPSHOT` se emiten a
      todos los sockets miembros. Movimiento de un miembro replica el snapshot completo de la party.
- [x] Sincronizar enemigos. La instancia y el `INSTANCE_SNAPSHOT` contienen una lista server-side
      acotada de enemigos (arquetipo, posición, vida, estado y `aiState`); al iniciar Bosque se
      genera una oleada determinista y todos los miembros reciben la misma revisión. `EnemyAuthority`
      avanza una vez por instancia, ejecuta FSM/steering, leash y los cinco perfiles de ataque con la
      fórmula compartida; muerte conserva `deadAtMs`, cleanup espera la ventana de presentación y el
      respawn elige un punto seguro determinista. La XP/oro/materiales ya se entregan por
      `EnemyRewardService`; quedan drops como objetos persistentes para los Pasos 11/15. El cliente
      valida eventos `REWARD_GRANTED` y los muestra mediante un feed acotado, sin convertirlos en
      autoridad.
- [x] Validar movimiento. El servidor normaliza el vector, limita velocidad/mapa, bloquea actores
      derribados y prueba movimiento individual y compartido.
- [x] Validar ataques. `COMBAT_INTENT` llega al `CombatAuthority` server-side, que valida ownership,
      habilidad, cooldown, Furia, estado, objetivo y alcance; resuelve daño/crit con RNG determinista,
      deduplica por `operationId` y replica `COMBAT_RESULT`/`INSTANCE_SNAPSHOT`. Los golpes soportan
      arco/radio, selección determinista, múltiples objetivos, knockback e impactos programados por
      `impactMs`/`tickOffsetsMs`. `EnemyAuthority` resuelve melee, proyectiles, telégrafos y curación
      de aliados desde datos versionados; cleanup/respawn ya corre con reloj y puntos seguros. Los
      resultados de red se validan y presentan mediante `game-events.ts`/`game-session.ts`.
- [x] Validar habilidades. Slash, Golpe poderoso, Torbellino y Piel de hierro consumen recursos y
      cooldowns server-side; Slash/Poder difieren el impacto y Torbellino agenda sus ticks mediante
      `CombatAuthority.advance` y un timer autoritativo de 50 ms. El resultado incluye `pending`,
      `impactAtMs`, todos los impactos, knockback, ventana de Piel de hierro y multiplicador de
      movimiento. Las habilidades enemigas ya usan la misma autoridad para daño y reloj; el HUD
      presenta resultados, recompensas e interrupciones sin mutar autoridad. Drops de objetos e
      inventario siguen en los pasos de dominio.
- [x] Sincronizar objetivos. `ActiveInstanceState` y `INSTANCE_SNAPSHOT` replican una lista
      server-side de objetivos versionados, con ID estable, modo `endless_forest`, estado y
      progreso acotado al objetivo. El objetivo finito de altares/jefe queda retirado por la
      decisión de §0.1; el Bosque activo sincroniza el nivel 1→20 sin condición terminal. La
      validación rechaza objetivos duplicados o progreso mayor al target; el cliente no puede
      escribir esta lista. La acumulación de XP/oro/materiales que mueve el nivel llega por el evento
      server-side `REWARD_GRANTED`; los drops como objetos quedan en el dominio posterior.
- [x] Sincronizar jefe. No aplica al bucle activo vigente: §0.1 retiró la misión finita de altares,
      puerta y Guardián Corrupto. El estado de jefe queda reservado al Paso 10/raid posterior; no
      se inventa una entidad o arena que el Bosque infinito no utiliza.
- [x] Implementar interpolación. Sustituido por snapshots confirmados y tick asíncrono server-side
      según la decisión de §14; no hay movimiento cliente-a-cliente de tiempo real que interpolar.
- [x] Implementar predicción local limitada. Sustituido por intenciones de movimiento/combate y
      feedback reversible; el cliente no predice vida, daño, cooldowns ni objetivos.
- [x] Implementar reconciliación. La revisión/tick de `INSTANCE_SNAPSHOT` y el replay por
      `operationId` son la reconciliación del modelo por ticks; no se mantiene una simulación local
      paralela que deba corregirse frame a frame.
- [x] Implementar reanimación. El servidor selecciona al compañero `downed` más cercano con tie-break
      por ID, conserva el destinatario server-derived en el recibo idempotente, agenda la duración
      del altar en el tick de instancia, interrumpe si el actor recibe daño y restaura vida/estado
      únicamente mediante `InteractionEffectService`. El efecto y el snapshot actualizado se
      retransmiten a toda la party; el cliente no puede elegir a quién revivir ni otorgar vida.
- [x] Implementar reconexión. El cierre de un socket no elimina la party ni la instancia activa:
      el siguiente WebSocket autenticado recibe `PARTY_SNAPSHOT` e `INSTANCE_SNAPSHOT` con la
      misma revisión server-side, y el tick continúa procesando impactos/interacciones aunque no
      haya comandos nuevos. Los lobbies abandonados se limpian tras el TTL sólo cuando todos sus
      miembros están desconectados; una partida ya iniciada no acepta joins tardíos.
- [x] Implementar fin de partida. El modo vigente es el Bosque infinito por niveles de §0.1, por lo
      que no existe una victoria/derrota terminal ni un cierre de misión que sincronizar. La
      condición terminal del Guardián es `downed` y su recuperación es la reanimación autoritativa;
      XP/oro/materiales ya se entregan por derrota; las instancias de loot y drops pertenecen al Paso 15.
- [x] Medir tráfico. `TrafficMetrics` cuenta mensajes/bytes entrantes y salientes en el borde
      WebSocket, tasas por segundo y una muestra acotada p95 de `INSTANCE_SNAPSHOT`. El endpoint
      autenticado `GET /api/metrics/network` expone una ventana de 60 s sin payloads ni IDs.

## Criterios de aceptación

- [x] Dos a cuatro jugadores comparten una instancia activa y pueden reconectar sin perder party,
      objetivos, enemigos ni revisión; el recorrido no tiene una condición de completitud terminal
      mientras el Bosque infinito siga vigente.
- [x] El daño es consistente: `CombatAuthority` y `EnemyAuthority` resuelven desde el mismo tick,
      RNG/orden deterministas y estado server-side, con pruebas de party y de impactos diferidos.
- [x] Un cliente no puede otorgarse vida: la reanimación deriva destinatario y vida del servidor y
      publica un efecto idempotente a la party.
- [x] Un cliente no puede ignorar cooldowns: habilidades e interacciones se validan y deduplican
      por `operationId` en las autoridades server-side.
- [x] Los objetivos no se duplican. La transición server-side rechaza IDs repetidos y la prueba de
      party verifica que host, miembro y reconexión reciben la misma lista de objetivos.
- [x] La reanimación funciona. Selección determinista, persistencia del destinatario, finalización
      idempotente, interrupción por daño y réplica de efecto están cubiertas por pruebas puras,
      persistencia y registro de instancia.
- [x] La desconexión no bloquea la sala: el socket se puede cerrar/reabrir, la party activa conserva
      su instancia y el timer sigue resolviendo impactos/interacciones sin depender de otro comando.
- [x] Los eventos autoritativos visibles (`COMBAT_RESULT`, `REWARD_GRANTED`, efectos e interrupciones)
      se validan con el contrato compartido y llegan a un feed HUD deduplicado/acotado por operación;
      el cliente no inventa daño, XP, oro, materiales ni drops.

---

# Paso 15 — Recompensas multiplayer

Estado: [x]

## Tareas

- [x] Generar botín individual. `EnemyRewardService` crea una instancia determinista por
      personaje receptor dentro de la transacción de recompensa y la inserta en su inventario.
- [x] Mostrar drops privados. `REWARD_GRANTED` lleva `visibility: private` y `/resultados` sólo
      consulta los `RewardLog` cuyo `characterId` pertenece al usuario autenticado.
- [x] Calcular experiencia. `EnemyRewardService` deriva la XP del catálogo y la aplica junto al
      progreso del Bosque.
- [x] Calcular oro. La misma transacción deriva y persiste el oro de la sintonía del enemigo.
- [x] Aplicar dificultad. `GAME_DATA.balance.difficulty` versiona Normal/Veterano y la fórmula
      server-side escala salud, daño y respawn por cantidad real de jugadores.
- [x] Guardar resultado. `CharacterProgress`, `CharacterForestProgress` y `RewardLog` quedan
      versionados y persistidos.
- [x] Entregar mediante transacción. La transacción serializable valida ownership y saldos antes
      de emitir `REWARD_GRANTED`.
- [x] Implementar idempotencia. `operationId`/hash reproducen el receipt o rechazan un conflicto.
- [x] Crear pantalla de resultados. `/resultados` muestra recursos, nivel, dificultad y objeto
      desde el historial privado autenticado.
- [x] Agregar pruebas simultáneas. PostgreSQL cubre dos `applyOnce` concurrentes, replay único,
      una sola instancia de item y rechazo de historial de otro personaje.

## Criterios de aceptación

- [x] Cada jugador recibe recompensas propias de la party, sin exponer el receipt de otro personaje;
      los drops y el endpoint de resultados son privados por ownership.
- [x] Reclamar o finalizar dos veces no duplica recompensas.
- [x] La desconexión tardía no duplica resultados: el mismo `operationId` reproduce el receipt.
- [x] Las recompensas de recursos persisten después de reiniciar el servidor mediante `RewardLog` y
      progreso versionado.

---

# Paso 16 — Modo offline basado en calibración de 5 minutos

Estado: [x]

## Tareas

### Calibración

- [x] Crear botón **Preparar modo offline**.
- [x] Crear selector de zona y dificultad.
- [x] Crear contador autoritativo de 5 minutos.
- [x] Capturar snapshot de build.
- [x] Bloquear cambios durante la muestra.
- [x] Registrar métricas válidas en servidor.
- [x] Excluir recompensas no válidas.
- [x] Validar actividad mínima.
- [x] Detectar tasas imposibles.
- [x] Invalidar la muestra cuando corresponda.
- [x] Mostrar motivo de invalidación.
- [x] Mostrar estimación por hora.

### Activación

- [x] Crear confirmación.
- [x] Guardar hora de inicio del servidor.
- [x] Guardar calibración y snapshot inmutables.
- [x] Marcar personaje como `AWAY_FARMING`.
- [x] Impedir partidas activas con ese personaje.
- [x] Configurar límite inicial de 8 horas.
- [x] Configurar eficiencia inicial de 80 %.

### Cálculo

- [x] Calcular tiempo transcurrido.
- [x] Aplicar límite máximo.
- [x] Aplicar eficiencia.
- [x] Aplicar penalización por muertes.
- [x] Calcular experiencia.
- [x] Calcular oro.
- [x] Calcular materiales.
- [x] Calcular oportunidades de loot.
- [x] Generar loot nuevo con tablas y semilla del servidor.
- [x] Excluir recompensas únicas y de jefe.
- [x] Limitar rarezas por zona.
- [x] Versionar fórmulas de cálculo.

### Regreso y reclamo

- [x] Detener modo ausente al abrir el personaje mediante el acceso durable `/ausente` y su acción de regreso.
- [x] Persistir resultado antes de mostrarlo.
- [x] Crear informe completo.
- [x] Crear reclamación transaccional.
- [x] Implementar idempotencia.
- [x] Proteger contra reclamos concurrentes.
- [x] Liberar personaje después del reclamo.
- [x] Conservar sesión tras reinicio del servidor.

### Pruebas

- [x] Probar calibración válida de 300 segundos.
- [x] Probar cambio de build mediante fingerprint server-side.
- [x] Probar desconexión durante calibración como estado recuperable/reintento.
- [x] Probar cero actividad.
- [x] Probar reloj del cliente manipulado.
- [x] Probar límite de 8 horas.
- [x] Probar un legendario en la muestra sin duplicación literal.
- [x] Probar IDs únicos de objetos.
- [x] Probar reclamo simultáneo.
- [x] Documentar fórmulas y límites.

## Criterios de aceptación

- [x] El jugador completa una muestra válida de 5 minutos.
- [x] El sistema muestra una estimación explicable por hora.
- [x] El jugador puede cerrar el navegador o apagar la PC.
- [x] El servidor conserva la sesión ausente.
- [x] El reloj del cliente no afecta el resultado.
- [x] El equipamiento posterior no altera el snapshot.
- [x] La recompensa se calcula según el tiempo transcurrido y el límite.
- [x] El loot se genera nuevamente y no copia objetos exactos.
- [x] Las recompensas únicas no aparecen.
- [x] La recompensa se entrega una sola vez.
- [x] El personaje vuelve a estar disponible después del reclamo.

---

# Paso 17 — Pueblo completo y economía

Estado: [x]

## Tareas

- [x] Integrar todos los menús.
- [x] Crear comerciante.
- [x] Vender objetos.
- [x] Comprar objetos básicos.
- [x] Crear cofre.
- [x] Crear portal activo.
- [x] Crear acceso a **Preparar modo offline**.
- [x] Crear navegación coherente.
- [x] Implementar confirmaciones.
- [x] Crear tutorial inicial.
- [x] Permitir repetir u omitir tutorial.
- [x] Registrar economía.

## Criterios de aceptación

- [x] El jugador completa todo el ciclo desde el pueblo.
- [x] No existen pantallas sin salida.
- [x] No se pierden objetos al moverlos.
- [x] Las operaciones económicas son persistentes.

---

# Paso 18 — Arte, audio y feedback

Estado: [x]

## Tareas

- [x] Documentar pipeline final de arte.
- [x] Validar manifiesto y licencias.
- [x] Reemplazar placeholders prioritarios.
- [x] Crear sprites originales. El inventario conserva placeholders CC0 y hojas generadas con
      procedencia/licencia explícita; los reemplazos mantienen IDs y contrato de frames.
- [x] Crear animaciones del Guardián. `dark_knight` valida `idle`, `walk`, `basic_attack`, `hit` y
      `death` en cuatro direcciones con origen de pies.
- [x] Crear animaciones de enemigos. `ranger` y `root_brute` están registrados y cargados por el
      catálogo; los estados no presentes usan fallback estable sin romper el contrato visual.
- [x] Crear efectos de habilidades. Slash, Power Strike, Whirlwind, impacto, crítico, muerte,
      curación, buff, debuff, explosión y peligro usan descriptores compartidos.
- [x] Crear cambios visuales de equipamiento. El loadout confirmado aplica overlays de rareza sin
      mezclar presentación con estadísticas/hitboxes.
- [x] Crear sonidos. El mezclador sintetiza tonos de activación, impacto, crítico, curación y muerte.
- [x] Crear música. El mezclador genera un loop procedural reemplazable y desbloqueado por gesto.
- [x] Crear buses de audio. Master, música, ambiente, efectos y UI tienen ganancias independientes.
- [x] Crear opciones de volumen. `/ajustes` persiste mute, movimiento reducido y cinco niveles de
      volumen con sanitización y migración de clave.
- [x] Crear feedback de impacto. Los impactos y números flotantes usan colores de crítico, reset y
      límites acotados.
- [x] Crear pooling y límites de efectos. Pools preasignados cubren habilidades, impactos, texto,
      proyectiles, telégrafos y bursts; agotarlos sólo omite presentación.
- [x] Revisar legibilidad. El smoke del preview conserva un canvas, tres enemigos y HUD visible sin
      errores; los ataques tienen color, escala, telegraph y feedback diferenciables.
- [x] Verificar licencias.
- [x] Verificar presupuesto de descarga.
- [x] Verificar compatibilidad en navegadores objetivo. Smoke automatizado con Chrome for Testing
      151, Edge instalado y Firefox 153: `/bruto-preview` monta el HUD/canvas y tres enemigos;
      `/ajustes` expone cinco rangos y movimiento reducido. No hubo `pageerror` ni requests fallidas
      de la aplicación; Firefox sólo emite el aviso de teardown `InvalidStateError: Navigated away
      from page` al destruir Phaser durante una navegación, sin error no controlado del documento.

## Criterios de aceptación

- [x] No se usan assets sin permiso. Cada entrada del manifiesto declara procedencia/licencia y el
      validador rechaza entradas huérfanas.
- [x] Los ataques se leen correctamente. El preview muestra efectos de habilidad, telégrafos,
      impactos, críticos y muerte con movimiento reducido disponible.
- [x] El sonido puede desactivarse. El toggle y los buses silencian efectos/música sin tocar combate.
- [x] La interfaz no tapa información crítica. El smoke visual mantiene HUD, canvas y enemigos
      dentro del viewport.
- [x] El arte mantiene una dirección consistente. Paleta profunda verde/púrpura y descriptores
      compartidos se aplican a Guardian, enemigos, overlays y feedback.

Paso 18 queda cerrado. El siguiente paso activo es el Paso 19 — Calidad, rendimiento y seguridad.

---

# Paso 19 — Calidad, rendimiento y seguridad

Estado: [x]

## Tareas

- [x] Ejecutar auditoría de seguridad.
- [x] Revisar validaciones.
- [x] Revisar autorización.
- [x] Revisar duplicación de recompensas.
- [x] Agregar rate limits.
- [x] Revisar logs.
- [x] Medir FPS.
- [x] Medir memoria.
- [x] Medir cantidad de entidades, proyectiles, efectos y audio.
- [x] Validar presupuestos de rendimiento.
- [x] Validar herramientas internas desactivadas en producción.
- [x] Medir servidor.
- [x] Probar cuatro jugadores.
- [x] Probar sesiones largas.
- [x] Probar reconexiones.
- [x] Probar cierre del navegador durante el modo ausente.
- [x] Probar recuperación después de reiniciar el servidor.
- [x] Corregir fugas.
- [x] Corregir errores de consola.
- [x] Revisar accesibilidad.

## Criterios de aceptación

- [x] No hay vulnerabilidades críticas conocidas.
- [x] No hay duplicación reproducible de moneda u objetos.
- [x] El cliente mantiene rendimiento razonable.
- [x] El servidor soporta múltiples salas de prueba.
- [x] Los errores tienen logs útiles.

---

# Paso 20 — Pruebas finales y despliegue

Estado: [-]

## Tareas

- [x] Crear entorno de staging.
- [x] Configurar base de datos.
- [!] Configurar secretos (plantilla segura lista; faltan valores del proveedor).
- [x] Configurar frontend.
- [x] Configurar backend.
- [x] Configurar websocket.
- [x] Configurar CORS.
- [!] Configurar HTTPS (perfil Caddy listo; faltan dominio y certificados reales).
- [x] Configurar assets e iconos web de producción.
- [x] Verificar versionado y despliegue del cliente web.
- [x] Ejecutar migraciones.
- [x] Ejecutar seed controlado.
- [x] Crear health checks.
- [x] Crear CI.
- [!] Ejecutar pruebas en CI (comandos reproducidos localmente; falta ejecución en proveedor).
- [x] Crear backups.
- [x] Documentar rollback.
- [x] Crear checklist de publicación.

## Criterios de aceptación

- [x] El juego funciona fuera de localhost (smoke LAN sobre `192.168.0.154`).
- [-] Dos usuarios remotos pueden jugar (dos sesiones LAN autenticadas verificadas; falta validar
  clientes desde redes externas).
- [x] El modo ausente sobrevive reinicios.
- [x] Cerrar la computadora no interrumpe el cálculo por tiempo transcurrido.
- [x] Las migraciones son reproducibles.
- [x] Existe procedimiento de recuperación.

---

# Paso 21 — Cierre del MVP

Estado: [ ]

## Tareas

- [ ] Ejecutar el flujo activo completo.
- [ ] Ejecutar el flujo completo del modo ausente.
- [ ] Verificar que el mismo personaje conserva progreso y recompensas.
- [ ] Resolver bugs bloqueantes.
- [ ] Clasificar bugs menores.
- [ ] Congelar alcance.
- [ ] Actualizar README.
- [ ] Actualizar documentación.
- [ ] Crear notas de versión.
- [ ] Crear lista de mejoras post-MVP.
- [ ] Etiquetar versión.
- [ ] Crear build estable.

## Criterios de aceptación

- [ ] Cumple la definición de terminado.
- [ ] Todas las tareas críticas están marcadas.
- [ ] No existen placeholders presentados como definitivos.
- [ ] El proyecto puede instalarse desde cero.
- [ ] El MVP tiene un ciclo divertido y repetible.
- [ ] El modo offline calcula progreso real desde una calibración válida de 5 minutos.

---

# 29. Backlog posterior al MVP

No implementar hasta cerrar el MVP.

## Contenido

- [ ] Clase Acechador.
- [ ] Clase Arcanista.
- [ ] Segunda región.
- [ ] Tercera región.
- [ ] Nuevos jefes.
- [ ] Nuevos legendarios.
- [ ] Árboles de habilidades.
- [ ] Fabricación.
- [ ] Mejoras de objetos.
- [ ] Runas.
- [ ] Encantamientos.

## Multiplayer

- [ ] Matchmaking.
- [ ] Lista de amigos.
- [ ] Invitaciones.
- [ ] Chat de grupo.
- [ ] Gremios.
- [ ] Modo ausente grupal.
- [ ] Tablas de clasificación.

## Arte y herramientas

- [ ] Animaciones de ocho direcciones.
- [ ] Personalización visual avanzada.
- [ ] Editor interno de mapas.
- [ ] Pipeline automático desde Aseprite.
- [ ] Variantes visuales extensas por objeto.
- [ ] Cinemáticas.

## Plataforma

- [ ] Controles móviles.
- [ ] Aplicación móvil.
- [ ] Soporte para control.
- [ ] Localización.
- [ ] Accesibilidad ampliada.

---

# 30. Decisiones pendientes

Estas decisiones no bloquean el Paso 1, pero deben resolverse antes de las fases indicadas.

- [ ] Nombre final del juego.
- [ ] Identidad visual final.
- [ ] Sistema de autenticación definitivo.
- [ ] Colyseus o Socket.IO según prototipo.
- [ ] Phaser con Arcade Physics o sistema propio.
- [ ] Estilo de inventario: lista o cuadrícula.
- [ ] Regla exacta de muerte en solitario.
- [ ] Curva de experiencia.
- [ ] Si la eficiencia ausente inicial queda en 80 % o se ajusta.
- [ ] Si el límite inicial será de 8, 12 o 24 horas.
- [ ] Cantidad mínima de enemigos para validar la muestra.
- [ ] Techo de objetos raros por hora y por zona.
- [ ] Si se guardan calibraciones para reutilizarlas con la misma build.
- [ ] Modelo de hosting.
- [ ] Tamaño final de frames del arte definitivo.
- [ ] Si los sprites finales usan spritesheets o texture atlases.
- [ ] Si izquierda se dibuja o se espeja por asset.
- [ ] Presupuesto máximo de descarga inicial.
- [ ] Política de pestaña oculta durante la calibración.
- [ ] Capacidad y vencimiento del buzón temporal.
- [ ] Política de conservación de datos.

# 31. Reglas para evitar sobrearquitectura

- No crear microservicios para el MVP.
- No introducir colas distribuidas sin necesidad comprobada.
- No usar Redis hasta que exista un problema real de escalado o coordinación.
- No construir un editor genérico para todo.
- No crear un motor propio si Phaser cubre el caso.
- No crear sistemas de plugins.
- No construir un editor de animaciones dentro del juego.
- No obligar a usar arte final antes de validar la jugabilidad.
- No acoplar la lógica de combate a nombres de archivos.
- No cargar todos los assets del juego al inicio.
- No implementar contenido posterior al MVP.
- No optimizar antes de medir.
- No mezclar lógica de juego con componentes visuales.
- No crear un segundo juego o perfil local para simular el modo offline.
- El modo ausente debe ser un cálculo de servidor, no una simulación permanente.
- No duplicar modelos entre cliente y servidor.
- No introducir dependencias por tareas que pueden resolverse con pocas funciones claras.

---

# 32. Formato del informe de Codex

Al terminar cada sesión, Codex debe responder con:

## Resumen

Qué se implementó.

## Archivos principales

Archivos creados o modificados.

## Pruebas ejecutadas

Comandos y resultados.

## Verificación manual

Qué flujo se probó.

## Pendientes

Errores, riesgos o decisiones abiertas.

## Próximo paso

Abrir el Paso 18 — Arte, audio y feedback. El Paso 17 de pueblo y economía queda cerrado con
comerciante, cofre, portal, tutorial y ledgers persistentes; el Paso 10 continúa postergado por el
Bosque infinito.

También debe actualizar el registro siguiente.

---

# 33. Registro de progreso

| Fecha | Paso | Estado | Resumen | Pruebas | Próximo |
|---|---:|---|---|---|---|
| 2026-08-06 | MVP jugable desplegado (un solo origen) | Completado | Se desplegó a Railway como **un solo servicio** (`deploy/Dockerfile.allinone`): el mismo proceso Fastify sirve el frontend compilado, `/api` y `/ws`. Esto no es una simplificación cosmética: con web y API en dominios distintos la cookie de sesión pasa a ser de terceros y necesitaría `SameSite=None`, que los navegadores que están retirando cookies de terceros rechazan — el síntoma habría sido "el login responde 200 pero seguís deslogueado". Se agregó `@fastify/static` detrás de `WEB_DIST_PATH`/`SERVE_WEB` (opt-in, los tests y el dev de dos procesos quedan intactos) con fallback SPA que preserva 404 JSON en `/api` y `/ws`. `defaultApiBaseUrl()` ahora usa el origen de la página por defecto: NO puede depender de `import.meta.env.PROD` porque el `.env` de la raíz define `NODE_ENV=development` y Vite lo respeta incluso en `vite build` — un bundle de producción real salió con `PROD:false` apuntando a localhost:3001. El HUD dejó de mostrar oro/cristales/esquirlas/hojas ficticios: muestra oro y materiales reales del servidor, y descarta las tres monedas que no existen en ningún contrato. Los tres enemigos sin arte propia (esbirro, chamán, bestia) ganaron escala diferenciada para no compartir silueta exacta con el Guardián. | `pnpm test` (71 archivos/336 tests); `pnpm test:integration` (7 archivos/31 tests); `pnpm typecheck`; `pnpm lint`; `pnpm build`; verificación en vivo del modo un-solo-origen en `http://localhost:3061` (`/api/status` 200 mismo origen, sin CORS, deep-link `/mundo` sirve index.html) | PENDIENTE REAL: no se pudo probar el flujo autenticado extremo a extremo (crear cuenta → jugar → morir → volver al pueblo → persistir) porque no ingreso credenciales; lo debe verificar una persona. Los sprites de esbirro/chamán/bestia siguen siendo el Guardián tintado y reescalado — no hay generación de pixel art disponible en esta sesión; `scripts/pixellab-process-character.mjs` sólo procesa un export ya descargado de PixelLab. Chat, buffs y party del HUD siguen siendo fixtures. `attack_speed_minor` de los ítems sigue sin efecto |
| 2026-08-06 | Corrección: el equipo era solo visual | Completado | El equipamiento (arma/armadura) modificaba únicamente el sprite del Guardián — nunca sus stats de combate; el comentario del código lo advertía explícitamente. `GuardianCombatTuning` ahora acepta bonos aditivos opcionales de equipo (`armorBonus`, `physicalDamageBonus`, `maxHealthBonus`, `criticalChanceBonus`, todos por defecto 0 para no romper tuning existente); `createGuardianCombatState`, `criticalChance` y `resolvePhysicalDamage` los aplican. `LocalCombatController.applyCharacterProfile` los recibe y reconstruye armadura/vida máxima manteniendo la fracción de vida actual. El cliente reutiliza `InventorySnapshot.derivedStats` (ya calculado server-side por `InventoryService.deriveStats`, antes usado solo para mostrar la hoja de Inventario) y lo prioriza sobre los atributos base al armar el perfil que se envía a `setCharacterProfile`, así que fuerza/destreza/vitalidad de gear entran igual que fuerza/destreza/vitalidad de nivel. `critical_chance` del ítem se convierte de puntos porcentuales a fracción antes de sumarse. | `packages/shared/src/combat.test.ts` (16/16, incluye bono de equipo con RNG que refleja el piso del rango de daño); `apps/web/src/game/combat-controller.test.ts` (19/19, incluye que gear haga pegar más fuerte y suba vida máxima); `apps/web/src/game/GameIsland.test.tsx` (8/8, incluye que equipmentStats gane sobre los atributos base); `pnpm test` (71 archivos/334 tests); `pnpm test:integration` (7 archivos/31 tests); `pnpm typecheck`; `pnpm lint` | `attack_speed_minor` del ítem queda sin efecto porque el combate no tiene mecánica de velocidad de ataque todavía — no se inventó una para no ampliar alcance sin pedido explícito; equipar una pieza nueva sin salir de `/mundo` no refresca el combate en caliente porque el fetch de inventario ocurre solo al montar `GameIsland`, que siempre remonta al re-entrar |
| 2026-08-05 | Corrección: la experiencia de sesión no se persistía | Completado | El combate del arena local (client-simulado) nunca reportaba nada al servidor: el contador "EXP SESIÓN" del HUD subía pero la barra "NIVEL" persistida (`/api/characters/:id/progress`) quedaba fija en 0/100 para siempre, porque el checkpoint sólo actualizaba `lastSeenAt`/`revision` e ignoraba cualquier XP ganada. El checkpoint ahora acepta `experienceGained` (string decimal, opcional), la aplica una única vez dentro de la misma transacción idempotente por `operationId` vía `applyExperience`, y la limita a 5.000 XP por checkpoint — tope explícito porque el cliente reporta esta cifra sin que el servidor pueda validar cada kill (esa autoridad por-enemigo sólo existe hoy para el loop de party/instancia, no para el arena local). El cliente calcula el delta no sincronizado desde el último checkpoint exitoso, lo envía al volver al Pueblo o al guardar manualmente, y refresca la hoja de progresión tras un envío exitoso para que Nivel/atributos dejen de quedar retrasados. | `apps/server/src/auth/auth.integration.test.ts` (13/13, incluye tope y aplicación única); `apps/web/src/game/GameIsland.test.tsx` (7/7, incluye no reenviar XP ya sincronizada); `pnpm test` (71 archivos/331 tests); `pnpm test:integration` (7 archivos/31 tests); `pnpm typecheck`; `pnpm lint`; verificación en vivo de servidor+web reiniciados en caliente (`http://localhost:5273` → EN LÍNEA) | El tope de 5.000 XP por checkpoint es un parche de confianza en el cliente, no anti-cheat real; la solución de fondo es que el arena local reporte kills contra una instancia server-tracked, como ya hace el loop de party (`grantDefeatRewards`) |
| 2026-08-05 | Correcciones de juego + puerta de entrada MMO | Completado local | Las flechas enemigas se dibujan y estallan a la altura del pecho (simulación intacta, sigue en el plano del suelo); el margen superior del mapa contempla la silueta de 92px y la cámara gana relleno para que caminar al norte no saque al personaje de cuadro; el panel de caída ofrece "Volver al pueblo"; las pociones curan de verdad (25 cargas, 35% de vida, 8s de reutilización, tecla X) y sólo gastan carga si curan; la entrada se rehízo como portal de MMO clásico (`Gateway` + `CharacterSelect`) con arte a sangre, marco ornamentado y "Entrar al mundo" — se retiró el vocabulario de "partida" y la ruta pasó a `/mundo`; el combate ahora usa nivel y atributos autoritativos del personaje en lugar del tuning fijo del catálogo. | `pnpm test` (71 archivos/330 tests); `pnpm typecheck`; `pnpm lint`; verificación visual del portal en `http://localhost:5273` con API real | Pendiente: que armas y armaduras equipadas modifiquen daño/armadura en combate (hoy sólo son visuales); despliegue online para jugar con amigos; reemplazar las fixtures restantes del HUD (buffs, chat, recursos) por datos reales |
| 2026-08-05 | Corrección de desarrollo local | Completado | El servidor acepta también el origen loopback alternativo `5176` para que el frontend en ese puerto pueda comunicarse con la API sin ser bloqueado por CORS; se agregó una regresión del encabezado `Access-Control-Allow-Origin`. | `apps/server/src/app.test.ts` (4/4); verificación real `http://127.0.0.1:5176` → `http://127.0.0.1:3003`; `pnpm exec prettier --check` | Mantener sincronizados los puertos de desarrollo y la URL de API cuando se cambie de puerto |
| 2026-08-05 | Mantenimiento UI/runtime | Completado | Cámara del preview más alejada (`1.75x`) y seguimiento continuo; jugador y enemigos quedan limitados al mapa; el preview de combate no monta cofres, altares ni marcadores de interacción; se retiraron Pausar/Guardar, XP del Bosque y Party ficticia del HUD; las bonificaciones activas ocupan menos espacio; seleccionar un Guardián navega siempre a Pueblo. | `pnpm test` (69 archivos, 313 tests); `pnpm typecheck`; `pnpm lint`; `pnpm build`; `git diff --check` | Mantener la XP del Bosque sólo en dominio hasta que GOAL defina su retiro completo; Party reaparecerá únicamente al conectar datos de grupo reales |
| 2026-08-05 | Mantenimiento personaje/clases/movimiento | Completado | Se quitaron las colisiones de paredes decorativas del runtime: el movimiento y el knockback sólo respetan los límites del mapa, con regresión de bounds. La creación persistente ofrece Amazona, Asesina, Bárbara, Druida, Nigromante, Paladín y Hechicera; todas comparten provisionalmente el perfil de combate del Guardián y `GUARDIAN` queda como fallback legado. El snapshot autoritativo de XP/nivel/atributos/habilidades se refleja en Personaje, Habilidades y HUD con barra de experiencia, que se refresca al recibir `REWARD_GRANTED`. | `pnpm test` (70 archivos/318 tests); `pnpm test:integration` (7 archivos/30 tests); `pnpm typecheck`; `pnpm lint`; `pnpm build`; `git diff --check` | Implementar kits, recursos y árboles de habilidades diferenciados sólo con un plan de expansión y balance propio; no mezclar XP del Bosque con XP de personaje |
| 2026-08-05 | Progresión local y corrección de kite | Completado local | La preview aplica XP de cada mob a una progresión local versionada y persistida, entrega puntos al subir de nivel y permite asignar atributos desde la hoja local; el movimiento `keepDistance` queda reservado a la etiqueta explícita y los enemigos actuales no retroceden. | `pnpm test` (71 archivos/324 tests); `pnpm test:integration` (7 archivos/30 tests); `pnpm typecheck`; `pnpm lint`; `pnpm build` (warning conocido de chunk runtime grande); `pnpm format:check`; `git diff --check`; smoke HTTP 200 en `/`, `/bruto-preview` y `/health` | Conectar la progresión autenticada al runtime WebSocket en el siguiente hito online |
| 2026-08-05 | Guardado/combate/preparación online | Completado local | Cada mob conserva su XP por recompensa server-side idempotente; volver al Pueblo dispara un checkpoint autenticado con snapshot `saveVersion: 2` de progresión/Bosque y actualiza `lastSeenAt`; el HUD muestra EXP de sesión; `powerStrike` ya no aleja mobs; el Arquero presenta una flecha orientada y pooled. Staging/Docker/CI existentes quedan listos para completar con proveedor, dominio, TLS y secretos reales. | `pnpm test` (70 archivos/319 tests); `pnpm test:integration` (7 archivos/30 tests); `pnpm typecheck`; `pnpm lint`; `pnpm build`; Prettier focalizado; `git diff --check`; smoke HTTP 200 en web raíz, `/bruto-preview` y `/health` | Ejecutar staging con entorno administrado y, luego, conectar comandos WebSocket del runtime para una prueba online completa |
| 2026-08-05 | Paso 4: autenticación y perfiles | Ajuste completado | La creación e inicio de sesión aceptan contraseñas de mínimo 6 caracteres (máximo 128), con la misma regla en servidor y formulario web. | `apps/server/src/auth/contracts.test.ts`; `pnpm test`; `pnpm typecheck`; `pnpm lint`; `pnpm build` | Mantener la validación de credenciales alineada entre cliente y servidor |
| 2026-08-04 | Paso 11: inventario, equipamiento y loot | Completado | Catalogo versionado con 25 objetos, 12 afijos y legendario de Guardian; generador seedable; `InventoryService` con ownership, equipar/desequipar, favorito, venta, protecciones y ledger `InventoryOperation`; drops atomicos en `RewardLog` y `REWARD_GRANTED`; `Inventory.tsx` usa snapshot real y stats derivados; `equipment-visual.ts` hidrata overlays placeholder desde el loadout confirmado. | `pnpm test` (55 archivos/274 tests); `pnpm test:integration` (3 archivos/24 tests); `pnpm lint`; `pnpm typecheck`; `pnpm build`; `pnpm db:migrate:deploy`; `pnpm exec prettier --check` focalizado; `git diff --check`; smoke autenticado en `http://localhost:5173/partida` con inventario 1/40, mandoble equipado, stats server-side y screenshot con arma visible | Las capas authored por frame y compatibilidad exhaustiva quedan delegadas al Paso 18; siguiente: Paso 12 — experiencia, atributos y habilidades |
| 2026-08-04 | Paso 12: niveles, atributos y habilidades | Completado | `GAME_DATA.progression` y `shared/progression` separan XP del personaje del Bosque; recompensas/economia aplican nivel y puntos; `ProgressionService` expone snapshot, distribución, respec, desbloqueo y barra con ledger idempotente; Personaje/Habilidades y HUD consumen la build server-side. | `pnpm test -- --run` (56 archivos/278 tests); `pnpm test:integration` (4 archivos/25 tests); `pnpm typecheck`; `pnpm lint`; `pnpm build`; smoke autenticado en `/personaje`, `/habilidades` y `/partida` | Siguiente: Paso 15 — recompensas multiplayer y loot privado; Paso 10 continúa postergado |
| 2026-08-04 | Paso 14: recompensas y presentación | Completado | `EnemyRewardService` entrega XP, oro, materiales y progreso del Bosque por derrota server-side; `RewardLog` serializable, hash/replay/conflicto, `REWARD_GRANTED` privado y operación acotada. `game-session.ts` consume WS autenticado con backoff, `game-events.ts` valida/mapea eventos y el HUD muestra feed deduplicado de ocho entradas. El loot individual y el informe privado se cerraron en el Paso 15. | Focalizado 15/15; `pnpm test` (53 archivos/268 tests); `pnpm exec vitest run --config vitest.integration.config.ts --reporter=verbose` (2 archivos/22 tests); `pnpm lint`; `pnpm typecheck`; `pnpm build`; Prettier y `git diff --check` correctos | Paso 15: recompensas multiplayer/loot privado |
| 2026-08-03 | Plan transversal para Luna | Documentado, sin avance de paso | Auditoria del estado real y handoff ordenado para agrandar el HUD, cerrar Paso 8 con spawn/respawn continuo y luego completar Bosque/Expedicion, Inventario, Personaje/Habilidades, Modo ausente, Comerciante/Cofre, Ajustes y arte/VFX. No se marcaron sistemas incompletos como terminados. | Revision de `GOAL.md`, codigo runtime/UI, planes 8/9/UI y contratos de las skills aplicables; `pnpm exec prettier --check docs/plans/luna-continuation-plan.md` | Ejecutar solo el Milestone 1 de `docs/plans/luna-continuation-plan.md`; probar viewports y actualizar checkboxes antes de iniciar respawn |
| 2026-08-03 | Milestone 1 HUD | Completado | HUD principal expandido al viewport; stage y canvas contenidos; party/chat/buffs/avisos mantienen tamano legible; navegacion compacta accesible en mobile sin `transform: scale(0.86)` | `pnpm exec vitest run apps/web/src/game/GameHudOverlay.test.tsx` (4/4); `pnpm test` (32 archivos, 176 tests); `pnpm --filter @brecha/web typecheck`; `pnpm build`; smoke IAB 1440x900, 1280x720, 1920x1080 y 390x844 sin colisiones ni overflow | Milestone 2: respawn continuo del Paso 8; no iniciar pantallas de dominio |
| 2026-08-03 | Paso 8: ciclo de vida spawn/respawn | Parcial en curso | `EnemySpawnDirector` puro y determinista; cleanup/respawn diferido, IDs monotónicos, puntos seguros, retiro idempotente del controlador y recompensa XP deduplicada conectados al runtime. La composición rota los cinco tipos; todavía faltan abilities visuales, telegraphs, pooling y stress final. | `pnpm test` (33 archivos, 181 tests); `pnpm lint`; typecheck web/shared; `pnpm build`; Prettier check; smoke IAB AUTO con muestras `3 -> 2 -> 3` y `1 -> 3`, cero errores/warnings | Continuar Milestone 2: wiring de habilidades, estados visuales, pooling y escenario 30-40 entidades; no avanzar al Paso 9 |
| 2026-08-03 | Paso 8: lectura de cámara | Parcial en curso | La cámara del preview sigue al Guardián y muestra aproximadamente 30% más mundo: `CAMERA_ZOOM = 1.6 / 1.3`. El ajuste vive en la capa de presentación, no altera simulación, autoridad ni spawn. | `pnpm exec vitest run apps/web/src/game/runtime.test.ts` (4/4); typecheck web; smoke IAB en `bruto-preview` sin errores/warnings | Continuar Milestone 2: abilities/telegraphs, estados visuales, pooling y stress 30-40; no avanzar al Paso 9 |
| 2026-08-03 | Paso 8: perfiles de habilidad en runtime | Parcial en curso | `EnemyRecord` deriva los cinco perfiles desde `behaviors`; `runtime.ts` conecta melee, proyectil, curación de aliados, área telegrafiada y explosión telegrafiada. Daño resuelto una sola vez, curación con clamp, stun local y caps de seguridad 24/12 para proyectiles/telegraphs; pooling y estados finales siguen pendientes. | `pnpm exec vitest run apps/web/src/game/combat-controller.test.ts apps/web/src/game/sim/enemy-sim.test.ts packages/shared/src/combat.test.ts packages/shared/src/enemy-abilities.test.ts` (47/47); `pnpm lint`; typecheck web/shared; smoke IAB AUTO con un canvas, `cameraZoom=1.230769` y cero errores/warnings | Continuar Milestone 2: estados visuales `idle/walk/attack/hit/death`; luego pooling y stress 30-40; no avanzar al Paso 9 |
| 2026-08-04 | Paso 8: estados visuales mínimos | Parcial en curso | Nuevo latch de presentación para `hit` temporal y `death` terminal hasta cleanup; runtime reinicia ataques por token, mantiene `idle/walk/attack` y usa fallback `idle` cuando falta arte. El canvas expone `data-enemy-visual-states` sólo para smoke; no altera reglas de combate. | `pnpm test` (35 archivos, 189 tests), `pnpm lint`, typecheck web, `pnpm build`, Prettier check y `git diff --check`; targeted 24/24 para el adaptador; smoke IAB con `idle:3` al inicio, `attack:1` durante AUTO, un canvas y cero errores/warnings | Continuar Milestone 2: pooling y stress 30-40; no avanzar al Paso 9 |
| 2026-08-04 | Paso 8: pooling y stress de enemigos | Parcial en curso | `ObjectPool` puro con reset/idempotencia y pools Phaser preasignados para 24 proyectiles, 12 telegraphs y 64 bursts; `?enemyStress=40` crea 40 enemigos en puntos seguros deterministas y publica métricas de frame/memoria. No se crean GameObjects de efectos dentro de `update()`. | `pnpm test` (37 archivos, 196 tests); `pnpm lint`; typecheck web; `pnpm build`; Prettier check; smoke IAB `?enemyStress=3` (p95 RAF 5.700 ms, update p95 0.200 ms, heap 123504090) y `?enemyStress=40` (p95 RAF 5.700 ms, p99 5.800 ms, update p95 0.500 ms, heap 158770075, 600 muestras), un canvas y pools dentro de capacidad | Continuar Paso 8: estados visuales avanzados del contrato de 11 estados; no avanzar al Paso 9 |
| 2026-08-04 | Paso 8: estados visuales avanzados | Parcial en curso | El adaptador mapea los nueve estados de IA a `moving/interacting/attacking/casting/channeling/stunned/dead`, agrega reacción temporal `knocked_back` y conserva `mapState/pickAnimation` como fallback por personaje. `downed/reviving` no se inventan para enemigos porque requieren otro ciclo de vida; faltan clips dedicados para cerrar el contrato completo. | `pnpm test` (37 archivos, 196 tests); typecheck web; `enemy-visual-state.test.ts` (4/4); smoke IAB `?enemyStress=40` con `data-enemy-visual-advanced`, un canvas y pools dentro de capacidad | Continuar Paso 8: clips/animaciones dedicadas y cierre final; no avanzar al Paso 9 |
| 2026-08-04 | Paso 8: cierre de enemigos e IA | Completado | Paso 8 cerrado: cinco perfiles en runtime, telegraphs/proyectiles, spawn/cleanup/respawn continuo, estados visuales aplicables con fallback, pools de efectos y arte `ranger` para el Arquero junto a `root_brute`. `downed/reviving` quedan en el ciclo del Guardián; clips dedicados restantes son opcionales del Paso 18. | `pnpm test` (37 archivos, 197 tests); `pnpm lint`; typecheck web; `pnpm build`; Prettier; `git diff --check`; smoke IAB normal y `?enemyStress=40` con un canvas, 40 enemigos, 600 muestras RAF, p95/p99, memoria y pools dentro de capacidad | Paso 9: Bosque infinito y Expedición; no iniciar pantallas posteriores |
| 2026-08-04 | Paso 9: oleadas, HUD y Expedición | En curso | M1-M5 implementados: curva versionada 1-20, `ForestProgressState`, `applyDefeat` idempotente, validación monótona y `createForestWave` con composición seedeada/`spawnKey` estable. `runtime.ts` instancia la oleada inicial, aplica level-up y reconfigura el mismo `EnemySpawnDirector` sin resetear IDs, cleanup ni respawn; el HUD publica nivel/XP/oleada. `Expedition` ofrece Bosque Corrupto + Normal y entrada/salida coherentes desde Pueblo. | `pnpm exec vitest run packages/shared/src/endless-forest.test.ts packages/shared/src/forest-waves.test.ts packages/shared/src/enemy-spawn.test.ts packages/game-data/src/validation.test.ts apps/web/src/game/endless-forest-runtime.test.ts` (25/25); `pnpm test` (40 archivos, 205 tests); `pnpm lint`; typecheck web; `pnpm build`; Prettier focalizado; `git diff --check`; smoke IAB `/expedicion` → `/pueblo` → `/bruto-preview`, nivel 1/oleada 3, luego AUTO nivel 2/oleada 4/36 XP, consola limpia | Continuar el Paso 9 con persistencia; no avanzar al Paso 10 |
| 2026-08-04 | Paso 9: contrato común de interacción | Base preparada | `packages/shared/src/interaction.ts` define targets `npc`/`chest`/`revive`, validación de radio y disponibilidad, consumo `oneShot`, razones de rechazo y recibos idempotentes por `operationId`; no conecta aún efectos visuales, autoridad ni persistencia. | `pnpm exec vitest run packages/shared/src/interaction.test.ts` (5/5); incluido en `pnpm test` (41 archivos, 210 tests) | Conectar `applyInteraction` al runtime y a la entrada `F`; después persistir, sin avanzar al Paso 10 |
| 2026-08-04 | Paso 9: wiring local de interacción | Completado en preview | `interaction-runtime.ts` define targets visuales de cofre/NPC/reanimación; `runtime.ts` escucha `F`, valida mediante `applyInteraction`, actualiza el ledger inmutable y publica `data-interaction-*`. El cofre inicial acepta una vez y el prompt desaparece; no se inventan recompensas ni autoridad de cliente. | `pnpm exec vitest run apps/web/src/game/interaction-runtime.test.ts packages/shared/src/interaction.test.ts` (8/8); `pnpm test` (42 archivos, 213 tests); `pnpm lint`; typecheck web; `pnpm build`; smoke IAB limpio, un canvas y ledger `0→1` | Siguiente pendiente: persistir `ForestProgressState` con versión/migración; mantener autoridad/recompensas de interacción en servidor |
| 2026-08-04 | Paso 9: persistencia V1 del Bosque | Completado | `forest-progress-save.ts` define envelope/migrador V1 y convierte `ReadonlySet` a array ordenado; `CharacterForestProgress` se crea/backfillea con migración SQL. `ForestProgressRepository` valida contra la curva actual, exige ownership y `expectedRevision`, guarda en `Serializable` y rechaza snapshots/revisiones obsoletas. La API sólo expone GET para hidratar; no acepta estado arbitrario del cliente. | `pnpm exec vitest run packages/shared/src/forest-progress-save.test.ts` (4/4); `pnpm test:integration` (2 archivos, 15 tests); typecheck shared/server; `pnpm db:generate`; Prettier; migración desde DB vacía | Siguiente pendiente: comando autoritativo de interacción y recompensas idempotentes; no abrir Paso 10 |
| 2026-08-04 | Paso 9: adaptador server-side de interacción | Base preparada | `InteractionCommandSchema` separa intención de identidad/posición; `InteractionAuthorityService` valida ownership/estado, usa targets desde `@brecha/game-data`, valida alcance con posición del tick y persiste `CharacterInteractionState`/`CharacterInteractionReceipt` con replay/conflicto por `operationId`. No se conecta al WebSocket mientras el Paso 14 no tenga estado autoritativo de instancia y no se resuelven recompensas desde cliente. | `pnpm exec vitest run packages/shared/src/interaction.test.ts` (7/7); `pnpm test:integration` (2 archivos, 16 tests); typecheck shared/game-data/server; migración desde DB vacía; Prettier | Siguiente pendiente: integrar el servicio al tick/transport de gameplay y resolver efectos/recompensas server-side; no abrir Paso 10 |
| 2026-08-04 | Paso 9: transporte de interacción WebSocket | Completado en adaptador | `/ws` valida `ClientEventSchema`, acepta sólo `INTERACT_INTENT`, deriva el personaje seleccionado, mantiene posición de spawn server-side, aplica rate limit 30/min y rechaza secuencias obsoletas. Responde `INTERACTION_RESULT`; posición, reloj y recompensas no vienen del cliente. La instancia/tick real y los efectos de dominio siguen pendientes. | `pnpm test` (43 archivos, 219 tests); `pnpm test:integration` (2 archivos, 17 tests); `pnpm lint`; `pnpm typecheck`; `pnpm build`; Prisma validate/format; prueba WS de aceptación, replay, payload con posición falsificada y secuencia obsoleta | Siguiente pendiente: conectar la posición al tick de instancia del Paso 14 y resolver loot/diálogo/reanimación idempotentes; no abrir Paso 10 |
| 2026-08-04 | Paso 9: contrato común de interacción V2 | Completado | `InteractionTarget` admite los tipos de interacción definidos por GOAL y declara distancia, duración, estados, interrupción por daño, autoridad, `resultId`, UI y cooldown. `applyInteraction` mantiene ledger V2, ventanas de finalización y rechazos deterministas; la migración `20260804020000_interaction_contract_v2` agrega cooldowns sin alterar recibos V1. Preview, servicio y WS consumen el mismo contrato; los efectos concretos quedan en dominios posteriores. | `pnpm test` (44 archivos, 221 tests); `pnpm test:integration` (2 archivos, 17 tests); focused interaction (12/12); typecheck shared/game-data/server/web; lint; Prisma validate/format; migración desde DB vacía | Siguiente pendiente: instancia/tick real del Paso 14 y efectos de dominio; minimapa/checkpoints siguen postergados; no abrir Paso 10 |
| 2026-08-04 | Paso 14: estado autoritativo de instancia | Base implementada | `packages/shared/src/instance.ts` define estado versionado puro, tick monotónico, límites de mundo y movimiento por vector normalizado; `ActiveInstanceRegistry` conserva instancias por party/personaje, valida dueño/zona/dificultad, comparte estado entre hasta cuatro jugadores y el WebSocket procesa `MOVE_INTENT` sin confiar en posiciones absolutas. El transporte emite `INSTANCE_SNAPSHOT` tras movimiento/interacción. Las finalizaciones de interacción pasan por `InteractionEffectService` y `CharacterInteractionEffect`: reanimación/diálogo idempotentes y loot sólo autorizado como `PENDING_DOMAIN`. Combate, enemigos y fin de partida siguen pendientes. | `pnpm test` (48 archivos, 243 tests); `pnpm test:integration` (2 archivos, 20 tests); focused instancia/party/enemigos/combat; lint, typecheck y build; Prisma generate/format | Siguiente: completar combate/enemigos autoritativos; después limpieza durable y reconexión completa |
| 2026-08-04 | Paso 13/14: party y snapshots compartidos | Base implementada | `packages/shared/src/party.ts` y `network.ts` versionan intents/snapshots; `PartyRegistry` crea/une parties por código, limita a cuatro, coordina readiness, transfiere líder y bloquea joins después de iniciar. `/ws` materializa miembros listos en una instancia común y retransmite snapshots a los sockets; el movimiento de un miembro se observa desde el otro y la reconexión recupera party + instancia. El cleanup TTL y la reconexión del líder están probados; la persistencia social durable queda pendiente. | `pnpm exec vitest run apps/server/src/gameplay/party-registry.test.ts apps/server/src/gameplay/instance-registry.test.ts` (10/10); prueba WS de party incluida en `pnpm test:integration` (20/20); suite completa 48/243; lint/typecheck/build correctos | Siguiente: completar habilidades autoritativas; no abrir inventario/loot todavía |
| 2026-08-04 | Paso 14: snapshot inicial de enemigos | Base implementada | `ActiveInstanceState`/`InstanceSnapshot` incluyen hasta 64 enemigos con IDs, arquetipo, posición, vida y estado validados; `createInitialForestEnemies` usa `createForestWave` + seed derivada de `instanceId` y tuning de nivel 1. El spawn ocurre server-side al iniciar party o entrar solo y no acepta posiciones/vida del cliente. Falta resolver IA, ataques enemigos, muerte, cleanup y respawn en sus hilos de dominio. | `pnpm exec vitest run packages/shared/src/instance.test.ts apps/server/src/gameplay/instance-registry.test.ts` (14/14); WS de dos clientes verifica 3 enemigos compartidos; typecheck server | Siguiente checkbox: cerrar IA/ataques/muerte/respawn de enemigos; no adelantar loot/inventario |
| 2026-08-04 | Paso 14: ataque autoritativo mínimo | Parcial en curso | `CombatAuthority` procesa `COMBAT_INTENT` para las cuatro habilidades del Guardián, valida ownership/estado/cooldown/Furia/objetivo/alcance, usa RNG determinista, aplica daño y estado del enemigo, y deduplica replay por `operationId`. `COMBAT_RESULT` y `INSTANCE_SNAPSHOT` se replican a toda la party; todavía faltan efectos completos de habilidades, impactos diferidos/multiobjetivo, IA/ataques enemigos, muerte/respawn, loot y persistencia. | `pnpm exec vitest run apps/server/src/gameplay/combat-authority.test.ts packages/shared/src/instance.test.ts packages/shared/src/contracts.test.ts` (16/16); `pnpm test` (48/243); `pnpm test:integration` (2/20); lint/typecheck/build | Siguiente checkbox incompleto: validar habilidades completas; mantener servidor como autoridad |
| 2026-08-04 | Paso 14: habilidades inmediatas autoritativas | Parcial en curso | `CombatAuthority` valida las cuatro habilidades del Guardián desde datos versionados: Slash/Golpe poderoso usan arco y `maxTargets`, Torbellino usa radio sin target y Piel de hierro es self-targeted. `COMBAT_RESULT` incluye `hits[]`, daño total, knockback, ventana de reducción y multiplicador de movimiento; el servidor normaliza facing y nunca acepta vida/daño del cliente. Faltan impactos diferidos por tick, habilidades/ataques enemigos, muerte/respawn y recompensas. | `pnpm exec vitest run apps/server/src/gameplay/combat-authority.test.ts packages/shared/src/combat.test.ts packages/shared/src/contracts.test.ts` (25/25); `pnpm test` (48/245); `pnpm test:integration` (2/20); typecheck server/shared | Siguiente: impactos diferidos y sincronización de objetivos/enemigos |
| 2026-08-04 | Paso 13: cleanup y reconexión de lobby | Completado | `PartyRegistry` registra actividad, aplica TTL configurable de 15 minutos por defecto y elimina sólo lobbies en estado `LOBBY` cuyos miembros están todos desconectados. El cleanup se ejecuta al conectar, al procesar comandos y en un intervalo `unref`; parties activas nunca se limpian por este mecanismo. La reconexión autenticada del líder recupera el snapshot de lobby sin perder código, líder, readiness ni revisión. La persistencia social durable sigue fuera del hito porque el lobby es process-local temporal. | `pnpm exec vitest run apps/server/src/gameplay/party-registry.test.ts` (4/4); prueba WebSocket enfocada (11/11); Prettier focalizado | Siguiente: completar habilidades autoritativas del Paso 14 |
| 2026-08-04 | Paso 14: impactos diferidos autoritativos | Parcial en curso | `CombatAuthority.advance` procesa una cola server-side por personaje. Slash y Golpe poderoso difieren el daño según `impactMs`; Torbellino resuelve el primer tick y agenda los siguientes según `tickOffsetsMs`. Un intervalo `unref` de 50 ms avanza el reloj aun sin nuevos comandos y replica actualizaciones del mismo `operationId`; el replay devuelve el último resultado sin duplicar daño. Faltan IA/ataques enemigos, muerte/respawn, loot y recompensas. | `pnpm exec vitest run apps/server/src/gameplay/combat-authority.test.ts packages/shared/src/contracts.test.ts` (10/10); `pnpm test` (48 archivos, 245 tests); `pnpm test:integration` (2 archivos, 20 tests); `pnpm lint`; `pnpm typecheck`; `pnpm build`; Prettier y `git diff --check` | Siguiente: completar autoridad de enemigos y cierre del encuentro del Paso 14; no abrir inventario/loot todavía |
| 2026-08-04 | Paso 14: autoridad de enemigos y ataques PvE | Parcial en curso | `EnemyAuthority` conecta FSM/steering con `ActiveInstanceRegistry`, procesa cada instancia una sola vez por tick y expone `aiState` en el snapshot. Los cinco perfiles del catálogo ya actúan server-side: melee con fórmula compartida, proyectil del Arquero, telégrafos de Bruto/Bestia y curación del Chamán; `CombatAuthority` aplica daño al Guardián respetando armadura, Piel de hierro, Furia y derribo. Tuning atacante versionado en `2026.08.04.1`. Faltan muerte/cleanup/respawn, recompensas/loot y eventos visuales de red. | `pnpm exec vitest run apps/server/src/gameplay/enemy-authority.test.ts` (3/3); `pnpm test` (49 archivos, 248 tests); `pnpm test:integration` (2 archivos, 20 tests); `pnpm lint`; `pnpm typecheck`; `pnpm build`; Prettier y `git diff --check` | Siguiente: cerrar muerte/cleanup/respawn y recompensas del encuentro del Paso 14; no abrir inventario/loot todavía |
| 2026-08-04 | Paso 14: muerte, cleanup y respawn autoritativos | Parcial en curso | Los golpes server-side guardan `deadAtMs`; `EnemyAuthority` conserva la entidad durante 500 ms para la animación, retira proyectiles/telegraphs pendientes, libera el slot y agenda respawn 1500 ms después. El nuevo enemigo recibe ID monotónico por instancia, vida del catálogo, `aiState: idle` y un spawn elegido por seed fuera del radio seguro de jugadores/enemigos. Falta conectar el ledger de XP/recompensas y loot al evento de derrota. | `pnpm exec vitest run apps/server/src/gameplay/enemy-authority.test.ts` (4/4); `pnpm test` (49 archivos, 249 tests); `pnpm test:integration` (2 archivos, 20 tests); `pnpm lint`; typecheck server/shared; `pnpm build`; Prettier y `git diff --check` | Siguiente checkbox de GOAL: sincronizar objetivos; no abrir Paso 15 ni inventario/loot todavía |
| 2026-08-04 | Paso 14: sincronización de objetivos del Bosque | Completado en alcance vigente | `InstanceObjectiveState` es un contrato server-side versionado por snapshot: ID estable, modo `endless_forest`, estado, progreso y target; el estado de instancia rechaza IDs duplicados y progreso fuera de rango. La party y la reconexión reciben la misma lista de objetivo de nivel 1→20. La misión finita de altares/jefe no se reintroduce; XP/recompensas que hacen avanzar el nivel quedan en el dominio posterior. | `pnpm test` (49 archivos, 252 tests); `pnpm test:integration` (2 archivos, 20 tests); `pnpm lint`; `pnpm typecheck`; `pnpm build`; Prettier focalizado y `git diff --check` | Siguiente: reanimación autoritativa; jefe e interpolación/predicción/reconciliación documentados como sustituidos por el modelo infinito/tick |
| 2026-08-04 | Paso 14: reanimación autoritativa | Completado | `selectReviveTarget` elige al compañero derribado más cercano con tie-break estable; el recibo persistente conserva `effectCharacterId` para retries/reconexión. `ActiveInstanceRegistry` agenda y finaliza la duración del altar en el tick, marca interrupción por daño incluso en el mismo tick, y `InteractionEffectService` aplica vida/estado al destinatario una sola vez. `INTERACTION_EFFECT`/`INTERACTION_INTERRUPTED` y el snapshot se envían a la party; ningún dato de vida o destinatario viene del cliente. | `pnpm test` (50 archivos, 256 tests); `pnpm test:integration` (2 archivos, 20 tests); `pnpm typecheck`; focused revive/registry/persistence; lint y build pendientes de la verificación final de sesión | Siguiente: reconexión completa y cierre de fin de partida aplicable; no abrir Paso 15 ni inventario/loot |
| 2026-08-04 | Paso 14: reconexión, cierre aplicable y tráfico | Completado en alcance vigente | El WebSocket reproduce `PARTY_SNAPSHOT` e `INSTANCE_SNAPSHOT` al reconectar con la misma sesión y conserva la instancia/tick aunque no haya comandos; el TTL elimina sólo lobbies abandonados y las parties activas bloquean joins tardíos. El Bosque infinito no tiene victoria/derrota terminal; `downed`/reanimación es el cierre de ciclo vigente. `TrafficMetrics` mide mensajes/bytes en ambos sentidos, tasas y p95 acotado de snapshots; `GET /api/metrics/network` expone una ventana autenticada de 60 s sin payloads ni IDs. | `pnpm typecheck`; `pnpm exec vitest run apps/server/src/gameplay/traffic-metrics.test.ts apps/server/src/gameplay/instance-registry.test.ts` (12/12); reconexión WebSocket de lobby/partida en integración; `pnpm test` (51 archivos, 261 tests) y `pnpm test:integration` (2 archivos, 20 tests) | Resolver los ítems parciales restantes del Paso 14 (recompensas/loot y presentación de eventos) antes de abrir Paso 15 |
| 2026-08-04 | Paso 9: Guardian derribado no terminal | Completado | `tryActivateAbility` rechaza habilidades con razón `downed`; el runtime bloquea movimiento y AUTO al llegar a 0 vida, mantiene la reanimación como interacción disponible, cambia el estado visual a `downed`/death y el HUD muestra aviso y deshabilita controles de combate. No se inventa reanimación local: el efecto sigue pendiente del tick/instancia autoritativa. | `pnpm test` (44 archivos, 223 tests); `pnpm test:integration` (2 archivos, 17 tests); focused (35/35); lint, typecheck, build, Prisma validate/format y Prettier focalizado | Continuar instancia/tick del Paso 14 y resolver reanimación/loot/diálogo en dominios server-side; minimapa/checkpoints siguen postergados |
| 2026-08-04 | Backlog posterior confirmado | Documentado | El usuario priorizó, después de cerrar el GOAL, loot/objetos, XP/estadísticas/árbol de habilidades, ciudad/Pueblo y mejora de efectos/sprites/feedback. Se mantienen asignados a los Pasos 11, 12, 17 y 18, sin marcar implementación anticipada. | Revisión de alcance contra `GOAL.md`, `docs/plans/luna-continuation-plan.md` y arquitectura de módulos | Terminar primero la autoridad/recompensas de interacción del Paso 9 |
| 2026-08-04 | Mapa mundial y zonas idle | Planificado, post-GOAL | Se agregó `docs/plans/post-goal-world-map-idle.md` y el Milestone 10: catálogo `ZoneDefinition`, mapa de zonas desbloqueables, segunda zona vertical slice, seeds/recompensas versionadas y cálculo activo/offline autoritativo. No se crea contenido definitivo todavía. | Revisión de arquitectura, límites idle, generación determinista, persistencia y presupuestos de entidades; Prettier y `git diff --check` | Ejecutar sólo después de cerrar el Paso 9 y los Milestones 4–9 |
| 2026-08-03 | UI transversal (soporte Paso 8) | Completado | IntegraciÃ³n visual de la referencia `La Brecha Oscura UI completa (1).zip`: tokens, primitives, catÃ¡logo SVG inline, menÃº, pueblo, inventario y HUD sobre Phaser con topbar, vitals reales, buffs/party/chat/loot/notificaciones de presentaciÃ³n, habilidades, conexiÃ³n, pausa y checkpoint. Fixtures separados del dominio; no se modifican autoridad, economÃ­a ni persistencia. | `pnpm typecheck`; `pnpm test` (32 archivos, 175 tests); `pnpm build`; smoke IAB a 1672Ã—941 y 390Ã—844 sin overflow horizontal, canvas Ãºnico ni errores/warnings; clicks de habilidades, AUTO, pausa y navegaciÃ³n verificados | Mantener Paso 8 en curso: decidir assets/adaptador de enemigos y no adelantar pasos de dominio; ver `docs/plans/ui-ux-reference-integration.md` |
| Pendiente | 1 | No iniciado | Documento maestro consolidado para web, modo ausente, spritesheets, assets, mapas, audio, tutorial y herramientas internas | No aplica | Auditar repositorio |
| 2026-07-29 | 1 | Completado | Monorepo pnpm con cliente React/Vite, servidor Fastify, configuración estricta, PostgreSQL local y documentación de arquitectura, autoridad y modo ausente | Instalación congelada, formato, lint, typecheck, 1 test, build, smoke web/API, revisión visual y PostgreSQL healthy | Paso 2: crear paquete `shared` |
| 2026-07-29 | 2 | Completado | Contratos Zod y catálogo versionado compartidos por cliente y servidor: dominio, red, modo ausente, Guardián, objetos, enemigos, misión, balance, sprites y mapas | Instalación congelada, formato, lint, typecheck, 12 pruebas, build, auditoría de imports y smoke web/API | Paso 3: instalar y configurar Prisma |
| 2026-07-29 | 3 | Completado | Persistencia autoritativa en PostgreSQL con Prisma, agregado de personaje, ownership compuesto, guardados versionados, economía idempotente y backup/restore local verificado | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 14 pruebas unitarias, 6 integraciones sobre DB vacía, build, 3 migraciones, seed doble y restore con SHA-256 | Paso 4: elegir e implementar autenticación |
| 2026-07-29 | 4 | Completado | Autenticación propia con Argon2id, sesiones opacas revocables, rutas y WebSocket protegidos, perfil y gestión segura de Guardianes con UI web | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 19 pruebas unitarias/UI, 11 integraciones PostgreSQL/HTTP/WS, build, 5 migraciones, seed doble y recorrido visual real | Paso 5: configurar navegación principal |
| 2026-07-29 | 5 | Completado | Navegación protegida, recuperación no rotativa de sesión, estado de red/mantenimiento y acciones single-flight con intención idempotente | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 32 pruebas unitarias/UI, 12 integraciones PostgreSQL/HTTP/WS, build, migraciones y seed doble | Paso 6: instalar y configurar Phaser |
| 2026-07-29 | 6 | Completado | Isla Phaser desacoplada con escenas Boot/Test, movimiento y colisiones Arcade, FSM y capas animadas validadas, ciclo de vida seguro y checkpoint autoritativo idempotente | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 41 pruebas unitarias/UI, 13 integraciones PostgreSQL/HTTP, build, 6 migraciones, seed doble, backup/restore SHA-256 y smoke real de canvas/remontaje | Paso 7: implementar combate del Guardián |
| 2026-07-30 | 7 | Completado | Combate del Guardián cerrado tras auditoría independiente: RNG determinista seedeado y orden de blancos por distancia (antes dependían de orden de inserción del Map), daño entrante real vía `applyIncomingDamage` (Piel de hierro y Sed de batalla eran inertes en el juego pese a tests unitarios verdes), presentación visual atada a `GAME_DATA.animations` sin literales mágicos, y dos bugs reales que impedían todo uso en navegador real: `fetch` nativo invocado con receptor incorrecto (Illegal invocation en todo navegador) y `LocalCombatController` construido como campo de clase antes de que `this.time` de Phaser existiera. Verificado en vivo: registro, Guardián, canvas renderizando personaje/capas/dummies/hazard, ataque activando cooldown | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 77 pruebas unitarias/UI, 13 integraciones PostgreSQL/HTTP, build, smoke real de navegador con sesión completa (registro→Guardián→partida→canvas visible) | Paso 8: sistema base de enemigos |
| 2026-07-30 | 8 | En curso | Núcleo puro de IA de enemigos completo y probado en `packages/shared`/`packages/game-data`: tuning real de los 5 enemigos (8.1), FSM de 9 estados con detección por histéresis (8.2), `SimulationWorld` de paso fijo componiendo FSM+steering (8.2 parte 2, fusionado desde 8.0d una vez hubo consumidores reales), navegación seek/flee/arrive/separación sin A* (8.3), diferenciación de movimiento melee/ranged mapeada a los 5 enemigos por sus `behaviors` (8.4), proyectiles y telégrafos reutilizables por el jefe (8.5), dos modificadores élite con RNG seedeado (8.6), y limpieza/recompensas de muerte con XP deduplicada (8.7). Deliberadamente sin cerrar: nada de esto está todavía instanciado en `runtime.ts` ni es visible/jugable en el navegador — bloqueado en tener assets de sprite reales para los 5 enemigos (ninguno generado esta sesión), y en construir el adaptador `apps/web/src/game/sim/` que los conecte a Phaser. Los criterios de aceptación de comportamientos específicos por enemigo (Chamán prioriza aliados, Bestia telegrafía su explosión) tampoco están implementados, sólo sus primitivos genéricos | Instalación congelada, formato, lint, typecheck, 122 pruebas unitarias nuevas sobre el núcleo puro (enemy-ai, steering, enemy-simulation, behavior-profile, projectiles, elites, enemy-lifecycle) — sin smoke de navegador todavía, no hay nada visual que probar | Punto de decisión pendiente del usuario (no asumir): (a) profundizar comportamiento por enemigo (Chamán/Bestia/Bruto) sobre el núcleo puro ya probado, sin tocar sprites; (b) generar sprites de los 5 enemigos vía PixelLab para desbloquear el adaptador de Phaser; o (c) avanzar al Paso 9 (mapa/misión) dejando el Paso 8 documentado como está — ver `docs/plans/step-08-enemies-ai.md`, sección Trabajo pendiente |
| 2026-07-30 | 8 | En curso | Comportamientos específicos por enemigo (camino (a) del punto de decisión, parte lógica pura): nueva capa `packages/shared/src/enemy-abilities.ts` decide qué hace un enemigo en `attack`/`use_ability` — cinco perfiles data-driven (melee_strike, ranged_shot/Arquero, heal_allies/Chamán, area_attack/Bruto, telegraphed_explosion/Bestia), derivados de los `behaviors` tags con prioridad explícita, nunca del id. Reusa `resolveAttack` simétrico; daño de área/explosión sólo resuelve en el tick de resolución. Chamán prioriza aliado con menor % de vida (tie-break por id para determinismo); Bestia anuncia su explosión antes de dañar; Bruto abre telégrafo de área + aturde. `resolveEnemyAbilityProfile` en `game-data` mapea los 5 enemigos reales del catálogo; nuevo `enemyAbilityTuning` centraliza radios/multiplicadores/telegraphMs (GAME_DATA_VERSION/BALANCE_VERSION → 2026.07.30.3). Cumple los criterios de aceptación de comportamiento del Paso 8 **a nivel lógica pura y probada** (21 tests nuevos, 155 totales verdes) — sigue sin wiring a Phaser porque eso exige la decisión de assets del usuario | Instalación congelada, formato, lint, typecheck, build, 155 pruebas unitarias/UI verdes, 13 integraciones PostgreSQL/HTTP sin tocar | El wiring a Phaser de los 5 enemigos (camino (b): requiere decisión de presupuesto/plan de PixelLab del usuario) o avanzar al Paso 9 dejando el Paso 8 documentado (camino (c)) — decisión que sigue pendiente del usuario |
| 2026-07-30 | 0 (visión) | Completado | Pivote de visión decidido por el usuario tras discutir alternativas (ver sección 0.1): de "ARPG cooperativo en tiempo real, sala por sesión" a "juego online persistente con sistema de party (roles mecánicos: tanque/arquero/etc.) y combate semi-automático (idle por defecto, intervención manual del jugador en jefes de raid/misiones difíciles)". La resolución de acciones en grupo pasa a ser asíncrona por tick de servidor (referencia: combate por ticks de Old School RuneScape), no sincronizada en tiempo real — se evita así el netcode de autoridad de servidor a 20-60 Hz con predicción/reconciliación, que era el costo más caro de la visión anterior. Reescritas la Definición (Sección 1), 2.4 y la Sección 14 completa; notas de pivote agregadas a los Pasos 13 y 14 del plan maestro (no reescritos tarea por tarea porque no empezaron). El núcleo puro de combate/IA de los Pasos 7-8 no se toca — fue construido con esta forma en mente y sigue siendo la pieza correcta | No aplica (cambio documental) | Presentar el modo semi-automático (idle) funcionando en el navegador usando los personajes ya generados, con los enemigos recoloreados en vez de tótems |
| 2026-07-30 | 0 (visión) | Completado | Segundo cambio de visión, decidido por el usuario: el Bosque pasa de **misión finita** (3 altares → puerta del jefe → Guardián Corrupto → victoria/derrota → regreso al pueblo) a **idle RPG infinito por niveles** (alcance inicial niveles 1-20, cada nivel más difícil, sin victoria ni derrota terminal por ahora). Encaja con el §0.1: el combate semi-automático es el loop natural de un idle infinito. Decisión asociada: el mapa se define por **datos propios versionados**, no por Tiled (§10.1). Reescritos §1 (Primer objetivo jugable), §3 (Alcance MVP), §10.1 (Mapas) y el Paso 9 completo del plan maestro; jefe/altares/puerta y victoria/derrota marcados postergados fuera del MVP del bucle infinito. Es sólo documentación todavía — la implementación del núcleo puro del Bosque infinito sigue en la misma sesión | No aplica (cambio documental) | Implementar el núcleo puro del Bosque infinito (modelo de niveles 1-20, escalado monótono, progreso idempotente) en `packages/shared`/`packages/game-data` con tests, sin tocar Phaser todavía |
| 2026-07-30 | 9 | En curso | Núcleo puro del Bosque infinito completo y probado (M1-M4): modelo de niveles 1-20 con escalado monótono (`ForestLevelTuning`/`ForestProgressionCurve`), estado de progreso inmutable (`ForestProgressState`) con `applyDefeat` idempotente por `enemyInstanceId` (mismo patrón que `EnemyRewardLedger`/Sed de batalla — un enemigo no paga XP dos veces), level-up en cascada acotado y clamp en nivel máximo. Escalado en `game-data` (`endlessForest`: vida ×1.25/nivel, daño ×1.10/nivel, oleada +1/nivel) con `GAME_DATA_VERSION`/`BALANCE_VERSION` → `2026.07.30.4` y validación semántica que rechaza catálogos no monótonos o fuera de secuencia — convierte un bug de balance silencioso en error de build. Bug `bestLevel` (quedaba un nivel atrás tras subir) detectado por test y corregido. Todo determinista puro, sin Phaser/red/persistencia — preparado para que el servidor lo reusa en el Paso 14. Ver `docs/plans/step-09-endless-forest.md` | Instalación congelada, formato, lint, typecheck, **166 pruebas totales verdes** (8 nuevas: 7 endless-forest + 1 validación de escalado monótono), build sin tocar — la implementación es sólo núcleo puro + datos, sin cambios en el cliente | Wiring a Phaser del Bosque (mostrar nivel/progreso, instanciar oleadas por nivel, feedback de avance) y generación de oleadas reales — ambos bloqueados en la misma decisión de assets de sprite del usuario que el Paso 8; la persistencia de `ForestProgressState` y el HUD son Pasos posteriores |

---


# 34. Cambios consolidados de esta versión

Esta versión reemplaza los documentos anteriores e incorpora:

- Plataforma web de escritorio.
- Multiplayer cooperativo.
- Modo ausente basado en calibración real de cinco minutos.
- Spritesheets y animaciones de cuatro direcciones.
- Capas visuales de equipamiento.
- Máquina de estados.
- Pipeline y manifiesto de assets.
- Mapas con Tiled.
- Sistema de interacciones.
- Efectos visuales.
- Audio por buses.
- Guardados versionados.
- Semillas reproducibles.
- Registro de eventos.
- Herramientas internas.
- Balance centralizado.
- Presupuestos de rendimiento.
- Compatibilidad web.
- Tutorial.
- Licencias y procedencia de assets.

Este archivo debe utilizarse como único `GOAL.md`.

---

## Actualizacion del Paso 14: recompensa de enemigos (2026-08-04)

`EnemyRewardService` ya resuelve la primera mitad del pendiente: una derrota confirmada por
`CombatAuthority` deriva destinatarios server-side, actualiza XP/oro/materiales y
`CharacterForestProgress` en una transaccion `Serializable`, y registra un `RewardLog` con
`operationId`/hash/versiones. Cada personaje recibe `REWARD_GRANTED`; replay devuelve el receipt
sin duplicar saldos. Los IDs de transporte y `sourceId` son digests acotados para respetar los
`VarChar(128)` existentes. Esto no genera objetos: drops privados, instancias, rarezas, afijos y
pantalla de resultados continúan en el Paso 15.

La presentacion de eventos queda cerrada en esta sesion: `game-session.ts` consume el WebSocket
autenticado con reconexion acotada, `game-events.ts` valida `ServerEventSchema`, traduce resultados,
recompensas e interrupciones a un feed de HUD deduplicado y el runtime conserva un limite de ocho
entradas. Los drops como objetos no se inventan en este paso y continúan en los Pasos 11/15.

# Registro de diseño — expansión de clases (2026-08-05)

Se leyó el brief adjunto de referencia de Diablo II y se contrastó con el estado real del catálogo,
Prisma, progresión, autoridad de combate y HUD. Se decidió documentar una expansión propia y
posterior: conservar `guardian` y planificar `dark_knight`, `arcanist`, `hunter` y `summoner` con
tres ramas y nodos data-driven, sin copiar contenido protegido. Se creó el ExecPlan
`docs/plans/post-goal-class-expansion.md` y se amplió `docs/game/classes.md`.

No se modificó código ni persistencia y no se inició el Paso 21. El siguiente paso operativo sigue
siendo cerrar los bloqueos externos del Paso 20; luego M1 del ExecPlan sólo con autorización
explícita. Verificación documental: revisión de `GOAL.md`, `PLANS.md`, catálogo, contratos,
Prisma, progresión, combate y HUD; no aplica suite de código porque no hubo cambios ejecutables.

# Registro de corrección UX — acceso a Personaje sin selección (2026-08-05)

La ruta `/personaje` ya no monta una hoja vacía cuando no existe una sesión o un Guardián
seleccionado. Las sesiones anónimas vuelven al flujo de autenticación; las autenticadas sin
selección reciben un mensaje claro y el botón `Ir a Guardianes`. Las sesiones con selección y el
desvío de personajes `AWAY_*` conservan su comportamiento. Se agregó una regresión en
`apps/web/src/App.test.tsx`; no cambia autoridad ni persistencia.

Verificación: `pnpm exec vitest run apps/web/src/App.test.tsx` (10/10),
`pnpm --filter @brecha/web typecheck`, `pnpm exec eslint apps/web/src/App.tsx
apps/web/src/App.test.tsx`, `pnpm exec prettier --check apps/web/src/App.tsx
apps/web/src/App.test.tsx`, y smoke del navegador en `/personaje` (sesión anónima muestra el login,
no el estado vacío).

# Registro de ambientaciÃ³n visual â€” fondos de pueblo y expediciones (2026-08-05)

Se generÃ³ un set visual de seis fondos raster sin texto ni entidades: plaza del pueblo, herrerÃ­a,
santuario del GuardiÃ¡n del Portal, puesto de la Exploradora, Bosque Corrupto y teaser de Ruinas
Sumergidas. Se optimizaron a WebP 832Ã—468 (menos de 320 KB en total), se registraron en
`apps/web/public/assets/asset-manifest.json` y `ASSET_PROVENANCE.md`, y se consumen en las pantallas
de pueblo, comerciante, expediciÃ³n y modo ausente. El Bosque Corrupto tambiÃ©n se carga como capa
visual bajo el runtime Phaser; no altera colisiones, spawn ni autoridad.

La zona Ruinas Sumergidas queda bloqueada y es sÃ³lo una previsualizaciÃ³n visual hasta que exista su
contenido de gameplay. VerificaciÃ³n prevista al cierre: validador de assets, suite completa, typecheck,
lint, formatter y smoke visual de `/pueblo`, `/comerciante`, `/expedicion`, `/ausente` y
`/bruto-preview`.

# 35. Prompt operativo inicial para Codex

Usar este texto al comenzar:

```text
Leé GOAL.md completo y tratá ese archivo como la fuente principal de verdad.

Inspeccioná el repositorio antes de modificarlo. Compará el código real con el checklist de GOAL.md.

Trabajá únicamente en el primer paso incompleto. No intentes implementar varios pasos completos en una sola ejecución, salvo tareas pequeñas que sean dependencias directas del mismo paso.

Antes de marcar una tarea con [x], ejecutá las pruebas, el lint, el typecheck y la verificación manual correspondiente. Si una tarea está iniciada pero incompleta, marcala con [-]. Si está bloqueada, marcala con [!] y explicá el motivo.

Al finalizar:
1. Actualizá GOAL.md.
2. Agregá una fila al Registro de progreso.
3. Informá qué archivos modificaste.
4. Informá qué pruebas ejecutaste y sus resultados.
5. Indicá el siguiente paso exacto.

Comenzá ahora con el Paso 1.
```
# Registro de progreso — Paso 11 (2026-08-04)

`packages/shared/src/items.ts` define instancias reproducibles con semilla, rareza, estadisticas
base y afijos; `packages/game-data/src/catalog.ts` valida 25 definiciones (10 armas, 10 piezas de
armadura y 5 accesorios), 12 afijos y el legendario del Guardian Corrupto. `InventoryService`
ejecuta snapshot, equipar/desequipar, favorito y venta con ownership, protecciones, revisiones,
ledger `InventoryOperation` y transacciones serializables. `EnemyRewardService` genera el drop en
la misma transaccion del `RewardLog` y lo replica en `REWARD_GRANTED`, evitando duplicados en replay.
`Inventory.tsx` consume el snapshot real y muestra stats derivados server-side.

Verificacion inicial: `pnpm test` (54 archivos, 271 tests), `pnpm test:integration` (3 archivos, 24 tests),
`pnpm typecheck` y Prisma generate correctos.

Actualizacion de cierre visual (2026-08-04): `apps/web/src/game/equipment-visual.ts` transforma el
snapshot server-side en un loadout minimo; `GameIsland` lo hidrata solo para sesiones online y
`runtime.ts` dibuja overlays placeholder de arma/armadura sobre el personaje generado, respetando
origen 92x92, direccion, profundidad y alpha. El smoke autenticado equipó un mandoble común y
confirmó `weapon:common|armor:none` en el canvas y el cambio visible en screenshot. La validación de
compatibilidad exige las cinco animaciones generadas, sus direcciones y el origen de pies antes de
arrancar Phaser. Las capas authored por frame siguen siendo una mejora visual del Paso 18, pero no
bloquean el vertical slice MVP; el Paso 11 queda cerrado y el siguiente paso activo es el Paso 12.

# Registro de progreso — Paso 12 (2026-08-04)

`GAME_DATA.progression` centraliza la curva acumulativa de XP 1–10, los tres puntos de atributo por
nivel y el costo de respec; `packages/shared/src/progression.ts` calcula nivel, puntos y stats sin
mezclar la progresión del Bosque. `EconomyService` y `EnemyRewardService` ahora actualizan XP,
nivel y puntos en la misma transacción. `ProgressionService` expone snapshots server-side,
asignación atómica, desbloqueo por nivel, cuatro ranuras de habilidades, respec y replay idempotente
mediante `InventoryOperation`; `COMBAT_INTENT` rechaza habilidades no aprendidas.

La UI agrega `/personaje` y `/habilidades`, consume el snapshot autenticado, muestra estadísticas y
requisitos, y el HUD reemplaza la barra de fixtures por las habilidades equipadas confirmadas.
`docs/plans/step-12-character-progression.md` documenta alcance, autoridad, persistencia y deuda.

Verificación: `pnpm test -- --run` (56 archivos, 278 tests), `pnpm test:integration` (4 archivos,
25 tests), `pnpm typecheck`, `pnpm lint`, `pnpm build`, smoke autenticado en `/personaje`,
`/habilidades` y `/partida` con canvas único y barra real. Paso 12 queda cerrado; siguiente paso
Paso 15 queda cerrado; siguiente paso activo: Paso 16 — modo offline basado en calibración de 5 minutos
(Paso 10 continúa postergado).

# Registro de progreso — Paso 15 (2026-08-04)

`EnemyRewardService` ya genera drops individuales en la misma transacción serializable que XP,
oro, materiales y `RewardLog`. El hash incluye dificultad/tamaño de party; `REWARD_GRANTED` sólo se
envía al usuario receptor y lleva `visibility: private`. `GET /api/characters/:characterId/rewards/recent`
comprueba ownership y alimenta la pantalla `/resultados`.

`GAME_DATA.balance.difficulty` versiona Normal/Veterano y `enemyDifficultyMultipliers` aplica el
escalado de salud/daño por jugadores al crear oleadas, resolver ataques y respawnear. La prueba de
PostgreSQL ejecuta dos recompensas concurrentes con el mismo `operationId`, confirma un solo objeto
persistido y rechaza el historial de otro personaje.

Verificación: `pnpm test -- --run` (suite unitaria/UI verde), `pnpm test:integration` (4 archivos,
26 tests), `pnpm typecheck`, `pnpm lint`, `pnpm build`, Prettier y `git diff --check`. Siguiente paso
activo: Paso 16 — modo offline basado en calibración de 5 minutos.

# Registro de progreso — Paso 16 (2026-08-04)

`AwayService` implementa calibración autoritativa de 300 segundos usando métricas de `RewardLog`,
fingerprint de atributos/equipo/habilidades, validación de actividad y detección de tasas imposibles.
La activación persiste snapshot, semilla, dificultad, cap de 28.800 segundos y eficiencia 0,8; el
personaje pasa por `AWAY_CALIBRATING`, `AWAY_FARMING` y `AWAY_REWARD_PENDING`. El regreso crea un
`AwayResult` pendiente con fórmula agregada, penalización acotada por muertes y loot common/magic/rare
generado nuevamente. El reclamo serializable inserta objetos, aplica XP/oro/materiales, escribe
`RewardLog` `away-claim:<resultId>` y libera el personaje; el replay concurrente devuelve el mismo
receipt. El WebSocket y mutaciones de inventario/progresión bloquean personajes no disponibles.

La UI agrega `/ausente` con selector de zona/dificultad, contador, estimación, informe y reclamo; al
abrir Personaje para una sesión ausente se muestra el informe y se detiene la sesión. El plan vivo es
[`docs/plans/step-16-away-mode.md`](docs/plans/step-16-away-mode.md).

Verificación: `pnpm test -- --run` (62 archivos, 290 tests),
`pnpm exec vitest run --config vitest.integration.config.ts apps/server/src/persistence/away.integration.test.ts`
(1 archivo, 1 test), `pnpm typecheck`, `pnpm lint`, `pnpm build`, Prettier y `git diff --check`.
Siguiente paso activo: Paso 17 — Pueblo completo y economía. Paso 10 continúa postergado por el
Bosque infinito.

# Registro de progreso — Paso 17 (2026-08-04)

El pueblo ahora consume un snapshot server-side con recursos, portal del Bosque Corrupto,
comerciante, cofre y tutorial. `TownService` persiste las transiciones de tutorial con
`CharacterTownOperation`; `InventoryService` agrega compra y venta atómicas, genera el objeto de
stock con seed determinista y escribe `RewardLog` para cada delta de oro. `CharacterChest` conserva
instancias completas en un contenedor versionado; depósito/retiro y reintentos no duplican ni
pierden objetos.

La navegación agrega `/comerciante`, `/cofre` y `/ajustes`; el dock del pueblo conecta personaje,
inventario, habilidades, expedición, modo ausente, comerciante y cofre. La pantalla inicial muestra
el tutorial, permite completarlo, omitirlo y repetirlo. Las confirmaciones cubren compra, venta,
depósito y retiro.

Verificación: `pnpm test -- --run` (65 archivos, 293 tests),
`pnpm exec vitest run --config vitest.integration.config.ts apps/server/src/persistence/town.integration.test.ts apps/server/src/persistence/town.routes.integration.test.ts`
(2 archivos, 3 tests), `pnpm test:integration` (exit 0), `pnpm typecheck`, `pnpm lint`,
`pnpm build` (exit 0; sólo warning del chunk runtime grande), Prettier y `git diff --check`.
Siguiente paso activo: Paso 18 —
Arte, audio y feedback. Paso 10 continúa postergado por el Bosque infinito.

# Registro de progreso — Paso 18 (2026-08-04)

Se cerró la implementación de presentación del Paso 18. `asset-manifest.json` y
`scripts/validate-assets.mjs` validan procedencia/licencia, dimensiones, frames, animaciones mínimas,
direcciones y un presupuesto total de 1,5 MB antes del build. El runtime mantiene VFX descriptivos y
preasignados para habilidades, impactos, críticos, estados, muerte, curación, buff, explosión y
telégrafos; los overlays de equipo siguen el loadout confirmado sin tocar autoridad ni hitboxes.
`GameAudioMixer` agrega buses master/música/ambiente/efectos/UI, tonos y música procedural, deduplicación
por evento, desbloqueo por gesto, silencio y volúmenes persistidos. `/ajustes` expone cinco rangos,
mute y movimiento reducido; el feedback de impacto también respeta la reducción de movimiento.

Verificación: `pnpm validate:assets` (7 entradas, 848505 bytes), `pnpm test -- --run` (69 archivos,
300 tests), `pnpm test:integration` (7 archivos, 30 tests), targeted de audio/VFX/settings/runtime
(11 tests), `pnpm typecheck`, `pnpm lint`, `pnpm build` (exit 0; warning conocido del chunk runtime
grande), Prettier y `git diff --check`.
Smoke de compatibilidad: Chrome for Testing 151, Edge instalado y Firefox 153 cargaron
`/bruto-preview` (canvas único, tres enemigos) y `/ajustes` (cinco rangos) sin `pageerror` ni request
fallido. Firefox sólo dejó una advertencia de teardown de Phaser al navegar, sin error de documento.
Paso 18 queda cerrado; el siguiente paso es Paso 19.

# Registro de progreso — Paso 19 (2026-08-04)

Se completó la auditoría de calidad, rendimiento y seguridad. El rate limiter de credenciales y
gameplay mantiene ventanas existentes pero ahora limita el mapa a 10.000 claves, elimina expiradas y
rechaza nuevas claves cuando se llena sin evictar identidades activas; los tests cubren ventanas,
fail-closed y argumentos inválidos. Los logs de errores
inesperados incluyen `requestId`, método/URL y contexto de gameplay sin volcar payloads. La autoridad,
ownership, validación Zod y ledgers de operación ya cubrían replay idempotente; se agregaron lobbies
aislados y recuperación del modo ausente tras reconstruir Fastify.

El stress harness y Arcade debug quedan sólo en `MODE=development`. El perfil Chrome de 40 enemigos
registró 600 muestras, frame p50/p95/p99 5,5/5,7/5,8 ms, `update` p95 0,3 ms, heap 93.115.695 B,
pools dentro de capacidad y audio pico 4; Firefox normal funciona, pero su stress headless p95 27,78 ms
y heap no expuesto quedan documentados como riesgo de hardware/driver. La build de producción ignoró
`enemyStress=40` en Chrome/Firefox y conservó tres enemigos. Smoke accesible en diez rutas mantuvo un
`main`, botones con nombre y campos etiquetados. 200 `/health` locales dieron p50 0,344 ms, p95
0,765 ms y p99 1,080 ms.

Verificación: `pnpm test` (69 archivos, 306 tests), `pnpm test:integration` (7 archivos, 30 tests),
`pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm format:check`, `pnpm validate:assets` y smoke de
producción. Paso 19 queda cerrado; siguiente paso incompleto: Paso 20 — Pruebas finales y despliegue.

# Registro de progreso — Paso 20 (2026-08-04)

Se implementó un staging reproducible aislado en `docker-compose.staging.yml` con PostgreSQL 17,
migrator/seed one-shot, API Fastify, cliente Vite servido por nginx y perfil Caddy opcional para TLS.
`deploy/staging.env.example` sólo contiene placeholders; `APP_ORIGIN`, `VITE_API_URL`, puertos,
health checks y proxy WebSocket quedan configurables sin exponer secretos. El seed de Prisma ahora
invoca `tsx` desde `@brecha/server`, por lo que también funciona dentro de la imagen minimalista.

Se agregaron workflow CI (`.github/workflows/ci.yml`), smoke de staging, checklist de publicación,
rollback, validación de entorno y scripts `staging:backup`/`staging:restore:smoke`/
`staging:multiplayer:smoke`. La verificación local construyó las tres
imágenes, aplicó 12 migraciones, ejecutó seed idempotente y dejó PostgreSQL/API/web healthy. El smoke
confirmó HTML, favicon, `/health`, protocolo 1, `GAME_DATA_VERSION` `2026.08.04.4` y CORS. El backup
custom con SHA-256 se restauró en una base efímera y verificó 12 migraciones y 1 usuario seed antes de
eliminarse.

Verificación: `pnpm staging:env:check` (template rechazado, fixtures local/TLS aceptados),
`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (69 archivos, 306 tests),
`pnpm test:integration` (7 archivos, 30 tests), `pnpm build`, `pnpm validate:assets`, compose config,
build/health de staging, smoke LAN de `pnpm staging:smoke` y `pnpm staging:multiplayer:smoke`,
`pnpm staging:backup` y `pnpm staging:restore:smoke`.
Paso 20 queda iniciado pero incompleto: las tareas marcadas `[!]` requieren proveedor, DNS,
certificados y secretos suministrados por el propietario, además de una ejecución observada en CI. El
smoke LAN sobre `192.168.0.154` ya probó acceso fuera de loopback y dos sesiones autenticadas en una
party/instancia compartida; falta repetirlo desde redes externas. También se añadió
`staging:env:check`, que bloquea placeholders, secretos débiles, CORS inconsistente y TLS incompleto.
El workspace tampoco tiene un remote Git configurado para observar el workflow hospedado. Siguiente paso incompleto: Paso 20 (cerrar
infraestructura externa); Paso 21 no se inicia.

# Registro de ajuste de cámara — Paso 8 (2026-08-04)

La vista del preview ahora es más cenital: `CAMERA_DISTANCE_FACTOR = 1.55` y
`CAMERA_ZOOM = 1.032258` muestran más mundo que el ajuste anterior. El personaje comienza en el
centro jugable (`640,360`) para no quedar fuera de pantalla cuando la cámara está limitada por los
bordes del mundo. `startFollow` usa seguimiento inmediato, sin deadzone ni offset, por lo que la
cámara permanece centrada en el personaje durante todo el movimiento. El cambio es de presentación
únicamente y no modifica simulación, autoridad, colisiones ni spawn de enemigos.

Verificación: `pnpm exec vitest run apps/web/src/game/runtime.test.ts`, `pnpm typecheck`,
`pnpm build`, smoke del navegador en `/bruto-preview` sin errores de consola. El siguiente pendiente
del Paso 8 continúa siendo el cierre de clips/animaciones dedicadas y el stress visual documentado.

# Registro de mantenimiento visual — Bruto aprobado (2026-08-04)

Se reemplazaron las hojas antiguas de `root_brute` por el sprite proporcionado por el proyecto:
`apps/web/public/assets/characters/root_brute/previews/root_brute_preview.png` y las nueve hojas
`idle`/`walk`/`basic_attack` conservan el contrato de `248×248`, pero cada frame usa únicamente esa
referencia. Se actualizaron procedencia/licencia pendiente en ambos manifiestos y la documentación
del pipeline. `pnpm validate:assets`, las pruebas enfocadas del runtime, `pnpm test` (69 archivos,
306 tests), `pnpm typecheck`, `pnpm build`, `pnpm lint` y `pnpm format:check` pasan. El ID de cuenta
`9deb6b46-c653-4d2e-8c62-021bfa470086` no existe en la base local inspeccionada, por lo que no se
alteró ninguna cuenta; queda pendiente apuntar a la base que contenga esa cuenta para asignación
persistente si el Bruto debe ser el personaje del jugador y no sólo el enemigo visual.

# Registro de progreso — stack local Aseprite/MCP (2026-08-06)

- [x] Auditoría local, Aseprite real, Go, GNU Make, uv e Inspector instalados y auditados.
- [x] Smoke Lua directo validado: sprite RGB transparente 32×32, tres capas, cuatro frames,
  tags `idle`/`walk`, duraciones distintas, PNG y spritesheet JSON.
- [x] `diivi/aseprite-mcp`: `uv sync`, 121 tests Python verdes, 116 herramientas y llamadas
  reales por Inspector.
- [x] `willibrandon/pixel-mcp`: compilación con Go/Make, health check, 50 herramientas y
  exportaciones reales verificadas.
- [x] Configuración Codex respaldada y ampliada con `aseprite_diivi` y `pixel_mcp`; reiniciar
  Codex para que la sesión actual recargue los servidores.
- [x] Smoke reusable, validación Pillow, previews 8×, reporte y ExecPlan agregados.
- [ ] Pendiente externo: corregir upstream en pixel-mcp las rutas Windows, line endings y
  tests Unix para que toda la suite Go de integración sea verde en Windows.

Detalle operativo: `docs/plans/aseprite-mcp-local-stack.md` y `tools/aseprite-stack/REPORT.md`.

# Registro de sincronización — clases y arte (2026-08-06)

La auditoría de `docs/game/classes.md` confirmó que el MVP ya persiste siete IDs de clase que
resuelven al perfil provisional del Guardián, y que Amazona está conectada en producción al rig
por capas `hunter`. También confirmó que el scaffold M1 (`class-tree.ts`, `ClassRegistrySchema` y
`validateClassRegistry`) existe, pero el catálogo sólo contiene a `guardian`: no hay ramas, nodos,
recursos ni kits propios para las cuatro clases de expansión. El demo de Bárbara queda como arte de
prueba fuera de los assets del juego.

Se corrigieron las notas de procedencia y el comentario del catálogo para que no describan un estado
de desarrollo ya superado. Quedan abiertas, sin implementar, tres decisiones: resolver la colisión
del ID `dark_knight`, decidir si Bárbara permanece como opción equivalente o se adelanta como clase
propia, y confirmar si el gate del Paso 20 sigue vigente o si el propietario autoriza una excepción.
El Paso 21 no se inicia y ningún checkbox de expansión se marca como terminado.

Verificación de esta revisión: `pnpm exec vitest run packages/shared/src/class-tree.test.ts
packages/game-data/src/validation.test.ts` (20 tests) y las pruebas de IDs/progresión/contratos
seleccionadas (12 tests), todas verdes. No se modificó gameplay, persistencia ni assets binarios.

## M1 — registro inicial de clases (2026-08-06)

Se registraron `guardian` y las siete clases jugables (`amazon`, `assassin`, `barbarian`, `druid`,
`necromancer`, `paladin`, `sorceress`) en `GAME_DATA.classRegistry`. Bárbara ya dejó de ser un registro
vacío: usa el recurso `rage` y la rama `branch.barbarian.bloodsong`; las demás clases conservan
temporalmente el recurso provisional y ramas/nodos vacíos.

Verificación: `pnpm exec vitest run packages/game-data/src/validation.test.ts
packages/shared/src/class-tree.test.ts` (20 tests) y `pnpm typecheck` pasan. El siguiente registro
documenta el cierre de contratos M1.

## M1 — registro inicial de contenido (2026-08-06)

Se agregó `GAME_DATA.contentExpansion` como registro data-only versionado: cinco enemigos nuevos
(`spore_stalker`, `ash_crawler`, `veil_wraith`, `stonebound_sentinel`, `rift_howler`) y tres zonas
(`spore_marsh`, `ash_mines`, `threshold_ruins`) con mapas, IDs estables y referencias cruzadas.
Todavía no se activan spawns, balance, arte ni recompensas de estas entradas.

Verificación: `pnpm exec vitest run packages/game-data/src/validation.test.ts
packages/shared/src/class-tree.test.ts` (21 tests), `pnpm typecheck` y `git diff --check` pasan.
Siguiente subpaso: contrato data-driven de skills y efectos (completado en el registro siguiente).

## M1 — contrato de skills y efectos (2026-08-06)

Los nodos del árbol aceptan `effectIds` y `ClassRegistry` expone efectos versionados con tipo,
targeting, tags y estado de tuning. `validateClassRegistry` comprueba que cada referencia apunte a un
efecto existente, evitando nodos huérfanos antes de activar habilidades en el servidor. El catálogo
actual declara los tres efectos provisionales del kit de Bárbara; todavía no se activan en combate.

Verificación: `pnpm exec vitest run packages/shared/src/class-tree.test.ts
packages/game-data/src/validation.test.ts` (22 tests), `pnpm typecheck`, builds de `@brecha/shared` y
`@brecha/game-data`, y `git diff --check` pasan. Siguiente subpaso: vertical slice de Bárbara.

## M2 — diseño data-driven de Bárbara (2026-08-06)

Se activó en el catálogo la rama `branch.barbarian.bloodsong` con `Hachazo creciente` (activo),
`Impulso de sangre` (pasiva) y `Juramento del coloso` (definitiva). Cada nodo referencia una
habilidad/efecto estable; el helper puro `unlockClassSkillNode` valida clase, nivel, prerrequisito y
puntos sin condicionales por clase. El kit todavía no se conecta a la autoridad de combate, a la
persistencia de talentos ni a arte/VFX/audio definitivos.

Verificación: `pnpm exec vitest run packages/shared/src/class-skills.test.ts
packages/shared/src/class-tree.test.ts packages/game-data/src/validation.test.ts` (24 tests),
`pnpm typecheck`, builds de `@brecha/shared`/`@brecha/game-data` y `git diff --check` pasan.
Siguiente subpaso: integración server-side del kit de Bárbara (completada en el registro siguiente).

## M2 — integración server-side de Bárbara (2026-08-06)

La creación de personajes Bárbara inicia con `ability.barbarian.cleave`; `ProgressionService` deriva
las habilidades desde la rama registrada y mantiene Guardián como fallback compatible. La autoridad de
combate recibe la clase validada desde el snapshot autenticado y selecciona el tuning
`barbarian-combat.1`, sin aceptar daño, coste ni cooldown del cliente. Se agregó una prueba de ataque
Bárbara que resuelve impacto diferido y daño determinista.

Verificación: `pnpm exec vitest run packages/shared/src/character-class.test.ts
apps/server/src/gameplay/combat-authority.test.ts packages/game-data/src/validation.test.ts` (19 tests),
`pnpm typecheck`, builds de `@brecha/shared`/`@brecha/game-data` y `git diff --check` pasan.

La integración `apps/server/src/characters/progression.integration.test.ts` crea y carga una Bárbara
real contra PostgreSQL y confirma que el snapshot autenticado contiene `cleave` desbloqueada y la
definitiva con requisito de nivel 6. `pnpm test:integration` queda en 32 tests verdes. Siguiente
subpaso: conectar el snapshot de nodos a la UI de árbol (completado en la presentación siguiente).

La pantalla `/habilidades` ahora consume `branchId`, `nodeId`, `kind` y `effectIds` opcionales del
snapshot: muestra la rama `Canto de sangre` para Bárbara y evita ofrecer una pasiva como ranura activa.
Verificación: `pnpm exec vitest run apps/web/src/screens/Skills.test.tsx` (2 tests), `pnpm typecheck`
y `git diff --check` pasan. El siguiente bloque de M2 es arte de Bárbara y eventos VFX/audio.

Se generó además un preview provisional de Bárbara en
`apps/web/public/assets/characters/barbarian/previews/barbarian_preview.png` usando el pipeline de
imagen con chroma-key y alpha, escalado nearest-neighbor a 184×184. No se agregó al manifiesto ni al
runtime porque todavía no es una hoja animada consistente; la procedencia y los requisitos pendientes
quedaron registrados en `ASSET_PROVENANCE.md`.

# Decisión de alcance — expansión completa de contenido (2026-08-06)

El propietario autorizó explícitamente completar las siete clases, mapas nuevos, armas, armaduras,
habilidades, efectos, audio y al menos cinco enemigos mientras el Paso 20 continúa abierto. Esta
excepción no inicia el Paso 21 ni elimina los requisitos de despliegue. El trabajo queda gobernado por
[`docs/plans/all-content-expansion.md`](docs/plans/all-content-expansion.md) y debe avanzar por hitos,
con M1 (contratos y catálogo validable) ya cerrado y M2 iniciado de forma gradual.

## M2 — runtime local de Bárbara (2026-08-06)

El runtime local ahora selecciona `barbarian-combat.1` cuando la clase es `BARBARIAN`, conserva
la autoridad del servidor para el recorrido online y expone en el HUD las tres habilidades activas
del vertical slice: `Hendidura` (LMB), `Juramento berserker` (Q) y `Piel de batalla` (E). La barra
usa los IDs del snapshot de progresión; las pasivas no se renderizan como ranuras activas y el
recurso se etiqueta `RABIA` para Bárbara. Se agregaron regresiones del selector de tuning y del HUD.

Pendiente de M2: hojas animadas consistentes, manifest/runtime de arte, VFX/audio definitivos y
validación visual. Después se continúa con las seis clases restantes según
[`docs/plans/all-content-expansion.md`](docs/plans/all-content-expansion.md).

## Registro de arte — primera pasada de sprites de clases (2026-08-07)

Se generaron y registraron hojas merged de `barbarian`, `assassin`, `druid`, `necromancer`, `paladin`
y `sorceress` con tres direcciones, cinco estados y frames de 92×92. `characterForClass` las conecta
al runtime; Amazona mantiene su rig por capas y Guardián mantiene su asset legado. La primera pasada
repite las poses de contacto dentro del frame count contractual para preservar la importación y el
presupuesto; queda una pasada posterior de animación multi-frame authored antes de cerrar M2 como arte
definitivo.

## Registro de correccion - seleccion visual de clase (2026-08-07)

Se corrigieron dos causas de que un personaje nuevo apareciera siempre como `darkKnight`: crear un
personaje ahora selecciona en el servidor ese ID antes de refrescar el roster, y `GameIsland` vuelve
a montar el runtime cuando cambia el personaje o su clase. La resolucion visual quedo centralizada:
las clases merged usan su atlas propio, Amazona usa `hunter_body` como base del rig por capas y solo
el legado `GUARDIAN` (o un preview sin clase) usa `dark_knight`. El canvas publica la clase/asset
resueltos en `data-character-class`, `data-character-visual` y `data-character-layered` para smoke
visual sin alterar autoridad de combate.

Verificacion de esta sesion: pruebas enfocadas, suite completa, typecheck, lint y build.

La verificacion posterior en navegador encontro que `5173` y `3001` estaban ocupados por otro
proyecto local (`JD-Auto`), por lo que la pestaña visible conservaba una instancia vieja del juego.
La Brecha Oscura se levanto aislada en web `5176` y API `3002`; la sesion real confirmo que la cuenta
abierta solo contiene un personaje persistido como `GUARDIAN`, para el cual `dark_knight` es el asset
esperado. Las integraciones de autenticacion/progresion confirman que crear `BARBARIAN` conserva ese
ID en PostgreSQL. Para comprobar otra clase en el flujo real se debe crear el personaje dentro de la
instancia aislada; seleccionar una opcion del formulario no cambia la clase del Guardian existente.

## Registro de correccion - orientacion, audio y variedad visual (2026-08-07)

La orientacion del Guardián queda determinada por el movimiento cardinal (W/S/A/D) y por el
mapping estable `north`/`south`/`east` + espejo de `pixellab-characters.ts`; se agregaron regresiones
para las cuatro direcciones para evitar que el cursor o una facing anterior inviertan el paso. Las
hojas existentes de `dark_knight` mantienen norte como espalda y sur como frente, por lo que no se
invirtieron assets a ciegas.

El apagado del audio ya no depende solamente de `Phaser.Scenes.Events.SHUTDOWN`: el runtime libera
el mezclador de Web Audio antes de `game.destroy(true)` y el cierre es idempotente. Esto detiene el
intervalo de musica y cierra el `AudioContext` al volver al menu, incluso si Phaser no alcanza a
emitir el evento de escena durante el cambio de ruta.

Las hojas de las seis clases merged conservan sus contratos de 92x92, pero ahora pasan por
`scripts/aseprite-gen/synthesize-class-animation-variants.py`: cada estado tiene variaciones
nearest-neighbor de bob/lean para que caminar, atacar, recibir daño y morir no sean una pose congelada.
Es una pasada puente de arte, reemplazable por frames authored sin cambiar IDs, rutas, pivotes ni
hitboxes. Enemigos que antes eran solo un Guardian teñido (`corrupted_minion`, `dark_shaman` y
`unstable_beast`) usan provisionalmente las siluetas de Asesina, Nigromante y Druida; Bruto y Arquero
conservan sus hojas propias. La IA, balance, recompensas y autoridad no se modifican.

Verificacion: pruebas enfocadas de audio, visuales de enemigos, atlas, movimiento y runtime (46
tests) verdes;
el script de assets se ejecuto sobre las 90 hojas merged y los manifiestos conservaron dimensiones y
frame counts. Pendiente: reemplazar la pasada procedural por arte multi-pose definitivo y generar
hojas enemigas dedicadas cuando se apruebe presupuesto visual.
