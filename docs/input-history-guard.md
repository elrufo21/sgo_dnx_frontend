# InputHistoryGuard

## Propósito

Evita que el historial y el autocompletado del navegador interfieran con los campos de texto de la aplicación, aplica mayúsculas a los campos normales y limpia caracteres no permitidos de los inputs de texto.

## Alcance

Los campos de autocompletado con `role="combobox"` quedan fuera de la modificación directa del valor, mayúsculas forzadas y atributos de bloqueo del guard. React/MUI debe recibir cada evento de escritura intacto para actualizar la consulta y filtrar opciones en cada tecla.

En cualquier `input[type="text"]` se eliminan al escribir o pegar los caracteres `'`, `[`, `]`, `;`, `|`, `¬` y la secuencia `}}`. El filtro también funciona dentro de diálogos y conserva la posición del cursor. No modifica campos de otros tipos ni `textarea`; este control del navegador no sustituye la validación del backend.

## Uso

El guard se monta globalmente desde `src/app/App.tsx`. Los nuevos autocompletados que usen `role="combobox"` no requieren configuración adicional; los campos normales conservan el comportamiento existente.
