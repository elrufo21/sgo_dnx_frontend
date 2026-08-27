# Mantenimiento de categorías

El módulo `/maintenance/categories` usa el mismo procedimiento de escritorio, `dbo.uspInsertarCategoria`, a través de `/api/v1/Linea`.

## Operaciones

- El listado consulta `Sublinea` y conserva `IdSublinea`, `NombreSublinea` y `CodigoSUNAT`.
- El registro y la edición envían `IdSublinea|NombreSublinea|CodigoSUNAT` a `uspInsertarCategoria`.
- La eliminación usa `uspEliminarCategoria`.

Las rutas utilizadas son `/Linea/maintenance/list`, `/Linea/registerlinea` y `/Linea/maintenance/{id}`.

El formulario solo solicita categoría y código SUNAT. No muestra ni envía líder de línea porque el procedimiento de categorías no lo requiere.

Este cambio conserva las rutas de mantenimiento para listar y eliminar, pero el guardado usa el procedimiento de categorías del escritorio.
