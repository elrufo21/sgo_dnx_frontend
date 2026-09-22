# Guía de remisión local

## Propósito

La pantalla **Ventas > Guía de remisión** genera localmente un XML preliminar UBL 2.1 de GRE Remitente para traslado entre establecimientos con transporte privado, y su representación impresa en PDF.

## Uso

1. Desde el botón **Guía** de la barra superior, ubicado junto a **Pago V**, abra la pantalla.
2. Complete el traslado, destinatario, ubigeos, placa, DNI del conductor y los bienes. Los datos de empresa, RUC y punto de partida se toman de la sesión cuando están disponibles.
3. Seleccione **Generar XML** para descargar el XML, o **Generar ZIP** para descargar el ZIP que contiene ese mismo XML. Valídelo con el Sistema Facturador SUNAT antes de usarlo.
4. Opcionalmente, seleccione **Generar PDF**. El documento se abre en otra pestaña; si el navegador bloquea esa pestaña, se descarga.

## Alcance

- El XML, ZIP y PDF se generan en el navegador y no crean registros, no se firman y no se envían a SUNAT. El ZIP contiene un único XML sin firma.
- El XML está limitado al motivo 04, traslado entre establecimientos, y modalidad 02, transporte privado.
- La serie y número son editables; no se asignan de forma correlativa. La integración de correlativos, persistencia, firma y envío requiere un flujo de emisión distinto.
- El comando `npm run verify:gre-xml` comprueba el tipo de documento, el escapado de texto y el nombre de archivo.
