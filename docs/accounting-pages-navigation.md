# Navegación y exportación de Contabilidad

## Alcance

Las pantallas `Resumen de boletas`, `Envío de facturas` y `PDT Empresa` mantienen un retorno visible dentro de su tarjeta de controles mediante `BackArrowButton` con flecha negra sobre fondo claro. No agregan títulos redundantes fuera de esa tarjeta.

## Envío de facturas

La pantalla consulta únicamente documentos pendientes de OSE, los presenta en orden ascendente por `DocuId` y no muestra filtros de fecha ni búsqueda. El botón `Excel` descarga los pendientes visibles.

## PDT Empresa

Al entrar se consulta el mes actual. Cambiar **F-Inicio** solo modifica el filtro; al cambiar **F-Fin** o pulsar **Buscar** se consultan ventas y compras con el rango seleccionado.

Las tablas de ventas y compras muestran 100 filas por página por defecto y conservan la preferencia de paginación del usuario. El botón de exportación se muestra como `Excel`; conserva la exportación de la pestaña activa. Los contadores `Items` de ventas y compras usan el separador de miles de la aplicación (por ejemplo, `1,470`). La tabla limita su alto a `52vh` para conservar visibles sus totales sin desplazamiento vertical de la página.

## SIRE

El botón de regreso usa una flecha negra sobre fondo claro para que sea visible en la tarjeta de controles.
