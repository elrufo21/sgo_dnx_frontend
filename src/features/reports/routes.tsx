import { Navigate } from "react-router";
import ProductSalesReportPage from "./pages/ProductSalesReportPage";
import SalesReportPage from "./pages/SalesReportPage";

export default [
  {
    path: "reports",
    element: <Navigate to="/reports/sales" replace />,
    handle: { breadcrumb: [{ label: "Reportes" }] },
  },
  {
    path: "reports/sales",
    element: <SalesReportPage />,
    handle: { breadcrumb: [{ label: "Reportes" }, { label: "Ventas" }] },
  },
  {
    path: "reports/products",
    element: <ProductSalesReportPage />,
    handle: { breadcrumb: [{ label: "Reportes" }, { label: "Productos" }] },
  },
  { path: "sales/reports", element: <Navigate to="/reports/sales" replace /> },
];
