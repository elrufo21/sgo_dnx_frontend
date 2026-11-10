# Navegación y exportación de Contabilidad

## Alcance

Las pantallas `Resumen de boletas`, `Envío de facturas` y `PDT Empresa` mantienen un retorno visible dentro de su tarjeta de controles mediante `BackArrowButton` con flecha negra sobre fondo claro. No agregan títulos redundantes fuera de esa tarjeta.

## Envío de facturas

La pantalla consulta únicamente documentos pendientes de OSE, los presenta en orden ascendente por `DocuId` y no muestra filtros de fecha ni búsqueda. El botón `Excel` descarga los pendientes visibles.

## Notas de crédito

En **Contabilidad → Notas de crédito** se consultan las notas de la compañía del usuario por rango de fechas de emisión (inicialmente desde el primer día del mes hasta hoy). La tabla permite buscar por comprobante, cliente, documento relacionado, usuario y estados. **Ver** abre la nota seleccionada con una distribución semejante a la venta: productos y totales a la izquierda; número de nota, número asociado, concepto, estados y cliente a la derecha. El número asociado procede de `DocuNroGuia`; si está vacío, se busca el documento identificado por `DocuAsociado` en la misma compañía. Si no existe dato registrado se muestra un guion. Si no hay detalle, se indica. La pantalla es de solo lectura y requiere `CONTABILIDAD.VER`.

Cuando se identifica la venta original de la misma compañía, **Nro. asociado** permite abrirla en modo de consulta. La venta muestra una ruta de navegación hacia la lista de notas y la nota de origen, además del botón superior para volver. Para encontrar el documento se prioriza `DocuAsociado`; si no hay identificador numérico, se usa la referencia solo cuando identifica un único documento de venta. Si una línea de la nota no tiene producto, se recupera de la venta original únicamente si hay una sola línea con la misma cantidad y precio; cuando no hay coincidencia inequívoca se deja vacío. Si la base dispone de `DetalleDescripcion`, se respeta la descripción guardada de la línea.

**Descargar PDF** genera un documento de consulta con los datos y detalles mostrados, los totales y la compañía de la sesión. No recupera ni reemplaza el comprobante electrónico emitido por OSE.

## Inventario permanente valorizado

En **Contabilidad → Inventario permanente valorizado** se seleccionan un producto y un rango de fechas para consultar sus movimientos de Kardex existentes y exportarlos a Excel. La pantalla es de solo lectura. El Excel contiene las 22 columnas del escritorio, sus códigos fijos y las fórmulas de saldo de la exportación individual: el primer saldo usa el stock de la primera fila y los siguientes suman entradas y restan salidas. La tabla muestra el stock guardado en cada movimiento. No reconstruye Kardex ni ejecuta la actualización de inventario del escritorio.

Desde esa pantalla, **Vista previa ICA y COMAS** muestra documentos de ambas sedes antes de un posible reproceso, con sus estados, precios de origen y códigos agrupados. Permite descargar un Excel por producto o un ZIP del lote seleccionado. Cada Excel contiene una hoja **Kardex** con las 22 columnas y los cálculos del escritorio y otra con los documentos de origen. Los cálculos son preliminares y no modifican datos; los filtros y la diferencia entre saldo inicial individual y masivo se detallan en la documentación del backend.

La vista presenta una sola tabla con búsqueda, acciones y fechas en la barra superior. En productos, las casillas marcan los Excel que se exportarán; **Marcar resultados** y **Desmarcar resultados** actúan sobre todas las coincidencias, incluso las de otras páginas. La búsqueda no elimina selecciones ocultas. **Ver movimientos** abre la tabla de detalle y la flecha regresa conservando búsqueda, fechas y selección. En el detalle, **Actualizar consulta** aplica fechas nuevas; el botón de descarga se deshabilita hasta actualizar el rango modificado. La tabla no presenta costo o stock consolidados: esas cantidades requieren validación por sede.

En la consulta individual de Kardex, el selector de producto permite buscar por código o descripción mediante el autocompletado compartido.

## PDT Empresa

Al entrar se consulta el mes actual. Cambiar **F-Inicio** solo modifica el filtro; al cambiar **F-Fin** o pulsar **Buscar** se consultan ventas y compras con el rango seleccionado.

En Ventas, la columna **Documento relacionado** aparece después de **Estado** y muestra la referencia de las notas de crédito. Se utiliza el campo `Referencia` ya devuelto por la consulta (en `LDdocumentosweb` procede de `DocuNroGuia`); si está vacío o la fila no es una nota de crédito, se muestra `-`. No se deduce el tipo de comprobante cuando la referencia solo contiene serie y número.

El Excel de Ventas sigue las 20 columnas y el orden de `NOTACRED.xlsx`: Emision, Documento, NroDoc, RazonSocial, RUC, DNI, BaseImp, IGV, ICBPER, Total, Referencia, Estado, CDSunat, Mensaje, Condicion, FormaPago, EntidadBancaria, NroOperacion, Efectivo y Deposito. ICBPER se exporta como importe numérico y se suma en la fila final; las notas de crédito usan signo negativo.

Al exportar PDT, la razón social de Ventas y el proveedor de Compras omiten `.`, `,`, `{`, `}`, `[` y `]`, así como referencias `EXPdd-mm-aaaa` con o sin corchetes. La limpieza se aplica solo al texto exportado, sin modificar los datos de la tabla ni la base. Se conserva la limpieza de datos al consultar y registrar clientes.

Las tablas de ventas y compras muestran 100 filas por página por defecto y conservan la preferencia de paginación del usuario. El botón de exportación se muestra como `Excel`; conserva la exportación de la pestaña activa. Los contadores `Items` de ventas y compras usan el separador de miles de la aplicación (por ejemplo, `1,470`). La tabla limita su alto a `52vh` para conservar visibles sus totales sin desplazamiento vertical de la página.

## SIRE

El botón de regreso usa una flecha negra sobre fondo claro para que sea visible en la tarjeta de controles.
