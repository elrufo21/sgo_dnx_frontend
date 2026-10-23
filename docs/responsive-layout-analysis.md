# Análisis de distribución responsive — 2026-10-22

## Objetivo y alcance

Mantener una distribución de escritorio utilizable a partir de 1200 px de ancho del viewport. Reservar el apilamiento general de paneles para anchos inferiores, conservando legibilidad, acceso a acciones y edición de formularios. Este documento propone el trabajo para todo el frontend; no implementa cambios de interfaz.

El análisis se basa en el código actual y la captura entregada por el usuario. No se realizaron pruebas visuales del navegador a diferentes anchos. La captura no permite determinar por sí sola el viewport CSS real ni el zoom activo.

## Hallazgos comprobados

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

## Entrega prevista

Realizar primero los ajustes compartidos y validar Ventas como referencia; luego recorrer los grupos restantes con los mismos criterios. Documentar los cambios y producir nuevos builds de frontend para ICA y COMAS cuando la implementación esté aprobada y terminada. Este trabajo de presentación no requiere cambios de API ni SQL.
