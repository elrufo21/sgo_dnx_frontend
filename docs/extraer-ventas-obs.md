# Extraer ventas OBS/IOC

## Propósito

Consultar y mostrar las ventas OBS o IOC registradas en `TABLAOBS`, junto con su estado de captura y caja asociada.

## Uso

- Al entrar al módulo se consulta el rango inicial del día actual.
- Cambiar **Fecha inicio** solo modifica el filtro; no consulta automáticamente.
- Cambiar **Fecha fin** consulta usando el inicio seleccionado y el nuevo fin. También se puede consultar con **Buscar**.
- Cambiar entre **OBS** e **IOC** consulta el rango actual para el tipo elegido.
- **Buscar** consulta el API con las fechas actuales y el tipo de venta seleccionado.
- El campo de búsqueda de la tabla filtra localmente por transacción, código, cliente, usuario, estado o caja.
- La recepción de una captura desde la extensión guarda las líneas y vuelve a consultar el rango recibido.

La acción manual **Buscar** debe omitir la caché del navegador. Así se pueden reintentar consultas fallidas y ver cambios que se hicieron después de la primera carga.

## API

- `GET /api/v1/ObsCapture?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD&tipoVenta=OBS|IOC` lista las filas.
- `POST /api/v1/ObsCapture` guarda o actualiza las líneas recibidas de la extensión.

Las escrituras requieren asistencia cuando la validación está activa; las consultas GET siguen disponibles sin esa validación.

## Diagnóstico de rendimiento del listado

El GET descarga todas las filas del rango y cruza `TABLAOBS` con `NotaPedido` por transacción; la paginación y la búsqueda son locales y los totales corresponden a todas las filas filtradas. Un rango amplio puede aumentar el trabajo y la transferencia. El filtro SQL usa `TipoVenta` y `FechaTransaccion`; el cruce usa `NotaTransaccion`.

El 31/10/2026 se ejecutaron el [diagnóstico de solo lectura](../../sgo_dnx_backend/scripts/sql/20261031_obs_listado_diagnostico.sql) y el [script de índices](../../sgo_dnx_backend/scripts/sql/20261031_obs_listado_indices.sql) exclusivamente en `localhost\SQLEXPRESS01`, base `DXNCOMAS2610`, según la configuración activa. Se crearon `IX_WebObs_TipoFecha` e `IX_WebObs_NotaTransaccion`, y el diagnóstico posterior confirmó que estaban habilitados. El encabezado del script de índices describe su estado anterior a esta ejecución; se conserva el archivo exacto que se ejecutó. Las demás bases no se modificaron. Antes de aplicar en otra sede, el administrador debe revisar los tipos, índices existentes, plan y bloqueos.

La [consulta de medición](../../sgo_dnx_backend/scripts/sql/20261031_obs_listado_medicion.sql), con el último día OBS disponible, devolvió 77 filas tanto antes como después: una medición aislada tardó 815 ms antes y 520 ms después. No es una prueba estadística ni una medición de producción. No se cambió el GET ni se agregó paginación: sigue entregando todas las filas del rango y los totales siguen siendo locales. En esta base `FechaTransaccion` es `date`; el diagnóstico de fechas existente advierte que en otras bases, si contiene horas, el límite final actual puede excluir parte del último día. No se cambió esa semántica.
