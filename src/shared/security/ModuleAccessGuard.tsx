import { Navigate, Outlet, useLocation } from "react-router";
import { useAuthStore } from "@/store/auth/auth.store";
import { hasPermission } from "./permissions";

const routePermissions: [string, string][] = [
  ["/sales/pos/payment", "VENTAS.POS"],
  ["/sales/pos", "VENTAS.POS"],
  ["/sales/html_capture", "VENTAS.CAPTURAR"],
  ["/sales/order_notes", "VENTAS.LISTA"],
  ["/sales/obs_capture", "VENTAS.OBS"],
  ["/sales/delivery-guide", "VENTAS.GUIA_REMISION"],
  ["/sales/send_note", "VENTAS.NOTA_PEDIDO"],
  ["/sales/boletas_summary", "VENTAS.RESUMEN_BOLETAS"],
  ["/sales/small_cash", "CAJA.CHICA"],
  ["/sales", "VENTAS.VER"],
  ["/pos", "VENTAS.POS"],
  ["/send_note", "VENTAS.NOTA_PEDIDO"],
  ["/products", "MANTENIMIENTO.PRODUCTOS"],
  ["/cash-final-report", "CAJA.INFORME_FINAL"],
  ["/petty-cash-movements", "CAJA.CHICA"],
  ["/cash_flow_control/create", "CAJA.APERTURA"],
  ["/cash_flow_control", "CAJA.CONTROL"],
  ["/shopping", "COMPRAS.GESTIONAR"],
  ["/purchases", "COMPRAS.GESTIONAR"],
  ["/service-invoices", "FACTURAS_SERVICIO.GESTIONAR"],
  ["/customers", "CLIENTES.GESTIONAR"],
  ["/accounting/pdt-company", "CONTABILIDAD.PDT_EMPRESA"],
  ["/accounting/invoice-dispatch", "CONTABILIDAD.ENVIO_FACTURAS"],
  ["/accounting/boletas_summary", "CONTABILIDAD.RESUMEN_BOLETAS"],
  ["/accounting", "CONTABILIDAD.VER"],
  ["/maintenance/areas", "MANTENIMIENTO.AREAS"],
  ["/maintenance/categories", "MANTENIMIENTO.CATEGORIAS"],
  ["/maintenance/providers", "MANTENIMIENTO.PROVEEDORES"],
  ["/maintenance/holidays", "MANTENIMIENTO.FERIADOS"],
  ["/maintenance/computers", "MANTENIMIENTO.COMPUTADORAS"],
  ["/maintenance/products", "MANTENIMIENTO.PRODUCTOS"],
  ["/maintenance/employees", "MANTENIMIENTO.EMPLEADOS"],
  ["/maintenance/users", "MANTENIMIENTO.USUARIOS"],
  ["/maintenance/boletas_summary", "MANTENIMIENTO.RESUMEN_BOLETAS"],
  ["/maintenance", "MANTENIMIENTO.VER"],
  ["/configuration/billing", "CONFIGURACION.FACTURACION"],
  ["/configuration/boleta-batch", "CONFIGURACION.VENTAS_BOLETAS"],
  ["/configuration/caja", "CONFIGURACION.CAJA"],
  ["/configuration/permissions", "CONFIGURACION.PERMISOS"],
  ["/configuration", "CONFIGURACION.VER"],
];

export function ModuleAccessGuard() {
  const user = useAuthStore((state) => state.user);
  const { pathname } = useLocation();
  const permission = routePermissions.find(([path]) => pathname === path || pathname.startsWith(`${path}/`))?.[1];

  return !permission || hasPermission(user, permission)
    ? <Outlet />
    : <Navigate to="/access-denied" replace />;
}
