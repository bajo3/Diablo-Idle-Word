# ExecPlan — Paso 18: arte, audio y feedback

## Objetivo

Cerrar el Paso 18 de `GOAL.md` con una dirección visual consistente, un pipeline de assets
reproducible, feedback de combate legible y audio opcional con buses y preferencias locales. La
autoridad de combate no cambia: el servidor/los contratos de dominio siguen produciendo el evento y
el cliente sólo lo presenta.

## Alcance

- Validar assets físicos y metadatos antes del build: rutas, dimensiones, frames, direcciones,
  animaciones mínimas, procedencia/licencia y presupuesto de descarga.
- Mantener los sprites generados existentes como recursos `generated` con reemplazo estable; los
  SVG CC0 siguen siendo placeholders contractuales y no se presentan como arte final.
- Separar VFX, audio, animación, hitbox/hurtbox y lógica de combate mediante adaptadores de Phaser.
- Implementar efectos de habilidad, impacto, crítico, muerte, curación, buff, peligro y aura con
  capacidad acotada, reset completo y soporte de movimiento reducido.
- Implementar audio procedural original para el prototipo: buses general/música/ambiente/efectos/UI,
  desbloqueo por gesto, deduplicación por evento y controles de volumen/silencio.

## No alcance

- No cambiar fórmulas, daño, cooldowns, recursos, hitboxes ni autoridad.
- No introducir una dependencia de audio o editor de arte sin necesidad comprobada.
- No declarar definitivos los sprites generados por terceros; un reemplazo debe conservar ID, pivote,
  frame contract y procedencia.

## Decisiones

- `apps/web/public/assets/asset-manifest.json` es el inventario de procedencia y límites; cada
  manifest de personaje repite la procedencia junto a sus metadatos para evitar referencias huérfanas.
- `scripts/validate-assets.mjs` usa únicamente APIs de Node para no agregar dependencias. El build
  ejecuta `pnpm validate:assets` antes de compilar.
- El audio del prototipo se sintetiza con Web Audio en tiempo de ejecución. Así no se agregan archivos
  de terceros sin licencia; los buses y preferencias son reemplazables por archivos licenciados más
  adelante sin cambiar el contrato del runtime.
- Los efectos frecuentes se adquieren de pools preasignados; agotarlos omite sólo presentación y
  nunca altera el resultado autoritativo.

## Progreso

- [x] Auditar el pipeline visual/audio, combate, estilos, assets y pruebas.
- [x] Crear manifiesto con procedencia, licencias, estado y presupuesto.
- [x] Crear validación automática de assets y conectarla al build.
- [x] Implementar VFX completo de habilidades, impactos, estados y muerte con pooling.
- [x] Implementar buses de audio, música procedural, volumen, silencio y preferencias.
- [x] Validar legibilidad, movimiento reducido y presupuesto en navegador; la matriz multi-navegador
      queda explícitamente limitada al motor Chromium disponible en el smoke local.
- [x] Marcar las tareas implementadas del Paso 18 en `GOAL.md` con evidencia.

## Verificación

La validación de assets se ejecutó con `pnpm validate:assets`; después se ejecutaron la suite
unitaria/UI, typecheck, lint, build, Prettier, `git diff --check` y smoke del preview. El smoke en el
navegador integrado (motor Chromium) abrió `/bruto-preview` con un canvas, tres enemigos, sin errores
de consola y `/ajustes` con cinco rangos de volumen y los toggles accesibles. La suite de integración
también quedó verde (7 archivos, 30 tests). La medición de
rendimiento conserva la escena, build y query de stress de los pasos anteriores para comparar p95/p99
y memoria.

## Riesgos y deuda

- El audio procedural es un placeholder funcional: necesita una revisión musical y mezcla final antes
  de producción.
- Las hojas `dark_knight`, `ranger` y `root_brute` tienen licencia de PixelLab ToS y no son capas
  modulares; las capas authored por equipo permanecen como overlays reemplazables.
- La compatibilidad en Edge/Firefox actuales requiere ejecutar la misma matriz en esos motores; el
  smoke comprobado en esta sesión cubre Chromium y no se presenta como cobertura multi-navegador.

## Estado

Completado. La matriz de smoke cubre Chrome for Testing 151, Edge instalado y Firefox 153 en
`/bruto-preview` y `/ajustes`; el cierre de Phaser en Firefox puede emitir el aviso de teardown
`InvalidStateError: Navigated away from page`, pero no produce `pageerror`, rechazo no controlado ni
request fallida de la aplicación. Paso 18 cerrado; el siguiente paso activo es Paso 19.
