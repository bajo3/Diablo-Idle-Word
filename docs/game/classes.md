# Clases y habilidades

## Estado actual

Existe el contrato y catálogo inicial del Guardián, sus atributos, Furia y cinco habilidades. Progresión, costos, cooldowns, fórmulas y árboles siguen `TBD` o sin ejecución.

## Datos del Paso 2

El catálogo define la clase Guardián, Furia, los cuatro atributos, Tajo, Golpe poderoso, Torbellino, Piel de hierro y Sed de batalla. Costos, cooldowns, cantidades y fórmula siguen explícitamente `TBD`.

## Responsabilidades

Mantener definiciones de clase/habilidad, progreso por nivel, puntos, requisitos, rangos, pasivas y respec. Usar IDs estables y configuración validable.

Separar:

- Definición inmutable de clase/habilidad.
- Progreso persistente del personaje.
- Estado temporal de cast/cooldown.
- Resultado de estadísticas derivadas.
- Presentación y localización.

## Flujo de datos

```text
Definición + nivel + talentos + equipo + efectos
→ pipeline de stats → snapshot de combate/presentación
```

Aprender o resetear: comando → validar requisitos/puntos → mutación atómica → recalcular → persistir → replicar.

## Límites

Evitar condicionales globales por clase. Combate ejecuta efectos definidos; balance decide valores; saves versiona progreso; servidor autoriza cambios online.

## Riesgos

IDs vinculados al nombre visible, referencias cíclicas, orden de stats duplicado, respec que deja efectos, clases futuras que exigen editar todos los consumidores.

## Pruebas requeridas

Crear clase, nivelar, validar requisitos, aprender activa/pasiva, respec, compatibilidad de equipo, round trip y sincronización de dos jugadores.

## Skills relacionadas

- [classes-and-skills](../../.agents/skills/classes-and-skills/SKILL.md)
- [combat-system](../../.agents/skills/combat-system/SKILL.md)
- [game-balance](../../.agents/skills/game-balance/SKILL.md)
- [save-and-migrations](../../.agents/skills/save-and-migrations/SKILL.md)
