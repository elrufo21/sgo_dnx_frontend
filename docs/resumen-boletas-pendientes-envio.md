# Listado y envío de boletas pendientes

## Propósito y uso

La pantalla de **Resumen de boletas** lista boletas pendientes de la fecha más antigua disponible para la compañía. La búsqueda de la tabla solo filtra la vista; **Enviar Resumen** siempre usa el conjunto completo cargado, para que una búsqueda no reduzca los comprobantes del envío.

## Integridad del listado y envío

El backend llama a `uspListaDocumentosWEB`. Al construir el texto delimitado, el procedimiento convierte `ICBPER` nulo a cero antes de concatenar la fila, evitando que SQL Server omita la boleta completa. El normalizador del store conserva el valor de respaldo `0.00` para respuestas que traigan el campo vacío.

Antes de enviar un resumen RC a SUNAT, el backend compara los identificadores `docuId` del detalle con todas las boletas pendientes de la compañía para la fecha de referencia. Si el conjunto no coincide, no hace el envío y pide actualizar el listado.

El script SQL `../../sgo_dnx_backend/scripts/sql/20261016_uspListaDocumentosWEB_icbper.sql` instala la variante web. El procedimiento de escritorio `uspListaDocumentos` no se altera.
