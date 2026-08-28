# Movimiento de Caja Chica: pagos de venta

La pantalla **Movimiento de Caja Chica** muestra los movimientos automáticos originados por ventas OBS:

- **Salidas**: egresos manuales y la parte digital de IOC/Cashbill; Venta Libre también registra aquí su parte de depósito.
- **Ingresos**: el total de una Venta Libre.

La pantalla `/sales/html_capture/new` envía el `UsuarioId` de la sesión. La salida de venta conserva la estructura del escritorio: `NotaId = 0`, `NotaIdB = NotaId` y estado `D`.

Las filas con pago de venta son de solo consulta. La columna Pago muestra forma de pago, entidad y número de operación cuando corresponda.
Cuando no hay entidad bancaria, muestra solo la forma de pago, sin separador adicional.
Las ventas con condición **PAGO/VARIOS** se registran pendientes sin entidad bancaria ni número de operación; esos datos se completan recién al realizar el pago.
Un número de operación ya usado para la misma entidad bancaria no puede registrarse otra vez y se informa el motivo exacto. Una venta **PAGO/VARIOS** ya pagada no puede anularse desde Lista de ventas.

El modal **Pago Varios** incluye las pestañas **Pendientes** y **Pagos realizados**. Conserva una altura fija adaptable a la pantalla al cambiar de pestaña. La segunda replica el historial del escritorio y permite filtrar los pagos registrados por rango de fechas.

La descripción del pago es un borrador del modal: se conserva al seleccionar documentos o modificar los demás campos y se limpia al registrar, eliminar o elegir **Nuevo**. Al eliminar un pago, el formulario vuelve a sus valores iniciales.

Cada pago realizado tiene un botón **Ver**. Su detalle se muestra en la pestaña **Pendientes** con el mismo formulario cargado en modo consulta: documentos a la izquierda y forma de pago, importes, entidad, operación y descripción a la derecha. Desde ahí permite volver al historial, eliminarlo con clave de administrador o usar **Nuevo** para limpiar el formulario y regresar a los documentos pendientes.

El acceso Caja chica de Ventas y su ruta anterior redirigen a esta misma pantalla.
