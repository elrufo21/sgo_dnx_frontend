# Registro de proveedores

El formulario envía los datos a `POST /api/v1/Proveedor/register`; la API llama a `dbo.uspInsertarProveedor` con el contrato heredado `@Data`. El procedimiento de referencia crea o actualiza el proveedor y rechaza un RUC duplicado. Si el servidor falla, la pantalla muestra un error y no agrega un proveedor ficticio a la lista.

El error SQL 2812 indica que el procedimiento no existe en la base conectada. El responsable de SQL puede revisar [el script preparado](../../sgo_dnx_backend/scripts/sql/20261028_instalar_usp_insertar_proveedor.sql), extraído de `scripts/sql/bdactual.sql`; solo crea el procedimiento si falta y no reemplaza uno existente. Debe verificar la base de destino y la compatibilidad de la tabla `Proveedor` antes de ejecutarlo. El script no se ha ejecutado ni se ha comprobado el registro en una base real.

La definición heredada devuelve `true` al crear, sin identificador. El flujo actual no puede asociar automáticamente cuentas bancarias nuevas sin ese identificador; esta limitación debe resolverse antes de usar ese flujo con cuentas.
