# Navegación del sidebar

## Ventas

El módulo **Reportes** del sidebar abre el acceso al reporte anual de ventas y al reporte de productos. Ambos conservan el permiso `VENTAS.VER`; su propósito y uso están en `reportes.md`.

## Menú Caja

El sidebar agrupa bajo **Caja** el control de flujo, Caja Chica, Extraer Ventas OBS y Depósitos centros, en ese orden; **Extraer Ventas OBS** aparece después de Caja Chica. **Generar informe final** aparece dentro del mismo grupo cuando `Compania.FlagCaja` está activo. Cada submenú conserva su ruta, estado de navegación y permiso actual; Caja se oculta si el usuario no tiene acceso a ninguno de sus módulos.

El grupo se despliega al entrar a cualquiera de sus rutas, incluida `/sales/obs_capture` para **Extraer Ventas OBS**. El buscador encuentra tanto el grupo como sus páginas y muestra los submenús coincidentes. En el sidebar colapsado, Caja se representa con su icono y el botón lo expande para mostrar las páginas.
