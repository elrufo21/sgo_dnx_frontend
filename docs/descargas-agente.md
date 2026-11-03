# Guardado de archivos por el agente local

Las descargas iniciadas por DNX se envían al agente local, que guarda los archivos en `C:\DNX\Descargas` en la PC donde se ejecuta Chrome. La web muestra la ruta o el motivo del error. Si el nombre existe, el agente crea una copia numerada. Las descargas no aparecen en el historial de Chrome.

Las confirmaciones y errores usan el componente compartido de notificaciones, con fondo y contraste, para que la ruta del archivo se pueda leer sobre cualquier pantalla.

Tras guardar, el aviso incluye **Ver carpeta**, que abre la carpeta local de DNX mediante el protocolo `dnxdescargas:`. Para habilitarlo, cada usuario de Windows debe ejecutar `instalar-ver-carpeta.ps1` junto a `abrir-carpeta-descargas.vbs`; el instalador registra el protocolo solo en su perfil y copia el archivo necesario a su carpeta local de aplicaciones. Chrome puede solicitar confirmación para abrir la aplicación. El acceso siempre abre la carpeta de DNX y no acepta rutas desde la web. El servicio de impresión no necesita reiniciarse. Si no está instalado, el guardado sigue funcionando y se puede abrir la ruta indicada manualmente.

Incluye comprobantes de ventas y captura OBS, facturas de servicio, cierre de caja, exportaciones de notas, SIRE, PDT, resúmenes, pendientes OSE y XML/ZIP de guías. Cuando un PDF se abre como vista previa, la descarga realizada con los controles propios del visor sigue dependiendo del navegador. No se identificó una descarga automática al confirmar una venta en los flujos revisados; los botones explícitos se adaptaron.

La web requiere el agente actualizado, activo y configurado con su origen y token, y admite archivos hasta el límite del agente (10 MB por defecto). Si el agente no responde, informa el problema sin anunciar una descarga exitosa. El directorio es compartido en la PC según los permisos locales; acordar acceso antes de usarlo con información sensible. No modifica la base de datos ni los documentos de origen.
