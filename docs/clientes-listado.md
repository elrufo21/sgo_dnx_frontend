# Listado de clientes

El listado de clientes ocupa todo el alto disponible bajo la cabecera, sin desplazamiento de página. Muestra cincuenta filas por página y conserva la paginación para consultar el resto de clientes.

Al entrar por primera vez, carga los clientes desde el servidor. Si se abre el formulario de registro y se vuelve sin guardar, reutiliza la lista almacenada en memoria y no realiza otra consulta. La misma regla se aplica al modal de Clientes de Ventas al alternar entre las pestañas Clientes y Formulario. Las altas, ediciones y eliminaciones actualizan esa misma lista local.

Durante la carga, el listado reutiliza el modal compartido `BlockingSpinner` con el texto **Cargando clientes...**. El modal cubre la pantalla mientras el store indica carga y se retira al finalizar la petición; no agrega consultas ni cambia la caché o la paginación.

La consulta externa del formulario acepta solo números: requiere 8 dígitos para DNI y 11 para RUC. El servicio compartido rechaza números incompletos o con otros caracteres antes de enviar la solicitud.

En el campo de consulta de DNI o RUC, Enter ejecuta la misma búsqueda y validaciones que el botón **Consultar**.

## Razón social sin signos

Al registrar o editar un cliente, se eliminan de su nombre o razón social únicamente los caracteres `.`, `,`, `{`, `}`, `[` y `]`. Esto también se aplica a los datos que devuelve la consulta externa de DNI/RUC y al guardar desde otros formularios; los demás caracteres se conservan. El servidor aplica la misma regla y no acepta un nombre vacío. Los clientes existentes se pueden revisar y limpiar con el script `sgo_dnx_backend/scripts/sql/limpiar-signos-razon-social-cliente.sql`, que debe ejecutar el administrador en cada base de datos correspondiente, previa revisión y respaldo. Los documentos históricos no se modifican mediante ese script.

Antes de quitar los signos, se eliminan las referencias `EXPdd-mm-aaaa`, con o sin corchetes, con cualquier fecha en ese formato y sin distinguir mayúsculas. La misma limpieza se aplica a los nombres recibidos por la captura de ventas y por consultas de documentos, y el servidor la aplica al crear o editar clientes. Una referencia con otro formato no se identifica como EXP.

Antes de limpiar los signos, el administrador puede usar `sgo_dnx_backend/scripts/sql/limpiar-referencia-exp-cliente.sql` para retirar referencias completas con el formato `[EXPdd-mm-aaaa]`. El script inicia en modo de vista previa y no elimina referencias que ya hayan perdido los corchetes ni formatos diferentes.

Para realizar ambas limpiezas juntas existe `sgo_dnx_backend/scripts/sql/limpiar-razon-social-completo.sql`. Primero retira las referencias EXP con el formato indicado y luego los signos; presenta la razón anterior y la resultante en modo vista previa. Debe revisarse y aplicarse por separado en cada base de datos por el administrador, con respaldo previo. No reconoce referencias sin corchetes.

## Selección de cliente en Ventas

En una venta nueva, Ventas resuelve la selección explícita por código, RUC o nombre; el DNI no se usa para buscar ni para inferir un cliente. La búsqueda del campo RUC consulta solo RUC.

Al abrir una venta guardada, el cliente se carga exclusivamente por `ClienteId` del registro. No se vuelve a inferir por DNI, RUC, nombre o código, porque esos valores pueden estar duplicados o haber cambiado.
