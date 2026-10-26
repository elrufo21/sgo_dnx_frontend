# Ticket térmico: QR continuo

El ticket PDF usa un ancho de 226 puntos (80 mm), altura automática y no incluye marco exterior. El margen interno es de 2 px para aprovechar el ancho disponible sin arriesgar que el contenido llegue al límite físico de una ticketera. No se establece una altura fija, porque una página fija podía enviar el QR a una segunda página PDF cuando el detalle de venta ocupaba el espacio disponible. Las ticketeras imprimen ambas páginas como una sola tira y mostraban el espacio en blanco entre el detalle y el QR.

El QR ahora permanece inmediatamente después del contenido del comprobante. La corrección está centralizada en `src/components/Ticket.tsx`, por lo que aplica tanto a Ventas como a la captura HTML.

La cantidad de cada producto se imprime en negrita a 13 puntos (antes 9), para facilitar su lectura. El tamaño se aplica al número de unidades en el detalle del ticket compartido, tanto al completar la venta como al volver a imprimirla; el encabezado **Cant.**, las descripciones y los importes mantienen su tamaño.

La impresión correcta se realiza en silencio, sin mostrar un toast de éxito. Si falla la generación del ticket, la conexión con el agente o el envío a la impresora, se conserva el toast con el error correspondiente.
