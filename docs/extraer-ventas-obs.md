# Extraer ventas OBS/IOC

## Propósito

Consultar y mostrar las ventas OBS o IOC registradas en `TABLAOBS`, junto con su estado de captura y caja asociada.

## Uso

- Al entrar al módulo se consulta el rango de fechas seleccionado.
- **Buscar** consulta el API con las fechas actuales y el tipo de venta seleccionado.
- **Actualizar** vuelve a consultar el mismo rango para traer los datos más recientes.
- El campo de búsqueda de la tabla filtra localmente por transacción, código, cliente, usuario, estado o caja.
- La recepción de una captura desde la extensión guarda las líneas y vuelve a consultar el rango recibido.

Las acciones manuales **Buscar** y **Actualizar** deben omitir la caché del navegador. Así se pueden reintentar consultas fallidas y ver cambios que se hicieron después de la primera carga.

## API

- `GET /api/v1/ObsCapture?fechaInicio=YYYY-MM-DD&fechaFin=YYYY-MM-DD&tipoVenta=OBS|IOC` lista las filas.
- `POST /api/v1/ObsCapture` guarda o actualiza las líneas recibidas de la extensión.

Las escrituras requieren asistencia cuando la validación está activa; las consultas GET siguen disponibles sin esa validación.
