# Nota Pedido

## Concepto OBS en el listado

El listado incluye **ConceptoOBS** después de **Cliente**, con el valor registrado en la nota (por ejemplo, `VENTA` o `FACTURA MANUAL`). El buscador también considera este campo y la exportación Excel lo incluye en la misma posición. Si la nota no tiene concepto o el procedimiento anterior todavía no lo devuelve, se muestra `-`.

La API consulta `dbo.listaNotaPedidoWEB`, que agrega el concepto al final de la cadena, en la posición 46 (contando desde cero), sin desplazar los campos existentes. `dbo.listaNotaPedido` se conserva sin cambios para cualquier consumidor existente, incluido el escritorio. El frontend acepta la cadena y respuestas JSON con `conceptoOBS` o `ConceptoOBS`; el parser JSON del backend también conserva el campo. El responsable de SQL debe crear o actualizar el procedimiento web con `sgo_dnx_backend/scripts/sql/20261026_listaNotaPedido_web.sql` en cada base que atienda la API. Preparar el archivo no actualiza la base ni cambia datos o tablas.

## Anulación

Las facturas y boletas siguen su flujo electrónico. Una **PROFORMA V** se anula localmente desde su vista, con reposición de inventario para sus productos inventariables.

## Totales del listado

Los cuadros de efectivo, depósito y total se calculan únicamente con las filas visibles tras aplicar la búsqueda del listado. Al limpiar o cambiar el filtro, los tres valores se actualizan de inmediato.

Los estados `ANULADO`, `BAJA` y `RECHAZADO` se muestran en rojo en las columnas **Estado** y **Estado Sunat**. En una anulación confirmada con nota de crédito, el estado SUNAT de la factura es `ANULADO`; para una boleta dada de baja es `BAJA`.

Al abrir una nota existente, la acción **Anular** se oculta si `NotaEstado`, `EstadoSunat` o `DocuEstado` indica `ANULADO`, `BAJA` o `RECHAZADO`. Se espera a cargar esos estados antes de mostrar la acción.

## Carga del listado y vista

Las solicitudes concurrentes del listado para el mismo rango de fechas comparten una única consulta. Si la consulta falla, se conservan las filas que ya estaban cargadas en vez de reemplazarlas por una lista vacía. Al abrir una venta, las consultas de cabecera, detalle y archivos CPE también comparten una sola carga concurrente; la vista no descarga los catálogos completos de productos y clientes ni consulta el acumulado mensual de PVS, que solo usa el modo de edición. Las validaciones de anulación y la carga de Pago Varios concurrentes comparten una consulta por documento o usuario.
