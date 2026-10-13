# Nota Pedido

## Anulación

Las facturas y boletas siguen su flujo electrónico. Una **PROFORMA V** se anula localmente desde su vista, con reposición de inventario para sus productos inventariables.

## Totales del listado

Los cuadros de efectivo, depósito y total se calculan únicamente con las filas visibles tras aplicar la búsqueda del listado. Al limpiar o cambiar el filtro, los tres valores se actualizan de inmediato.

Los estados `ANULADO`, `BAJA` y `RECHAZADO` se muestran en rojo en las columnas **Estado** y **Estado Sunat**. En una anulación confirmada con nota de crédito, el estado SUNAT de la factura es `ANULADO`; para una boleta dada de baja es `BAJA`.

Al abrir una nota existente, la acción **Anular** se oculta si `NotaEstado`, `EstadoSunat` o `DocuEstado` indica `ANULADO`, `BAJA` o `RECHAZADO`. Se espera a cargar esos estados antes de mostrar la acción.

## Carga del listado y vista

Las solicitudes concurrentes del listado para el mismo rango de fechas comparten una única consulta. Si la consulta falla, se conservan las filas que ya estaban cargadas en vez de reemplazarlas por una lista vacía. Al abrir una venta, las consultas de cabecera, detalle y archivos CPE también comparten una sola carga concurrente; la vista no descarga los catálogos completos de productos y clientes ni consulta el acumulado mensual de PVS, que solo usa el modo de edición. Las validaciones de anulación y la carga de Pago Varios concurrentes comparten una consulta por documento o usuario.
