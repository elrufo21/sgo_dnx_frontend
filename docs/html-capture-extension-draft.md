# Borrador temporal de captura de extensión

## Objetivo

Conservar una captura de venta recibida desde la extensión DXN cuando el usuario navega a otro módulo, por ejemplo a Caja para realizar una apertura, y luego regresa a Ventas.

## Funcionamiento

1. Al recibir el mensaje `SGO_DXN_CAPTURE`, la pantalla de captura guarda los datos en `sessionStorage` y continúa aplicándolos al formulario como antes.
2. Al volver a `/sales/html_capture/new` en la misma pestaña, la captura se recupera y se aplica de nuevo.
3. El borrador se elimina cuando el usuario pulsa **Limpiar**, inicia un **Nuevo registro**, quita el último producto, confirma una venta correctamente, cierra la pestaña o pasan dos horas.
4. Al confirmar una venta, la pantalla también indica a la extensión que descarte la captura pendiente. Así no se vuelve a cargar al regresar al formulario.

## Alcance y seguridad

- El borrador no se envía al servidor ni crea una venta por sí solo.
- Está limitado a la pestaña actual y se valida contra la empresa y el usuario que lo generaron.
- Las ventas libres guardan en la misma sesión sus datos de formulario, productos, cantidades, precios y tipo de venta. Se restauran al volver a la pantalla y se eliminan en las mismas acciones que una captura.
- Solo hay un borrador de captura o de venta libre activo por tipo; una nueva captura descarta el borrador de venta libre.
- Los documentos guardados con `conceptoOBS = VENTA` se muestran como **Cashbill** al volver a abrirlos.
