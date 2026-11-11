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

En **Contabilidad → Inventario permanente valorizado** se listan los productos de la base configurada y los grupos de ICA y COMAS sin correspondencia local, con búsqueda por código o descripción y stock actual local cuando está disponible. La tabla permite seleccionar productos, editar su saldo inicial y exportar el lote.

La lista agrupa los códigos base y sus variantes con prefijos `191`, `201`, `211`, `221`, `231`, `241` y `251` en una fila; `181` permanece separado. **Stock vigente** muestra el stock del registro local sin prefijo cuando existe y un guion cuando no está disponible; no suma existencias históricas ni otras sedes. También se puede buscar por el código de una variante. La lista del escritorio conserva las filas separadas: la agrupación visual es una mejora web basada en las equivalencias de su consulta de movimientos.

Marca o desmarca los productos mediante sus casillas. La casilla del encabezado selecciona o deselecciona todos los productos habilitados, incluso los de otras páginas y los ocultos por la búsqueda, y muestra un estado parcial cuando solo hay algunos seleccionados. **Exportar seleccionados** reconstruye el Kardex del reporte a partir de ventas y compras de ICA y COMAS y descarga un ZIP con un Excel por producto con movimientos. Las variantes equivalentes comparten selección y los productos sin código o con correspondencia ambigua no pueden seleccionarse. Cada Excel contiene la hoja **Kardex** con las 22 columnas del escritorio, los costos según el reproceso y el saldo calculado a partir de Último INV. La vista avisa si el rango rebasa las fechas disponibles en alguna sede o si se omitieron productos sin movimientos.

La búsqueda conserva las selecciones ocultas. El stock de la tabla corresponde a la base principal. La ruta de vista previa de documentos sigue disponible para revisar las ventas y compras que entrarían en un reproceso.

Si falla la consulta principal o la consulta de saldos del período, se muestra un aviso y no se permite exportar.

**Último INV** es un único campo numérico por producto agrupado y fecha de inicio. Se guarda al salir de la celda o pulsar Enter, admite hasta dos decimales y requiere `MANTENIMIENTO.PRODUCTOS`. El campo vacío y el valor cero son válidos y la exportación usa cero como saldo inicial cuando no hay un valor guardado. Borrar un saldo previamente guardado lo actualiza a cero. Cambiar la fecha final conserva el mismo saldo; cambiar la fecha de inicio consulta el saldo correspondiente a esa fecha. Se registra aparte, sin sumar ni modificar los valores históricos `Producto.UltimoINV`. No existe todavía una función que obtenga automáticamente un cierre anterior validado.

La exportación envía los códigos seleccionados en una sola solicitud y consulta cada sede una vez; el ZIP conserva un Excel por grupo. La descripción prioriza el registro local con código sin prefijo cuando existe. Para almacenar saldos se necesita aplicar previamente el script `20261110_inventario_saldo_inicial.sql` en la base principal; la aplicación no lo ejecuta automáticamente.

Si la entrada numérica queda incompleta o el guardado falla, se restaura el último valor cargado y se muestra un aviso. Durante un guardado pendiente no se puede iniciar la exportación.

## PDT Empresa

Al entrar se consulta el mes actual. Cambiar **F-Inicio** solo modifica el filtro; al cambiar **F-Fin** o pulsar **Buscar** se consultan ventas y compras con el rango seleccionado.

En Ventas, la columna **Documento relacionado** aparece después de **Estado** y muestra la referencia de las notas de crédito. Se utiliza el campo `Referencia` ya devuelto por la consulta (en `LDdocumentosweb` procede de `DocuNroGuia`); si está vacío o la fila no es una nota de crédito, se muestra `-`. No se deduce el tipo de comprobante cuando la referencia solo contiene serie y número.

El Excel de Ventas sigue las 20 columnas y el orden de `NOTACRED.xlsx`: Emision, Documento, NroDoc, RazonSocial, RUC, DNI, BaseImp, IGV, ICBPER, Total, Referencia, Estado, CDSunat, Mensaje, Condicion, FormaPago, EntidadBancaria, NroOperacion, Efectivo y Deposito. ICBPER se exporta como importe numérico y se suma en la fila final; las notas de crédito usan signo negativo.

Al exportar PDT, la razón social de Ventas y el proveedor de Compras omiten `.`, `,`, `{`, `}`, `[` y `]`, así como referencias `EXPdd-mm-aaaa` con o sin corchetes. La limpieza se aplica solo al texto exportado, sin modificar los datos de la tabla ni la base. Se conserva la limpieza de datos al consultar y registrar clientes.

Las tablas de ventas y compras muestran 100 filas por página por defecto y conservan la preferencia de paginación del usuario. El botón de exportación se muestra como `Excel`; conserva la exportación de la pestaña activa. Los contadores `Items` de ventas y compras usan el separador de miles de la aplicación (por ejemplo, `1,470`). La tabla limita su alto a `52vh` para conservar visibles sus totales sin desplazamiento vertical de la página.

## SIRE

El botón de regreso usa una flecha negra sobre fondo claro para que sea visible en la tarjeta de controles.
