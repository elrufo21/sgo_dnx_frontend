# Pantalla de acceso

## Propósito

Presentar el acceso al sistema con la identidad visual roja de DXN y conservar el flujo de autenticación existente.

## Alcance y uso

La página combina una imagen de contexto comercial, un panel oscuro, acentos rojos, campos de usuario y contraseña, alternancia para mostrar la contraseña y mensajes de validación o error. En pantallas pequeñas, la composición se apila para mantener el formulario utilizable.

El formulario reutiliza `TextField` de MUI y `HookForm`; el cambio visual no modifica el envío de credenciales, la sesión ni la navegación posterior al acceso.
