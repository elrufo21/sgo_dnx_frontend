import BillingSettingsPage from "./pages/BillingSettingsPage";
import BoletaBatchSettingsPage from "./pages/BoletaBatchSettingsPage";
import ConfigurationDashboard from "./pages/ConfigurationDashboard";

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
        { label: "Envío de boletas" },
      ],
    },
  },
];
