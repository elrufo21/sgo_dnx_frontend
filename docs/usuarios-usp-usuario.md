# Mantenimiento de usuarios: `dbo.usp_Usuario`

El módulo `/maintenance/users` usa rutas exclusivas de mantenimiento y el procedimiento unificado `dbo.usp_Usuario`. Los endpoints antiguos de `UsuariosCrud` se conservan para autenticación y consumidores existentes.

## Rutas de mantenimiento

- `GET /UsuariosCrud/maintenance/list?estado=ACTIVO`: envía `LISTAR` y aplica el filtro de estado y paginación.
- `POST /UsuariosCrud/maintenance/register`: envía `CREAR` o `ACTUALIZAR` según `UsuarioID`.
- `DELETE /UsuariosCrud/maintenance/{id}`: envía `ELIMINAR|UsuarioID`.

El formulario reutiliza `UserFormBase` y conserva los campos de serie, rutas y vencimiento de clave. Los permisos de comprobantes y administrador no se muestran: siempre se envían con valor `Sí` (`1`). La clave se cifra con `dbo.encriptar` antes de enviarse al parámetro `@UsuarioClave` del procedimiento.

Cuando no se informa el vencimiento de clave, el frontend envía `null`; el procedimiento lo conserva como valor nulo.

El procedimiento debe estar instalado en la base de datos antes de usar el módulo.
