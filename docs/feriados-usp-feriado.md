# Feriados en la web

El módulo web usa `dbo.usp_FeriadoWEB`. El procedimiento original `dbo.usp_Feriado` se conserva para el escritorio.

- `LISTAR` y `ELIMINAR|id` delegan al procedimiento original.
- `CREAR|yyyy-MM-dd|motivo` registra un feriado; se permiten motivos repetidos.
- `ACTUALIZAR|id|yyyy-MM-dd|motivo` modifica un feriado; se permiten motivos repetidos.
- La fecha debe ser única. El motivo sigue siendo obligatorio y admite hasta 250 caracteres.

Ejecutar `sgo_dnx_backend/scripts/sql/20261009_feriado_motivo_repetido_web.sql` después de los procedimientos base. La API conserva sus rutas actuales y transforma las respuestas `OK|...` y `ERROR|...` para el formulario y listado web.
