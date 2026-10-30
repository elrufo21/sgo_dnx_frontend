# Mantenimiento de empleados: `dbo.usp_Personal`

El módulo `/maintenance/employees` utiliza rutas exclusivas de mantenimiento:

- `GET /Personal/maintenance/list` envía `LISTAR` y pagina por `PersonalId` descendente para mostrar primero los registros nuevos.
- `POST /Personal/maintenance/registerpersonal` envía `CREAR` o `ACTUALIZAR` según `PersonalId`.
- `DELETE /Personal/maintenance/{id}` envía `ELIMINAR|PersonalId`.

La eliminación interpreta el booleano `true` de la API como éxito, actualiza la lista y su caché; `false` o una respuesta fallida se muestran como error. También conserva compatibilidad con respuestas de texto `OK|...`.

El backend elimina la fotografía solo después de que se confirme la eliminación del personal. Si la base rechaza la operación, conserva la fotografía; si falla la limpieza de la foto después de eliminar el registro, informa el éxito y deja una advertencia en el registro de la API. Un fallo al actualizar la caché tampoco cambia el resultado de una eliminación confirmada.

El registro conserva los datos del formulario: nombres, apellidos, área, código, fechas, DNI, dirección, teléfonos, correo, sueldo, estado, fecha de baja, RUC, imagen y compañía. La huella es opcional y se envía como archivo cuando exista.

La fecha de ingreso es de solo lectura en el formulario por auditoría. Al crear se muestra la fecha actual y al editar se conserva la fecha registrada; el campo mantiene su valor al guardar. Esta restricción se aplica en la interfaz web.

Los controles Teléfono asistente, RUC, Fecha de baja y Sueldo no se muestran en el formulario. Sus valores existentes se mantienen en los datos del formulario y se envían al guardar, sin modificarlos desde estos controles.

Las rutas antiguas `/Personal/list`, `/Personal/registerpersonal` y `/Personal/{id}` permanecen sin cambios para usuarios, autenticación y demás consumidores.
