# Cálculo del efectivo en caja

En una caja activa, el cuadro morado **Efectivo en Caja** replica el escritorio: muestra la suma de todos los ingresos visibles.

`TOTAL EFECTIVO` se calcula como Sistema OBS menos Salidas. A ese valor se agregan Sencillo, IOC, Vitrina, Revistas y Copias u otros. El diferencial compara el conteo físico contra ese total de ingresos.

Las ventas OBS no se agregan directamente como ingreso de caja: son la fuente de `Sistema OBS` para el consolidado. Por eso el listado de cajas abiertas conserva los valores persistidos hasta el cierre, como en el escritorio.

El botón de recarga junto a **Sistema (OBS)** solo consulta nuevamente el total OBS de la caja abierta seleccionada. Se deshabilita cuando la caja está cerrada para conservar el valor histórico; la acción también se bloquea en el controlador del formulario.

## Listado y cierre

El listado de control de flujo de caja consulta inicialmente el rango vigente, ordena las cajas más recientes primero (descendente por `CajaId`) y muestra las fechas de apertura y cierre como `DD/MM/YYYY HH:mm:ss`, usando el horario de 24 horas. Cambiar **Fecha Inicio** solo actualiza el filtro; la consulta se ejecuta al cambiar **Fecha Fin** o pulsar la lupa Buscar, que valida las fechas actuales del filtro. El listado consulta `dbo.uspListarControlCajaWeb` con el rango aplicado, pagina, tamano y busqueda. El procedimiento pagina antes de agrupar movimientos y devuelve el diferencial en el mismo viaje a SQL. Si la API falla, la tabla muestra un mensaje de error en lugar de presentarlo como una lista vacía. El formulario usa el mismo formato para ambas fechas y normaliza los cierres antiguos que tienen un espacio en lugar del último `:`. La columna **Ingresos** conserva el valor persistido en `CajaIngresos`, igual que el escritorio; por eso puede mostrarse como `0.00` en cajas cerradas y no debe reconstruirse para el listado. En cajas cerradas, **Diferencia** se calcula como efectivo contado menos (monto inicial + ventas OBS + ventas IOC - salidas + ingresos manuales), igual que en el detalle. Las cajas abiertas mantienen el valor persistido que usa el listado.

El recálculo del listado agrupa monedas, ventas y movimientos manuales únicamente para las cajas cerradas de la página visible. Las cajas abiertas conservan el cálculo previo. Los importes salen de SQL como números; la API no vuelve a consultar diferencias. `DataTable` reutiliza paginación y búsqueda remotas. El store conserva los filtros al refrescar tras guardar, evita peticiones idénticas simultáneas y descarta respuestas antiguas. Ver [optimización de listados](../../sgo_dnx_backend/docs/optimizacion-listados-caja-facturas.md).

Al crear una caja, el cursor queda inicialmente en **Sencillo**. Al cambiar el estado de una caja abierta a **CERRADA**, el cursor pasa a **Observaciones**. Si se intenta guardar el cierre con una diferencia sin observación, el formulario muestra el aviso y mantiene el foco en **Observaciones** para ingresar la justificación.

Al cambiar una caja abierta a **CERRADA** y guardar, si el diferencial entre el efectivo contado y los ingresos es distinto de cero en precisión de centavos, se exige una observación que explique la diferencia. Sin diferencia, la observación sigue siendo opcional. La validación ocurre antes de guardar los ingresos manuales o cerrar la caja.

Antes de cerrar, el backend verifica si la compañía tiene boletas pendientes de incluir en un resumen diario, desde la fecha más antigua pendiente hasta hoy. Si encuentra alguna, bloquea el cierre e indica la fecha y la cantidad; después de enviar el resumen, se puede volver a cerrar la caja. La validación también se ejecuta en el endpoint para evitar que se omita desde otra interfaz.

Una caja cerrada permite editar el sencillo, las cantidades por denominación, los ingresos manuales y las observaciones únicamente cuando no existe ninguna caja en estado **ACTIVO**, sin importar el encargado. Al pulsar **Editar**, la web consulta si hay alguna caja activa y bloquea la edición con el aviso «Hay una caja aperturada. Ciérrala antes de modificar una caja cerrada.» si encuentra una. El backend repite la validación antes de guardar ingresos, conteos o cambios del registro, para impedir escrituras aunque se omita la comprobación del formulario. Si la consulta de estado falla, la web también bloquea la edición hasta poder verificarla. Cuando todas las cajas están cerradas, se permite editar cualquier caja cerrada.

Después de guardar una modificación de una caja existente, el formulario vuelve a **Apertura de caja** (`/cash_flow_control/create`) para iniciar un nuevo registro. Si se modificó una caja cerrada, el correo actualizado se genera y envía antes de volver al formulario nuevo.

Cuando **Permitir múltiples cajas abiertas** está activo, antes de abrir, cerrar o reabrir una caja la web verifica que exista el conteo general de efectivo del día anterior. Si el día anterior fue domingo, revisa el viernes anterior. Si no hay conteo, permite la operación cuando esa fecha figura como feriado; en caso contrario, informa que falta registrar el conteo. Con una sola caja permitida, esta validación no bloquea la operación.

Cada encargado solo puede tener una caja en estado **ACTIVO** a la vez. La validación se aplica tanto al crear una caja como al reactivar una caja cerrada, aunque la compañía tenga habilitadas múltiples cajas para distintos encargados. El backend serializa estas operaciones por encargado para evitar aperturas simultáneas concurrentes.

Las operaciones de escritura de los módulos de Caja requieren asistencia registrada para el día actual. Al abrir una caja, se valida la asistencia del usuario seleccionado como encargado, aunque sea una caja ajena a quien inició sesión; en las demás operaciones se valida al usuario autenticado. Las consultas permanecen disponibles; la validación se aplica en el backend y cubre los módulos de Caja descritos en [validación de asistencia en Caja](../../sgo_dnx_backend/docs/validacion-asistencia-modulos-caja.md).

Al ingresar a una caja desde el listado, una caja cerrada se muestra en modo lectura con los tabs **Caja**, **Productos** y **Reporte**. El PDF del cierre se carga al abrir **Reporte**. Si se activa la edición, **Reporte** se oculta. Una caja abierta nunca muestra el tab **Reporte**. Al cerrar y guardar una caja, y también al guardar una edición que la mantiene cerrada, **Reporte** queda como único tab visible. Si la edición reabre la caja, vuelve a la pestaña **Caja**.

El PDF de cierre muestra al final las asistencias registradas para la fecha de cierre, con los campos nombre, ingreso, salida a refrigerio, retorno, estado y cantidad de tardanzas. El PDF del informe final consolida la asistencia de la fecha seleccionada. Ambos reutilizan el endpoint del **Reporte de asistencia Web**.

## Informes

Los botones para imprimir el informe PDF y enviarlo por correo se habilitan solo cuando la caja está cerrada y el formulario está bloqueado. Durante la edición permanecen deshabilitados; al bloquearla, se pueden usar nuevamente.

En una caja existente, el candado permite entrar a edición una vez. Mientras el formulario está editándose, el botón queda deshabilitado; vuelve a habilitarse después de guardar correctamente.

Al guardar una caja, el botón se deshabilita, cambia su etiqueta a **Guardando...** y muestra un spinner hasta que termina toda la operación. Un bloqueo inmediato también evita que dos clics rápidos envíen dos guardados.

## Carga del registro

Al consultar una caja existente, el detalle y sus movimientos se solicitan en paralelo. La lista de usuarios se consulta solo al abrir una caja nueva, porque la consulta de un registro existente ya trae el encargado guardado.

En una caja existente, los campos permanecen bloqueados hasta que termina la carga del detalle y los movimientos. Esto evita que una respuesta inicial tardía reemplace cambios que el usuario empezó a escribir antes de cargar el registro. Observaciones también sincroniza el texto visible con el estado del formulario al perder el foco, antes de guardar.
