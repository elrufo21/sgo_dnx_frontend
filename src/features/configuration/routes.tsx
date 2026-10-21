import BillingSettingsPage from "./pages/BillingSettingsPage";
import BoletaBatchSettingsPage from "./pages/BoletaBatchSettingsPage";
import CashSettingsPage from "./pages/CashSettingsPage";
import ConfigurationDashboard from "./pages/ConfigurationDashboard";
import EmailSenderSettingsPage from "./pages/EmailSenderSettingsPage";
import RenewalSettingsPage from "./pages/RenewalSettingsPage";
import SalesRulesSettingsPage from "./pages/SalesRulesSettingsPage";
import PermissionsSettingsPage from "./pages/PermissionsSettingsPage";
import SunatSettingsPage from "./pages/SunatSettingsPage";
import { PermissionGuard } from "@/shared/security/PermissionGuard";

export default [
  {
    path: "configuration",
    element: <ConfigurationDashboard />,
    handle: {
      breadcrumb: [{ label: "Configuración" }],
    },
  },
  {
    path: "configuration/billing",
    element: <BillingSettingsPage />,
    handle: {
      breadcrumb: [
        { label: "Configuración", to: "/configuration" },
        { label: "Facturación" },
      ],
    },
  },
  {
    path: "configuration/sunat",
    element: <PermissionGuard permission="CONFIGURACION.FACTURACION" fallback="/configuration" />,
    children: [{ index: true, element: <SunatSettingsPage /> }],
    handle: { breadcrumb: [{ label: "Configuración", to: "/configuration" }, { label: "Credenciales SUNAT" }] },
  },
  {
    path: "configuration/email-sender",
    element: <PermissionGuard permission="CONFIGURACION.PERMISOS" fallback="/configuration" />,
    children: [{ index: true, element: <EmailSenderSettingsPage /> }],
    handle: { breadcrumb: [{ label: "Configuración", to: "/configuration" }, { label: "Correo emisor" }] },
  },
  {
    path: "configuration/ventas-operativas",
    element: <PermissionGuard permission="CONFIGURACION.VENTAS_BOLETAS" fallback="/configuration" />,
    children: [{ index: true, element: <SalesRulesSettingsPage /> }],
    handle: { breadcrumb: [{ label: "Configuración", to: "/configuration" }, { label: "Anulaciones y descuentos" }] },
  },
  {
    path: "configuration/renovaciones",
    element: <PermissionGuard permission="CONFIGURACION.FACTURACION" fallback="/configuration" />,
    children: [{ index: true, element: <RenewalSettingsPage /> }],
    handle: { breadcrumb: [{ label: "Configuración", to: "/configuration" }, { label: "Renovaciones" }] },
  },
  {
    path: "configuration/boleta-batch",
    element: <BoletaBatchSettingsPage />,
    handle: {
      breadcrumb: [
        { label: "Configuración", to: "/configuration" },
        { label: "Ventas y boletas" },
      ],
    },
  },
  {
    path: "configuration/caja",
    element: <CashSettingsPage />,
    handle: {
      breadcrumb: [
        { label: "Configuración", to: "/configuration" },
        { label: "Caja" },
      ],
    },
  },
  {
    path: "configuration/permissions",
    element: <PermissionGuard permission="CONFIGURACION.PERMISOS" fallback="/configuration" />,
    children: [{ index: true, element: <PermissionsSettingsPage /> }],
    handle: {
      breadcrumb: [
        { label: "Configuración", to: "/configuration" },
        { label: "Permisos" },
      ],
    },
  },
];
