# Feriados: procedimiento unificado

El módulo Feriados usa `dbo.usp_Feriado` para todas sus operaciones.

- `LISTAR` devuelve una fila por feriado con el formato `id|fecha|motivo`.
- `CREAR|yyyy-MM-dd|motivo` registra un feriado.
- `ACTUALIZAR|id|yyyy-MM-dd|motivo` modifica un feriado.
- `ELIMINAR|id` lo elimina.

La API conserva sus rutas actuales y transforma las respuestas `OK|...` y `ERROR|...` para el formulario y listado web.
