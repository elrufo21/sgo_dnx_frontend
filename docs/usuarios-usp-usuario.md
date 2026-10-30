# Mantenimiento de usuarios: `dbo.usp_Usuario`

El módulo `/maintenance/users` usa rutas exclusivas de mantenimiento y el procedimiento unificado `dbo.usp_Usuario`. Los endpoints antiguos de `UsuariosCrud` se conservan para autenticación y consumidores existentes.

## Rutas de mantenimiento

- `GET /UsuariosCrud/maintenance/list?estado=ACTIVO`: envía `LISTAR`, aplica el filtro de estado y pagina por `UsuarioID` descendente para mostrar primero los registros nuevos.
- `POST /UsuariosCrud/maintenance/register`: envía `CREAR` o `ACTUALIZAR` según `UsuarioID`.
- `DELETE /UsuariosCrud/maintenance/{id}`: envía `ELIMINAR|UsuarioID`.

El formulario reutiliza `UserFormBase` y conserva los campos de serie, rutas y vencimiento de clave. Los permisos de comprobantes y administrador no se muestran: siempre se envían con valor `Sí` (`1`). La clave se cifra con `dbo.encriptar` antes de enviarse al parámetro `@UsuarioClave` del procedimiento.

Al crear un usuario, el campo Serie (correlativo) no se muestra y se conserva el valor predeterminado `B001` para el guardado. Al editar se muestra la serie registrada.

El listado muestra primero el nombre completo del personal, seguido por usuario, área y estado. El procedimiento `LISTAR` devuelve el ID del personal, pero no su nombre ni área; la API consulta `Personal` y `Area` para completar esos datos de los usuarios de la página. La búsqueda también incluye el nombre. Si falta la relación con personal o área, se deja el campo vacío.

Cuando no se informa el vencimiento de clave, el frontend envía `null`; el procedimiento lo conserva como valor nulo.

El procedimiento debe estar instalado en la base de datos antes de usar el módulo.
