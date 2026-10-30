# Módulo Reportes

## Propósito y uso

El módulo **Reportes** es un grupo desplegable en el menú lateral con las opciones **Reporte de ventas** y **Reporte de productos**. La ruta `/reports` redirige al reporte anual de ventas. Ambos reportes requieren el permiso existente `VENTAS.VER`.

En el reporte de ventas se ingresa un año y se alterna entre columnas y líneas; la gráfica muestra el importe mensual sobre cada barra o punto. En el reporte de productos se selecciona un producto activo buscándolo por nombre o código; la lista se filtra mientras se escribe y el reporte se consulta automáticamente al elegir el producto y al cambiar el año válido. Su gráfica muestra la cantidad vendida por mes y unidad del producto, mientras la tarjeta anual y la tabla mantienen los importes de venta. En pantallas amplias, la gráfica y la tabla mensual se muestran en paralelo; en pantallas angostas se apilan.

En **Reporte de ventas**, vaciar el año, dejarlo incompleto o escribir un valor fuera del rango permitido limpia inmediatamente la gráfica y el total, oculta la carga y los errores anteriores y deshabilita la consulta. Al completar cuatro dígitos dentro del rango permitido, se consulta automáticamente ese año; la lupa o Enter permiten volver a consultar el mismo año. La clave de caché incluye el año escrito y la gráfica y el total solo aparecen si el año de la respuesta coincide con él. La API debe devolver el año solicitado; una respuesta con otro año se considera un error. Cambiar rápidamente de año no permite que una respuesta tardía muestre el reporte anterior. Verificación local sin API ni SQL: `node scripts/verify-sales-report-year.mjs`.

## Fuente y reglas

- Ventas generales: `NotaPedido.NotaFecha` y `SUM(NotaPagar)` para notas con `NotaEstado = 'CANCELADO'`.
- Productos: `NotaPedido` se une con `DetallePedido` por `NotaId`; los detalles se filtran por `IdProducto`, `NotaEstado = 'CANCELADO'` y `NotaConcepto = 'MERCADERIA'`.
- Importe mensual: suma de `DetalleImporte`, el importe guardado en cada línea de venta.
- Cantidad mensual: suma de `DetalleCantidad * ValorUM`, usando factor 1 cuando `ValorUM` sea nulo o no positivo; el resultado se expresa en la unidad base guardada en `ProductoUM`.
- Ambas consultas devuelven los doce meses, incluidos los meses sin ventas.

## Implementación web

- `src/features/reports/routes.tsx` registra las dos páginas y conserva `/reports` como redirección al reporte anual.
- `src/store/products/products.store.ts` entrega el catálogo activo usado por el selector.
- `src/store/reports/productSalesReport.store.ts` carga y conserva la consulta por producto y año.
- `GET /api/v1/SalesReport/products/monthly?year=YYYY&productId=ID` obtiene los totales mensuales con parámetros SQL y el permiso `VENTAS.VER`.

El reporte de productos no depende de los procedimientos históricos `uspResumenDetalle` o `uspResumenDetalleZ`; esos objetos no están conectados en el flujo de procedimientos desplegados por la web.

## Reporte de asistencia Web

La ruta `/reports/attendance` consulta automáticamente al ingresar el reporte general del día actual, usando esa fecha como inicio y fin. Permite consultar asistencias por rango de fechas y por personal o como reporte general. Los cambios de fecha o de personal aplican los filtros automáticamente. Al activar Reporte General se consulta el reporte general; al desactivarlo sin un personal seleccionado se espera a que se seleccione uno. Limpiar restablece y consulta el rango predeterminado del día. No se muestran el buscador de la tabla ni el botón Buscar. Las consultas se conservan frescas durante cinco minutos y no se repiten al volver a la pestaña del navegador. El botón Imprimir genera un PDF A4 horizontal, con filtros, total de registros, cabecera de tabla repetida y número de página, y lo abre en otra pestaña.

Al activar Reporte General se limpia la selección de personal y se consultan los registros disponibles de todos los empleados para el rango de fechas. El reporte no aplica búsquedas guardadas anteriormente en el navegador.

El reporte y su PDF ordenan las asistencias por fecha ascendente; dentro de una misma fecha mantienen la hora de ingreso descendente, con las horas vacías al final.

Los botones Limpiar e Imprimir se alinean con la parte inferior de los filtros de fecha en la barra del reporte.
