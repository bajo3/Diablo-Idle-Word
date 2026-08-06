# Stack local de Aseprite y MCP operativo

## Objetivo del usuario

Instalar, configurar y probar de forma reproducible Aseprite, `diivi/aseprite-mcp`,
`willibrandon/pixel-mcp` y el Inspector MCP para poder generar y validar arte de pixel
del juego sin tocar la lógica del cliente o del servidor.

## Estado actual

- Aseprite disponible en `C:/Users/felip/Documents/aseprite-src/build/bin/aseprite.exe`.
  La compilación es `1.3.18.1-6-g717ab76b2-dev` y `--noinapp` no pertenece a esta
  compilación; el error de opción se conserva como evidencia, no se oculta.
- Python 3.13 aislado por `uv` y `uv sync` completados en
  `tools/aseprite-stack/aseprite-mcp`.
- Go 1.26.5 y GNU Make 4.4.1 instalados; `pixel-mcp` compila con Make y con Go directo.
- Inspector instalado de forma efímera con `npx -y @modelcontextprotocol/inspector`.
- `C:/Users/felip/.config/pixel-mcp/config.json` fue respaldado antes de activar debug,
  timing, carpeta temporal y log del proyecto.
- `C:/Users/felip/.codex/config.toml` fue respaldado antes de añadir los servidores
  globales `aseprite_diivi` y `pixel_mcp`.

## Alcance

- [x] Auditoría de herramientas, versiones, rutas y capacidades.
- [x] Smoke Lua directo que genera un sprite RGB transparente de 32×32, 3 capas,
      4 frames, tags `idle`/`walk`, duraciones distintas, PNG y spritesheet JSON.
- [x] Clonado, `uv sync`, pruebas y arranque stdio de `diivi/aseprite-mcp`.
- [x] Compilación, health check, configuración y prueba MCP real de `pixel-mcp`.
- [x] `tools/list` y llamadas reales por Inspector en ambos servidores.
- [x] Validación visual y previews nearest-neighbor 8×.
- [x] Script reproducible `tools/aseprite-stack/test-aseprite-stack.ps1`.
- [x] Informe y registro de backups.

## Fuera de alcance

- No se modificó el código de juego, contratos multiplayer, balance ni persistencia.
- No se descargó ni incorporó un token, licencia o secreto de terceros.
- No se cambia la compilación de Aseprite del usuario por una distribución distinta.

## Arquitectura afectada

El stack queda aislado en `tools/aseprite-stack`: el artefacto `.aseprite` es la fuente
editable, PNG/JSON son salidas verificables, y MCP se comunica por stdio. Codex inicia
`aseprite_diivi` mediante `uv` y `pixel_mcp` mediante el binario Go. El servidor de
juego no conoce estas herramientas.

## Skills requeridas

- `pixel-art-pipeline`: convenciones de escala, transparencia, capas, tags y exportación.
- `automated-playtesting`: smoke reproducible, capturas, validación de artefactos y
  criterio de salida sin errores nuevos.

## Archivos relevantes

- `tools/aseprite-stack/direct-lua/smoke_test.lua`: generador directo Lua.
- `tools/aseprite-stack/aseprite-mcp`: checkout Python de diivi.
- `tools/aseprite-stack/pixel-mcp`: checkout Go y binario compilado.
- `tools/aseprite-stack/inspector/aseprite-diivi.json`: sesión Inspector de diivi.
- `tools/aseprite-stack/validate-assets.py`: validación Pillow y previews 8×.
- `tools/aseprite-stack/test-aseprite-stack.ps1`: smoke completo y capturas.
- `artifacts/aseprite-smoke-tests`: evidencia generada, JSON, PNG y logs.

## Modelo de datos

No se agregan entidades persistentes. El fixture usa 32×32 RGB, alpha transparente,
capas `background/body/weapon`, cuatro frames y tags `idle:1-2` y `walk:3-4`.

## Flujo de ejecución

Ruta Aseprite → script Lua → `.aseprite` → exportaciones PNG/JSON → Inspector MCP
(`tools/list`/`tools/call`) → validación Pillow → previews 8× y logs. En pixel-mcp,
las rutas Windows con barras invertidas pueden romper el JSON de respuesta de
`save_as`/`export_spritesheet`; las llamadas reproducibles usan `/` en los argumentos
de salida y las respuestas quedan verificadas.

## Consideraciones multiplayer

No aplica: ninguna herramienta se conecta al servidor de juego ni muta estado de partida.

## Consideraciones de persistencia

No aplica al juego. Los únicos backups son copias explícitas de configuración local:
`tools/aseprite-stack/backups/codex-config.toml.20260806-144936.bak` y
`tools/aseprite-stack/backups/pixel-mcp-config.json.20260806-143354.bak`.

## Consideraciones de rendimiento

El stack se ejecuta fuera del loop del juego. El smoke directo terminó en menos de un
segundo y los health/list de MCP quedan bajo el timeout del script; no hay trabajo por
frame ni asignaciones en Phaser.

## Riesgos

| Riesgo                                                         | Mitigación                                                                               | Señal                                   |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| `--noinapp` no existe en el build local                        | Usar `--batch`; documentar incompatibilidad                                              | `environment-audit.txt`                 |
| Inspector con `uv` como launcher se queda esperando en Windows | Probar Inspector con Python 3.13 del venv; Codex conserva `uv`                           | timeout de sesión config                |
| Rutas `\` rompen JSON de algunas respuestas de pixel-mcp       | Usar rutas `/` en tool calls y validar archivos                                          | logs `pixel-export-spritesheet-forward` |
| Tests Unix del checkout asumen `echo`, `sh`, `true`            | Ejecutar tests Python completos y tests Go dirigidos; reportar fallos upstream/platforma | reporte final                           |

## Decisiones

- 2026-08-06: conservar el Aseprite source-build existente porque es el ejecutable
  referenciado por la configuración del usuario y responde correctamente a MCP.
- 2026-08-06: agregar MCP a la configuración global con `codex mcp add` después de
  backup, preservando todos los servidores existentes.
- 2026-08-06: usar rutas forward-slash en operaciones pixel-mcp que devuelven JSON.

## Milestones

1. [x] Herramientas instaladas y localizadas.
2. [x] Fixture Lua directo verificable.
3. [x] diivi instalado, probado y consultado por Inspector.
4. [x] pixel-mcp compilado, health y operaciones reales.
5. [x] Codex MCP configurado con backup.
6. [x] Validación visual, script reusable e informe.

## Progreso

- [x] 2026-08-06 — auditoría y paths reales completados.
- [x] 2026-08-06 — smoke Lua y artefactos directos completados.
- [x] 2026-08-06 — diivi `uv sync`, `pytest` 121/121 y MCP real completados.
- [x] 2026-08-06 — pixel-mcp `make build`, health y 50 tools listados.
- [x] 2026-08-06 — Codex registra `aseprite_diivi` y `pixel_mcp` (requiere reinicio de sesión).
- [ ] Pendiente externo — corregir upstream los fallos de rutas/line endings de pixel-mcp
      si se necesita una suite Go integral 100% verde en Windows.

## Pruebas

- `uv sync` y `uv run pytest -q`: 121 passed.
- `go test ./pkg/config ./pkg/server ./cmd/pixel-mcp`: passed.
- `go build ./cmd/pixel-mcp` y `make build`: passed.
- `pixel-mcp --health`: passed.
- Inspector `tools/list`: diivi 116 tools; pixel-mcp 50 tools.
- `test-aseprite-stack.ps1`: exit 0; Aseprite/direct Lua, health, Inspector y Pillow
  pasan. El build devuelve exit code `-1` para la ayuda/script pero deja artefactos válidos.
- `go test -tags=integration ./...`: fallos conocidos del checkout en Windows (Unix
  commands, line endings, rutas backslash en JSON); se guardan en la sesión y en REPORT.

## Criterios de aceptación

- Aseprite real genera y vuelve a abrir `.aseprite` con dimensiones, capas, frames,
  tags y duraciones esperadas.
- Cada MCP acepta stdio, anuncia sus herramientas y realiza al menos una operación real.
- PNG y JSON tienen formato, dimensiones, alpha, colores y metadata no vacíos.
- Codex mantiene servidores previos, registra los dos nuevos y tiene backup recuperable.
- La prueba reusable termina con código 0 cuando los prerrequisitos y artefactos están bien.

## Resultados

Completado el 2026-08-06. Ver `tools/aseprite-stack/REPORT.md` para la tabla de comandos,
artefactos, limitaciones y próximos pasos.

## Trabajo pendiente

- Reiniciar Codex para que la sesión actual cargue los dos MCP globales.
- Si se requiere suite Go integral verde en Windows, abrir un issue/parche upstream para
  normalizar paths JSON, line endings y tests que invocan comandos Unix.
