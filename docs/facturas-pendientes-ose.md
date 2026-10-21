# Facturas pendientes de OSE

La pantalla **Contabilidad / Despacho de facturas** lista exclusivamente documentos pendientes de envío a OSE dentro del rango elegido.

- Incluye facturas (`TipoCodigo = 01`) y notas de crédito (`TipoCodigo = 07`).
- El estado SUNAT queda fijo en `PENDIENTE`; el selector se conserva comentado en el componente por solicitud funcional.
- La consulta usa `GET /Nota/facturas-servicio` con `pendientesOse=true`, por lo que el filtro también queda aplicado en la API.
- La API usa `dbo.uspListarFacturasServicioWeb`: primero filtra y pagina los IDs y despues obtiene detalles, archivos y notas de credito. El comando SQL limita la espera a 15 segundos y el cliente a 20; un error no se convierte en una lista vacia. Ver [optimizacion de listados](../../sgo_dnx_backend/docs/optimizacion-listados-caja-facturas.md).
- Cada fila cuenta con el botón `Ver` de Lista de ventas y, durante la consulta, se muestra el cargando general del sistema.
- Al abrir un pendiente se ingresa a `/sales/html_capture/:notaId`. Ahí se muestran `Volver` y `Reenviar`; Volver conserva el rango usado en Despacho de facturas y Reenviar usa `POST /Nota/documentos/:docuId/reenviar-ose` para emitir el documento guardado.
- Antes de reenviar una factura (`TipoCodigo = 01`), la pantalla valida que el RUC tenga 11 dígitos, pase el dígito verificador y exista/esté activo mediante la consulta de documento ya usada al registrar clientes de factura. Si la consulta no lo confirma, no llama al endpoint de reenvío. Las notas de crédito (`TipoCodigo = 07`) no requieren esta consulta de RUC.

## Listado de Facturas de servicio

El listado de servicios usa la misma API con `soloServicio=true`. `DataTable` controla paginacion remota, total de registros y busqueda en todo el rango aplicado (comprobante, cliente, concepto y producto). Solicita solo la pagina visible; el orden es fecha de emision e ID descendentes. La busqueda espera 300 ms al escribir. Los stores comparten una peticion identica en curso y cancelan la anterior al cambiar filtros; ignoran cualquier respuesta tardia.

Despacho OSE conserva su carga completa y su exportacion: recorre las paginas de pendientes del mismo procedimiento. Una pagina fallida interrumpe la carga y muestra error, evitando presentar datos parciales como un listado completo. Una pagina fuera del rango devuelve vacio, incluso cuando la ultima pagina tiene exactamente 200 filas.
