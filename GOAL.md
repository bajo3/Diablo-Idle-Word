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

# 1. Visión del producto

## Nombre provisional

**La Brecha Oscura**

El nombre es provisional y debe poder cambiarse desde una configuración central.

## Definición

Juego web 2D híbrido de acción RPG, progresión persistente, botín y cooperación online para entre 1 y 4 jugadores.

El juego combina dos formas de progreso sobre el mismo personaje online:

### Modo activo

El jugador controla manualmente a su personaje, explora una zona, combate enemigos, usa habilidades, completa objetivos, consigue equipamiento y derrota jefes.

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

En el **Bosque Corrupto**, el jugador debe:

1. Entrar solo o con un grupo.
2. Explorar el mapa.
3. Destruir tres altares corruptos.
4. Sobrevivir a grupos de enemigos.
5. Abrir la puerta del jefe.
6. Derrotar al Guardián Corrupto.
7. Regresar al pueblo con las recompensas.

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

## 2.4 Cooperación sencilla

El multiplayer debe permitir jugar con amigos sin sistemas sociales complejos.

Para el MVP:

- Crear sala.
- Obtener código.
- Unirse por código.
- Hasta 4 jugadores.
- Botín individual.
- Reanimación de compañeros.
- Dificultad escalada.

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
- Una región: Bosque Corrupto.
- Una expedición activa.
- Modo offline o ausente basado en una calibración real de 5 minutos.
- Un límite inicial configurable de 8 horas de progreso ausente.
- Una clase jugable: Guardián.
- Nivel máximo inicial: 10.
- Cuatro atributos principales.
- Ataque básico.
- Tres habilidades activas.
- Una habilidad pasiva.
- Cinco tipos de enemigos.
- Un enemigo élite con modificadores.
- Un jefe con dos fases.
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
- Mapas creados con Tiled o datos equivalentes versionados.
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

Usar **Tiled Map Editor** o un formato de mapa equivalente basado en datos.

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

## Alcance

- 1 a 4 jugadores.
- Cooperativo.
- Sala privada con código.
- Sin matchmaking público en el MVP.
- Sin chat global.

## Flujo

1. El jugador entra al pueblo.
2. Selecciona “Jugar”.
3. Crea una sala o introduce un código.
4. El servidor crea o recupera la sala.
5. Los jugadores aparecen en el lobby.
6. El anfitrión selecciona misión y dificultad.
7. Todos marcan “Listo”.
8. El anfitrión inicia.
9. El servidor crea la instancia de expedición.
10. Los jugadores ingresan.
11. Al terminar, todos ven resultados individuales y grupales.

## Servidor autoritativo

El servidor controla o valida:

- Estado de la sala.
- Estado de la partida.
- Posiciones.
- Velocidades.
- Colisiones críticas.
- Vida.
- Daño.
- Cooldowns.
- Recursos.
- Botín.
- Eliminaciones.
- Reanimaciones.
- Objetivos.
- Resultado.
- Recompensas.

El cliente envía intenciones:

- Movimiento.
- Apuntado.
- Ataque.
- Activación de habilidad.
- Interacción.
- Reanimación.

## Sincronización

- Tick del servidor configurable.
- Snapshots.
- Interpolación para entidades remotas.
- Predicción local limitada para movimiento.
- Reconciliación cuando sea necesario.
- No enviar el estado completo si no cambió.
- Separar estado persistente del estado de partida.

## Desconexiones

- Tolerar desconexión breve.
- Mantener un período de reconexión configurable.
- Si no reconecta, eliminar o convertir el personaje en estado seguro.
- Transferir anfitrión en el lobby.
- Durante la partida, la sala no depende del anfitrión.
- Limpiar salas vacías.

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

Estado: [ ]

## Tareas

- [ ] Implementar vida.
- [ ] Implementar Furia.
- [ ] Implementar ataque básico.
- [ ] Implementar Golpe poderoso.
- [ ] Implementar Torbellino.
- [ ] Implementar Piel de hierro.
- [ ] Implementar Sed de batalla.
- [ ] Implementar cooldowns.
- [ ] Implementar costos.
- [ ] Implementar impactos.
- [ ] Implementar retroceso.
- [ ] Implementar críticos.
- [ ] Implementar armadura.
- [ ] Vincular impactos a ventanas o eventos de animación.
- [ ] Implementar efectos visuales provisionales.
- [ ] Implementar sonidos provisionales.
- [ ] Implementar pooling de efectos repetitivos.
- [ ] Implementar números de daño opcionales.
- [ ] Crear pruebas de fórmulas.

## Criterios de aceptación

- [ ] Las habilidades respetan cooldowns.
- [ ] No pueden activarse sin recursos.
- [ ] La vida y Furia se sincronizan con el HUD.
- [ ] Las fórmulas tienen pruebas.
- [ ] No hay daño calculado únicamente en la capa visual.

---

# Paso 8 — Enemigos e IA

Estado: [ ]

## Tareas

- [ ] Crear sistema base de enemigo.
- [ ] Crear máquina de estados.
- [ ] Crear detección.
- [ ] Crear navegación simple.
- [ ] Implementar Esbirro.
- [ ] Implementar Arquero.
- [ ] Implementar Chamán.
- [ ] Implementar Bruto.
- [ ] Implementar Bestia.
- [ ] Implementar estados visuales de enemigos.
- [ ] Implementar animaciones placeholder de enemigos.
- [ ] Implementar muerte.
- [ ] Implementar drops provisionales.
- [ ] Implementar al menos dos modificadores élite.
- [ ] Agregar pruebas de estados.

## Criterios de aceptación

- [ ] Los cinco enemigos tienen comportamientos diferentes.
- [ ] Los ataques peligrosos se anuncian.
- [ ] El Chamán prioriza aliados válidos.
- [ ] La Bestia no explota sin señal previa.
- [ ] Las entidades muertas se limpian correctamente.

---

# Paso 9 — Mapa y misión activa

Estado: [ ]

## Tareas

- [ ] Configurar pipeline de Tiled.
- [ ] Definir esquema de propiedades.
- [ ] Crear importador y validador de mapas.
- [ ] Crear Bosque Corrupto.
- [ ] Crear límites.
- [ ] Crear obstáculos.
- [ ] Crear zonas de aparición.
- [ ] Crear tres altares.
- [ ] Crear sistema de objetivos.
- [ ] Mostrar progreso.
- [ ] Bloquear jefe hasta destruir altares.
- [ ] Crear sistema común de interacción.
- [ ] Crear minimapa básico o datos para generarlo.
- [ ] Crear puntos de control si corresponden.
- [ ] Implementar victoria y derrota.
- [ ] Crear resultados básicos.

## Criterios de aceptación

- [ ] La misión puede completarse de principio a fin.
- [ ] Los altares se contabilizan una vez.
- [ ] El jefe no aparece antes de tiempo.
- [ ] La derrota reinicia o finaliza correctamente.
- [ ] El resultado contiene métricas reales.

---

# Paso 10 — Jefe

Estado: [ ]

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

Estado: [ ]

## Tareas

- [ ] Crear inventario persistente.
- [ ] Crear panel.
- [ ] Crear comparación.
- [ ] Equipar y desequipar.
- [ ] Actualizar estadísticas.
- [ ] Crear drops individuales.
- [ ] Crear generación de rareza.
- [ ] Crear afijos.
- [ ] Crear objetos MVP.
- [ ] Crear favorito.
- [ ] Crear venta.
- [ ] Crear protecciones.
- [ ] Crear cambios visuales de arma y armadura.
- [ ] Sincronizar capas visuales con todas las animaciones.
- [ ] Validar compatibilidad de frames entre capas.
- [ ] Crear pruebas de generación y equipamiento.

## Contenido mínimo

- [ ] 10 armas.
- [ ] 10 piezas de armadura.
- [ ] 5 accesorios.
- [ ] 12 afijos.
- [ ] 1 objeto legendario de jefe.

## Criterios de aceptación

- [ ] Equipar modifica estadísticas reales.
- [ ] El servidor valida la operación.
- [ ] No puede equiparse un objeto ajeno.
- [ ] No se duplican objetos.
- [ ] El cambio visual básico es visible.

---

# Paso 12 — Niveles, atributos y habilidades

Estado: [ ]

## Tareas

- [ ] Implementar experiencia.
- [ ] Implementar niveles 1 a 10.
- [ ] Implementar puntos de atributo.
- [ ] Implementar distribución.
- [ ] Implementar reseteo controlado si corresponde.
- [ ] Implementar desbloqueo de habilidades.
- [ ] Implementar barra de habilidades.
- [ ] Guardar build.
- [ ] Crear pantalla de personaje.
- [ ] Crear pruebas.

## Criterios de aceptación

- [ ] No se gastan más puntos de los disponibles.
- [ ] Los atributos actualizan estadísticas.
- [ ] La build persiste.
- [ ] El nivel no puede alterarse desde el cliente.
- [ ] La curva de experiencia está centralizada.

---

# Paso 13 — Multiplayer de lobby

Estado: [ ]

## Tareas

- [ ] Configurar servidor multiplayer.
- [ ] Autenticar conexión.
- [ ] Crear sala.
- [ ] Generar código.
- [ ] Unirse por código.
- [ ] Listar jugadores.
- [ ] Estado listo.
- [ ] Transferir anfitrión.
- [ ] Seleccionar misión.
- [ ] Seleccionar dificultad.
- [ ] Iniciar partida.
- [ ] Limpiar salas.
- [ ] Probar dos clientes.

## Criterios de aceptación

- [ ] Dos usuarios pueden entrar a la misma sala.
- [ ] Los códigos inválidos muestran error.
- [ ] No se supera el límite de cuatro.
- [ ] El anfitrión puede desconectarse sin destruir el lobby.
- [ ] Una partida iniciada no admite nuevos jugadores.

---

# Paso 14 — Multiplayer de combate

Estado: [ ]

## Tareas

- [ ] Crear estado de partida autoritativo.
- [ ] Sincronizar jugadores.
- [ ] Sincronizar enemigos.
- [ ] Validar movimiento.
- [ ] Validar ataques.
- [ ] Validar habilidades.
- [ ] Sincronizar objetivos.
- [ ] Sincronizar jefe.
- [ ] Implementar interpolación.
- [ ] Implementar predicción local limitada.
- [ ] Implementar reconciliación.
- [ ] Implementar reanimación.
- [ ] Implementar reconexión.
- [ ] Implementar fin de partida.
- [ ] Medir tráfico.

## Criterios de aceptación

- [ ] Dos a cuatro jugadores completan la misión.
- [ ] El daño es consistente.
- [ ] Un cliente no puede otorgarse vida.
- [ ] Un cliente no puede ignorar cooldowns.
- [ ] Los objetivos no se duplican.
- [ ] La reanimación funciona.
- [ ] La desconexión no bloquea la sala.

---

# Paso 15 — Recompensas multiplayer

Estado: [ ]

## Tareas

- [ ] Generar botín individual.
- [ ] Mostrar drops privados.
- [ ] Calcular experiencia.
- [ ] Calcular oro.
- [ ] Aplicar dificultad.
- [ ] Guardar resultado.
- [ ] Entregar mediante transacción.
- [ ] Implementar idempotencia.
- [ ] Crear pantalla de resultados.
- [ ] Agregar pruebas simultáneas.

## Criterios de aceptación

- [ ] Cada jugador recibe recompensas propias.
- [ ] Reclamar o finalizar dos veces no duplica recompensas.
- [ ] La desconexión tardía no duplica resultados.
- [ ] Las recompensas persisten después de reiniciar el servidor.

---

# Paso 16 — Modo offline basado en calibración de 5 minutos

Estado: [ ]

## Tareas

### Calibración

- [ ] Crear botón **Preparar modo offline**.
- [ ] Crear selector de zona y dificultad.
- [ ] Crear contador autoritativo de 5 minutos.
- [ ] Capturar snapshot de build.
- [ ] Bloquear cambios durante la muestra.
- [ ] Registrar métricas válidas en servidor.
- [ ] Excluir recompensas no válidas.
- [ ] Validar actividad mínima.
- [ ] Detectar tasas imposibles.
- [ ] Invalidar la muestra cuando corresponda.
- [ ] Mostrar motivo de invalidación.
- [ ] Mostrar estimación por hora.

### Activación

- [ ] Crear confirmación.
- [ ] Guardar hora de inicio del servidor.
- [ ] Guardar calibración y snapshot inmutables.
- [ ] Marcar personaje como `AWAY_FARMING`.
- [ ] Impedir partidas activas con ese personaje.
- [ ] Configurar límite inicial de 8 horas.
- [ ] Configurar eficiencia inicial de 80 %.

### Cálculo

- [ ] Calcular tiempo transcurrido.
- [ ] Aplicar límite máximo.
- [ ] Aplicar eficiencia.
- [ ] Aplicar penalización por muertes.
- [ ] Calcular experiencia.
- [ ] Calcular oro.
- [ ] Calcular materiales.
- [ ] Calcular oportunidades de loot.
- [ ] Generar loot nuevo con tablas y semilla del servidor.
- [ ] Excluir recompensas únicas y de jefe.
- [ ] Limitar rarezas por zona.
- [ ] Versionar fórmulas de cálculo.

### Regreso y reclamo

- [ ] Detener modo ausente al abrir el personaje.
- [ ] Persistir resultado antes de mostrarlo.
- [ ] Crear informe completo.
- [ ] Crear reclamación transaccional.
- [ ] Implementar idempotencia.
- [ ] Proteger contra reclamos concurrentes.
- [ ] Liberar personaje después del reclamo.
- [ ] Conservar sesión tras reinicio del servidor.

### Pruebas

- [ ] Probar calibración válida de 300 segundos.
- [ ] Probar cambio de build.
- [ ] Probar desconexión durante calibración.
- [ ] Probar cero actividad.
- [ ] Probar reloj del cliente manipulado.
- [ ] Probar límite de 8 horas.
- [ ] Probar un legendario en la muestra sin duplicación literal.
- [ ] Probar IDs únicos de objetos.
- [ ] Probar reclamo simultáneo.
- [ ] Documentar fórmulas y límites.

## Criterios de aceptación

- [ ] El jugador completa una muestra válida de 5 minutos.
- [ ] El sistema muestra una estimación explicable por hora.
- [ ] El jugador puede cerrar el navegador o apagar la PC.
- [ ] El servidor conserva la sesión ausente.
- [ ] El reloj del cliente no afecta el resultado.
- [ ] El equipamiento posterior no altera el snapshot.
- [ ] La recompensa se calcula según el tiempo transcurrido y el límite.
- [ ] El loot se genera nuevamente y no copia objetos exactos.
- [ ] Las recompensas únicas no aparecen.
- [ ] La recompensa se entrega una sola vez.
- [ ] El personaje vuelve a estar disponible después del reclamo.

---

# Paso 17 — Pueblo completo y economía

Estado: [ ]

## Tareas

- [ ] Integrar todos los menús.
- [ ] Crear comerciante.
- [ ] Vender objetos.
- [ ] Comprar objetos básicos.
- [ ] Crear cofre.
- [ ] Crear portal activo.
- [ ] Crear acceso a **Preparar modo offline**.
- [ ] Crear navegación coherente.
- [ ] Implementar confirmaciones.
- [ ] Crear tutorial inicial.
- [ ] Permitir repetir u omitir tutorial.
- [ ] Registrar economía.

## Criterios de aceptación

- [ ] El jugador completa todo el ciclo desde el pueblo.
- [ ] No existen pantallas sin salida.
- [ ] No se pierden objetos al moverlos.
- [ ] Las operaciones económicas son persistentes.

---

# Paso 18 — Arte, audio y feedback

Estado: [ ]

## Tareas

- [ ] Documentar pipeline final de arte.
- [ ] Validar manifiesto y licencias.
- [ ] Reemplazar placeholders prioritarios.
- [ ] Crear sprites originales.
- [ ] Crear animaciones del Guardián.
- [ ] Crear animaciones de enemigos.
- [ ] Crear efectos de habilidades.
- [ ] Crear cambios visuales de equipamiento.
- [ ] Crear sonidos.
- [ ] Crear música.
- [ ] Crear buses de audio.
- [ ] Crear opciones de volumen.
- [ ] Crear feedback de impacto.
- [ ] Crear pooling y límites de efectos.
- [ ] Revisar legibilidad.
- [ ] Verificar licencias.
- [ ] Verificar presupuesto de descarga.
- [ ] Verificar compatibilidad en navegadores objetivo.

## Criterios de aceptación

- [ ] No se usan assets sin permiso.
- [ ] Los ataques se leen correctamente.
- [ ] El sonido puede desactivarse.
- [ ] La interfaz no tapa información crítica.
- [ ] El arte mantiene una dirección consistente.

---

# Paso 19 — Calidad, rendimiento y seguridad

Estado: [ ]

## Tareas

- [ ] Ejecutar auditoría de seguridad.
- [ ] Revisar validaciones.
- [ ] Revisar autorización.
- [ ] Revisar duplicación de recompensas.
- [ ] Agregar rate limits.
- [ ] Revisar logs.
- [ ] Medir FPS.
- [ ] Medir memoria.
- [ ] Medir cantidad de entidades, proyectiles, efectos y audio.
- [ ] Validar presupuestos de rendimiento.
- [ ] Validar herramientas internas desactivadas en producción.
- [ ] Medir servidor.
- [ ] Probar cuatro jugadores.
- [ ] Probar sesiones largas.
- [ ] Probar reconexiones.
- [ ] Probar cierre del navegador durante el modo ausente.
- [ ] Probar recuperación después de reiniciar el servidor.
- [ ] Corregir fugas.
- [ ] Corregir errores de consola.
- [ ] Revisar accesibilidad.

## Criterios de aceptación

- [ ] No hay vulnerabilidades críticas conocidas.
- [ ] No hay duplicación reproducible de moneda u objetos.
- [ ] El cliente mantiene rendimiento razonable.
- [ ] El servidor soporta múltiples salas de prueba.
- [ ] Los errores tienen logs útiles.

---

# Paso 20 — Pruebas finales y despliegue

Estado: [ ]

## Tareas

- [ ] Crear entorno de staging.
- [ ] Configurar base de datos.
- [ ] Configurar secretos.
- [ ] Configurar frontend.
- [ ] Configurar backend.
- [ ] Configurar websocket.
- [ ] Configurar CORS.
- [ ] Configurar HTTPS.
- [ ] Configurar assets e iconos web de producción.
- [ ] Verificar versionado y despliegue del cliente web.
- [ ] Ejecutar migraciones.
- [ ] Ejecutar seed controlado.
- [ ] Crear health checks.
- [ ] Crear CI.
- [ ] Ejecutar pruebas en CI.
- [ ] Crear backups.
- [ ] Documentar rollback.
- [ ] Crear checklist de publicación.

## Criterios de aceptación

- [ ] El juego funciona fuera de localhost.
- [ ] Dos usuarios remotos pueden jugar.
- [ ] El modo ausente sobrevive reinicios.
- [ ] Cerrar la computadora no interrumpe el cálculo por tiempo transcurrido.
- [ ] Las migraciones son reproducibles.
- [ ] Existe procedimiento de recuperación.

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

La siguiente tarea incompleta del checklist.

También debe actualizar el registro siguiente.

---

# 33. Registro de progreso

| Fecha | Paso | Estado | Resumen | Pruebas | Próximo |
|---|---:|---|---|---|---|
| Pendiente | 1 | No iniciado | Documento maestro consolidado para web, modo ausente, spritesheets, assets, mapas, audio, tutorial y herramientas internas | No aplica | Auditar repositorio |
| 2026-07-29 | 1 | Completado | Monorepo pnpm con cliente React/Vite, servidor Fastify, configuración estricta, PostgreSQL local y documentación de arquitectura, autoridad y modo ausente | Instalación congelada, formato, lint, typecheck, 1 test, build, smoke web/API, revisión visual y PostgreSQL healthy | Paso 2: crear paquete `shared` |
| 2026-07-29 | 2 | Completado | Contratos Zod y catálogo versionado compartidos por cliente y servidor: dominio, red, modo ausente, Guardián, objetos, enemigos, misión, balance, sprites y mapas | Instalación congelada, formato, lint, typecheck, 12 pruebas, build, auditoría de imports y smoke web/API | Paso 3: instalar y configurar Prisma |
| 2026-07-29 | 3 | Completado | Persistencia autoritativa en PostgreSQL con Prisma, agregado de personaje, ownership compuesto, guardados versionados, economía idempotente y backup/restore local verificado | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 14 pruebas unitarias, 6 integraciones sobre DB vacía, build, 3 migraciones, seed doble y restore con SHA-256 | Paso 4: elegir e implementar autenticación |
| 2026-07-29 | 4 | Completado | Autenticación propia con Argon2id, sesiones opacas revocables, rutas y WebSocket protegidos, perfil y gestión segura de Guardianes con UI web | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 19 pruebas unitarias/UI, 11 integraciones PostgreSQL/HTTP/WS, build, 5 migraciones, seed doble y recorrido visual real | Paso 5: configurar navegación principal |
| 2026-07-29 | 5 | Completado | Navegación protegida, recuperación no rotativa de sesión, estado de red/mantenimiento y acciones single-flight con intención idempotente | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 32 pruebas unitarias/UI, 12 integraciones PostgreSQL/HTTP/WS, build, migraciones y seed doble | Paso 6: instalar y configurar Phaser |
| 2026-07-29 | 6 | Completado | Isla Phaser desacoplada con escenas Boot/Test, movimiento y colisiones Arcade, FSM y capas animadas validadas, ciclo de vida seguro y checkpoint autoritativo idempotente | Instalación congelada, Prisma generate/validate, formato, lint, typecheck, 41 pruebas unitarias/UI, 13 integraciones PostgreSQL/HTTP, build, 6 migraciones, seed doble, backup/restore SHA-256 y smoke real de canvas/remontaje | Paso 7: implementar combate del Guardián |

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
