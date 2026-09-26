import BillingSettingsPage from "./pages/BillingSettingsPage";
import BoletaBatchSettingsPage from "./pages/BoletaBatchSettingsPage";
import CashSettingsPage from "./pages/CashSettingsPage";
import ConfigurationDashboard from "./pages/ConfigurationDashboard";
import PermissionsSettingsPage from "./pages/PermissionsSettingsPage";
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
