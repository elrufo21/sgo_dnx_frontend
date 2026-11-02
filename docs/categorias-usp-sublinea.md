# Mantenimiento de categorías

El listado consulta `Sublinea` y conserva ID, nombre y código SUNAT. El registro y la edición, tanto desde mantenimiento como desde productos, envían estos datos a `/Linea/registerlinea`. La API utiliza `dbo.uspInsertarCategoriaWeb`; la eliminación mantiene `/Linea/maintenance/{id}` y `uspEliminarCategoria`. El formulario no solicita línea.

Los dos formularios comprueban la respuesta antes de informar éxito o actualizar la lista: muestran un error ante una respuesta inválida o un fallo de la API, y reconocen los nombres duplicados.

En el modal de categorías abierto desde productos, Enter en Código SUNAT activa la misma acción que el botón Guardar, tanto en escritorio como en móvil.

El [script web compatible con SQL Server 2008](../../sgo_dnx_backend/scripts/sql/20261101_instalar_usp_insertar_categoria_web.sql) se aplicó el 2026-11-02 en la base local `DXNCOMAS2610`. Para otras bases, el responsable de SQL debe revisar y ejecutar el script antes de publicar la API. El procedimiento se crea solo si falta y no modifica el del escritorio.

El [procedimiento de eliminación](../../sgo_dnx_backend/scripts/sql/20261102_instalar_usp_eliminar_categoria.sql) también se instaló en `DXNCOMAS2610` el 2026-11-02. Las categorías referenciadas por productos no se pueden eliminar por la restricción de la base de datos.
