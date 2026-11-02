import { Navigate } from "react-router";
import ProductSalesReportPage from "./pages/ProductSalesReportPage";
import SalesReportPage from "./pages/SalesReportPage";
import AttendanceReportPage from "./pages/AttendanceReportPage";
import PvsReportPage from "./pages/PvsReportPage";

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
  {
    path: "reports/pvs",
    element: <PvsReportPage />,
    handle: { breadcrumb: [{ label: "Resumen PVS" }] },
  },
  {
    path: "reports/attendance",
    element: <AttendanceReportPage />,
    handle: { breadcrumb: [{ label: "Reportes" }, { label: "Asistencia Web" }] },
  },
  { path: "sales/reports", element: <Navigate to="/reports/sales" replace /> },
];
