# Cálculo del efectivo en caja

En una caja activa, el cuadro morado **Efectivo en Caja** replica el escritorio: muestra la suma de todos los ingresos visibles.

`TOTAL EFECTIVO` se calcula como Sistema OBS menos Salidas. A ese valor se agregan Sencillo, IOC, Vitrina, Revistas y Copias u otros. El diferencial compara el conteo físico contra ese total de ingresos.

Las ventas OBS no se agregan directamente como ingreso de caja: son la fuente de `Sistema OBS` para el consolidado. Por eso el listado de cajas abiertas conserva los valores persistidos hasta el cierre, como en el escritorio.

## Listado y cierre

El listado de control de flujo de caja presenta primero las cajas más recientes (orden descendente por `CajaId`) y muestra las fechas de apertura y cierre como `DD/MM/YYYY HH:mm:ss`, usando el horario de 24 horas. El formulario usa el mismo formato para ambas fechas y normaliza los cierres antiguos que tienen un espacio en lugar del último `:`. En cajas cerradas, **Ingresos** se calcula como monto inicial + ventas OBS + ventas IOC - salidas + ingresos manuales, y **Diferencia** como efectivo contado menos esos ingresos. Esto evita interpretar los valores históricos de `CajaIngresos` y `CajaTotal` con el significado que les da el cierre web, ya que el escritorio guardaba en esas columnas conceptos distintos. Las cajas abiertas mantienen el valor persistido que usa el listado.

El recálculo del listado agrupa monedas, ventas y movimientos manuales por caja en una consulta, en vez de ejecutar sumas correlacionadas por cada caja. Así se conserva el mismo diferencial sin repetir lecturas de las tablas de movimientos para cada registro.

Al crear una caja, el cursor queda inicialmente en **Sencillo**. Al cambiar el estado de una caja abierta a **CERRADA**, el cursor pasa a **Observaciones**. Si se intenta guardar el cierre con una diferencia sin observación, el formulario muestra el aviso y mantiene el foco en **Observaciones** para ingresar la justificación.

Al cambiar una caja abierta a **CERRADA** y guardar, si el diferencial entre el efectivo contado y los ingresos es distinto de cero en precisión de centavos, se exige una observación que explique la diferencia. Sin diferencia, la observación sigue siendo opcional. La validación ocurre antes de guardar los ingresos manuales o cerrar la caja.

Una caja cerrada también permite editar sus campos al activar **Editar** (desbloquear) en el detalle. Se pueden modificar el sencillo, las cantidades por denominación, ingresos manuales y observaciones. Al guardar, la web persiste el conteo y recalcula el efectivo contado y los ingresos de la caja; en modo bloqueado los campos permanecen de solo lectura.

Antes de abrir, cerrar o reabrir una caja, la web verifica que exista el conteo general de efectivo del día anterior. Si el día anterior fue domingo, revisa el viernes anterior. Si no hay conteo, permite la operación cuando esa fecha figura como feriado; en caso contrario, informa que falta registrar el conteo.

Cada encargado solo puede tener una caja en estado **ACTIVO** a la vez. La validación se aplica tanto al crear una caja como al reactivar una caja cerrada, aunque la compañía tenga habilitadas múltiples cajas para distintos encargados. El backend serializa estas operaciones por encargado para evitar aperturas simultáneas concurrentes.

Las operaciones de escritura de los módulos de Caja también requieren asistencia del usuario autenticado registrada para el día actual. Las consultas permanecen disponibles; la validación se aplica en el backend y cubre los módulos de Caja descritos en [validación de asistencia en Caja](../../sgo_dnx_backend/docs/validacion-asistencia-modulos-caja.md).

Después de cerrar correctamente la caja desde el formulario, se genera y abre automáticamente el mismo PDF disponible en **Generar informe PDF**. Si el navegador bloquea la pestaña nueva, el PDF se descarga. Al terminar, la pantalla vuelve a **Nuevo** con el formulario vacío para la siguiente apertura.

## Informes

Los botones para imprimir el informe PDF y enviarlo por correo se habilitan solo cuando la caja está cerrada y el formulario está bloqueado. Durante la edición permanecen deshabilitados; al bloquearla, se pueden usar nuevamente.

En una caja existente, el candado permite entrar a edición una vez. Mientras el formulario está editándose, el botón queda deshabilitado; vuelve a habilitarse después de guardar correctamente.

## Carga del registro

Al consultar una caja existente, el detalle y sus movimientos se solicitan en paralelo. La lista de usuarios se consulta solo al abrir una caja nueva, porque la consulta de un registro existente ya trae el encargado guardado.
