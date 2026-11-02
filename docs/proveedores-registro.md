# Registro de proveedores

El listado muestra la columna **Celular** con el valor `ProveedorCelular`, que es el campo editable del formulario. `ProveedorTelefono` se conserva como dato independiente y no se muestra en el listado.

La consulta externa de RUC acepta solo números y requiere exactamente 11 dígitos antes de consultar.

El formulario de proveedores, tanto en el módulo como al registrar desde Compras, no muestra ni consulta cuentas bancarias. Crear o editar un proveedor no envía cambios de cuentas desde este formulario. Las cuentas existentes no se eliminan de la base de datos.

El formulario envía los datos a `POST /api/v1/Proveedor/register`; la API llama a `dbo.uspInsertarProveedor` con el contrato heredado `@Data`. El procedimiento de referencia crea o actualiza el proveedor y rechaza un RUC duplicado. Si el servidor falla, la pantalla muestra un error y no agrega un proveedor ficticio a la lista.

El error SQL 2812 indica que el procedimiento no existe en la base conectada. El responsable de SQL puede revisar [el script preparado](../../sgo_dnx_backend/scripts/sql/20261028_instalar_usp_insertar_proveedor.sql), extraído de `scripts/sql/bdactual.sql`; solo crea el procedimiento si falta y no reemplaza uno existente. Debe verificar la base de destino y la compatibilidad de la tabla `Proveedor` antes de ejecutarlo. El script no se ha ejecutado ni se ha comprobado el registro en una base real.

La eliminación usa `dbo.uspEliminarProveedor` con `@Id` y devuelve éxito cuando se eliminó una fila. El 2026-11-02 se instaló y verificó en la instancia local `DESKTOP-B6B71UA\SQLEXPRESS01`, base `DXNCOMAS2610`, con autorización del usuario, mediante el [script de instalación](../../sgo_dnx_backend/scripts/sql/20261102_instalar_usp_eliminar_proveedor.sql) basado en `bdactual.sql`. No se ejecutó el procedimiento ni se eliminaron proveedores; otras bases no fueron modificadas. Las relaciones existentes con Compras y Letras impiden eliminar proveedores referenciados.

La definición heredada devuelve `true` al crear, sin identificador.
