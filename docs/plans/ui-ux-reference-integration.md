# Integración de UI/UX de La Brecha Oscura

## Objetivo del usuario

Integrar en el juego la UI/UX entregada en `La Brecha Oscura UI completa (1).zip`: identidad
visual dark-fantasy, iconografía, paneles ornamentados, menú, pueblo, inventario y HUD de combate.
La interfaz debe ser funcional y navegable, no una imagen estática, y conservar los límites entre
presentación, dominio Phaser y servidor.

## Estado actual

La referencia contiene una maqueta interactiva de cinco vistas (`tokens`, `menu`, `pueblo`,
`inventario`, `hud`) y una captura de 1680×900. El repositorio ya tiene tokens parciales,
`Button`, `Panel`, `Glyph`, pantallas React mock de menú/pueblo/inventario y un HUD de combate en
`GameIsland`, pero la integración está incompleta: faltan iconos consistentes, party/chat/
notificaciones/bonificaciones, responsive de las vistas, smoke visual y pruebas específicas de las
nuevas pantallas. El runtime sólo expone salud, Furia, cooldowns, conexión, pausa y enemigos vivos.

## Alcance

- Consolidar tokens y componentes visuales reutilizables sin agregar dependencias.
- Crear un catálogo de iconos SVG inline accesibles, con fallback CSS sólo para placeholders.
- Pulir menú, pueblo e inventario para seguir la referencia y funcionar con teclado/click.
- Integrar en el HUD topbar, vitals, recursos, buffs, party de presentación, chat, log de loot,
  notificaciones, skill dock, conexión, pausa y footer de experiencia.
- Mantener una fuente de estado de presentación separada del dominio; usar datos reales donde el
  snapshot ya los expone y fixtures explícitos donde el sistema todavía no existe.
- Añadir responsive para escritorio y pantallas estrechas, estados hover/focus/disabled y pruebas
  de helpers/render críticos.

## Fuera de alcance

- No inventar party, minimapa, loot, recompensas, economía o progreso persistente reales.
- No cambiar fórmulas, autoridad del servidor, Prisma, contratos de red ni migraciones.
- No usar la captura de referencia como asset de producción ni agregar dependencias de iconos.
- No cerrar el Paso 8 ni avanzar a otro paso del GOAL por este trabajo visual.

## Arquitectura afectada

React posee navegación y componentes presentacionales. `GameIsland` sigue siendo el único puente
con Phaser. El runtime publica un snapshot pequeño; adaptadores de presentación lo convierten en
props para HUD sin importar Phaser en componentes React. Los iconos son SVG inline puros y no
contienen lógica de dominio.

## Skills requeridas

- `game-architect`: límites entre UI, Phaser y contratos.
- `automated-playtesting`: tests de componentes y smoke visual sin afirmar sistemas inexistentes.
- `pixel-art-pipeline`: iconos/assets, escala, fallback y separación de VFX.

## Archivos relevantes

- `apps/web/src/components/Icon.tsx`, `Panel.tsx`, `Button.tsx`: primitives visuales.
- `apps/web/src/components/ui/*`: paneles, barras, badges y slots reutilizables.
- `apps/web/src/data/uiPresentation.ts`: fixtures y tipos de presentación.
- `apps/web/src/screens/*`: menú, pueblo e inventario.
- `apps/web/src/game/GameIsland.tsx`: composición del HUD sobre canvas.
- `apps/web/src/game/runtime.ts`: sólo extensión mínima del snapshot si hace falta.
- `apps/web/src/styles/theme.css`, `apps/web/src/styles.css`: tokens, responsive y focus states.
- `apps/web/src/*test*`: regresiones de helpers, rutas e interacción.

## Modelo de datos

No se agregan entidades persistentes. Las estructuras de party, buffs, chat, loot y notificaciones
son `Readonly` de presentación con IDs estables de fixture. Los valores reales del Guardián y
cooldowns provienen del snapshot existente. Cuando esos sistemas existan, se reemplaza el adaptador
sin cambiar componentes.

## Flujo de ejecución

Input de navegación/click/teclado → handler React → cambio de ruta o estado local → componente
presentacional → callback existente (runtime/API) cuando corresponde. Phaser publica snapshot →
`GameIsland` deriva porcentajes/labels → HUD renderiza; la UI no resuelve daño ni persiste estado.

## Consideraciones multiplayer

No aplica a esta iteración: party/chat son fixtures visuales y no se envían por red. La autoridad de
combate y conexión existente permanece intacta.

## Consideraciones de persistencia

No aplica: no se cambia formato de guardado, inventario real ni migraciones. Acciones existentes de
checkpoint siguen usando la intención versionada actual.

## Consideraciones de rendimiento

Evitar animaciones por frame en React; limitar transiciones CSS a transform/opacity y publicar el
HUD con el throttling existente. Los iconos son SVG inline pequeños, sin imágenes nuevas. El overlay
no debe bloquear el canvas salvo controles interactivos.

## Riesgos

- Solapamiento de paneles sobre el canvas: mitigar con layout responsive y smoke visual.
- Diferencia entre fixture y dominio: etiquetar placeholders y mantener tipos separados.
- Iconos borrosos o inconsistentes: usar viewBox fijo, stroke/fill tokenizados y tamaños definidos.
- Accesibilidad degradada por controles visuales: labels, focus visible, botones reales y aria-label.

## Milestones

1. Primitives/tokens/iconos y ExecPlan.
2. Menú, pueblo e inventario alineados a la referencia.
3. HUD de combate completo con overlays y controles.
4. Tests, formatter/build y smoke visual desktop/mobile.
5. Documentación de resultados y deuda de integración.

## Progreso

- [x] Inspeccionar ZIP, captura, HTML de referencia y estado actual.
- [x] Crear este ExecPlan y fijar límites de presentación.
- [x] Implementar primitives e iconografía.
- [x] Integrar pantallas React.
- [x] Integrar HUD sobre Phaser.
- [x] Validar tests, build y smoke visual.

## Pruebas

- `pnpm typecheck`
- `pnpm test`
- `pnpm format:check`
- `pnpm build`
- Smoke de navegador: `/menu`, `/pueblo`, `/inventario`, `/bruto-preview`; verificar canvas, HUD,
  clicks, foco, pausa, navegación y ausencia de errores de consola.

## Criterios de aceptación

- Las vistas de menu, pueblo, inventario y HUD son accesibles; los tokens de la referencia quedan
  centralizados en la capa visual.
- Los iconos de recursos, navegación, equipo y habilidades son consistentes y reutilizables.
- El HUD no tapa el centro de la escena, los controles siguen funcionando y las barras/cooldowns
  reflejan el snapshot real.
- Inventario permite filtrar y seleccionar fixtures sin mutar el dominio.
- Responsive y focus states no generan overflow horizontal en 320px.
- Suite, formatter, build y smoke visual pasan; placeholders de sistemas inexistentes quedan
  documentados.

## Resultados

- Milestone 1 completado: `Icon.tsx` agrega un catálogo SVG inline con nombres estables, tamaños
  16/24/32 y modo decorativo o etiquetado para lectores de pantalla.
- `Button` y `Panel` incorporan clases/variantes reutilizables, altura md de 44px, slots de icono,
  `type=button` seguro, encabezados asociados y focus-visible consistente.
- `uiPresentation.ts` mantiene fixtures de recursos, buffs, party, chat, loot, notificaciones y
  skills fuera de dominio/backend, con IDs estables y tipos `Readonly` para el siguiente hito.
- Verificado: `pnpm --filter @brecha/web typecheck`; `pnpm exec vitest run apps/web/src/components/visual-primitives.test.tsx` (3 tests); Prettier aplicado.
- `pnpm format:check` mantiene cuatro avisos preexistentes fuera de esta iteracion (`.zcode/plans/...`,
  `Glyph.tsx`, `mockData.ts` y `game/sim/enemy-sim.ts`); los archivos de UI modificados quedaron formateados.
- `GameHudOverlay.tsx` compone topbar, vitals reales, bonificaciones, party/chat/notificaciones de
  presentaciÃ³n, loot, skill dock, conexiÃ³n, controles de pausa/checkpoint y footer de EXP. `GameIsland`
  conserva el puente Ãºnico con Phaser; las habilidades disparan el adaptador runtime existente.
- MenÃº, pueblo e inventario usan el catÃ¡logo SVG y variantes de `Button`/`Panel`; el preview del HUD
  monta a pantalla completa y la navegaciÃ³n conecta pueblo/inventario.
- Verificado: `pnpm typecheck`; `pnpm test` (32 archivos, 175 tests); `pnpm build`; Prettier aplicado.
- Smoke IAB: `/menu`, `/pueblo`, `/inventario`, `/bruto-preview` a 1672Ã—941 y 390Ã—844; canvas Ãºnico,
  sin overflow horizontal ni errores/warnings de consola; clicks de habilidad, AUTO, pausa y rutas
  comprobados.

## Trabajo pendiente

La party real, chat, minimapa, recompensas, economÃ­a, EXP y equipamiento persistente quedan para
los pasos de dominio/backend correspondientes; esta integraciÃ³n no altera el Paso 8 ni adelanta los
pasos posteriores.

La party real, chat, minimapa, recompensas, economía y equipamiento persistente requieren sus pasos
de dominio/backend correspondientes. Este plan sólo deja puntos de integración presentacionales.
