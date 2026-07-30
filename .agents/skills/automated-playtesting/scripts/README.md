# Scripts futuros de pruebas

El stack todavía no está definido. Integrar herramientas sólo después de detectar motor, runtime, test runner y CI.

Orden de adopción:

1. Reutilizar el runner existente para pruebas unitarias.
2. Crear helpers de reloj, RNG, almacenamiento y transporte controlables.
3. Añadir smoke headless o de escena si el motor lo soporta.
4. Añadir integración para guardado, red y transacciones.
5. Añadir E2E para recorridos críticos con artefactos de fallo.

Todo script debe aceptar configuración de entorno sin secretos, tener timeout, limpiar recursos, devolver exit code correcto y producir logs correlacionados. Evitar coordenadas o sleeps fijos cuando pueda esperarse un estado observable.

Interfaz conceptual:

```text
run-playtest --scenario <id> --seed <n> --timeout <duration> --artifacts <path>
```

Agregar un comando al gestor de scripts sólo cuando exista y la convención sea clara. Documentar requisitos de servidor/cliente, puertos, fixtures y ejecución local/CI.

