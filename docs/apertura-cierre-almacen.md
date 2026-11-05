# Apertura y cierre de almacén

La pantalla se muestra en el menú y su ruta está disponible tanto en desarrollo como en builds de producción para los usuarios con el permiso requerido.

La opción **Apertura y cierre de almacén** usa la carga, búsqueda y filtro de productos inactivos de la tabla de Ventas. El buscador está integrado en la barra de la tabla y filtra por código o descripción. Muestra código, descripción, xMayor, UNIxCaja, Total x Mayor, UM, Despacho, Vitrina, Almacén total y Validación. Las cantidades xMayor, Despacho y Vitrina se ingresan como valores no negativos; Enter y flechas arriba/abajo navegan por la misma columna, como en Ventas.

UNIxCaja se consulta por ID desde `Producto.ProductoxCaja`, igual que la referencia del procedimiento de escritorio `uspListarApertura`. Si el valor no está disponible o no es positivo, se muestra `—` y se bloquea xMayor para evitar calcular con un dato inventado. Total x Mayor = xMayor × UNIxCaja; Almacén total = Total x Mayor + Despacho + Vitrina. Validación queda vacía en esta etapa. Los valores se mantienen al filtrar y paginar, incluso con productos que comparten código.

La ruta `/warehouse` y el endpoint de solo lectura `GET /warehouse/units-per-box` requieren `MANTENIMIENTO.PRODUCTOS`. La consulta SQL de referencia está en `sgo_dnx_backend/scripts/sql/20261104_consulta_unidades_caja_almacen.sql` y no modifica objetos ni datos. Si la consulta falla, la pantalla lo indica y bloquea el conteo por mayor.

El conteo es temporal y se pierde al salir o recargar la pantalla. No guarda cantidades, no abre ni cierra almacenes y no altera existencias. Los productos incluidos siguen el criterio de la tabla de Ventas; no se supone que todos sean inventariables.
