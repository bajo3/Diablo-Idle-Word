# Project objective

Construir un juego 2D ARPG extensible con combate activo, progresión idle, clases, estadísticas, habilidades, equipamiento, loot procedural, enemigos, dungeons, jefes, multiplayer y persistencia.

[GOAL.md](GOAL.md) es la fuente principal de verdad para alcance, arquitectura, orden de implementación y progreso. Ante cualquier contradicción, seguir GOAL.md y actualizar la documentación derivada.

El repositorio usa un monorepo pnpm con TypeScript estricto, React/Vite para el cliente y Node/Fastify para el servidor. Phaser, PostgreSQL/Prisma y el transporte multiplayer deben incorporarse únicamente en los pasos definidos por GOAL.md.

# Working agreements

- Inspeccionar reglas, manifiestos, código, configuración, pruebas y documentación antes de modificar.
- Hacer cambios pequeños, reversibles y verificables; preservar compatibilidad.
- No inventar APIs ni asumir capacidades del motor; comprobar código instalado o documentación oficial.
- No agregar dependencias sin justificar necesidad, alternativas, costo y mantenimiento.
- Ejecutar compilación/arranque, pruebas, lint y formatter pertinentes; informar comandos y resultados.
- Actualizar documentación y ExecPlan junto con la implementación, no después.
- No guardar secretos, tokens, credenciales ni datos personales en el repositorio o logs.
- Tratar al servidor como autoridad de todo estado multiplayer; el cliente sólo expresa intención.
- No cambiar datos persistentes sin versión, migración, pruebas y documentación.
- No cambiar fórmulas o números de balance sin fuente configurable, ejemplos y reporte antes/después.
- Mantener lógica de negocio separada de render, UI, animación y transporte.
- Evitar números mágicos, estado global mutable, archivos gigantes y dependencias circulares.
- Favorecer configuración basada en datos, IDs estables, relojes/RNG inyectables e idempotencia.
- Agregar una prueba de regresión para cada bug corregido cuando sea viable.
- No eliminar ni reemplazar trabajo existente sin inspeccionarlo; aislar cambios no relacionados.

# Skills

Las skills viven en `.agents/skills/`. Activarlas explícitamente o por coincidencia con su descripción.

| Skill                         | Usar para                                                            |
| ----------------------------- | -------------------------------------------------------------------- |
| `game-architect`              | módulos, límites, escenas, eventos, refactors y cliente/servidor     |
| `combat-system`               | ataques, daño, defensa, recursos, cooldowns, estados y hit detection |
| `classes-and-skills`          | clases, stats, nivel, habilidades, pasivas y árboles                 |
| `loot-and-items`              | objetos, inventario, equipo, afijos, drops y transacciones           |
| `idle-progression`            | tiempo offline, simulación agregada y reclamación                    |
| `multiplayer-authority`       | autoridad, sincronización, validación, reconexión y seguridad        |
| `enemy-and-dungeon-generator` | IA, enemigos, élites, jefes, encuentros y dungeons                   |
| `game-balance`                | curvas, DPS/TTK, economía, drops y simulaciones                      |
| `save-and-migrations`         | guardado, versionado, migraciones, backups y recuperación            |
| `automated-playtesting`       | unidad, integración, E2E, smoke y regresión jugable                  |
| `performance-2d`              | FPS, memoria, entidades, render, física, IA y red                    |
| `pixel-art-pipeline`          | pixel art, spritesheets, atlas, pivotes y placeholders               |

Para tareas multisistema combinar `game-architect`, las skills del dominio y `automated-playtesting`. Agregar `performance-2d` ante densidad o trabajo por frame, `multiplayer-authority` ante estado compartido y `save-and-migrations` ante datos persistentes.

Combinaciones obligatorias:

- Nueva clase: `game-architect`, `classes-and-skills`, `combat-system`, `game-balance`, `automated-playtesting`; sumar `multiplayer-authority` online.
- Nuevo tipo de objeto: `loot-and-items`, `game-balance`, `save-and-migrations`, `automated-playtesting`.
- Nueva dungeon: `enemy-and-dungeon-generator`, `game-balance`, `performance-2d`, `automated-playtesting`.
- Combate multiplayer: `combat-system`, `multiplayer-authority`, `performance-2d`, `automated-playtesting`.
- Recompensas offline: `idle-progression`, `game-balance`, `multiplayer-authority`, `save-and-migrations`, `automated-playtesting`.
- Cambio arquitectónico grande: `game-architect`, ExecPlan, skills de dominios afectados y `automated-playtesting`.

# ExecPlans

Usar un ExecPlan según `PLANS.md` para toda funcionalidad grande, refactor significativo o tarea que afecte varios sistemas. Mantenerlo como documento vivo, registrar decisiones y actualizar checkboxes durante la implementación.

# Definition of done

Una tarea termina sólo cuando:

- El código compila o el juego inicia según el stack.
- Pasan las pruebas relevantes y no aparecen errores nuevos de consola o red.
- La documentación y el ExecPlan aplicables están actualizados.
- La arquitectura conserva límites coherentes y compatibilidad definida.
- Se consideraron casos límite, autoridad, idempotencia, persistencia y rendimiento pertinentes.
- El reporte enumera archivos, comandos, resultados y riesgos pendientes.

# Code review rules

Revisar especialmente:

- Autoridad del servidor y validación de entrada.
- Duplicación de objetos, replay y operaciones no idempotentes.
- Cambios de economía, tasas, drops y fuentes/sumideros.
- Cambios de guardado sin versión o migración.
- Uso de reloj local para recompensas.
- Cálculos no deterministas o redondeo divergente.
- Dependencias circulares y lógica de negocio en UI.
- Pruebas faltantes o regresiones sin escenario.
- Trabajo, allocaciones, listeners o queries costosas por frame.
- Datos sensibles en snapshots, logs o configuración.
