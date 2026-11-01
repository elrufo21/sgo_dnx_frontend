# Mantenimiento de categorías

El listado consulta `Sublinea` y conserva ID, nombre y código SUNAT. El registro y la edición, tanto desde mantenimiento como desde productos, envían estos datos a `/Linea/registerlinea`. La API utiliza `dbo.uspInsertarCategoriaWeb`; la eliminación mantiene `/Linea/maintenance/{id}` y `uspEliminarCategoria`. El formulario no solicita línea.

Los dos formularios comprueban la respuesta antes de informar éxito o actualizar la lista: muestran un error ante una respuesta inválida o un fallo de la API, y reconocen los nombres duplicados.

El responsable de SQL debe revisar y ejecutar el [script web compatible con SQL Server 2008](../../sgo_dnx_backend/scripts/sql/20261101_instalar_usp_insertar_categoria_web.sql) en la base correspondiente antes de publicar la API. El procedimiento se crea solo si falta y no modifica el del escritorio.
