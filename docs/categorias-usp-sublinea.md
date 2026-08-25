# Mantenimiento de categorías (Sublineas)

El módulo `/maintenance/categories` usa el procedimiento `dbo.usp_Sublinea` a través de las rutas de mantenimiento de `/api/v1/Linea`.

## Operaciones

- El listado envía `LISTAR` y conserva `IdSublinea`, `IdLinea`, `NombreSublinea`, `CodigoSUNAT` y `Vista`.
- El registro envía `CREAR|IdLinea|NombreSublinea|CodigoSUNAT|Vista`.
- La edición envía `ACTUALIZAR|IdSublinea|IdLinea|NombreSublinea|CodigoSUNAT|Vista`.
- La eliminación envía `ELIMINAR|IdSublinea`.

Las rutas utilizadas son `/Linea/maintenance/list`, `/Linea/maintenance/register` y `/Linea/maintenance/{id}`.

El formulario solicita el Id de línea porque el procedimiento valida que la línea exista. La Vista se conserva y, si no se indica, se usa `V`.

Este cambio está limitado al mantenimiento de Sublineas. Las rutas antiguas `/Linea/list`, `/Linea/registerlinea` y `/Linea/{id}`, junto con sus consumidores, permanecen sin modificaciones.
