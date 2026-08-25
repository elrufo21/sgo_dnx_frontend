# Facturas pendientes de OSE

La pantalla **Contabilidad / Despacho de facturas** lista exclusivamente documentos pendientes de envío a OSE dentro del rango elegido.

- Incluye facturas (`TipoCodigo = 01`) y notas de crédito (`TipoCodigo = 07`).
- El estado SUNAT queda fijo en `PENDIENTE`; el selector se conserva comentado en el componente por solicitud funcional.
- La consulta usa `GET /Nota/facturas-servicio` con `pendientesOse=true`, por lo que el filtro también queda aplicado en la API.
- Cada fila cuenta con el botón `Ver` de Lista de ventas y, durante la consulta, se muestra el cargando general del sistema.
- Al abrir un pendiente se ingresa a `/sales/html_capture/:notaId`. Ahí se muestran `Volver` y `Reenviar`; Volver conserva el rango usado en Despacho de facturas y Reenviar usa `POST /Nota/documentos/:docuId/reenviar-ose` para emitir el documento guardado.
