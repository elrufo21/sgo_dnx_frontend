# Áreas: procedimiento unificado

El módulo Áreas usa `dbo.usp_Area` para todas sus operaciones.

- `LISTAR` devuelve cada registro como `id|nombre`.
- `CREAR|nombre` registra un área.
- `ACTUALIZAR|id|nombre` modifica un área existente.
- `ELIMINAR|id` elimina el área si no tiene registros relacionados.

La API conserva sus rutas actuales. La web interpreta las respuestas `OK|...` y `ERROR|...` para mostrar el mensaje del procedimiento y evitar cambios locales cuando una operación es rechazada.
