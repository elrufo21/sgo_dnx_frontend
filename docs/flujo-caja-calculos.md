# Cálculo del efectivo en caja

En una caja activa, el cuadro morado **Efectivo en Caja** replica el escritorio: muestra la suma de todos los ingresos visibles.

`TOTAL EFECTIVO` se calcula como Sistema OBS menos Salidas. A ese valor se agregan Sencillo, IOC, Vitrina, Revistas y Copias u otros. El diferencial compara el conteo físico contra ese total de ingresos.

Las ventas OBS no se agregan directamente como ingreso de caja: son la fuente de `Sistema OBS` para el consolidado. Por eso el listado de cajas abiertas conserva los valores persistidos hasta el cierre, como en el escritorio.

## Listado y cierre

El listado de control de flujo de caja presenta la fecha de apertura como `DD/MM/YYYY HH:mm:ss`, usando el horario de 24 horas. La columna **Diferencia** se calcula como efectivo contado (`CajaTotal`) menos efectivo esperado (`CajaIngresos`), igual que el diferencial del detalle.

Al crear una caja, el cursor queda inicialmente en **Sencillo**. Si se intenta cerrar con una diferencia sin observación, el formulario muestra el aviso y enfoca **Observaciones** para ingresar la justificación.

Al cambiar una caja abierta a **CERRADA** y guardar, si el diferencial entre el efectivo contado y los ingresos es distinto de cero en precisión de centavos, se exige una observación que explique la diferencia. Sin diferencia, la observación sigue siendo opcional. La validación ocurre antes de guardar los ingresos manuales o cerrar la caja.

Antes de abrir, cerrar o reabrir una caja, la web verifica que exista el conteo general de efectivo del día anterior. Si el día anterior fue domingo, revisa el viernes anterior. Si no hay conteo, permite la operación cuando esa fecha figura como feriado; en caso contrario, informa que falta registrar el conteo.

Después de cerrar correctamente la caja desde el formulario, se genera y abre automáticamente el mismo PDF disponible en **Generar informe PDF**. Si el navegador bloquea la pestaña nueva, el PDF se descarga.

## Informes

Los botones para imprimir el informe PDF y enviarlo por correo se habilitan solo cuando la caja está cerrada y el formulario está bloqueado. Durante la edición permanecen deshabilitados; al bloquearla, se pueden usar nuevamente.

En una caja existente, el candado permite entrar a edición una vez. Mientras el formulario está editándose, el botón queda deshabilitado; vuelve a habilitarse después de guardar correctamente.

## Carga del registro

Al consultar una caja existente, el detalle y sus movimientos se solicitan en paralelo. La lista de usuarios se consulta solo al abrir una caja nueva, porque la consulta de un registro existente ya trae el encargado guardado.
