# Edición de productos

La pantalla **Mantenimiento > Productos** muestra la fecha de registro solo como referencia. Al crear o editar un producto, el frontend no envía `ProductoFecha`; los procedimientos `ingresarProductoWEB` y `editarProductoWEB` asignan la fecha en la base de datos.

Al abrir un producto, el formulario consulta el detalle individual y muestra **Fecha Registro** con fecha y hora, incluidos los segundos cuando están disponibles. Si no se puede consultar el detalle, usa la fecha disponible en el listado; si solo contiene una fecha, no inventa una hora. El campo sigue siendo de solo lectura. La fecha mostrada es el valor guardado en `ProductoFecha`, que el procedimiento de edición también puede actualizar.

Esto evita que un formato de fecha visual o heredado bloquee una actualización antes de que el producto llegue al procedimiento almacenado.

Al crear un producto o iniciar uno nuevo desde el formulario, la sublínea predeterminada es **SUSTITUTO DE CAFÉ** si existe en el catálogo. Se identifica por nombre, sin depender de un ID fijo ni del acento; el usuario puede cambiarla. Si no existe, el campo queda sin selección para elegirlo manualmente. Al editar se conserva la sublínea del producto.

Al abrir el formulario de creación o pulsar **Nuevo** dentro de él, el foco queda en **Código del Producto**, con el cursor al final del código generado.

La selección predeterminada se aplica cuando termina de cargar el catálogo y también después de un reinicio de los valores iniciales del formulario, para que el orden de carga no la deje vacía. Una selección manual no se reemplaza al llegar el catálogo.

El selector de sublínea sincroniza el texto de la opción seleccionada aunque el campo ya tenga el foco; esto permite ver el valor predeterminado cuando el catálogo llega después de abrir el formulario desde el listado.

Al crear o editar, la respuesta `existe Codigo` se presenta como **«El código de producto ya existe»**, conserva los datos ingresados y sitúa el cursor al final del código para corregirlo. Al abrir un producto para editar, el foco pasa a **Nombre del Producto**. Los errores de conexión o respuestas inválidas se muestran como fallos de guardado y no agregan un producto ficticio a la lista. Cuando la API devuelve un mensaje de validación HTTP 4xx, se muestra ese mensaje.

## Valores numéricos

En productos inventariables, **Cantidad en Stock** es obligatoria y solo admite números enteros al escribir o pegar. La validación también impide guardar decimales. Si un producto existente tiene una cantidad decimal, debe corregirse antes de guardar. Los servicios mantienen la cantidad en cero.

El frontend serializa el campo técnico `Data` con punto decimal (`79.00`). El backend lo interpreta con cultura invariable; por ello `79.00` se guarda como `79` incluso cuando el servidor usa configuración regional española, donde el punto normalmente representa miles. Los datos con coma decimal heredados (`79,00`) mantienen compatibilidad.

La fecha devuelta por listados heredados puede llegar como `MM/dd/yyyy`. Cuando el día es mayor de 12, el formulario identifica este formato para presentarlo correctamente; el detalle individual es la fuente preferida para evitar ambigüedades.
