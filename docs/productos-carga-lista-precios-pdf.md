# Carga de lista de precios PDF en Productos

## Propósito y alcance

Documenta el flujo de **Productos → Cargar PDF** para replicarlo en otro aplicativo: selección del archivo, extracción de la lista, revisión previa, persistencia de productos y efectos en `Producto` y `Kardex`.

El flujo actual tiene dos pasos separados. Leer el PDF **no modifica la base de datos**. La modificación ocurre solo cuando el usuario confirma **Guardar en BD** en la vista previa.

## Flujo de usuario

1. En la lista de productos, **Cargar PDF** abre el selector de archivos. El selector acepta archivos con extensión `.pdf`; al cambiar el archivo se limpia el input para poder elegir el mismo archivo otra vez.
2. El frontend envía el archivo como `multipart/form-data`, campo `archivo`, a `POST /api/v1/Productos/lista-precios-pdf`.
3. El backend extrae la vigencia y las filas. Devuelve `vigenteDesde` y productos con página, categoría, código, nombre, unidad, contenido, precio distribuidor, precio menudeo, SV y PV.
4. El frontend muestra una vista previa con todos esos datos. La vigencia se presenta como “No indicada” si no fue detectada. El usuario puede cerrar o confirmar **Guardar en BD**.
5. Al confirmar, el frontend envía la lista y el nombre del usuario a `POST /api/v1/Productos/lista-precios-pdf/guardar`. Si la respuesta es válida, vuelve a cargar la lista con el filtro de estado actual y muestra cantidades de nuevos/actualizados y códigos omitidos.

Ambos endpoints requieren un usuario autenticado (`[Authorize]`). No tienen en este flujo una autorización específica por permiso de catálogo; la autorización es la sesión autenticada.

## Validación del archivo

- Frontend: valida que el nombre termine en `.pdf` sin distinguir mayúsculas y minúsculas. No valida tamaño ni MIME.
- Backend: requiere archivo presente y no vacío, extensión `.pdf` y tamaño máximo de **10 MiB**. También limita el cuerpo multipart a ese tamaño.
- No se comprueba MIME type ni la firma binaria `%PDF`; la lectura real con PdfPig es la que falla si el contenido no se puede abrir como PDF.
- Si el PDF abre pero no hay códigos de producto reconocibles, el backend devuelve error: `El PDF no contiene filas de productos reconocibles.`

## Extracción del PDF

Implementación: `sgo_dnx_backend/src/Infrastructure/Pdf/ProductoPdfService.cs`, usando PdfPig. Se inspeccionan todas las páginas y las palabras con sus coordenadas.

### Detección de filas y columnas

- Un código válido para detectar una fila debe coincidir con `^[A-Z]{2,5}\d{2,5}$`. La expresión distingue mayúsculas, así que códigos en minúscula no se reconocen automáticamente.
- Los códigos detectados se ordenan por coordenada vertical. Los puntos medios entre códigos consecutivos delimitan las filas. Se asume que cada producto tiene un código legible en el PDF.
- El cálculo actual de límites usa el código anterior y siguiente; una página que tenga exactamente un código reconocido produce un error de índice. Si el otro aplicativo debe admitir páginas con un solo producto, corregir ese borde en vez de copiarlo.
- Las posiciones horizontales se escalan según el ancho de página (`ancho / 595.276`). Los límites de columna son `0, 80, 235, 295, 380, 435, 490, 535`.

| Rango X escalado | Campo extraído |
| --- | --- |
| 0–80 | Código |
| 80–235 | Nombre |
| 235–295 | Unidad de medida |
| 295–380 | Contenido |
| 380–435 | Precio distribuidor |
| 435–490 | Precio menudeo |
| 490–535 | SV |
| 535 en adelante | PV |

Las palabras de cada campo se unen con espacios. El texto `ﬁ` se normaliza a `fi` y los campos se recortan.

Los precios solo se reconocen cuando el texto contiene `S/` seguido de dígitos/comas y, opcionalmente, punto con dos decimales. SV/PV se parsean como decimales invariantemente después de quitar `S/` y comas. Un formato distinto queda como `null` y se mostrará con `-` en el preview.

### Categoría y vigencia

- La categoría se infiere de líneas cercanas situadas antes del código según las coordenadas PDF. Se descartan líneas que parezcan códigos, precios (`S/`) o encabezados/textos conocidos: “Código de Producto”, “Nombre del Producto”, “Lista de precios”, “Efectivo desde”, “Distribuidor Independiente”, “DXN INTERNATIONAL”, líneas que comienzan con `RUC`, “Por favor” o `*`.
- La vigencia se detecta con el texto español `Efectivo desde el <día> de <mes> del <año>`. Se reconocen los meses enero–diciembre, incluyendo `setiembre` y `septiembre`. Si no se detecta, se devuelve `null`; no impide guardar.
- La vigencia se muestra en la vista previa, pero no se guarda en `Producto`, no se compara con la fecha actual y no impide importar una lista antigua.

### Completar precios ausentes

Después de extraer filas, si una fila no tiene ninguno de los cuatro datos numéricos (distribuidor, menudeo, SV, PV), se intenta copiar los cuatro desde la fila más próxima que cumpla todo esto: misma página, categoría, unidad, contenido, precio distribuidor presente y distancia vertical menor a 90 puntos. Si no hay candidata, los valores quedan nulos.

### Excepción de la lista vigente desde 01/09/2026

`CompletarLista13` solo se activa si la vigencia detectada es **2026-09-01** y aparece el código `FB007`. La lista incluye correcciones de datos extraídos y productos añadidos porque algunas filas del PDF son trazos vectoriales sin texto legible. Para otro catálogo o fecha, estas filas no se agregan automáticamente.

Correcciones de filas detectadas (categoría, nombre, unidad, contenido, distribuidor, menudeo, SV, PV):

| Código | Categoría | Nombre | Unidad / contenido | Distribuidor | Menudeo | SV | PV |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| FB007 | Alimentos y Bebidas | DXN Morinzhi | Botella / Botella x 285ml | 87 | 131 | 38.70 | 5.50 |
| FB098 | Alimentos y Bebidas | DXN White Coffee Zhino | Bolsa / Bolsa x 12 paquetes x 28g | 104 | 156 | 45.20 | 7 |
| FB215 | Alimentos y Bebidas | DXN Lion's Mane Coffee | Caja / Caja x 20 sachets x 21g | 82 | 123 | 27.80 | 8.30 |
| FB267 | Alimentos y Bebidas | DXN Lion's Mane Coffee (cup) | Taza / Taza x 1 sachet x 21g | 8 | 12 | 2.70 | 0.70 |
| FB351 | Alimentos y Bebidas | DXN Oozhi Tea 30g | Botella / Botella x 30g | 33 | 50 | 13.70 | 2.40 |
| FB373 | Alimentos y Bebidas | DXN Ootea Zhi Mocha Mix | Bolsa / Bolsa x 20 paquetes x 21g | 99 | 149 | 44 | 7.10 |
| HF127 | Tabletas masticables | DXN Spirulina Tablet 120's | Botella / Botella x 120 tabletas masticables x 0.25g | 132 | 198 | 59.90 | 5.20 |
| PEKIT13 | Kit de membresía y materiales de marketing | KIT PREMIUM BUSINESS: - Material - DXN Lingzhi Coffee 3 in 1 (1 BOLSA) | Set / 1 set | 125 | — | 23.60 | 4.60 |

Productos agregados al no existir código legible en el PDF:

| Página | Código | Categoría | Nombre | Unidad / contenido | Distribuidor | Menudeo | SV | PV |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |
| 2 | HA004 | Electrodomésticos | DXN Pressure Cooker 4/6L | Set / 1 pieza | 906 | 1359 | 268.70 | 63 |
| 2 | HA005 | Electrodomésticos | DXN OTG Mug | Unit / 1 pieza | 213 | 320 | 72.30 | 16 |
| 2 | HA012 | Electrodomésticos | DXN Tea Infuser | Unit / 1 pieza | 92 | 138 | 31.30 | 7.60 |
| 2 | WT058 | Electrodomésticos | DXN Energy Plus Water System | Unit / 1 pieza | 5229 | 7844 | 1772.70 | 393 |
| 2 | WT059 | Electrodomésticos | Filter A - DXN Efficient Ceramic Filter | Unit / 1 pieza | 2444 | 3668 | 828.30 | 199 |
| 2 | WT060 | Electrodomésticos | Filter B - DXN Pre-Carbon Filter | Unit / 1 pieza | 2444 | 3668 | 828.30 | 199 |
| 2 | WT061 | Electrodomésticos | Filter C - DXN Resin Filter | Unit / 1 pieza | 2444 | 3668 | 828.30 | 199 |
| 2 | WT062 | Electrodomésticos | Filter D - DXN Energy Filter | Unit / 1 pieza | 2444 | 3668 | 828.30 | 199 |
| 2 | WT063 | Electrodomésticos | Filter E - DXN Post-Carbon Filter | Unit / 1 pieza | 2444 | 3668 | 828.30 | 199 |
| 2 | WT064 | Electrodomésticos | Filter F - DXN Ultra Filtration Membrane Filter | Unit / 1 pieza | 2444 | 3668 | 828.30 | 199 |
| 2 | AP027 | Prendas de Vestir | DXN Kimono (Cool Blue) - size S | Set / 1 set | 168 | 252 | — | — |
| 2 | AP028 | Prendas de Vestir | DXN Kimono (Cool Blue) - size M | Set / 1 set | 168 | 252 | — | — |
| 2 | AP029 | Prendas de Vestir | DXN Kimono (Cool Blue) - size L | Set / 1 set | 168 | 252 | — | — |
| 2 | AP030 | Prendas de Vestir | DXN Kimono (Cool Blue) - size XL | Set / 1 set | 168 | 252 | — | — |
| 2 | AP031 | Prendas de Vestir | DXN Kimono (Cool Blue) - size XXL | Set / 1 set | 168 | 252 | — | — |
| 2 | PEKIT4 | Kit de membresía y materiales de marketing | KIT BÁSICO: Material | Set / 1 set | 60 | — | — | — |
| 2 | P2138 | Kit de membresía y materiales de marketing | Dato' Dr. Lim Siow Jin - Mi Camino con DXN - Español | Unit / 1 pieza | 52.80 | 52.80 | — | — |
| 2 | P2184 | Kit de membresía y materiales de marketing | Sunya - The Power That Drives DXN, DXN Spanish Version | Unit / 1 pieza | 52.80 | 52.80 | — | — |
| 3 | PC004 | Cuidado Personal | DXN Ganozhi Shampoo | Botella / Botella x 250ml | 73 | 110 | 32.50 | 5 |
| 3 | PC005 | Cuidado Personal | DXN Ganozhi Body Foam | Botella / Botella x 250ml | 73 | 110 | 32.50 | 5 |
| 3 | PC006 | Cuidado Personal | DXN Ganozhi Toothpaste | Caja / Caja x 01 tubo x 150g | 45 | 68 | 19.40 | 3 |
| 3 | PC007 | Cuidado Personal | DXN Gano Massage Oil | Caja / Caja x 01 botella x 75ml | 58 | 87 | 25.20 | 3.80 |
| 3 | PC036 | Cuidado Personal | DXN Ganozhi Soap | Sachet / Sachet x 01 barra x 80g | 22 | 33 | 9.10 | 1.50 |
| 3 | SC020 | Cuidado de la Piel | DXN Aloe V Cleasing Gel | Tubo / Tubo x 100ml | 64 | 96 | 28.10 | 5.20 |
| 3 | SC021 | Cuidado de la Piel | DXN Aloe V Hydrating Toner | Frasco / Frasco x 100ml | 64 | 96 | 28.10 | 5.20 |
| 3 | SC022 | Cuidado de la Piel | DXN Aloe V Aqua Gel | Tubo / Tubo x 50ml | 87 | 131 | 37.90 | 6 |
| 3 | SC023 | Cuidado de la Piel | DXN Aloe V Nurticare Cream | Tubo / Tubo x 30ml | 87 | 131 | 37.90 | 6 |
| 3 | SC024 | Cuidado de la Piel | DXN Aloe V Hand and Body Lotion | Frasco / Frasco x 250ml | 64 | 96 | 28.10 | 5.20 |
| 3 | SC032 | Cuidado de la Piel | DXN Aloe V Facial Scrub | Tubo / Tubo x 75ml | 76 | 114 | 33.10 | 5.80 |
| 3 | SC033 | Cuidado de la Piel | DXN Aloe V Hydrating Mask | Tubo / Tubo x 100ml | 87 | 131 | 37.90 | 6.60 |

Para esta lista, la categoría también se asigna por página: página 1 = **Alimentos y Bebidas**; en página 2 se asignan excepciones para `HF125`/`HF127` (Tabletas masticables), `PEKIT13` (Kit) y `FB445`, `FB446`, `FB455`, `FB467`, `FB603`, `HF039` (Alimentos y Bebidas). El resto conserva la categoría inferida o “Sin categoría”.

## Preparación del lote en el backend

El endpoint de guardado (`ProductosController`) normaliza y transforma cada fila antes de llamar al repositorio:

- Código: recorta espacios y convierte a mayúsculas. Si queda vacío, se omite y se devuelve en `errores` como `SIN CODIGO`.
- Nombre: recorta, convierte a mayúsculas, elimina apóstrofos y quita un prefijo inicial `DXN `; si queda vacío, se omite y se informa el código.
- Usuario: el frontend toma `displayName` o `username`, conserva las primeras dos palabras y las convierte a mayúsculas. El backend vuelve a conservar las dos primeras palabras en mayúsculas. Si no recibe nombre, usa `IMPORTACION PDF`.
- `PrecioDistribuidor` se convierte en costo. Si viene nulo, se guarda como 0.
- Categoría y contenido se concatenan en `ProductoObs` con el formato `CATEGORIA: <categoría> CONTENIDO: <contenido>`; se quitan `;`.
- La capa controller fija sublínea `1`, nombre de unidad `UNIDAD`, venta igual al costo, marca `DXN`, inventariable `S`, almacén `1`, y PV/SV nulos como 0.
- `PrecioMenudeo`, unidad extraída, vigencia y número de página no se envían al procedimiento de base de datos. Aunque el precio menudeo aparece en pantalla, **no participa en la actualización**.

El repositorio serializa el lote como XML y llama al procedimiento `dbo.uspGuardarListaPreciosPdfWEB`, con timeout de 300 segundos. El XML lleva código, nombre, costo, observación, PV y SV.

## Reglas de persistencia en SQL

El procedimiento activo convierte código, nombre y observación a mayúsculas; recorta espacios; quita el prefijo `DXN ` del nombre y elimina apóstrofos. También quita `;` de la observación. Valida que haya filas, que código/nombre no estén vacíos y que no haya códigos repetidos dentro del lote ya normalizado. Los errores SQL no identifican una fila concreta.

La operación de productos y Kardex usa transacción con `XACT_ABORT ON`.

### Código ya existente (coincidencia exacta)

Actualiza en `Producto` las filas cuyo `ProductoCodigo` coincide con el código importado:

| Campo | Valor escrito |
| --- | --- |
| `IdSubLinea` | `1` |
| `ProductoNombre` | Nombre normalizado |
| `ProductoMarca` | `DXN` |
| `ProductoUM` | `UNIDAD` |
| `ProductoCosto` | Precio distribuidor o 0 |
| `ProductoVenta` | El mismo costo/distribuidor; no precio menudeo |
| `ProductoINV` | `S` |
| `AlmacenId` | `1` |
| `ProductoUbicacion` | Cadena vacía |
| `ProductoObs` | Categoría y contenido |
| `ProductoUsuario` / `ProductoFecha` | Usuario importador / fecha actual |
| `ProductoPV` / `ProductoSV` | Valor extraído, o 0 |
| `ProductoxCaja` | `1` |

No cambia stock (`ProductoCantidad`), estado (`ProductoEstado`), imagen, `ProductoVentaB`, `AplicaFB`, tipo de cambio ni otros campos no listados. Inserta un Kardex por cada fila actualizada con motivo/documento `Edita Cantidad`, concepto `INGRESO`, stock inicial y final iguales al stock que ya tenía, entrada/salida 0 y el costo nuevo. Es una auditoría de cambio de precio/datos, aunque el texto de motivo diga “Edita Cantidad”.

### Código nuevo

Inserta una fila en `Producto` con sublínea 1, código y nombre normalizados, marca DXN, unidad `UNIDAD`, costo distribuidor y venta igual a ese costo, almacén 1, ubicación vacía, stock 0, observación categoría/contenido, estado `BUENO`, usuario/fecha actuales, sin imagen, valor crítico 0, PV/SV o 0, por caja 1, `ProductoINV = 'S'`, `AplicaFB = 'S'` y `UltimoINV = NULL`. También inserta Kardex con motivo/documento `Nuevo Registro`, stock inicial/final 0, cantidad ingreso/salida 0, costo del producto, concepto `INGRESO` y estado `E`.

La respuesta del procedimiento cuenta inserciones y actualizaciones. Los códigos omitidos por el controller se devuelven aparte como errores. No hay tratamiento especial de productos cuyo código empieza con `251`: el procedimiento activo empareja por igualdad exacta de `ProductoCodigo` y no modifica otro código relacionado.

## Errores y límites importantes

- Si el controller omite algunos productos por código o nombre vacío, todavía intenta guardar el resto; la respuesta informa los códigos omitidos.
- Si el lote queda sin productos válidos, se rechaza antes de llamar al procedimiento.
- Si SQL rechaza el XML/lote o falla otra operación, el controller devuelve HTTP 500 con mensaje genérico; la respuesta no expone la fila causante.
- La vista previa no ofrece edición de los datos extraídos ni selección parcial: confirmar guarda el lote completo que recibió.
- El guardado no considera la fecha de vigencia ni hace una comparación con otra lista; cada PDF confirmado actualiza el catálogo inmediatamente.
- La actualización por código no reactiva un producto inactivo, porque la rama de actualización no cambia `ProductoEstado`.
- Un precio distribuidor nulo termina como costo y venta 0. PV/SV nulos terminan como 0. Menudeo nulo o no nulo se ignora al guardar.
- El método de fila exige código en mayúsculas. Las filas que el PDF represente solo como imagen/trazos no se extraen, salvo la excepción codificada para lista vigente 01/09/2026.

## Diferencias entre documentación/código fuente y base activa

La definición consultada en `DXN_ICA2909REG` es la referencia para el comportamiento en esa base. Encontré estas diferencias que conviene revisar antes de portar:

1. La versión anterior de este documento decía que importar `FB007` también actualizaba `251FB007`. Eso **no lo hace el procedimiento activo**: solo actualiza coincidencias exactas. No se debe replicar esa afirmación como regla actual.
2. El archivo fuente `sgo_dnx_backend/scripts/sql/20260922_procedimientos_web_produccion.sql` termina su `CATCH` con `THROW;`. La definición consultada en la base activa hace rollback y ejecuta `PRINT 'aramirez'` con el `THROW` comentado. En esa base, un error SQL se puede ocultar en el procedimiento y el repositorio puede recibir cero filas en vez del error original. Revisar esa diferencia si se despliega o migra el procedimiento.

## Archivos de referencia

- UI y vista previa: `sgo_dnx_frontend/src/features/products/pages/ProductList.tsx`.
- Extracción PDF y excepción Lista 13: `sgo_dnx_backend/src/Infrastructure/Pdf/ProductoPdfService.cs`.
- Endpoints, validación y mapeo: `sgo_dnx_backend/src/Api/Controllers/ProductosController.cs`.
- Serialización XML y llamada SQL: `sgo_dnx_backend/src/Infrastructure/Repositories/ProductoRepository.cs`.
- Persistencia y Kardex: `dbo.uspGuardarListaPreciosPdfWEB`.
