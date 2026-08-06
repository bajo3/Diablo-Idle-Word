# ExecPlan — Mapa mundial y zonas para el RPG idle

## Objetivo del usuario

Después de cerrar el GOAL actual y sus sistemas de loot, personaje, habilidades, Pueblo y efectos,
incorporar un mapa mundial con otras zonas jugables que funcione como un RPG idle: el jugador elige
una zona desbloqueada, puede jugarla activamente o dejar una sesión ausente autoritativa, recibe
recompensas explicables y desbloquea contenido posterior sin simular cada frame fuera de línea.

## Estado actual

- El Bosque Corrupto es la única zona funcional y usa niveles infinitos 1–20 con `ForestProgressState`
  y oleadas deterministas.
- `Expedition` permite entrar al Bosque Corrupto en dificultad Normal; todavía no existe un mapa
  mundial ni un catálogo de zonas seleccionables.
- El contrato de interacción, su persistencia V1 y el adaptador WebSocket ya están preparados sobre
  una posición de spawn server-side; todavía faltan el tick de instancia real y los efectos de
  dominio. No iniciar este plan antes de cerrar esos trabajos y los pasos de dominio previos.
- El repositorio separa `shared`/`game-data`, React/Vite, Phaser, Fastify y persistencia Prisma.

## Alcance

- Catálogo versionado de zonas, biomas, dificultades, encuentros, requisitos y perfiles de
  recompensa.
- Mapa mundial navegable con zonas bloqueadas/desbloqueadas y una transición clara a Expedición.
- Generación determinista por `zoneId`, `generatorVersion` y seed para encuentros y layouts cuando
  una zona lo necesite.
- Progreso por zona independiente del nivel del personaje y del nivel del Bosque.
- Modo activo y modo idle con el mismo contrato de recompensas, pero con cálculo agregado en servidor
  para ventanas offline.
- Pruebas de conectividad, desbloqueo, balance básico, límites de entidades, replay y reclamación.

## Fuera de alcance

- No reemplazar el Bosque Corrupto ni convertir nombres provisionales en arte definitivo todavía.
- No simular ataques o entidades por frame durante horas offline.
- No permitir que React, Phaser o el reloj del cliente otorguen recompensas.
- No crear un segundo sistema de XP que mezcle progresión de zona, personaje y Bosque.
- No generar decenas de mapas finales antes de validar una zona vertical slice.

## Arquitectura afectada

```text
WorldMap catalog (game-data)
        ↓ validated ZoneDefinition
Zone progression + encounter generator (shared)
        ↓ commands/results
Server application + Save/Reward repositories
        ↓ DTO/snapshot
React map / Expedition ←→ Phaser active-zone adapter
```

- Dominio: `ZoneDefinition`, requisitos, progreso, generador, encuentros y recompensas.
- Aplicación: seleccionar zona, iniciar sesión, calcular ventana idle, crear recompensa pendiente y
  reclamarla idempotentemente.
- Infraestructura: Prisma, reloj de servidor, transporte y Phaser.
- Presentación: mapa React, selector de zona, HUD de zona activa y VFX; nunca resuelve balance.

## Skills requeridas

- `game-architect`: límites entre mapa, dominio, servidor y presentación.
- `idle-progression`: cálculo agregado, cap, reloj autoritativo y claim idempotente.
- `enemy-and-dungeon-generator`: biomas, encuentros, seeds, conectividad y spawn seguro.
- `game-balance`: dificultad, tasas y economía entre zonas.
- `save-and-migrations`: snapshots, versiones y migraciones de progreso.
- `automated-playtesting`: recorridos activos, idle, desbloqueo y replay.
- `performance-2d`: presupuesto de entidades, efectos y carga de zona.

## Modelo de datos

Cada zona debe tener un ID estable y una definición versionada, similar a:

```ts
type ZoneDefinition = {
  zoneId: string;
  displayName: string;
  biomeId: string;
  generatorVersion: number;
  unlock: { requiredZoneId?: string; requiredCharacterLevel?: number };
  activeProfile: { levelRange: [number, number]; encounterBudget: number };
  idleProfile: {
    xpPerSecond: number;
    goldPerSecond: number;
    materialRates: Record<string, number>;
  };
  rewardTableId: string;
  mapSeedPolicy: 'fixed' | 'session';
};
```

Invariantes:

- `zoneId`, `rewardTableId` y `generatorVersion` son estables y no dependen de nombres de archivos.
- Las tasas, requisitos y budgets pasan validación monotónica/versionada antes de publicarse.
- El progreso de zona guarda `highestLevel`, `unlocked`, `lastActiveSession` y la versión de balance;
  no reutiliza directamente `ForestProgressState`.
- Toda recompensa pendiente tiene `operationId`, ventana, seed/versiones, desglose y estado
  `pending|claimed`.

## Flujo de ejecución

1. El cliente solicita el mapa y recibe sólo zonas válidas para el personaje.
2. El servidor valida requisito, versión de contenido y ownership de la sesión.
3. Para modo activo, crea una sesión de zona y Phaser consume el snapshot/encuentros autorizados.
4. Para modo idle, el servidor calcula `min(fin - inicio, cap)` por tramos de tasa; no usa el reloj
   del cliente ni itera ataques.
5. El dominio produce una recompensa pendiente con seed y desglose auditable.
6. Una transacción idempotente acredita y marca `claimed`; un replay devuelve el resultado registrado.

## Consideraciones multiplayer

El servidor posee desbloqueos, sesiones, spawns, muertes, dificultad y recompensas. El cliente sólo
expresa intención (`selectZone`, `startExpedition`, `claimReward`). Los comandos llevan `operationId`
y versión de contrato; reconexión y doble sesión no pueden duplicar una recompensa ni crear dos
sesiones activas para el mismo personaje.

## Consideraciones de persistencia

Agregar migración versionada sólo cuando exista una zona vertical slice. Guardar snapshots de progreso
por zona y recompensas pendientes; respaldar antes de migrar y probar restore. Si cambia la tabla de
recompensas durante una ventana idle, dividir el cálculo por `balanceVersion` en lugar de aplicar la
configuración nueva retroactivamente.

## Consideraciones de rendimiento

- Definir presupuesto por zona para enemigos, proyectiles, telegraphs y efectos antes de crear arte.
- Mantener generación y validación fuera de `update()`; usar pools para efectos repetitivos.
- Verificar carga de mapa, FPS, memoria y entidades con una seed mínima, densa y ramificada.
- Para idle, el costo debe depender de cambios de tasa/encuentro, no de segundos ni frames
  transcurridos.

## Riesgos

- Zonas con dificultad o recompensas no monotónicas → validación de catálogo y simulación balance.
- Grafo de desbloqueos sin salida → test de conectividad y al menos una ruta desde la zona inicial.
- Recompensas activas e idle divergentes → comparar contratos y desglose antes de publicar.
- Seeds incompatibles tras cambiar el generador → persistir `generatorVersion` y conservar seeds de
  regresión.
- Demasiadas entidades al combinar zonas → budget, pooling, stress y degradación segura.

## Decisiones

- 2026-08-04: usar catálogo de datos propios versionados y un mapa mundial por `zoneId`; no acoplar
  progreso a nombres de escenas ni a Tiled para el MVP del RPG idle.
- 2026-08-04: empezar con una vertical slice (Bosque Corrupto + una zona nueva) antes de producir
  múltiples biomas.
- 2026-08-04: compartir el contrato de recompensa entre activo e idle, pero separar sus cálculos y
  adaptadores para mantener autoridad y rendimiento.

## Milestones

- [ ] M1 — Contrato `ZoneDefinition`, catálogo inicial y validador de requisitos/tasas.
- [ ] M2 — Mapa mundial React, navegación y estado bloqueado/desbloqueado.
- [ ] M3 — Segunda zona vertical slice con seed, encuentros, spawn seguro y recompensas.
- [ ] M4 — Progreso por zona persistente y sesión activa sin duplicación.
- [ ] M5 — Cálculo idle, recompensa pendiente, claim y auditoría.
- [ ] M6 — Balance, stress, reconexión, visualización de métricas y cierre del recorrido.

## Progreso

- [ ] Pendiente: no iniciar hasta cerrar el Paso 9, loot, personaje/habilidades, Pueblo y efectos
      definidos en `GOAL.md`.

## Pruebas

- Catálogo: IDs, requisitos, monotonicidad de tasas y versiones.
- Generación: seeds mínima/densa/ramificada, conectividad y spawn seguro.
- Idle: duración negativa/cero/cap, cambio de tasa, reloj atrasado, replay, doble sesión y claim
  tras desconexión.
- E2E: mapa → zona desbloqueada → Expedición → recompensa → claim; zona bloqueada no inicia.
- Rendimiento: una zona y dos zonas bajo el presupuesto de entidades; sin objetos de efecto por frame.

## Criterios de aceptación

- El mapa muestra al menos dos zonas y comunica claramente por qué una está bloqueada.
- El jugador puede entrar a una zona desbloqueada y volver al mapa sin duplicar runtime ni progreso.
- Una seed y versión producen el mismo layout/encuentro; las zonas tienen spawn seguro y ruta válida.
- El modo idle usa tiempo de servidor, cap y tasas versionadas; no acepta recompensa del cliente.
- Reintentar una operación de inicio o claim devuelve el mismo resultado sin duplicar sesión, loot,
  XP, oro o materiales.
- Las pruebas de suite, lint, typecheck, build, smoke navegador y stress pasan con métricas registradas.

## Resultados

Pendiente de implementación posterior al GOAL actual.

## Trabajo pendiente

- Elegir la segunda zona vertical slice y confirmar su fantasy/arte antes de ampliar el catálogo.
- Definir números de balance en `game-data` y simular activo frente a idle antes de publicar tasas.
- Crear migración de persistencia sólo cuando el contrato de progreso de zona esté probado.
