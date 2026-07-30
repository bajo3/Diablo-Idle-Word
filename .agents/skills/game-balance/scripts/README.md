# Scripts futuros de balance

El repositorio aún no tiene lenguaje principal. No agregar dependencias ni elegir runtime hasta detectar el stack.

Cuando exista un stack:

1. Reutilizar su runtime, test runner y gestor de paquetes.
2. Colocar scripts deterministas en este directorio o en la ubicación de herramientas ya establecida.
3. Aceptar configuración, seed, número de corridas y salida mediante argumentos.
4. No importar UI, motor ni servicios externos para fórmulas puras.
5. Emitir JSON o CSV estable además de un resumen legible cuando facilite comparar versiones.
6. Devolver exit code distinto de cero ante datos inválidos.
7. Añadir una prueba pequeña con seed fija.

Interfaz conceptual:

```text
simulate-balance --scenario <id> --config <path> --seed <n> --runs <n> --out <path>
```

Registrar versión de configuración, commit si existe, timestamp sólo como metadata y todas las hipótesis. No almacenar resultados masivos en Git sin una decisión explícita.

