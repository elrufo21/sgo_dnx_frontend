# Carga de lista de precios PDF en Productos

En **Productos**, el botón **Cargar PDF** permite seleccionar una lista de precios. El sistema envía el archivo al endpoint `POST /api/v1/Productos/lista-precios-pdf` y muestra un modal con los productos extraídos: categoría, código, nombre, unidad, contenido, precios, SV y PV.

El modal tiene el botón **Guardar en BD**. Al usarlo, los productos nuevos se registran en `Producto` y los códigos existentes se actualizan con los datos y precios del PDF. La pantalla informa cuántos se crearon, cuántos se actualizaron y cuáles no pudieron guardarse.

Los productos importados se guardan con el código prefijado por `251-`, en mayúsculas, con sublínea/categoría `1` y unidad de medida `UNIDAD`. El precio de distribuidor se guarda como costo y el precio de menudeo como venta; la categoría y el contenido original quedan en la observación del producto.

Se aceptan únicamente archivos PDF de hasta 10 MB. Para la lista DXN vigente desde el 1 de septiembre de 2026, la extracción reconoce 89 productos; el backend completa las filas que el PDF contiene como trazos vectoriales sin texto legible.
