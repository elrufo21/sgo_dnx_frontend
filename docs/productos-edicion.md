# Edición de productos

La pantalla **Mantenimiento > Productos** muestra la fecha de registro solo como referencia. Al crear o editar un producto, el frontend no envía `ProductoFecha`; los procedimientos `ingresarProductoWEB` y `editarProductoWEB` asignan la fecha en la base de datos.

Esto evita que un formato de fecha visual o heredado bloquee una actualización antes de que el producto llegue al procedimiento almacenado.

Al crear un producto o iniciar uno nuevo desde el formulario, la sublínea predeterminada es **SUSTITUTO DE CAFÉ** si existe en el catálogo. Se identifica por nombre, sin depender de un ID fijo ni del acento; el usuario puede cambiarla. Si no existe, el campo queda sin selección para elegirlo manualmente. Al editar se conserva la sublínea del producto.

## Valores numéricos

El frontend serializa el campo técnico `Data` con punto decimal (`79.00`). El backend lo interpreta con cultura invariable; por ello `79.00` se guarda como `79` incluso cuando el servidor usa configuración regional española, donde el punto normalmente representa miles. Los datos con coma decimal heredados (`79,00`) mantienen compatibilidad.

La fecha devuelta por listados heredados puede llegar como `MM/dd/yyyy`. El formulario la convierte a `yyyy-MM-dd` antes de asignarla al control de fecha, por lo que una fecha como `09/25/2026` se muestra como `2026-09-25` y no queda vacía.
