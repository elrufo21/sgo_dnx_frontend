# Depósitos centros

El formulario registra depósitos y otros ingresos de los centros, incluyendo el importe, su descripción y el comprobante adjunto.

El listado inicia con el rango desde el primer día del mes hasta hoy. Al seleccionar una fecha fin y existir un rango válido, la consulta se ejecuta automáticamente; también se puede usar el botón de búsqueda. Si varias consultas coinciden, se muestran los resultados de la más reciente.

Al elegir **DEPÓSITO** o **TARJETA**, el foco pasa al número de operación. Al elegir una entidad bancaria, también pasa al número de operación. Al elegir **EFECTIVO** o **YAPE**, pasa a descripción para evitar los campos que no aplican.

El número de operación acepta solo dígitos, tanto al escribir como al pegar texto. El backend aplica la misma validación.

Eliminar un depósito pide la contraseña del usuario que inició sesión. La API la valida contra esa misma cuenta antes de eliminar el registro y su imagen.

Al abrir la confirmación de eliminación, el foco se coloca automáticamente en el campo **Tu contraseña**.

El botón **Nuevo** usa el color rojo principal del módulo y limpia el formulario para registrar otro ingreso.
