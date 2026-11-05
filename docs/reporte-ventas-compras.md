# Reporte Ventas vs. Compras

En **Reportes > Ventas vs. Compras**, el usuario selecciona mes y año. La gráfica muestra dos barras para su compañía: monto de ventas y monto de compras en soles. El filtro cambia la consulta automáticamente; **Consultar** permite volver a ejecutarla. Si el procedimiento no devuelve una fila de la compañía, se informa que no hay datos devueltos, sin asumir que el monto es cero.

La API `GET /api/v1/SalesReport/sales-vs-purchases?year=2026&month=1` requiere `VENTAS.VER`, obtiene la compañía de la sesión y llama `dbo.reporteVentaCompania @Mes, @Anno`. La API solo devuelve filas de esa compañía. El procedimiento original devuelve montos formateados con comas de miles y punto decimal; la API los convierte a números y rechaza los importes inválidos.

El procedimiento no se instala ni modifica con este cambio. Se debe comprobar con el responsable SQL que `dbo.reporteVentaCompania` exista y que la cuenta de la API tenga `EXECUTE` en cada sede. Las versiones documentadas del procedimiento difieren en los documentos incluidos. En el script de referencia `sgo_dnx_backend/scripts/sql/bdactual.sql`, ventas usa `DocumentoVenta.DocuEmision`, suma `DocuTotal`, excluye proformas y notas de crédito y exige `DocuAsociado` vacío; compras usa `Compras.CompraComputo`, suma facturas, resta notas de crédito y convierte dólares con `CompraTipoSunat`. No se añaden filtros de estado desde la web.

El procedimiento heredado utiliza `TOP 2` sin orden y puede omitir una compañía con actividad; no se debe interpretar un resultado vacío como cero confirmado. Sus resultados requieren contrastarse con el escritorio y los registros de la sede. La diferencia entre ventas y compras no se presenta como ganancia.
