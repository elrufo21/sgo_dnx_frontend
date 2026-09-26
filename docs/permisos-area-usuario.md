# Permisos por área y usuario

La ruta `/configuration/permissions` configura un perfil base por área y una excepción opcional por usuario. La persistencia usa únicamente `dbo.Indicador`; no se crea una tabla de permisos adicional.

## Estructura en `Indicador`

1. Raíz de área: `PERMISOS_AREA_{AreaId}` (`TipoIndicador = 90`).
2. Raíz de usuario: `USUARIO_{UsuarioId}`, hija de su área (`TipoIndicador = 91`).
3. Permiso: `PERMISO.{CODIGO}`, hijo del área o del usuario (`TipoIndicador = 92`). `ValorNum = 1` concede y `0` deniega.

El catálogo cubre módulos y submódulos de Ventas (POS, captura, listado, OBS, guías, notas y resúmenes), Caja, Compras, Facturas de servicio, Clientes, Contabilidad, Mantenimiento y Configuración. Cada submódulo tiene su propio código para poder ocultarlo y bloquear su ruta de forma independiente.

La evaluación es: administrador (`Usuarios.Administrador = 1`), excepción del usuario, perfil del área y, si no existe definición, denegar. La excepción puede tanto conceder como quitar un permiso del área.

## API y seguridad

`dbo.usp_PermisoIndicador` es el único punto de lectura/escritura de estos registros. Valida el catálogo y admite `OBTENER`, `EFECTIVOS` y `GUARDAR`. Internamente recibe los permisos como `CODIGO=0|CODIGO=1`, lo que mantiene compatibilidad con la versión de SQL Server de esta instalación.

- `GET /api/v1/Permisos/perfil` carga el perfil de área o usuario.
- `PUT /api/v1/Permisos/perfil` guarda el catálogo completo.
- `GET /api/v1/Permisos/mis-permisos` devuelve los permisos efectivos del usuario autenticado.

Solo administradores pueden leer o cambiar perfiles. El login incluye el contexto de usuario, compañía, área y administrador dentro del token, y devuelve los permisos efectivos para que el frontend oculte las opciones protegidas. Después de actualizar el backend, cada usuario debe cerrar sesión e ingresar nuevamente.

La primera cobertura de API protege Ventas (`NotaController`), Caja (`CashFlowController`), áreas y usuarios de mantenimiento. Los accesos directos a la pantalla de permisos también se redirigen si falta `MANTENIMIENTO.USUARIOS`.

El área `GERENCIA Y ADMINISTRACION` (ID 6) se inicializa con todos los permisos mediante el script de despliegue de Gerencia. Los usuarios de esta área que no sean administradores heredan ese perfil; los administradores conservan acceso total sin depender de los flags.
