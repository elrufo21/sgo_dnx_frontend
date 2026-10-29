# Movimiento de Caja Chica: pagos de venta

La pantalla **Movimiento de Caja Chica** muestra los movimientos automáticos originados por ventas OBS:

- **Salidas**: egresos manuales y la parte digital de IOC/Cashbill; Venta Libre también registra aquí su parte de depósito.
- **Ingresos**: el total de una Venta Libre.

La pantalla `/sales/html_capture/new` envía el `UsuarioId` de la sesión. La salida de venta conserva la estructura del escritorio: `NotaId = 0`, `NotaIdB = NotaId` y estado `D`.

Si la venta devuelve `NO ASISTIO`, la pantalla detiene la emisión y muestra el aviso de asistencia del escritorio con el botón **Aceptar**. No intenta generar documento ni enviar a OSE/SUNAT.

Las filas con pago de venta son de solo consulta. La columna Pago muestra forma de pago, entidad y número de operación cuando corresponda.
Cuando no hay entidad bancaria, muestra solo la forma de pago, sin separador adicional.
Las ventas con condición **PAGO/VARIOS** se registran pendientes sin entidad bancaria ni número de operación; esos datos se completan recién al realizar el pago.
En ventas (captura HTML y cobro POS) y al registrar **Pago Varios**, elegir **YAPE**, **YAPE/EFECTIVO** o **TARJETA** selecciona automáticamente **BCP** y bloquea la entidad. En captura HTML y Pago Varios, el foco pasa al número de operación. Este número sigue siendo obligatorio conforme a la validación de cada formulario. Las demás formas combinadas conservan la selección manual de entidad; efectivo y ventas pendientes de Pago Varios conservan su comportamiento anterior. Los documentos ya registrados se muestran con su entidad original. Movimiento de Caja Chica ya aplica BCP automáticamente para Yape y tarjeta.

La regla compartida está en `src/shared/helpers/paymentBank.ts`; la API de Pago Varios también normaliza estas formas a BCP antes de registrarlas. Se comprueba con `node --experimental-strip-types scripts/verify-payment-bank.mjs`.
Un número de operación ya usado para la misma entidad bancaria no puede registrarse otra vez y se informa el motivo exacto. Una venta **PAGO/VARIOS** ya pagada no puede anularse desde Lista de ventas.

El modal **Pago Varios** incluye las pestañas **Pendientes** y **Pagos realizados**. Conserva una altura fija adaptable a la pantalla al cambiar de pestaña. La segunda replica el historial del escritorio y permite filtrar los pagos registrados por rango de fechas.

Al abrir Pago Varios, la carga de productos y clientes de Ventas no muestra el indicador general encima del modal; la lista conserva su propio mensaje de carga. Al cerrar el modal, el indicador general vuelve a mostrarse si esas consultas aún continúan. Las cargas de registro, captura y reenvío mantienen su indicador habitual.

Los pendientes se consultan al abrir Pago Varios y cuando se notifica una actualización, evitando iniciar otra consulta solo por montar la pantalla de Ventas. La apertura desde el acceso del encabezado se procesa una vez por navegación, incluso con los efectos repetidos de desarrollo.

En pantallas de poca altura, el formulario lateral tiene desplazamiento vertical y las acciones **Pagar seleccionados**, **Eliminar pago** y **Nuevo** permanecen fuera de esa zona para evitar que se recorten. En pantallas angostas, los documentos y el formulario se apilan y el contenido del modal permite desplazarse verticalmente. La altura se adapta al espacio visible del navegador.

Verificación del 24/10/2026: modal real renderizado con datos simulados y CSS compilado en 1366×600, 1280×500, 1024×400 y 390×640. Se comprobó el botón visible en escritorio, su acceso mediante desplazamiento en móvil, una lista de 30 documentos, el aviso por conceptos distintos, las acciones del detalle y el historial vacío. `npm run build:vercel` pasó; `npm run build` sigue bloqueado por los mismos 272 diagnósticos de TypeScript del registro `sgo_dnx_backend/artifacts/typecheck-responsive-20261022.log`, comparados sin números de línea. No se registraron ni eliminaron pagos.

Los montos pendientes se reciben como números desde la API. El backend interpreta el formato entregado por el procedimiento (`1,234.56`) antes de responder, por lo que la interfaz muestra correctamente importes con miles y decimales.

La descripción del pago es un borrador del modal: se conserva al seleccionar documentos o modificar los demás campos y se limpia al registrar, eliminar o elegir **Nuevo**. Se muestra y se registra siempre en mayúsculas. Al eliminar un pago, el formulario vuelve a sus valores iniciales.

Cada pago realizado tiene un botón **Ver**. Su detalle se muestra en la pestaña **Pendientes** con la fecha y hora de registro en el encabezado, documentos a la izquierda y forma de pago, importes, entidad, operación y descripción a la derecha. Desde ahí permite volver al historial, eliminarlo con clave de administrador o usar **Nuevo** para limpiar el formulario y regresar a los documentos pendientes.

En el detalle, las columnas **Total**, **Efectivo** y **Depósito** muestran respectivamente `monto`, `efectivo` y `deposito` de cada documento. El total general se toma de la cabecera del pago. La corrección del orden de estas columnas evita mostrar el efectivo cero como si fuera el total en pagos por depósito; no modifica importes guardados ni datos de SQL.

El acceso Caja chica de Ventas y su ruta anterior redirigen a esta misma pantalla.

En **Movimiento de Caja Chica**, los datos de un movimiento registrado son de solo lectura. Al abrir un movimiento manual o automático sin imagen se puede seleccionar una imagen JPG, PNG o WEBP de hasta 5 MB y revisar la vista previa; se guarda únicamente al pulsar **Guardar comprobante**. Antes de guardarla se puede elegir otra imagen. Un movimiento que ya tiene imagen no permite reemplazarla ni borrarla. El movimiento todavía puede eliminarse conforme a las reglas existentes.
