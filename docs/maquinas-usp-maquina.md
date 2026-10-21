# Máquinas: procedimiento unificado

El módulo Máquinas usa `dbo.usp_Maquina` para todas sus operaciones.

- `LISTAR` devuelve cada máquina como `id|maquina|registro|serieFactura|serieNC|serieBoleta|tiketera`.
- `CREAR` registra el nombre de máquina, serie de factura, serie de nota de crédito, serie de boleta y ticketera opcional.
- `ACTUALIZAR` recibe el mismo conjunto de campos y el ID de la máquina. El registro de fecha lo genera la base de datos y no se edita desde el formulario.
- `ELIMINAR` elimina una máquina sin registros relacionados.

El nombre de la máquina debe ser único. Las series pueden repetirse entre máquinas; las emisiones que usan una misma serie comparten el correlativo de esa serie. El nombre de la ticketera/impresora es opcional y puede repetirse entre máquinas. Si una base instalada tiene un índice `UNIQUE` solamente sobre `MAQUINAS.Tiketera`, el administrador de SQL puede aplicar `sgo_dnx_backend/scripts/sql/20261020_maquinas_permitir_impresora_repetida.sql`; el script no elimina restricciones compuestas ni la unicidad del nombre de máquina.

La API conserva sus rutas actuales. La web interpreta las respuestas `OK|...` y `ERROR|...` para no mostrar éxito ni agregar registros locales cuando el procedimiento rechaza la operación. El formulario requiere nombre, serie de factura, serie de nota de crédito y serie de boleta; la ticketera es opcional.
