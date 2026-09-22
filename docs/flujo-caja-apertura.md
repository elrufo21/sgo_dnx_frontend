# Encargado al abrir una caja

En `/cash_flow_control/create`, **Encargado** se inicia con el usuario de la sesión. La pantalla lo busca entre los usuarios activos por alias, nombre o `PersonalId`; así muestra el nombre correspondiente aunque el ID guardado en la sesión no coincida con el listado. Si el usuario de la sesión no aparece en la página de resultados, se muestra su nombre e ID de sesión como opción.

El encargado puede cambiarse en el selector antes de guardar. La apertura envía el `UsuarioID` de la opción elegida y el backend guarda el nombre del encargado en la caja.

Al eliminar una caja, la web borra sus movimientos de `CajaDetalle`, sus denominaciones de `Monedas` y la cabecera de `Caja`. La operación se bloquea si existe una nota asociada cuyo estado sea distinto de `ANULADO`; así no se elimina la caja de una venta pendiente, a cuenta o cancelada. Las notas anuladas no bloquean la eliminación.

Si los datos de sesión apuntan a otra persona y no permiten identificar al usuario actual, el selector queda en **Seleccione un encargado**. En ese caso hay que elegir uno explícitamente antes de abrir la caja; nunca se toma automáticamente el primer usuario de la lista. Al consultar una caja existente se muestra el encargado que ya fue guardado.
