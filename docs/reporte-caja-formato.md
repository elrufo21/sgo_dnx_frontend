# Formato del reporte de caja

En el listado de **Control de flujo de caja**, las fechas de apertura y cierre recibidas como `DD/MM/AAAA H:mm:ss` se muestran como `DD/MM/AAAA HH:mm:ss`. También se admite la variante heredada que separa los segundos con un espacio. La conversión se hace en el helper compartido de fechas y conserva la hora local enviada por el backend.

El PDF de cierre de caja replica los resaltados del escritorio: fecha celeste, encabezado verde intenso para conteo e ingresos, encabezado amarillo para salidas y total amarillo en el conteo. El total de ingresos es amarillo completo; en salidas, la etiqueta es amarilla y el importe verde.

En el resumen del PDF, el importe de **DIFERENCIAL** se muestra rojo cuando es negativo, azul cuando es positivo (sobrante) y negro cuando es cero.

El bloque de responsable mantiene un margen de 5 puntos sobre cada línea de ventas y administrador para separarlas de la fecha y entre sí.

El conteo centra los valores de la columna **Efectivo**, deja vacíos los valores cero y no permite editarlos. Los totales de billetes y monedas se muestran en una tabla de dos filas con bordes, como el escritorio. Las columnas de descripción, incluido su encabezado en el resumen de ventas, se alinean a la izquierda.

El botón para generar el PDF permanece deshabilitado hasta que la caja tenga estado **CERRADA**. La propia acción también valida ese estado para impedir la generación de un reporte con información parcial.

Al pulsar **Imprimir**, el formulario carga el PDF en un marco oculto y, cuando termina de cargar, invoca el diálogo de impresión de Chrome sin abrir otra pestaña. El botón **Descargar informe PDF** sigue descargando el archivo con el nombre de cierre e ID.

La descarga iniciada desde el formulario y el PDF adjunto por correo usan `DD-MM-AAAA_HH-mm-ss_ID_<CajaId>.pdf`, construido con la fecha y hora de cierre y el identificador de la caja. Los controles nativos del visor PDF se ocultan. Para descargar con ese nombre, se usa el botón **Descargar informe PDF** del formulario.

En el PDF de caja, los bloques de salidas, ventas no capturadas al facturador, asistencias y productos solo se muestran cuando tienen filas. Si no hay datos, se ocultan tanto el título como la tabla y no se imprime una fila de texto indicando que está vacío. El resumen fijo de caja e ingresos permanece visible.

El módulo independiente **Generar informe de caja final** aparece en el sidebar únicamente cuando `Compania.FlagCaja` es `1`; con valor `0` no se muestra. No abre, cierra ni edita cajas. Tiene su propio formulario: fecha, cajeros consolidados, conteo por denominación, pestañas de ingresos/salidas, Sistema OBS, observaciones, diferencial y listado de informes registrados. Solo consolida las cajas que ya están cerradas para la fecha seleccionada. El conteo comparte las once denominaciones base de Control de flujo de caja, por lo que siempre se muestra aunque no exista un conteo previo en la fecha.

**TOTAL EFECTIVO** se calcula como Sistema OBS menos todas las salidas, incluidas las agregadas manualmente, con dos decimales. Si las salidas superan el OBS, el resultado es negativo; se usa también para el total de ingresos, el diferencial, el guardado y el PDF. El backend permite ese ingreso negativo únicamente cuando coincide con la resta indicada. Verificación sin SQL: `node scripts/verify-informe-final-efectivo.mjs`.

En el listado de informes finales, **Sistema OBS** y **Salidas** muestran separador de miles y dos decimales (por ejemplo, `10,000.00`).

En el formulario del informe final, los totales del conteo, ingresos, gastos, billetes y monedas, así como OBS, salidas y diferencial, se muestran con separador de miles y dos decimales. El formato solo cambia la presentación; los cálculos y los importes editables permanecen numéricos. El PDF ya utiliza el mismo formato.

Los importes mostrados como texto en las tablas de ingresos y gastos también usan separador de miles y dos decimales, incluido TOTAL EFECTIVO. Los movimientos manuales se mantienen como campos numéricos al editar y se muestran con el mismo formato en modo lectura.

La vista del informe final muestra el conteo, ingresos, gastos, OBS y diferencial, sin una tabla de productos vendidos. Al imprimir o enviar por correo un informe final, el PDF incluye los productos vendidos de la fecha en una página aparte cuando hay filas.

Al guardar o actualizar el informe final se abre un cuadro que indica **«Solo el administrador puede cerrar la caja final»** y solicita la clave de administrador. El backend valida que la clave corresponda a un usuario con `Administrador = 1` antes de insertar o actualizar el registro.

Desde el listado, el botón **Ver** abre un informe guardado en modo lectura con el arqueo, ingresos, salidas y observaciones originales.

El listado permite buscar informes por **Fecha Inicio** y **Fecha Fin**. Por defecto muestra el mes en curso hasta la fecha actual; ambos límites son obligatorios y la fecha inicial no puede ser posterior a la final.

Al ver un informe, el candado habilita su edición y el mismo control vuelve a bloquearlo descartando cambios que aún no se guardaron. El botón **Nuevo** de la barra abre una preparación nueva sin alterar el informe consultado.

Las filas manuales de ingresos y salidas conservan el foco y su descripción al escribir espacios o modificar el importe.

Las filas manuales usan una única lista editable, identificada por fila y por pestaña. La descripción usa el control nativo y se confirma al salir de ese campo; por ello, al pasar al importe conserva el texto escrito. La limpieza se realiza al iniciar un formulario o cambiar de fecha, no al completar la petición de preparación.

Al abrir un informe guardado, el conteo conserva los identificadores de sus monedas. Son requeridos por el procedimiento heredado de edición para actualizar cada fila existente.

Los ingresos adicionales guardados se distinguen de los seis conceptos base y vuelven a mostrarse como filas editables. Sus identificadores también se conservan para actualizarlos, sin duplicarlos, al volver a guardar.

El botón junto a **Sistema (OBS)** actualiza únicamente ese total para la fecha del informe, sin borrar el conteo ni los movimientos que se estén editando.

En modo lectura se habilitan **PDF** y **Enviar correo**. El PDF del informe final reutiliza el formato de cierre de caja e incluye una página aparte con los productos vendidos de la fecha cuando hay filas. Ambos PDF incluyen las ventas de `uspCruzeOBS` para la fecha consultada (transacción, código, cliente e importe) y el reporte de asistencia del día, con nombre, ingreso, salida a refrigerio, retorno, estado de asistencia y cantidad de tardanzas. El procedimiento identifica las ventas por `NotaPedido.CajaId IS NULL`.
