import { Navigate, RouterProvider, createBrowserRouter } from "react-router";
import cashFlowRoutes from "@/features/cashFlow/routes";
import maintenanceRoutes from "@/features/maintenance/routes";
import productRoutes from "@/features/products/routes";
import customerRoutes from "../features/customers/routes";
import salesRoutes from "../features/sales/routes";
import posRoutes from "../features/pos/routes";
import purchansesRoutes from "../features/purchanses/routes";
import shoppingRoutes from "../features/shopping/routes";
import sendNoteRoutes from "../features/sendNote/routes";
import serviceInvoiceRoutes from "../features/serviceInvoices/routes";
import boletasSummaryRoutes from "../features/boletasSummary/routes";
import configurationRoutes from "../features/configuration/routes";
import accountingRoutes from "../features/accounting/routes";
import MainLayout from "./layouts/MainLayout";
import { RedirectIfAuthenticated, RequireAuth } from "./guards/AuthGuard";
import LoginPage from "@/features/auth/LoginPage";
import { RouteErrorBoundary } from "./RouteErrorBoundary";

const router = createBrowserRouter([
  {
    path: "/login",
    errorElement: <RouteErrorBoundary />,
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: "/",
    errorElement: <RouteErrorBoundary />,
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/sales/pos" replace /> },
      ...productRoutes,
      ...customerRoutes,
      ...salesRoutes,
      ...posRoutes, // legacy direct routes (kept for compatibility if needed)
      ...purchansesRoutes, // legacy direct routes
      ...shoppingRoutes, // legacy direct routes
      ...sendNoteRoutes, // legacy direct routes
      ...serviceInvoiceRoutes,
      ...boletasSummaryRoutes,
      ...configurationRoutes,
      ...accountingRoutes,
      ...maintenanceRoutes,
      ...cashFlowRoutes,
      { path: "*", element: <h1>404 - Not Found</h1> },
    ],
  },
  { path: "*", element: <Navigate to="/login" replace /> },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
