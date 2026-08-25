# Máquinas: procedimiento unificado

El módulo Máquinas usa `dbo.usp_Maquina` para todas sus operaciones.

- `LISTAR` devuelve cada máquina como `id|maquina|registro|serieFactura|serieNC|serieBoleta|tiketera`.
- `CREAR` registra la máquina y sus series.
- `ACTUALIZAR` modifica la máquina existente.
- `ELIMINAR` elimina una máquina sin registros relacionados.

La API conserva sus rutas actuales. La web interpreta las respuestas `OK|...` y `ERROR|...` para no mostrar éxito ni agregar registros locales cuando el procedimiento rechaza la operación.
