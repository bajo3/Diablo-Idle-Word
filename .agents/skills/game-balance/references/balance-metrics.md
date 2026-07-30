# Métricas de balance

## Métricas principales

| Área | Métrica | Cálculo conceptual |
| --- | --- | --- |
| Progresión | tiempo por nivel | XP requerida / XP por hora |
| Ofensiva | DPS sostenido | daño total / duración |
| Defensa | vida efectiva | vida / daño recibido relativo |
| Encuentro | TTK | vida efectiva del objetivo / DPS |
| Economía | saldo por hora | fuentes - sumideros |
| Loot | objetos por hora | drops válidos / horas |
| Rareza | rarezas por hora | drops por tier / horas |
| Idle | relación idle/activo | progreso idle / progreso activo |

Medir burst, sustain, percentiles y ventanas relevantes; no mezclar DPS de un objetivo con área sin etiquetar.

## Economía

Inventariar fuentes: enemigos, quests, venta, idle y eventos. Inventariar sumideros: mejoras, crafting, comercio, reparación y cosméticos si existen. Segmentar por etapa; una economía con saldo positivo sostenido tiende a inflación.

## Clases y builds

Comparar con escenarios comunes:

- Objetivo único, grupos y movilidad.
- Ventana corta y sostenida.
- Equipo bajo, mediano y alto.
- Daño recibido evitable e inevitable.
- Tiempo activo e idle.

No exigir igualdad total; definir bandas por fortaleza declarada. Detectar dominancia cuando una build supera alternativas en varias dimensiones sin costo relevante.

## Rendimientos y caps

Documentar fórmula, punto de inflexión, cap blando y cap duro. Probar justo debajo, en y encima del límite.

## Simulación reproducible

Registrar:

- Versión de configuración y código.
- Seed y generador.
- Cantidad de corridas.
- Escenario, clase, build, nivel y equipo.
- Media, mediana, p10/p90 o intervalos apropiados.
- Supuestos y datos excluidos.

## Reporte antes/después

| Campo | Contenido |
| --- | --- |
| Métrica | Nombre y segmento |
| Anterior | Valor/distribución |
| Nuevo | Valor/distribución |
| Razón | Hipótesis |
| Riesgo | Efectos secundarios |
| Prueba | Comando/escenario/seed |
| Esperado | Banda de aceptación |
| Observado | Resultado real |

Evitar cambiar varias palancas a la vez salvo que el experimento mida su interacción.

