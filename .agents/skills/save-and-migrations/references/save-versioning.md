# Versionado de partidas

## Envelope mínimo

```yaml
format_version: 1
player_id: stable-id
character_id: stable-id
revision: 1
saved_at: authoritative-timestamp
payload:
  stats: {}
  inventory: {}
  equipment: {}
  abilities: {}
  progress: {}
  quests: {}
  currencies: {}
  pending_rewards: {}
  idle_state: {}
  settings: {}
```

No persistir secretos, tokens, caches recreables ni estado visual temporal.

## Migraciones secuenciales

```text
v1 --migrate_1_to_2--> v2 --migrate_2_to_3--> v3
```

Cada migración debe:

- Aceptar sólo versión origen.
- Ser determinista e idempotente o rechazar claramente una repetición.
- Validar precondiciones y resultado.
- Conservar IDs y semántica.
- Tener fixture de entrada y snapshot/asserters de salida.
- Documentar valores por defecto y pérdida inevitable.

Evitar una función única que migre cualquier versión directamente a “latest”; impide probar pasos y diagnosticar fallos.

## Escritura atómica

Para archivo local:

1. Serializar y validar en memoria.
2. Escribir un temporal en el mismo volumen.
3. Sincronizar cuando la plataforma lo permita.
4. Rotar backup válido.
5. Reemplazar atómicamente el destino.
6. Verificar lectura.

Para base de datos, usar transacción y control de revisión. No sobrescribir una revisión más nueva.

## Recuperación

Clasificar errores: formato desconocido, corrupción, referencia faltante, migración fallida o conflicto. Conservar original y backup, registrar diagnóstico seguro y ofrecer recuperación explícita. Nunca guardar defaults encima del único archivo corrupto antes de copiarlo.

## Compatibilidad

Definir versión mínima soportada y política de downgrade. Un servidor no debe aceptar un cliente antiguo que pueda truncar campos desconocidos. Versionar también generadores o catálogos si reconstruyen datos persistidos.

## Matriz de pruebas

- Round trip de versión actual.
- Cada paso N→N+1.
- Cadena desde versión mínima.
- Campos opcionales/ausentes y valores límite.
- Referencias inválidas y IDs duplicados.
- Archivo truncado y checksum si existe.
- Fallo entre temporal y reemplazo.
- Dos escritores con la misma revisión.
- Restauración de backup.

