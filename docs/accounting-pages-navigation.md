# Navegación y exportación de Contabilidad

## Alcance

Las pantallas `Resumen de boletas`, `Envío de facturas` y `PDT Empresa` mantienen un retorno visible dentro de su tarjeta de controles mediante `BackArrowButton` con flecha negra sobre fondo claro. No agregan títulos redundantes fuera de esa tarjeta.

## Envío de facturas

La pantalla consulta únicamente documentos pendientes de OSE, los presenta en orden ascendente por `DocuId` y no muestra filtros de fecha ni búsqueda. El botón `Excel` descarga los pendientes visibles.

## PDT Empresa

Al entrar se consulta el mes actual. Cambiar **F-Inicio** solo modifica el filtro; al cambiar **F-Fin** o pulsar **Buscar** se consultan ventas y compras con el rango seleccionado.

En Ventas, la columna **Documento relacionado** aparece después de **Estado** y muestra la referencia de las notas de crédito. Se utiliza el campo `Referencia` ya devuelto por la consulta (en `LDdocumentosweb` procede de `DocuNroGuia`); si está vacío o la fila no es una nota de crédito, se muestra `-`. No se deduce el tipo de comprobante cuando la referencia solo contiene serie y número.

El Excel de Ventas sigue las 20 columnas y el orden de `NOTACRED.xlsx`: Emision, Documento, NroDoc, RazonSocial, RUC, DNI, BaseImp, IGV, ICBPER, Total, Referencia, Estado, CDSunat, Mensaje, Condicion, FormaPago, EntidadBancaria, NroOperacion, Efectivo y Deposito. ICBPER se exporta como importe numérico y se suma en la fila final; las notas de crédito usan signo negativo.

Al exportar PDT, la razón social de Ventas y el proveedor de Compras omiten `.`, `,`, `{`, `}`, `[` y `]`, así como referencias `EXPdd-mm-aaaa` con o sin corchetes. La limpieza se aplica solo al texto exportado, sin modificar los datos de la tabla ni la base. Se conserva la limpieza de datos al consultar y registrar clientes.

Las tablas de ventas y compras muestran 100 filas por página por defecto y conservan la preferencia de paginación del usuario. El botón de exportación se muestra como `Excel`; conserva la exportación de la pestaña activa. Los contadores `Items` de ventas y compras usan el separador de miles de la aplicación (por ejemplo, `1,470`). La tabla limita su alto a `52vh` para conservar visibles sus totales sin desplazamiento vertical de la página.

## SIRE

El botón de regreso usa una flecha negra sobre fondo claro para que sea visible en la tarjeta de controles.
