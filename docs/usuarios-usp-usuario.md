# Mantenimiento de usuarios: `dbo.usp_Usuario`

El módulo `/maintenance/users` usa rutas exclusivas de mantenimiento y el procedimiento unificado `dbo.usp_Usuario`. Los endpoints antiguos de `UsuariosCrud` se conservan para autenticación y consumidores existentes.

## Rutas de mantenimiento

- `GET /UsuariosCrud/maintenance/list?estado=ACTIVO`: envía `LISTAR`, aplica el filtro de estado y pagina por `UsuarioID` descendente para mostrar primero los registros nuevos.
- `POST /UsuariosCrud/maintenance/register`: envía `CREAR` o `ACTUALIZAR` según `UsuarioID`.
- `DELETE /UsuariosCrud/maintenance/{id}`: envía `ELIMINAR|UsuarioID`. El frontend reconoce `true` como eliminación confirmada y retira el usuario del listado; también admite la respuesta anterior `OK|...`. `false`, errores y respuestas vacías se consideran fallos y mantienen el usuario en pantalla.

El formulario reutiliza `UserFormBase` y conserva los datos de serie, rutas y vencimiento de clave. Los permisos de comprobantes y administrador no se muestran: siempre se envían con valor `Sí` (`1`). Al editar, tanto en la página como en el modal del listado, los campos de contraseña comienzan vacíos: si no se ingresa una nueva, no se valida la confirmación ni se envía la clave. Si se ingresa, debe cumplir la política y coincidir con la confirmación. Al crear un usuario y al renovar una contraseña vencida sigue siendo obligatoria. La API cifra la clave nueva con `dbo.encriptar`; si no se envía, pasa `NULL` a `@UsuarioClave` y el procedimiento conserva la clave existente.

El campo **Personal** se selecciona al crear el usuario; al editar es de solo lectura y se conserva la persona asociada.

El campo Serie (correlativo) no se muestra al crear ni al editar. Al crear se envía el valor predeterminado `B001`; al editar se conserva y envía la serie cargada del usuario.

El listado muestra primero el nombre completo del personal, seguido por usuario, área y estado. El procedimiento `LISTAR` devuelve el ID del personal, pero no su nombre ni área; la API consulta `Personal` y `Area` para completar esos datos de los usuarios de la página. La búsqueda también incluye el nombre. Si falta la relación con personal o área, se deja el campo vacío.

Cuando no se informa el vencimiento de clave, el frontend envía `null`; el procedimiento lo conserva como valor nulo.

El procedimiento debe estar instalado en la base de datos antes de usar el módulo.
