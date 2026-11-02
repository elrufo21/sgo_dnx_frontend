# Máquinas: procedimiento unificado

El módulo Máquinas usa `dbo.usp_Maquina` para todas sus operaciones.

- `LISTAR` devuelve cada máquina como `id|maquina|registro|serieFactura|serieNC|serieBoleta|tiketera`.
- `CREAR` registra el nombre de máquina, serie de factura, serie de nota de crédito, serie de boleta y ticketera opcional.
- `ACTUALIZAR` recibe el mismo conjunto de campos y el ID de la máquina. El registro de fecha lo genera la base de datos y no se edita desde el formulario.
- `ELIMINAR` elimina una máquina sin registros relacionados.

El nombre de la máquina y la serie de factura deben ser únicos, sin distinguir mayúsculas ni espacios externos. La web y la API validan ambos al crear y editar; la API consulta toda la tabla y serializa las solicitudes de guardado. Las series de boleta y nota de crédito pueden repetirse; las emisiones que usan una misma serie comparten el correlativo de esa serie. La ticketera es opcional y puede repetirse. La validación de la API no impide escrituras efectuadas directamente por otros sistemas en SQL.

En la base local `DXNCOMAS2610` se detectaron las series de factura `FA01` y `FA02` repetidas. No se cambiaron automáticamente: al editar una máquina con una serie duplicada debe asignarse una serie disponible. El [diagnóstico SQL de solo lectura](../../sgo_dnx_backend/scripts/sql/20261102_consultar_duplicados_maquinas.sql) permite revisar otras bases. Si una base instalada tiene un índice `UNIQUE` solamente sobre `MAQUINAS.Tiketera`, el administrador de SQL puede aplicar `sgo_dnx_backend/scripts/sql/20261020_maquinas_permitir_impresora_repetida.sql`.

La API conserva sus rutas actuales. La web interpreta las respuestas `OK|...` y `ERROR|...` para no mostrar éxito ni agregar registros locales cuando el procedimiento rechaza la operación. El formulario requiere nombre, serie de factura, serie de nota de crédito y serie de boleta; la ticketera es opcional.

El listado ordena por ID descendente antes de paginar en la API y también mantiene ese orden en el estado local. La columna Registro se presenta como `dd/mm/aaaa hh:mm:ss`; la fecha que entrega la API no se modifica.
