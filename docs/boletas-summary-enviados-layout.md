# Resúmenes enviados: ajustes de visualización

Fecha: 2026-08-24

En la pestaña **Resúmenes enviados** de Contabilidad > Resumen de boletas:

- Se eliminó la tarjeta `Cant.` del pie del listado.
- `Rango Números` tiene un ancho mínimo y no divide el rango en varias líneas.
- `Fecha Envío`, `Serie` y `Usuario` tienen un ancho mínimo y se muestran en una sola línea.
- Se ocultó el control para limpiar la búsqueda solo en esta pestaña.
- El botón de retorno usa fondo claro y flecha negra para conservar contraste en el encabezado.
- El rango de comprobantes se muestra como `BV1-40608 al BV1-40647`, igual que en el escritorio. También se normalizan registros históricos que estén almacenados con ceros a la izquierda o con guiones entre ambos extremos.

El componente reutilizable `DataTable` conserva el control en los demás listados mediante `showSearchClear`, que por defecto permanece activo.
