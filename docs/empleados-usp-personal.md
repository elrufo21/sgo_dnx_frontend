# Mantenimiento de empleados: `dbo.usp_Personal`

El módulo `/maintenance/employees` utiliza rutas exclusivas de mantenimiento:

- `GET /Personal/maintenance/list` envía `LISTAR`.
- `POST /Personal/maintenance/registerpersonal` envía `CREAR` o `ACTUALIZAR` según `PersonalId`.
- `DELETE /Personal/maintenance/{id}` envía `ELIMINAR|PersonalId`.

El registro conserva los datos del formulario: nombres, apellidos, área, código, fechas, DNI, dirección, teléfonos, correo, sueldo, estado, fecha de baja, RUC, imagen y compañía. La huella es opcional y se envía como archivo cuando exista.

Las rutas antiguas `/Personal/list`, `/Personal/registerpersonal` y `/Personal/{id}` permanecen sin cambios para usuarios, autenticación y demás consumidores.
