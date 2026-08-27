# Listado de clientes

El listado de clientes ocupa todo el alto disponible bajo la cabecera, sin desplazamiento de página. Muestra cincuenta filas por página y conserva la paginación para consultar el resto de clientes.

Al entrar por primera vez, carga los clientes desde el servidor. Si se abre el formulario de registro y se vuelve sin guardar, reutiliza la lista almacenada en memoria y no realiza otra consulta. La misma regla se aplica al modal de Clientes de Ventas al alternar entre las pestañas Clientes y Formulario. Las altas, ediciones y eliminaciones actualizan esa misma lista local.
