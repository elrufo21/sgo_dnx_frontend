# Distribución responsive: análisis e implementación — 2026-10-22

## Objetivo y alcance

Mantener una distribución de escritorio utilizable a partir de 1200 px de ancho del viewport. Reservar el apilamiento general de paneles para anchos inferiores, conservando legibilidad, acceso a acciones y edición de formularios. El ajuste está implementado en el frontend y sus componentes compartidos. No requiere cambios de API o SQL.

El análisis inicial se basó en el código y la captura entregada por el usuario. La implementación se comprobó posteriormente en el navegador con la estructura real de la aplicación y datos simulados; se detalla la cobertura al final. Los anchos corresponden al viewport CSS, no necesariamente a la resolución física del monitor cuando se usa zoom.

## Hallazgos iniciales, antes de la implementación

| Área | Regla actual | Efecto |
| --- | --- | --- |
| Tailwind | `xl` = 80 rem, normalmente 1280 px; `2xl` = 96 rem, normalmente 1536 px | No existe un umbral compartido de escritorio en 1200 px. |
| Estructura global | `src/App.css`: ajustes a 1536 px y entre 1024 y 1366 px | Cambian espacios, altura del encabezado y ancho del sidebar. No es la regla que apila por sí sola los paneles de Ventas. |
| Ventas HTML | `HtmlCaptureSalePage.tsx`: dos columnas desde `xl`, formulario lateral de 420 px y 440 px desde `2xl` | Por debajo de 1280 px el formulario pasa debajo de los productos. |
| Tabla de Ventas | Mínimo de 760 px desde `sm`, dentro de un contenedor con desplazamiento horizontal | Adelantar las dos columnas a 1200 px puede aumentar el desplazamiento si no se ajustan los anchos. |
| Listados compartidos | `DataTable.tsx`: barra en fila desde `xl`; buscador de 26 rem desde `lg` y 34 rem desde `xl` | Buscador, filtros y acciones compiten por ancho. También pueden pasar de fila por `flex-wrap`, independientemente del breakpoint. |
| Facturas de servicio | `ServiceInvoiceCreate.tsx`: panel lateral de 19 rem desde `xl`; tabla con mínimo de 64 rem | Requiere revisar panel lateral y desplazamiento de tabla al activar escritorio en 1200 px. |
| POS | `POSPage.tsx`: carrito lateral desde `xl`; debajo pasa a panel superpuesto | Hay un cambio de interacción además del cambio de columnas. |
| Pago POS | `PaymentPage.tsx`: reglas explícitas a 1405 px | El layout de tres columnas no depende de `xl`; cambiar solo Tailwind no lo unifica. |
| Informes | PDT y reporte de productos tienen reglas `2xl`; SIRE combina anchos mínimos y fijos | Algunas vistas amplias necesitan adaptación propia para evitar desbordes. |
| Navegación y tablas móviles | Sidebar y tarjetas de `DataTable` cambian en `md`, normalmente 768 px | Son comportamientos móviles distintos del problema de escritorio. |

Se encontraron reglas `xl` en 21 archivos TSX y reglas `2xl` o de 1405 px en cinco archivos. Ese inventario no implica que todos sus usos deban cambiar: hay reglas de espaciado, tamaños y diseños amplios además de cambios estructurales.

Con la fuente raíz normal de 16 px, el sidebar abierto ocupa 220 px entre 1024 y 1366 px. A 1200 px, descontando ese menú y los 32 px de margen horizontal del contenido, quedan aproximadamente 948 px antes de considerar barras de desplazamiento. Una tabla de 760 px más un formulario de 420 px y un espacio de 16 px necesitan 1196 px. Por tanto, cambiar únicamente el umbral no resuelve el espacio disponible.

## Enfoque recomendado

1. Definir un breakpoint de escritorio compartido en 75 rem, equivalente a 1200 px con la fuente raíz normal. Aplicarlo a los cambios estructurales que deben obedecer la petición. Evitar redefinir indiscriminadamente `xl`: también activa anchos grandes de buscadores y bloques de información.
2. Mantener los tamaños móviles existentes mientras se aborda el escritorio. Desde 1200 px usar escritorio compacto; por debajo permitir el apilamiento de paneles y filtros. Las pantallas amplias pueden añadir espacio o paneles secundarios sin quitar acceso a operaciones en escritorio compacto.
3. Ajustar primero la estructura compartida: espacios del contenido, encabezado, sidebar, barras de `DataTable`, formularios reutilizables y diálogos. Revisar límites mínimos, crecimiento flexible y `min-width` para que los contenidos permanezcan dentro de su panel.
4. En Ventas, mantener productos y formulario en dos columnas desde 1200 px con un lateral adaptable. Ajustar espacios y columnas de tabla; conservar el desplazamiento horizontal dentro de la tabla cuando sea necesario, sin desplazar la página completa. No fijar toda la interfaz a un ancho mínimo de 1200 px ni reducir globalmente texto o zoom.
5. Revisar por grupos: Ventas/captura y POS; Caja y Caja Chica; Facturas de servicio y compras; listados; Contabilidad, reportes, Mantenimiento y Configuración. Usar los componentes existentes antes de agregar patrones nuevos.
6. Tratar explícitamente diseños especiales como Pago POS a 1405 px y reportes con `2xl`. En pantallas densas, definir una composición de escritorio compacto viable en lugar de forzar tres paneles rígidos dentro del mismo espacio.

## Criterios de aceptación

- A 1200, 1280, 1300 y 1366 px se mantienen las operaciones principales en una distribución de escritorio compacta, sin superposición de campos ni botones recortados.
- El cambio entre 1199 y 1200 px es coherente y no deja paneles duplicados, ocultos o inaccesibles.
- Las tablas densas pueden desplazarse horizontalmente dentro de su contenedor; la página completa no debe desbordarse por ellas.
- Los filtros pueden ocupar más de una fila cuando su contenido lo necesite, manteniendo orden y acceso. Conservar el escritorio no obliga a forzar todos los controles a una sola línea.
- Probar también los límites actuales de 1279/1280, 1404/1405 y 1535/1536 px, además de 1440 px, 768 px y móvil.
- Revisar alturas de 720/768 px, sidebar abierto/cerrado y zoom de navegador de 100 % y 125 %. El breakpoint se evalúa contra el viewport CSS, no contra la resolución física anunciada por el monitor.
- Validar con datos y textos largos, filtros completos, selectores abiertos, diálogos, errores y estados de carga. Una tabla vacía no permite detectar todos los problemas.

## Implementación realizada

- `src/App.css` define `--breakpoint-desktop: 75rem` (1200 px con tamaño inicial de fuente normal) mediante el tema de Tailwind 4. Se conserva `xl` para ampliar espaciado o buscadores; los cambios estructurales usan `desktop:`. `2xl` conserva mejoras de espacio para pantallas amplias, sin retirar operaciones del escritorio compacto.
- Estructura global: `MainLayout` permite encoger el contenido con `min-w-0`, mantiene la altura del encabezado con `shrink-0` y limita nombres de usuario largos con elipsis. El canal de scroll reserva un solo espacio vertical en lugar de ambos bordes. El menú mantiene su comportamiento móvil a 768 px y se puede contraer manualmente; sus botones tienen etiquetas accesibles.
- El sidebar de escritorio se contrae automáticamente al entrar en un viewport menor a 1300 px y se expande al llegar a 1300 px. El botón manual sigue permitiendo cambiarlo hasta cruzar de nuevo ese umbral; el menú móvil bajo 768 px conserva su panel superpuesto.
- `DataTable` mantiene sus tarjetas móviles a 768 px y limita sus bloques al ancho disponible. Los listados con buscador y rango de fechas usan `filters-inline`: hasta 1200 px conservan ambos controles en una sola fila, con campos de fecha compactos y desplazamiento horizontal solo si el ancho no alcanza. `SearchInput` conserva su tamaño preferido en tablas regulares.
- Ventas HTML: desde 1200 px los productos y el formulario permanecen en paralelo. Debajo de 1200 px hay secciones para **Productos y carrito** y **Datos de pago**, activas con o sin `ListaProductosTabla`; cuando hay espacio, comparten fila con las acciones. En Productos, el tipo de venta y las tarjetas **PVS venta** y **PVS mes** se alinean junto al buscador en ambos modos del flag y vuelven al encabezado en escritorio. Las filas y el formulario conservan su estado al cambiar de sección y la barra compacta queda fija arriba al desplazarse. El lateral de escritorio usa un mínimo de 20rem y un ancho adaptable; llega a 440 px en pantallas amplias. Las tablas densas conservan su scroll horizontal interno; se redujo el espacio de celdas solo en escritorio compacto. Se conserva la búsqueda optimizada y la navegación con Escape.
- POS: el carrito lateral y el cambio desde la superposición móvil usan 1200 px. Pago POS elimina el umbral aislado de 1405 px: desde 1200 px muestra Items y formulario en paralelo, con el PDF debajo de Items; desde 1536 px utiliza tres columnas. Por debajo de 1200 px mantiene la interacción con pestañas.
- Facturas de servicio: formulario y resumen lateral desde 1200 px, con lateral adaptable y campos principales en dos columnas en escritorio compacto. La tabla de servicios se desplaza dentro de su contenedor.
- Compras, proveedores y notas: los componentes compartidos `ShoppingFormBase`, `PurchaseFormBase` y `SendNoteFormBase` usan 1200 px para su separación lateral. Se corrigieron los `col-span` incondicionales de Compras, que creaban columnas implícitas en anchos pequeños.
- Caja, Caja Chica, Depósitos y listados: sus separaciones laterales, orden y filtros usan el mismo umbral. Apertura/cierre de Caja ya tenían formularios adaptables; reciben las correcciones del contenedor global y de los componentes compartidos.
- Contabilidad y reportes: PDT mantiene filtros y totales en bloques adaptables; sus filtros móviles se desplazan dentro de su franja. SIRE elimina anchos fijos que sumaban más espacio que el panel. El reporte de productos muestra gráfico y tabla en paralelo desde 1200 px y ajusta el margen del gráfico para no reservar dos veces el espacio del eje. Sus filtros se apilan antes de 1200 px.
- Dashboards de Ventas, Contabilidad, Mantenimiento y Configuración, despacho de facturas y guías de remisión utilizan el mismo umbral estructural.

## Verificación de la implementación

Se usó un servidor Vite temporal y la estructura real `MainLayout`, incluyendo menú abierto y nombre de usuario largo. Una fixture interceptó las peticiones y proporcionó 25 productos con descripciones largas, un ítem de POS y datos mensuales/comparación SIRE. Las rutas se abrieron mediante el selector de prueba; se inspeccionaron tamaños calculados, scroll y capturas. No se guardaron ventas, no se imprimió y no se accedió a SQL ni a los servicios reales. La fixture y el servidor se retiran al finalizar.

| Comprobación | Resultado |
| --- | --- |
| Ventas en 1199 / 1200 px | Una columna / dos columnas. A 1200 px con menú abierto: paneles aproximados de 597 y 320 px. |
| Ventas en 1279, 1280, 1300, 1366, 1404, 1405, 1440, 1535 y 1536 px | Dos columnas, sin desplazamiento horizontal del contenido principal. |
| Ventas en 768 y 390 px | Una columna y tabla/tarjetas según las reglas móviles existentes. |
| Factura nueva/listado, Caja listado/apertura, Caja Chica, Depósitos, Compras, Proveedores, Nota de pedido, POS/Pago, PDT, SIRE, Reportes y dashboards | Recorrido en 1200 px, sin desbordes horizontales de página. |
| 15 pantallas en 1199, 768 y 390 px | Se detectaron desbordes en filtros PDT móvil y en el filtro del reporte de productos a 768 px; tras corregirlos se repitieron las 45 combinaciones, todas sin desbordes horizontales de página. |
| SIRE con comparación y reporte de productos con gráfico/tabla poblados | Comprobados en 390, 768, 1199, 1200, 1366 y 1536 px, sin desbordes horizontales. |
| Pago POS en 1199, 1200, 1404, 1405, 1535 y 1536 px | Interacción compacta coherente; los tres paneles permanecen accesibles desde 1200 px. |
| Menú contraído a 1200 px; apertura/cierre móvil a 390 px | Funcionales, sin desbordes. |
| Cantidad en Ventas, motivo OBS y Escape a Detalle a 1200 px | Funcionales; una tabla de 640 px se desplaza dentro del panel de 595 px. |

Comandos ejecutados:

```sh
npm run build:vercel
node scripts/verify-responsive-breakpoints.mjs
node --experimental-strip-types scripts/verify-product-catalog-search.mjs
node --experimental-strip-types scripts/verify-sale-product-quantities.mjs
npm run typecheck
```

El build y los tres scripts de verificación pasaron. `typecheck` mantiene 272 diagnósticos existentes: al comparar sus mensajes con el registro anterior, ignorando números de línea, no se introdujeron diagnósticos nuevos. El build conserva la advertencia de tamaño del bundle. El script responsive comprueba que el CSS compilado incluya el umbral de 75rem y sus utilidades, y que Pago POS no dependa de 1405 px.

Evidencia local en el directorio `sgo_dnx_backend/artifacts`: `responsive-validation-20261022.json`, `responsive-ventas-1200-20261022.png` y `responsive-facturas-1200-20261022.png`. Las capturas contienen datos simulados.

Límites: pruebas locales con datos simulados y zoom normal; no sustituyen una revisión en cada PC con sus datos, navegadores y zoom. Las vistas sin cambios estructurales heredan los ajustes globales/compartidos; no se probaron todas las operaciones de negocio ni todos los diálogos de cada módulo. No se generaron nuevos ZIP de despliegue para ICA/COMAS en este trabajo.
