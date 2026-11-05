# Descargas de archivos

Las descargas iniciadas desde DNX usan el navegador y respetan su configuración de carpeta y confirmación. El navegador administra el nombre final y el historial de descargas; la web no puede confirmar que el archivo se haya guardado.

Esto incluye comprobantes, reportes, exportaciones y guías que usan el helper `downloadBrowserFile`. Las vistas previas PDF siguen usando los controles del navegador. La descarga no requiere el agente local ni el protocolo `dnxdescargas:`; el agente de impresión conserva su funcionamiento independiente.
