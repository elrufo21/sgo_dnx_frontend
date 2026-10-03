# InputHistoryGuard

## Propósito

Evita que el historial y el autocompletado del navegador interfieran con los campos de texto de la aplicación y aplica mayúsculas a los campos normales.

## Alcance

Los campos de autocompletado con `role="combobox"` quedan fuera de la modificación directa del valor, mayúsculas forzadas y atributos de bloqueo del guard. React/MUI debe recibir cada evento de escritura intacto para actualizar la consulta y filtrar opciones en cada tecla.

## Uso

El guard se monta globalmente desde `src/app/App.tsx`. Los nuevos autocompletados que usen `role="combobox"` no requieren configuración adicional; los campos normales conservan el comportamiento existente.
