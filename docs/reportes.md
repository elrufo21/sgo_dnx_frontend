# Módulo Reportes

## Propósito y uso

El módulo **Reportes** es un grupo desplegable en el menú lateral con las opciones **Reporte de ventas** y **Reporte de productos**. La ruta `/reports` redirige al reporte anual de ventas. Ambos reportes requieren el permiso existente `VENTAS.VER`.

En el reporte de ventas se ingresa un año y se alterna entre columnas y líneas; la gráfica muestra el importe mensual sobre cada barra o punto. En el reporte de productos se selecciona un producto activo buscándolo por nombre o código; la lista se filtra mientras se escribe y el reporte se consulta automáticamente al elegir el producto y al cambiar el año válido. Su gráfica muestra la cantidad vendida por mes y unidad del producto, mientras la tarjeta anual y la tabla mantienen los importes de venta. En pantallas amplias, la gráfica y la tabla mensual se muestran en paralelo; en pantallas angostas se apilan.

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
