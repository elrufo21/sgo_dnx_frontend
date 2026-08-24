# Movimiento de Caja Chica: pagos de venta

La pantalla **Movimiento de Caja Chica** muestra los movimientos automáticos originados por ventas OBS:

- **Salidas**: egresos manuales y la parte digital de IOC/Cashbill; Venta Libre también registra aquí su parte de depósito.
- **Ingresos**: el total de una Venta Libre.

La pantalla `/sales/html_capture/new` envía el `UsuarioId` de la sesión. La salida de venta conserva la estructura del escritorio: `NotaId = 0`, `NotaIdB = NotaId` y estado `D`.

Las filas con pago de venta son de solo consulta. La columna Pago muestra forma de pago, entidad y número de operación cuando corresponda.

El modal **Pago Varios** incluye las pestañas **Pendientes** y **Pagos realizados**. Conserva una altura fija adaptable a la pantalla al cambiar de pestaña. La segunda replica el historial del escritorio y permite filtrar los pagos registrados por rango de fechas.

Cada pago realizado tiene un botón de eliminación. Solicita la clave de un administrador, igual que el escritorio, y actualiza ambas pestañas cuando el pago se revierte.

El acceso Caja chica de Ventas y su ruta anterior redirigen a esta misma pantalla.
