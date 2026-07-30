# Cálculos de progresión idle

## Ventana válida

```text
inicio = último_instante_autoritativo
fin = instante_actual_autoritativo
duración_bruta = max(0, fin - inicio)
duración_efectiva = min(duración_bruta, cap_offline)
```

Usar una unidad entera acordada, preferentemente milisegundos o segundos. Registrar versión de tasas y dividir la ventana cuando cambie configuración.

## Recompensas lineales

```text
recompensa = floor(duración_efectiva × tasa_por_segundo)
```

Ejemplo: 7.200 segundos, 2 XP/s y cap de 4 horas → 14.400 XP.

Para reducción progresiva:

```text
total = tramo_1 × tasa_1 + tramo_2 × tasa_2 + ...
```

No integrar por frame; iterar sólo por cambios de tasa o tramos acotados.

## Loot agregado

Para `n` oportunidades independientes con probabilidad `p`:

```text
esperanza = n × p
P(al menos uno) = 1 - (1 - p)^n
```

Para entregar cantidades reales, usar una distribución binomial o una aproximación documentada y validada para `n` grande. Conservar seed y versión si el resultado debe reproducirse. Evitar millones de tiradas individuales.

Ejemplo: 100 oportunidades al 1 % → esperanza 1; probabilidad de al menos uno ≈ 63,4 %.

## Simulación resumida

Separar:

- Producción garantizada: fórmula por tasa.
- Encuentros: cantidad agregada limitada por poder y duración.
- Loot: distribución agregada por tabla/version.
- Misiones: avance hasta objetivo, cap y condiciones válidas.

No otorgar más progreso que el posible bajo las restricciones del modo idle.

## Idempotencia

Crear un registro:

```yaml
operation_id: UUID
player_id: stable-id
window_start: timestamp
window_end: timestamp
balance_version: version
status: pending|claimed
reward_digest: hash-or-version
```

En una transacción:

1. Rechazar ventanas solapadas ya calculadas.
2. Insertar o recuperar la operación por clave única.
3. Acreditar sólo si está `pending`.
4. Marcar `claimed` junto con los saldos.
5. En reintento, devolver el resultado registrado.

## Casos límite

Probar reloj atrasado, cap, cambio horario, leap second irrelevante para duración monotónica, doble sesión, desconexión tras acreditar, cambio de balance durante ventana, save antiguo y límite diario compartido.

