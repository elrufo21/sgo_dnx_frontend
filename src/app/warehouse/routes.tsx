import WarehouseInventoryPage from "./pages/WarehouseInventoryPage";

export default [
  {
    path: "warehouse",
    element: <WarehouseInventoryPage />,
    handle: { breadcrumb: [{ label: "Apertura y cierre de almacén" }] },
  },
  {
    path: "logistica/guia-salida",
    element: <></>,
    handle: { breadcrumb: [{ label: "Guía de salida" }] },
  },
  {
    path: "logistica/guia-ingreso",
    element: <></>,
    handle: { breadcrumb: [{ label: "Guía de ingreso" }] },
  },
];
