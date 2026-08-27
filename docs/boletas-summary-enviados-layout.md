# Resúmenes enviados: ajustes de visualización

Fecha: 2026-08-24

En la pestaña **Resúmenes enviados** de Contabilidad > Resumen de boletas:

- Se eliminó la tarjeta `Cant.` del pie del listado.
- `Rango Números` tiene un ancho mínimo y no divide el rango en varias líneas.
- `Fecha Envío`, `Serie` y `Usuario` tienen un ancho mínimo y se muestran en una sola línea.
- Se ocultó el control para limpiar la búsqueda solo en esta pestaña.
- El botón de retorno usa fondo claro y flecha negra para conservar contraste en el encabezado.

El componente reutilizable `DataTable` conserva el control en los demás listados mediante `showSearchClear`, que por defecto permanece activo.
