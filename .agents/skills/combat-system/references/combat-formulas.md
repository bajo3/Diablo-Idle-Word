# Fórmulas de combate

## Convenciones

- Usar unidades y precisión documentadas; preferir enteros escalados cuando cliente y servidor deban coincidir exactamente.
- Aplicar modificadores en orden estable: base → aditivos → multiplicativos → mitigación → críticos → modificadores finales → clamp → redondeo.
- Redondear una sola vez al final salvo que una regla documentada exija otra cosa.
- Aplicar mínimo de daño sólo si el diseño lo define; valor inicial recomendado: `max(0, resultado)`.

## Fórmula base

```text
ataque = base + suma_aditiva
potenciado = ataque × producto(1 + modificador_multiplicativo)
mitigado = potenciado × factor_defensa
crítico = mitigado × (es_crítico ? multiplicador_crítico : 1)
final = redondear(clamp(crítico × modificadores_finales, mínimo, máximo))
```

Ejemplo: base 100, +20, +25 %, factor de armadura 0,80 y crítico ×1,5:

```text
ataque = 120
potenciado = 150
mitigado = 120
final crítico = 180
```

## Armadura y resistencias

Usar una curva suave configurable cuando no exista fórmula:

```text
reducción = defensa / (defensa + K_nivel)
factor_defensa = 1 - clamp(reducción, reducción_mínima, reducción_máxima)
```

Ejemplo con defensa 100 y `K_nivel = 300`: reducción 25 %, daño 200 → 150.

Aplicar resistencias por tipo elemental. Documentar si admiten valores negativos y caps; no asumir un cap definitivo mientras el diseño esté `TBD`.

## Crítico, precisión y evasión

```text
prob_crítico_final = clamp(base + bonos, 0, cap_crítico)
daño_crítico = daño_mitigado × multiplicador_crítico
prob_impacto = clamp(función(precisión, evasión), mínimo, máximo)
```

Hacer una sola tirada autoritativa con RNG/seed controlable. Omitir precisión/evasión si el proyecto no las usa.

## Velocidad, lanzamiento y cooldown

```text
intervalo_ataque = intervalo_base / multiplicador_velocidad
cooldown_final = max(cooldown_mínimo, cooldown_base × producto_reducciones)
```

Definir si el cooldown comienza al iniciar, impactar o terminar el cast. Interrumpir mediante transición explícita y política de costo/cooldown.

## Efectos periódicos

Representar duración, frecuencia, fuente, tipo, stacks y política de refresco:

```text
ticks = floor(duración / intervalo_tick)
daño_total = ticks × daño_por_tick
```

Definir si burn, poison y bleed pueden criticar, heredar stats o acumularse. Slow, stun y freeze deben respetar inmunidades y caps. Knockback debe validarse contra navegación/colisión.

## Orden de resolución

1. Validar actor, objetivo, estado, alcance, recurso y cooldown.
2. Reservar costo e iniciar lanzamiento.
3. Resolver impacto/hitbox/proyectil.
4. Determinar hit y crítico con RNG autoritativo.
5. Calcular daño por tipo y mitigación.
6. Aplicar salud, efectos, aggro y knockback.
7. Resolver muerte y recompensas.
8. Emitir eventos y replicar resultado.

Probar valores cero, negativos permitidos, overflow, caps, inmunidad, muerte simultánea y diferencias de precisión entre plataformas.

