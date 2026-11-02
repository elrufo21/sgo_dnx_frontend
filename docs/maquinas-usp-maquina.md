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

Para generar una nota de crédito de factura, el agente local identifica la computadora y la API usa exactamente su `SerieNC` de `MAQUINAS` (por ejemplo, `FB01` o `FZ01`), sin sustituir el prefijo. Si el agente no responde, hay nombres de máquina duplicados o la serie falta o no tiene cuatro caracteres alfanuméricos empezando por `F`, se bloquea el envío. El formulario conserva la serie de NC existente al editar. Las notas ya creadas se reenvían con su número original; no se les asigna la serie de la máquina actual.

La regla cubre la generación desde notas de pedido, la anulación individual de facturas desde Ventas y las notas de crédito de facturas de servicio. El correlativo se obtiene para la serie y compañía; el método heredado consulta el máximo y no constituye una reserva atómica entre solicitudes simultáneas. La consulta de referencia está en [SQL de serie NC](../../sgo_dnx_backend/scripts/sql/20261102_consulta_serie_nc_maquina.sql). Para aplicar el cambio se deben reiniciar o publicar frontend y API actualizados y contar con el agente en cada estación emisora.
